import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './services/product.service';
import { ProductReadService } from './services/product-read.service';
import { ProductSearchService } from './services/product-search.service';
import { ProductWriteService } from './services/product-write.service';
import { ProductHelperService } from './services/product-helper.service';
import { ProductController } from './controllers/product.controller';
import { Product } from './entities/product.entity';
import { CommonModule } from 'src/common/common.module';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { ProductCategory } from '../product-category/entities/product-category.entity';
import { ReviewModule } from '../review/review.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { ProductVariant } from './entities/product-variant.entity';
import { VendorProductController } from './controllers/vendor-product.controller';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductVariant,
      ProductCategory,
      Store,
    ]),
    ReviewModule,
    CommonModule,
    CartModule,
    StoreModule,
    WishlistModule,
  ],
  controllers: [ProductController, VendorProductController],
  providers: [
    ProductService,
    ProductReadService,
    ProductSearchService,
    ProductWriteService,
    ProductHelperService,
  ],
  exports: [
    ProductService,
    ProductReadService,
    ProductSearchService,
    ProductWriteService,
  ],
})
export class ProductModule {}
