import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';
import { Store } from 'src/store/entities/store.entity';
import { Product } from './entities/product.entity';
import { CommonModule } from 'src/common/common.module';
import { StoreModule } from 'src/store/store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Product, ProductCategory]),
    CommonModule,
    StoreModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
