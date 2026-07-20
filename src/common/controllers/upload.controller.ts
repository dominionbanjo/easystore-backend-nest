import { BadRequestException, Body, Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery, ApiBody } from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../decorators/api-standard-errors.decorator';
import { SuccessResponseDto } from '../dto/api-response.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { UploadService } from '../services/upload.service';

@ApiTags('Uploads')
@ApiBearerAuth('JWT-auth')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('cloudinary-signature')
  @ApiOperation({ summary: 'Generate Cloudinary upload signature', description: 'Generates a signed signature for direct browser-to-Cloudinary uploads.' })
  @ApiQuery({ name: 'subfolder', required: false, type: String, description: 'Subfolder within the store or user folder' })
  @ApiOkResponse({ description: 'Cloudinary signature generated' })
  @ApiStandardErrorResponses()
  getCloudinarySignature(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('subfolder') subfolder?: string,
  ) {
    let folder = user.store_id
      ? `easystore/stores/${user.store_id}`
      : `easystore/users/${user.sub}`;

    if (subfolder) {
      folder = `${folder}/${subfolder}`;
    }

    const data = this.uploadService.generateCloudinarySignature(folder);

    return {
      status: 'success',
      message: 'Cloudinary signature generated',
      data,
    };
  }

  @Delete('cloudinary')
  @ApiOperation({ summary: 'Delete Cloudinary image', description: 'Deletes an image from Cloudinary by its public ID.' })
  @ApiBody({ description: 'Public ID of the image to delete', schema: { properties: { public_id: { type: 'string' } } } })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Image deleted successfully' })
  @ApiStandardErrorResponses()
  async deleteCloudinaryImage(@Body('public_id') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('public_id is required');
    }

    await this.uploadService.deleteSingle(publicId);

    return {
      status: 'success',
      message: 'Image deleted',
    };
  }
}
