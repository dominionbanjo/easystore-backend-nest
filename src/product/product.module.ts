import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductService } from './product.service';
import { ProductController } from './product.controller';

import { Product } from './entities/product.entity';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';
import { Store } from 'src/store/entities/store.entity';

import { CommonModule } from 'src/common/common.module';
import { StoreModule } from 'src/store/store.module';
import { ReviewModule } from 'src/review/review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, Store]),
    ReviewModule,
    CommonModule,
    StoreModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
