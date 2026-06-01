// src/common/controllers/upload.controller.ts
import { Body, Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import cloudinary from 'cloudinary';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor() {
    // ✅ Ensure Cloudinary is configured once
    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * 🔐 Generate Cloudinary signature for direct browser uploads
   * GET /uploads/cloudinary-signature
   */
  @Get('cloudinary-signature')
  getCloudinarySignature(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('subfolder') subfolder?: string,
  ) {
    const timestamp = Math.floor(Date.now() / 1000);

    // 🔒 Lock uploads to store or user scope
    let folder = user.store_id
      ? `easystore/stores/${user.store_id}`
      : `easystore/users/${user.sub}`;

    if (subfolder) {
      folder = `${folder}/${subfolder}`;
    }

    const signature = cloudinary.v2.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUD_API_SECRET!,
    );

    return {
      status: 'success',
      message: 'Cloudinary signature generated',
      data: {
        signature,
        timestamp,
        folder,
        apiKey: process.env.CLOUD_API_KEY,
        cloudName: process.env.CLOUD_NAME,
      },
    };
  }

  @Delete('cloudinary')
  async deleteCloudinaryImage(
    @Body('public_id') publicId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    if (!publicId) {
      return { status: 'error', message: 'public_id required' };
    }

    await cloudinary.v2.uploader.destroy(publicId);

    return {
      status: 'success',
      message: 'Image deleted',
    };
  }
}
