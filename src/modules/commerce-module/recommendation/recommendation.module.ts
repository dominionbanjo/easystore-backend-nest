import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { Cart } from '../cart/entities/cart.entity';
import { Order } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { ProductCustomer } from '../product/entities/product-customer.entity';
import { Wishlist } from '../wishlist/entities/wishlist.entity';
import { WishlistModule } from '../wishlist/wishlist.module';
import { RecommendationController } from './controllers/recommendation.controller';
import { UserPreference } from './entities/user-preference.entity';
import { RecommendationService } from './services/recommendation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Order,
      Cart,
      Wishlist,
      ProductCustomer,
      UserPreference,
    ]),
    WishlistModule,
    CacheModule,
  ],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
