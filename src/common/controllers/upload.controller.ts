import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import cloudinary from 'cloudinary';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Get('cloudinary-signature')
  getCloudinarySignature(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const timestamp = Math.floor(Date.now() / 1000);

    const folder = user.store_id
      ? `easystore/stores/${user.store_id}`
      : 'easystore/users';

    const signature = cloudinary.v2.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET!,
    );

    return {
      status: 'success',
      message: 'Request successful',
      data: {
        signature,
        timestamp,
        folder,
        apiKey: process.env.CLOUD_API_KEY,
        cloudName: process.env.CLOUD_NAME,
      },
    };
  }
}
