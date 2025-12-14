// src/store/dto/update-store.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsArray, IsEmail } from 'class-validator';
import * as storeEntity from '../entities/store.entity';

class UpdateStoreBaseDto {
  @IsOptional()
  @IsString()
  store_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  category_ids?: string[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  address?: storeEntity.IStoreAddress;
}

export class UpdateStoreDto extends PartialType(UpdateStoreBaseDto) {}
