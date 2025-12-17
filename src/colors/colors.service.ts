import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { ProductColor } from './entities/color.entity';

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE
  ──────────────────────────────────────────────── */
  async create(dto: CreateColorDto) {
    const exists = await this.colorRepo.exist({
      where: [{ name: dto.name }, { hex: dto.hex }],
    });

    if (exists) {
      throw new BadRequestException(
        'Color with same name or hex already exists',
      );
    }

    const color = this.colorRepo.create(dto);
    const saved = await this.colorRepo.save(color);

    return {
      message: 'Color created successfully',
      color: saved,
    };
  }

  /* ────────────────────────────────────────────────
     READ ALL
  ──────────────────────────────────────────────── */
  async findAll() {
    const colors = await this.colorRepo.find({
      select: ['id', 'name', 'hex'],
      order: { name: 'ASC' },
    });

    return {
      message: 'Colors retrieved successfully',
      data: colors,
    };
  }

  /* ────────────────────────────────────────────────
     READ ONE
  ──────────────────────────────────────────────── */
  async findOne(id: string) {
    const color = await this.colorRepo.findOne({
      where: { id },
    });

    if (!color) {
      throw new NotFoundException('Color not found');
    }

    return {
      message: 'Color retrieved successfully',
      color,
    };
  }

  /* ────────────────────────────────────────────────
     UPDATE
  ──────────────────────────────────────────────── */
  async update(id: string, dto: UpdateColorDto) {
    const color = await this.colorRepo.findOne({
      where: { id },
    });

    if (!color) {
      throw new NotFoundException('Color not found');
    }

    // prevent duplicates
    if (dto.name || dto.hex) {
      const exists = await this.colorRepo
        .createQueryBuilder('color')
        .where('(color.name = :name OR color.hex = :hex)', {
          name: dto.name ?? color.name,
          hex: dto.hex ?? color.hex,
        })
        .andWhere('color.id != :id', { id })
        .getOne();

      if (exists) {
        throw new BadRequestException(
          'Another color with same name or hex exists',
        );
      }
    }

    Object.assign(color, dto);
    const updated = await this.colorRepo.save(color);

    return {
      message: 'Color updated successfully',
      color: updated,
    };
  }

  /* ────────────────────────────────────────────────
     DELETE
  ──────────────────────────────────────────────── */
  async remove(id: string) {
    const exists = await this.colorRepo.exist({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException('Color not found');
    }

    await this.colorRepo.delete(id);

    return {
      message: 'Color deleted successfully',
    };
  }
}
