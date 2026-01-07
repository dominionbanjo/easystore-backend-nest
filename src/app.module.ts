import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

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
    // 🌍 ENV CONFIG
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 🗄️ DATABASE
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false, // ❌ never true in production
      ssl: {
        rejectUnauthorized: false, // required for Neon / managed PG
      },
    }),

    // 🚦 RATE LIMITING
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60, // seconds
          limit: 100, // requests per minute
        },
        {
          name: 'auth',
          ttl: 60,
          limit: 5, // login / register protection
        },
      ],
    }),

    // 🔐 CORE MODULES
    AuthModule,
    UsersModule,

    // 🛒 COMMERCE
    CartModule,
    OrderModule,
    DeliveryModule,
    EscrowModule,
    PayoutModule,
    TransactionsModule,

    // 🏪 STORE / PRODUCT
    StoreModule,
    StoreAnalyticsModule,
    ProductModule,
    ProductCategoryModule,
    ColorsModule,
    ReviewModule,
    WishlistModule,

    // 📧 / ⚡ INFRA
    EmailModule,
    CacheModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,

    // ✅ GLOBAL RATE-LIMIT GUARD (REQUIRED)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
