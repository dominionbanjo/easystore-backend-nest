import { Injectable } from '@nestjs/common';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { UpdateEscrowDto } from './dto/update-escrow.dto';

@Injectable()
export class EscrowService {
  create(createEscrowDto: CreateEscrowDto) {
    return 'This action adds a new escrow';
  }

  findAll() {
    return `This action returns all escrow`;
  }

  findOne(id: number) {
    return `This action returns a #${id} escrow`;
  }

  update(id: number, updateEscrowDto: UpdateEscrowDto) {
    return `This action updates a #${id} escrow`;
  }

  remove(id: number) {
    return `This action removes a #${id} escrow`;
  }
}
