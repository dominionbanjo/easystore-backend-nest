import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StoreService } from './store.service';
import { StoreController } from './store.controller';

import { Store } from './entities/store.entity';
import { Product } from 'src/product/entities/product.entity';
import { User } from 'src/users/entities/user.entity';

import { CacheModule } from 'src/cache/cache.module';
import { CommonModule } from 'src/common/common.module'; // <-- your module

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Product, User]),
    CacheModule,
    CommonModule,
  ],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
