import { Module } from '@nestjs/common';
import { UploadService } from './services/upload.service';
import { PaystackService } from './services/paystack.service';
import { UploadController } from './controllers/upload.controller';

@Module({
  controllers: [UploadController],
  providers: [UploadService, PaystackService],
  exports: [UploadService, PaystackService],
})
export class CommonModule {}
