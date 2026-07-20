import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserAddress } from './entities/user-address.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CommonModule } from 'src/common/common.module';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { BuyerEngagementCronService } from './services/buyer-engagement-cron.service';
import { EmailModule } from 'src/modules/shared-module/email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Store, StoreStaff, UserAddress]), CommonModule, EmailModule],
  controllers: [UsersController],
  providers: [UsersService, BuyerEngagementCronService],
  exports: [UsersService],
})
export class UsersModule {}
