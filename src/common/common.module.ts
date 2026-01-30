import { Module } from '@nestjs/common';
import { UploadService } from './services/upload.service';
import { PaystackService } from './services/paystack.service';
import { UploadController } from './controllers/upload.controller';
import { PaystackController } from './controllers/paystack.controller';

@Module({
  controllers: [UploadController, PaystackController],
  providers: [UploadService, PaystackService],
  exports: [UploadService, PaystackService],
})
export class CommonModule {}
