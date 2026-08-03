import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreStaff, User, Order])],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
