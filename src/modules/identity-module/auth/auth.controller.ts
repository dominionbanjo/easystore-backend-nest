import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiBody } from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account', description: 'Creates a new user account and sends an OTP verification email.' })
  @ApiCreatedResponse({ description: 'Account created successfully' })
  @ApiStandardErrorResponses()
  async register(@Body() dto: CreateAccountDto) {
    return this.authService.signUp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password', description: 'Authenticates a user and returns JWT access and refresh tokens.' })
  @ApiOkResponse({ description: 'Login successful' })
  @ApiStandardErrorResponses()
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @ApiOperation({ summary: 'Login or register with Google', description: 'Authenticates or registers a user via a Google OAuth token.' })
  @ApiOkResponse({ description: 'Google authentication successful' })
  @ApiStandardErrorResponses()
  continueWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.continueWithGoogle(dto.token);
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code', description: 'Verifies the one-time password sent to the user email during registration.' })
  @ApiOkResponse({ description: 'OTP verified successfully' })
  @ApiStandardErrorResponses()
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend OTP code', description: 'Resends a new one-time password to the user email.' })
  @ApiOkResponse({ description: 'OTP resent successfully' })
  @ApiStandardErrorResponses()
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset', description: 'Sends a password reset OTP to the user email.' })
  @ApiOkResponse({ description: 'Password reset OTP sent' })
  @ApiStandardErrorResponses()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with OTP', description: 'Resets the user password using the OTP code and new password.' })
  @ApiOkResponse({ description: 'Password reset successfully' })
  @ApiStandardErrorResponses()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout current user', description: 'Invalidates the refresh token for the currently authenticated user.' })
  @ApiOkResponse({ description: 'User logged out successfully' })
  @ApiStandardErrorResponses()
  logout(@Req() req: Request & { user: JwtAuthUser }) {
    return this.authService.logout(req.user.sub);
  }

  @Post('google-risc')
  @ApiOperation({ summary: 'Receive Google RISC security events', description: 'Technical endpoint to receive cross-account protection security events from Google.' })
  @ApiBody({ description: 'Google RISC event payload', type: Object })
  @ApiOkResponse({ description: 'RISC event processed' })
  @ApiStandardErrorResponses()
  async googleRisc(@Body() body: Record<string, unknown>) {
    const tokenString = typeof body === 'string' ? body : (body?.token as string);

    if (!tokenString) {
      console.warn(
        'Received empty body for RISC event. Check body-parser configuration.',
      );
      throw new Error('Missing token in body');
    }

    return this.authService.handleRiscEvent(tokenString);
  }
}
