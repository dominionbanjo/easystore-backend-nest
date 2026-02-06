import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart } from './entities/cart.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/entities/product.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, Product, ProductColor])],

  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
