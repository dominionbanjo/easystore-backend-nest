import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './product.service';
import { ProductController } from './controllers/product.controller';
import { Product } from './entities/product.entity';
import { CommonModule } from 'src/common/common.module';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { ProductCategory } from '../product-category/entities/product-category.entity';
import { ReviewModule } from '../review/review.module';
import { WishlistModule } from '../wishlist/wishlist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, Store]),
    ReviewModule,
    CommonModule,
    StoreModule,
    WishlistModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
