import { Module } from '@nestjs/common';
import { UploadService } from './services/upload.service';
import { PaystackService } from './services/paystack.service';

@Module({
  providers: [UploadService, PaystackService],
  exports: [UploadService, PaystackService],
})
export class CommonModule {}
