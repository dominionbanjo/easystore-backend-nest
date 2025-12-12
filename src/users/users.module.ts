import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { Store } from 'src/store/entities/store.entity';
import { Product } from 'src/product/entities/product.entity';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';

import { UploadService } from 'src/common/services/upload.service';
import { PaystackService } from 'src/common/services/paystack.service';

import { WishlistModule } from 'src/wishlist/wishlist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Store, Product]),
    WishlistModule, // <---- FIX
  ],
  controllers: [UsersController],
  providers: [UsersService, UploadService, PaystackService],
  exports: [UsersService],
})
export class UsersModule {}
