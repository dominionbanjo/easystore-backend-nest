import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OAuth2Client,
  TokenPayload,
  GoogleAuth,
  JWT,
} from 'google-auth-library';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { EmailVerificationService } from 'src/modules/shared-module/email/services/email-verification.service';
import { ResetPasswordMailService } from 'src/modules/shared-module/email/services/reset-password-mail.service';
import { WelcomeMailService } from 'src/modules/shared-module/email/services/welcome-mail.service';
import { AdminNotifyMailService } from 'src/modules/shared-module/email/services/admin-notify-mail.service';
import { StoreWelcomeMailService } from 'src/modules/shared-module/email/services/store-welcome-mail.service';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { SalesChannel, User } from '../users/entities/user.entity';
import { toUTCDate } from 'src/utils/time/toUTCDate';
import { comparePassword, hashPassword } from 'src/utils/auth/passwordUtil';
import { sanitizeUser } from 'src/utils/response/sanitizeUser';
import createHash from 'src/utils/auth/createHash';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly storeService: StoreService,
    private readonly emailVerification: EmailVerificationService,
    private readonly welcomeMail: WelcomeMailService,
    private readonly resetPasswordVerification: ResetPasswordMailService,
    private readonly adminNotifyMail: AdminNotifyMailService,
    private readonly storeWelcomeMail: StoreWelcomeMailService,
    private readonly dataSource: DataSource,
    @InjectRepository(StoreStaff)
    private readonly storeStaffRepo: Repository<StoreStaff>,
  ) {}

  private async generateUniqueUsername(
    firstName: string,
    lastName?: string,
  ): Promise<string> {
    const base = `${firstName}${lastName ?? ''}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    let username = base;
    let counter = 0;

    while (await this.users.existsByUsername(username)) {
      counter += 1;
      username = `${base}${counter}`;
    }

    return username;
  }

  // ------------------------------------------------------------------
  // SIGNUP
  // ------------------------------------------------------------------
  async signUp(dto: CreateAccountDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new BadRequestException('User already exists');

    // ---------------------------
    // Vendor validation
    // ---------------------------
    if (dto.account_type === 'vendor') {
      if (!dto.store_name || !dto.description) {
        throw new BadRequestException(
          'Vendors must provide both store name and description',
        );
      }
    }

    // ---------------------------
    // Sales channel validation
    // ---------------------------
    const allowed: SalesChannel[] = [
      'whatsapp',
      'instagram',
      'facebook',
      'tiktok',
      'other',
    ];

    let salesChannel: SalesChannel | null = null;
    if (dto.current_sales_channel) {
      const formatted = dto.current_sales_channel.trim().toLowerCase();
      if (!allowed.includes(formatted as SalesChannel)) {
        throw new BadRequestException('Invalid sales channel');
      }
      salesChannel = formatted as SalesChannel;
    }

    // ---------------------------
    // OTP + Password
    // ---------------------------
    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10) as Date;
    const hashed = await hashPassword(dto.password);

    const username = await this.generateUniqueUsername(
      dto.first_name,
      dto.last_name,
    );

    // ---------------------------
    // 🔒 TRANSACTIONAL CREATION
    // ---------------------------
    const result = await this.dataSource.transaction(async (manager) => {
      // 1️⃣ Create USER
      const user = await this.users.create(
        {
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          phone_number: dto.phone_number ?? null,
          account_type: dto.account_type,
          username,
          referral_code: dto.referral_code ?? null,
          current_sales_channel: salesChannel,
          agree_to_terms: dto.agree_to_terms,
          password: hashed,
          otp,
          otp_expiration,
          email_verified: false,
          signup_medium: 'signed',
          account_status: dto.account_type === 'vendor' ? 'pending' : 'active',
        },
        manager,
      );

      // 2️⃣ If vendor → CREATE STORE
      if (dto.account_type === 'vendor') {
        await this.storeService.createStore(
          {
            user_id: user.id,
            store_name: dto.store_name!,
            description: dto.description,
            email: dto.email,
          },
          manager,
        );
      }

      return user;
    });

    // ---------------------------
    // 3️⃣ Send verification email (Graceful failure)
    // ---------------------------
    try {
      await this.emailVerification.sendVerificationEmail({
        name: dto.first_name,
        email: dto.email,
        otp,
      });

      // Notify Admin
      this.adminNotifyMail
        .notifyNewSignup({
          name: `${dto.first_name} ${dto.last_name}`,
          email: dto.email,
          role: dto.account_type,
        })
        .catch((e) => console.error('Admin Signup Notify Error:', e.message));

      if (dto.account_type === 'user') {
        // Send regular Welcome Email
        await this.welcomeMail.sendWelcomeEmail({
          name: dto.first_name,
          email: dto.email,
          role: 'user',
        });
      }
    } catch (error) {
      console.error('Failed to send onboarding emails:', error);
    }

    // ---------------------------
    // 4️⃣ Auto login
    // ---------------------------
    const { access_token } = this.generateJwt(result);

    return {
      user: sanitizeUser(result),
      access: access_token,
      message: 'Signup Successful',
    };
  }

  // ------------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------------
  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.account_status === 'banned') {
      throw new UnauthorizedException(
        'Your account has been banned. Please contact support.',
      );
    }

    if (user.account_status === 'restricted') {
      throw new UnauthorizedException(
        'Your account is temporarily restricted. Please contact support for more information.',
      );
    }

    // ⭐ Handle users without passwords (e.g. Google Signups)
    if (!user.password) {
      if (user.signup_medium === 'google') {
        throw new BadRequestException(
          'This account was created using Google. Please use "Continue with Google" or reset your password to set a new one.',
        );
      }
      throw new BadRequestException(
        'Password not set for this account. Please use "Forgot Password" to set one.',
      );
    }

    const match = await comparePassword(dto.password, user.password);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.account_type === 'staff') {
      await this.storeStaffRepo.update(
        { user_id: user.id },
        { last_login_at: new Date() },
      );
    }

    const { access_token } = this.generateJwt(user);

    return {
      message: 'Login Successful',
      user: sanitizeUser(user),
      access: access_token,
    };
  }

  // ------------------------------------------------------------------
  // JWT TOKENS
  // ------------------------------------------------------------------
  generateJwt(user: User) {
    return {
      access_token: this.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.account_type,
        status: user.account_status,
        token_version: user.token_version,
      }),
    };
  }

  // ------------------------------------------------------------------
  // GOOGLE AUTH
  // ------------------------------------------------------------------
  async continueWithGoogle(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as
      | (TokenPayload & { picture?: string })
      | null;

    if (!payload) {
      throw new BadRequestException('Invalid Google token');
    }

    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture ?? null;
    const email_verified = payload.email_verified ?? false;
    const sub = payload.sub; // Google ID

    if (!email) {
      throw new BadRequestException('Google account has no email');
    }

    if (!name) {
      throw new BadRequestException('Google account has no display name');
    }

    let user = await this.users.findByEmail(email);

    if (user) {
      // Keep google_id updated
      if (!user.google_id) {
        await this.users.update(user.id, { google_id: sub });
      }
    } else {
      // Try finding by google_id just in case email changed (rare for Google but possible?)
      user = await this.users.findByGoogleId(sub);
    }

    if (!user) {
      const [first, last = ''] = name.trim().split(' ');

      const username = await this.generateUniqueUsername(first, last);

      user = await this.users.create({
        first_name: first,
        last_name: last,
        email,
        username, // ✅ REQUIRED
        email_verified,
        avatar: picture,
        signup_medium: 'google',
        account_status: 'active',
        google_id: sub,
      });

      // Notify Admin
      this.adminNotifyMail
        .notifyNewSignup({
          name: `${first} ${last}`,
          email,
          role: 'user',
        })
        .catch((e) =>
          console.error('Admin Google Signup Notify Error:', e.message),
        );

      // Send Welcome Email
      this.welcomeMail
        .sendWelcomeEmail({
          name: first,
          email,
          role: 'user',
        })
        .catch((e) => console.error('Google Welcome Email Error:', e.message));
    }

    if (user.account_status === 'banned') {
      throw new UnauthorizedException(
        'Your account has been banned. Please contact support.',
      );
    }

    if (user.account_status === 'restricted') {
      throw new UnauthorizedException(
        'Your account is temporarily restricted. Please contact support for more information.',
      );
    }

    const { access_token } = this.generateJwt(user);

    return {
      user: sanitizeUser(user),
      access: access_token,
      message: 'Login Successful',
    };
  }

  // ------------------------------------------------------------------
  // VERIFY OTP
  // ------------------------------------------------------------------
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');

    if (user.otp !== dto.otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (!user.otp_expiration) {
      throw new BadRequestException('OTP expiration missing');
    }

    if (user.otp_expiration.getTime() < Date.now()) {
      throw new BadRequestException('OTP expired');
    }

    await this.users.update(user.id, {
      email_verified: true,
      otp: null,
      otp_expiration: null,
    });

    return { message: 'Email verified successfully' };
  }

  // ------------------------------------------------------------------
  // RESEND OTP
  // ------------------------------------------------------------------
  async resendOtp(dto: ResendOtpDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');
    if (user.email_verified === true)
      throw new BadRequestException('User Email Already Verified');

    // Prevent spamming / rate limiting
    if (user.otp_expiration instanceof Date) {
      const diff = user.otp_expiration.getTime() - Date.now();
      if (diff > 0) {
        throw new BadRequestException(
          'Please wait before requesting a new OTP',
        );
      }
    }

    // Generate new OTP + expiration
    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10) as Date;

    // Save new OTP
    await this.users.update(user.id, {
      otp,
      otp_expiration,
    });

    // 📩 Send verification email again
    await this.emailVerification.sendVerificationEmail({
      name: user.first_name,
      email: user.email,
      otp,
    });

    return { message: 'A new OTP has been sent to your email' };
  }

  // ------------------------------------------------------------------
  // FORGOT PASSWORD
  // ------------------------------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.users.findByEmailWithToken(dto.email);

    // Always return generic response for security
    if (!user) {
      return { message: 'Password reset mail sent, please check your mail' };
    }

    // ⭐ Prevent spamming (similar to resendOtp)
    if (user.password_token_expiration_date instanceof Date) {
      const diff = user.password_token_expiration_date.getTime() - Date.now();

      if (diff > 0) {
        return { message: 'Password reset mail sent, please check your mail' };
      }
    }

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = createHash(rawToken);
    const expiration = toUTCDate(10) as Date;

    // Store hashed token
    await this.users.update(user.id, {
      password_token: hashedToken,
      password_token_expiration_date: expiration,
    });

    const origin = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Send email
    await this.resetPasswordVerification.sendResetPasswordEmail({
      name: user.first_name,
      email: user.email,
      token: rawToken,
      origin,
    });

    return { message: 'Password reset mail sent, please check your mail' };
  }

  // ------------------------------------------------------------------
  // RESET PASSWORD
  // ------------------------------------------------------------------
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.users.findByEmailWithToken(dto.email);
    if (!user) throw new UnauthorizedException('Invalid request');

    const hashedToken = createHash(dto.token);
    if (
      user.password_token !== hashedToken ||
      !user.password_token_expiration_date ||
      user.password_token_expiration_date.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hashedPassword = await hashPassword(dto.password);

    await this.users.update(user.id, {
      password: hashedPassword,
      password_token: null,
      password_token_expiration_date: null,
      must_change_password: false,
      token_version: (user.token_version ?? 0) + 1,
    });

    return { message: 'Password reset successful' };
  }

  // ------------------------------------------------------------------
  // RISC STREAM REGISTRATION
  // ------------------------------------------------------------------
  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Skipping RISC stream registration (not production)');
      return;
    }

    try {
      await this.registerRiscStream();
    } catch (error) {
      console.error('Failed to register RISC stream:', error);
    }
  }

  private async registerRiscStream() {
    const receiverUrl = `${process.env.BASE_URL}/auth/google-risc`;
    console.log(`Registering RISC stream for endpoint: ${receiverUrl}`);

    let credentials;

    // Use full JSON from env (Recommended for Render/Heroku)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        credentials = {
          client_email: json.client_email?.trim(),
          private_key: json.private_key?.trim(),
        };
      } catch (error) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON', error);
      }
    }

    if (!credentials || !credentials.private_key || !credentials.client_email) {
      console.error(
        'Missing or invalid Google Service Account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON.',
      );
      return;
    }

    /* DEBUGGING EMAIL for Hidden Chars */
    const email = credentials.client_email;
    console.log(`[RISC Debug] Email: "${email}" (Length: ${email.length})`);
    // Print explicit char codes to detect hidden utf8 chars
    // console.log(`[RISC Debug] Email CharCodes: ${email.split('').map(c => c.charCodeAt(0)).join(',')}`);

    /* DEBUGGING KEY FORMAT */
    // Ensure key ends with newline (PEM standard)
    if (!credentials.private_key.endsWith('\n')) {
      credentials.private_key += '\n';
    }

    const key = credentials.private_key;
    const keyLength = key.length;
    const hasHeader = key.includes('-----BEGIN PRIVATE KEY-----');
    const hasFooter = key.includes('-----END PRIVATE KEY-----');
    const newlines = (key.match(/\n/g) || []).length;

    console.log(`[RISC Debug] Key Length: ${keyLength}`);
    console.log(`[RISC Debug] Has Header: ${hasHeader}`);
    console.log(`[RISC Debug] Has Footer: ${hasFooter}`);
    console.log(`[RISC Debug] Newlines count: ${newlines}`);
    console.log(`[RISC Debug] Key Start: ${key.substring(0, 35)}...`);
    console.log(
      `[RISC Debug] Key End: ...${key.substring(key.length - 35).replace(/\n/g, '\\n')}`,
    );

    if (!hasHeader || !hasFooter || newlines < 5) {
      console.error(
        '[RISC Error] Private key seems malformed (missing headers or newlines). Check env vars.',
      );
    }
    console.log(
      `[RISC Debug] Using Service Account: ${credentials.client_email}`,
    );

    if (!hasHeader || !hasFooter || newlines < 5) {
      console.error(
        '[RISC Error] Private key seems malformed (missing headers or newlines). Check env vars.',
      );
    }

    try {
      // Use JWT Client directly for explicit control
      const client = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/riscconfiguration'],
      });

      const token = await client.getAccessToken();

      if (!token.token) {
        throw new Error('Failed to get access token (empty token returned)');
      }

      // 1. Update Stream
      const response = await fetch(
        'https://risc.googleapis.com/v1beta/stream:update',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            delivery: {
              delivery_method:
                'https://schemas.openid.net/secevent/risc/delivery-method/push',
              url: receiverUrl,
            },
            events_requested: [
              'https://schemas.openid.net/secevent/risc/event-type/account-credentials-change-required',
              'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
              'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
              'https://schemas.openid.net/secevent/risc/event-type/verification',
            ],
          }),
        },
      );

      const data = await response.json();
      console.log('RISC Stream Registration Result:', data);
    } catch (error: any) {
      console.error('[RISC Error] Failed to register stream. Details:', {
        message: error.message,
        response: error.response?.data,
        cause: error.cause, // catch-all for nested errors
      });
      // Re-throw if critical
      // throw error;
    }
  }

  // ------------------------------------------------------------------
  // RISC (Cross-Account Protection)
  // ------------------------------------------------------------------
  async handleRiscEvent(token: string) {
    let payload;
    try {
      // Verify the token (SET)
      // verifyIdToken fetches Google's public keys and verifies the signature
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new BadRequestException('Invalid RISC token');
    }

    if (!payload || !payload['events']) {
      throw new BadRequestException('Invalid RISC payload: missing events');
    }

    // 1. Handle Verification Event
    if (
      payload['events'][
        'https://schemas.openid.net/secevent/risc/event-type/verification'
      ]
    ) {
      return { message: 'Verification successful' };
    }

    // 2. Extract User Identifier (Subject)
    // The subject claim identifies the user. It corresponds to the 'sub' in ID tokens.
    // We try to find by Google ID first, then fallback to email.
    const sub = payload.sub;
    const email = payload.email || payload.subject?.email; // Some events might nest it

    let user: User | null = null;

    // A. Try finding by Google ID (sub) - Most reliable
    if (sub) {
      user = await this.users.findByGoogleId(sub);
    }

    // B. Fallback to Email if not found by sub
    if (!user && email) {
      user = await this.users.findByEmail(email);

      // Note: We could link the account here, but it's safer to do it on login.
    }

    if (!user) {
      // We can't identify the user to protect.
      console.warn(
        `RISC event received for unknown user. Sub: ${sub}, Email: ${email}`,
      );
      return { message: 'Event received' };
    }

    // 3. Handle Critical Events
    // We look for events that require session revocation
    const criticalEvents = [
      'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
      'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
      'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required',
    ];

    const hasCriticalEvent = criticalEvents.some(
      (type) => payload['events'][type],
    );

    if (hasCriticalEvent) {
      console.log(`Revoking sessions for user ${user.id} due to RISC event`);
      // Invalidate all tokens for this user
      await this.users.incrementTokenVersion(user.id);
    }

    return { message: 'Event processed' };
  }

  // ------------------------------------------------------------------
  // LOGOUT (Invalidate Token)
  // ------------------------------------------------------------------
  async logout(userId: string) {
    await this.users.incrementTokenVersion(userId);
    return { message: 'Logged out successfully' };
  }
}
