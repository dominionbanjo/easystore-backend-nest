import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payout])],
  controllers: [PayoutController],
  providers: [PayoutService],
  exports: [TypeOrmModule], // <-- REQUIRED
})
export class PayoutModule {}
