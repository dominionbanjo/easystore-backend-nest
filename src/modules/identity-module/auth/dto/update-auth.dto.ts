import { PartialType } from '@nestjs/swagger';
import { CreateAccountDto } from './create-account.dto';

export class UpdateAuthDto extends PartialType(CreateAccountDto) {}
