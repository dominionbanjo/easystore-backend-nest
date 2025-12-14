import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CartModule } from './cart/cart.module';
import { ColorsModule } from './colors/colors.module';
import { DeliveryModule } from './delivery/delivery.module';
import { EscrowModule } from './escrow/escrow.module';
import { OrderModule } from './order/order.module';
import { PayoutModule } from './payout/payout.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductModule } from './product/product.module';
import { ReviewModule } from './review/review.module';
import { StoreModule } from './store/store.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { EmailModule } from './email/email.module';
import { CacheModule } from './cache/cache.module';
import { StoreAnalyticsModule } from './store-analytics/store-analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL, // Neon connection string
      autoLoadEntities: true,
      synchronize: true, // turn off in production
      ssl: {
        rejectUnauthorized: false, // required for Neon
      },
    }),

    AuthModule,

    UsersModule,

    CartModule,

    ColorsModule,

    DeliveryModule,

    EscrowModule,

    OrderModule,

    PayoutModule,

    ProductCategoryModule,

    ProductModule,

    ReviewModule,

    StoreModule,

    TransactionsModule,

    WishlistModule,

    EmailModule,

    CacheModule,

    StoreAnalyticsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
