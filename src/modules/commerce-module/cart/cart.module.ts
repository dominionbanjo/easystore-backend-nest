import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart } from './entities/cart.entity';
import { Product } from '../product/entities/product.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, Product, ProductColor]),
    CommonModule,
  ],

  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
