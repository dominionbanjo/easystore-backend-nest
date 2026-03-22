import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { CreateAccountDto } from './dto/create-account.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthUser } from './strategies/jwt.strategy';
import { GoogleLoginDto } from './dto/google-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // REGISTER
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('register')
  async register(@Body() dto: CreateAccountDto) {
    return this.authService.signUp(dto);
  }

  // LOGIN
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  continueWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.continueWithGoogle(dto.token);
  }

  // VERIFY OTP
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // RESEND OTP
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // FORGOT PASSWORD
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // RESET PASSWORD
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // LOGOUT
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request & { user: JwtAuthUser }) {
    return this.authService.logout(req.user.sub);
  }

  // ------------------------------------------------------------------
  // GOOGLE RISC (Cross-Account Protection)
  // Endpoint to receive security events from Google
  // Note: Ensure your server can parse 'application/secevent+jwt' content type as text/string/buffer.
  // Additional middleware may be required in app.module or main.ts to handle this specific content type.
  // ------------------------------------------------------------------
  @Post('google-risc')
  async googleRisc(@Body() token: any) {
    // If body parser handles it as text/string, 'token' is the string.
    // If it's JSON { "token": "..." }, 'token' is object. We assume direct token string or {token: string} structure if wrappers are used.

    // Check if token is the body itself (string) or property
    const tokenString = typeof token === 'string' ? token : token?.token;

    if (!tokenString) {
      // Fallback: If body parser didn't parse it (empty object), logging error.
      // In real setup, you must configure body-parser for 'application/secevent+jwt'.
      console.warn(
        'Received empty body for RISC event. Check body-parser configuration.',
      );
      throw new Error('Missing token in body');
    }

    return this.authService.handleRiscEvent(tokenString);
  }
}
