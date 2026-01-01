import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import * as crypto from 'crypto';

import { UsersService } from '../users/users.service';

import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateAccountDto } from './dto/create-account.dto';

import {
  hashPassword,
  comparePassword,
} from 'src/common/utils/auth/passwordUtil';
import { toUTCDate } from 'src/common/utils/time/toUTCDate';
import { SalesChannel, User } from 'src/users/entities/user.entity';
import { StoreService } from 'src/store/store.service';
import { EmailVerificationService } from 'src/email/services/email-verification.service';
import { ResetPasswordMailService } from 'src/email/services/reset-password-mail.service';
import createHash from 'src/common/utils/auth/createHash';

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly storeService: StoreService,
    private readonly emailVerification: EmailVerificationService,
    private readonly resetPasswordVerification: ResetPasswordMailService,
  ) {}

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      account_type: user.account_type,
      store_id: user.store_id,
      store_name: user.store_name,
      username: user.username,
      avatar: user.avatar,
      email_verified: user.email_verified,
      signup_medium: user.signup_medium,
      created_at: user.created_at,
    };
  }

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

    // Validate vendor requirements
    if (dto.account_type === 'vendor') {
      if (!dto.store_name || !dto.description) {
        throw new BadRequestException(
          'Vendors must provide both store name and description',
        );
      }
    }

    // Validate sales channel
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

    // Create OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10) as Date;

    // Create hashed password
    const hashed = await hashPassword(dto.password);

    const username =
      dto.account_type === 'vendor'
        ? await this.generateUniqueUsername(dto.first_name, dto.last_name)
        : null;

    // ---------------------------
    // 1️⃣ Create user
    // ---------------------------
    const user = await this.users.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      phone_number: dto.phone_number ?? null,
      account_type: dto.account_type,
      store_name: dto.store_name ?? null,
      username: username || undefined,
      referral_code: dto.referral_code ?? null,
      current_sales_channel: salesChannel,
      agree_to_terms: dto.agree_to_terms,
      password: hashed,
      otp,
      otp_expiration,
      email_verified: false,
      signup_medium: 'signed',
    });

    // ---------------------------
    // 2️⃣ If vendor → CREATE STORE using StoreService
    // ---------------------------
    if (dto.account_type === 'vendor') {
      try {
        const store = await this.storeService.createStore({
          user_id: user.id,
          email: dto.email,
          store_name: dto.store_name!,
          description: dto.description,
        });

        // Link user to new store
        await this.users.update(user.id, {
          store_id: store.id,
          store_name: store.store_name,
        });

        user.store_id = store.id;
      } catch (e) {
        // rollback user on failure
        await this.users.deleteUser(user.id);
        throw e;
      }
    }

    // ---------------------------
    // 3️⃣ Send Email Verification
    // ---------------------------
    await this.emailVerification.sendVerificationEmail({
      name: dto.first_name,
      email: dto.email,
      otp,
    });

    // ---------------------------
    // 4️⃣ Auto-login (Generate JWT)
    // ---------------------------
    const { access_token } = this.generateJwt(user);
    // ---------------------------
    // 4️⃣ Return Safe Response
    // ---------------------------
    return {
      user: this.sanitizeUser(user),
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

    const match = await comparePassword(dto.password, user.password!);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { access_token } = this.generateJwt(user);

    return {
      message: 'Login Successful',
      user: this.sanitizeUser(user),
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
    if (!payload) throw new BadRequestException('Invalid Google token');

    const email = payload.email;
    const name = payload.name;
    if (!email) throw new BadRequestException('Google account has no email');
    if (!name)
      throw new BadRequestException('Google account has no display name');

    const picture = payload.picture ?? null;
    const email_verified = payload.email_verified ?? false;

    let user = await this.users.findByEmail(email);

    if (!user) {
      const [first, last = ''] = name.trim().split(' ');

      user = await this.users.create({
        first_name: first,
        last_name: last,
        email,
        email_verified,
        avatar: picture,
        signup_medium: 'google',
      });
    }

    const { access_token } = this.generateJwt(user);

    return {
      user: this.sanitizeUser(user),
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
    const user = await this.users.findByEmail(dto.email);

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
    const user = await this.users.findByEmail(dto.email);
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
    });

    return { message: 'Password reset successful' };
  }

  // ------------------------------------------------------------------
  // LOGOUT (Invalidate Token)
  // ------------------------------------------------------------------
  async logout(userId: string) {
    await this.users.incrementTokenVersion(userId);
    return { message: 'Logged out successfully' };
  }
}
