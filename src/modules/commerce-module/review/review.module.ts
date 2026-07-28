import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductReview } from './entities/review.entity';
import { StoreReview } from './entities/store-review.entity';
import { ProductReviewService } from './review.service';
import { ProductReviewController, StoreReviewController } from './review.controller';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { Product } from '../product/entities/product.entity';
import { ProductCustomer } from '../product/entities/product-customer.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductReview, StoreReview, Product, ProductCustomer, User]), CacheModule],
  controllers: [ProductReviewController, StoreReviewController],
  providers: [ProductReviewService],
  exports: [TypeOrmModule],
})
export class ReviewModule {}
