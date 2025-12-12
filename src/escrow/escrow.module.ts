import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Escrow])],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [TypeOrmModule], // important for User relations
})
export class EscrowModule {}
