import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductCategory } from './entities/product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductCategory]), // ✅ REQUIRED
  ],
  controllers: [ProductCategoryController],
  providers: [ProductCategoryService],
  exports: [
    TypeOrmModule, // ✅ allows other modules to use ProductCategory
  ],
})
export class ProductCategoryModule {}
