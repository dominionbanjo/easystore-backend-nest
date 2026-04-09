import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductReview } from './entities/review.entity';
import { ProductReviewService } from './review.service';
import { ProductReviewController } from './review.controller';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { Product } from '../product/entities/product.entity';
import { ProductCustomer } from '../product/entities/product-customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductReview, Product, ProductCustomer]), CacheModule],
  controllers: [ProductReviewController],
  providers: [ProductReviewService],
  exports: [TypeOrmModule],
})
export class ReviewModule {}
