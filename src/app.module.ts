import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CartModule } from './modules/commerce-module/cart/cart.module';
import { DeliveryModule } from './modules/commerce-module/delivery/delivery.module';
import { OrderModule } from './modules/commerce-module/order/order.module';
import { ProductCategoryModule } from './modules/commerce-module/product-category/product-category.module';
import { ProductModule } from './modules/commerce-module/product/product.module';
import { ReviewModule } from './modules/commerce-module/review/review.module';
import { WishlistModule } from './modules/commerce-module/wishlist/wishlist.module';
import { EscrowModule } from './modules/finance-module/escrow/escrow.module';
import { PayoutModule } from './modules/finance-module/payout/payout.module';
import { TransactionsModule } from './modules/finance-module/transactions/transactions.module';
import { AuthModule } from './modules/identity-module/auth/auth.module';
import { UsersModule } from './modules/identity-module/users/users.module';
import { CacheModule } from './modules/shared-module/cache/cache.module';
import { ColorsModule } from './modules/shared-module/colors/colors.module';
import { EmailModule } from './modules/shared-module/email/email.module';
import { StoreAnalyticsModule } from './modules/vendor-module/store-analytics/store-analytics.module';
import { StoreModule } from './modules/vendor-module/store/store.module';
import { AdminModule } from './modules/admin-module/admin-module.module';

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
    AdminModule,
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
