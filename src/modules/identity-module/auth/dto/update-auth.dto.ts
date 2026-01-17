import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';

export class UpdateAuthDto extends PartialType(CreateAccountDto) {}
