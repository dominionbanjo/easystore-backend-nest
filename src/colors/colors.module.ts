import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColorsService } from './colors.service';
import { ColorsController } from './colors.controller';
import { ProductColor } from './entities/color.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductColor])],
  controllers: [ColorsController],
  providers: [ColorsService],
})
export class ColorsModule {}
