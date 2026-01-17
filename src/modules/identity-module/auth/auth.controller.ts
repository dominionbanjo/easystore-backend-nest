import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';

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
  @Post('register')
  async register(@Body() dto: CreateAccountDto) {
    return this.authService.signUp(dto);
  }

  // LOGIN
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  continueWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.continueWithGoogle(dto.token);
  }

  // VERIFY OTP
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // RESEND OTP
  @Post('resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // FORGOT PASSWORD
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // RESET PASSWORD
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
}
