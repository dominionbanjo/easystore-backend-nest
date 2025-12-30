import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductReview } from './entities/review.entity';
import { ProductReviewService } from './review.service';
import { ProductReviewController } from './review.controller';
import { CacheModule } from 'src/cache/cache.module';
import { Product } from 'src/product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductReview, Product]), CacheModule],
  controllers: [ProductReviewController],
  providers: [ProductReviewService],
  exports: [TypeOrmModule],
})
export class ReviewModule {}
