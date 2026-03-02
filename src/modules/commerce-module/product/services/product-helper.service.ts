import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
import { ProductCategory } from '../../product-category/entities/product-category.entity';

@Injectable()
export class ProductHelperService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,
  ) {}

  async resolveColorsForList(items: any[]) {
    const allColorIds = new Set<string>();
    items.forEach((item) => {
      if (Array.isArray(item.colors)) {
        item.colors.forEach((c: string) => allColorIds.add(c));
      }
    });

    const colorMap = new Map();
    if (allColorIds.size > 0) {
      const colors = await this.colorRepo.find({
        where: { id: In([...allColorIds]) },
        select: ['id', 'name', 'hex'],
      });
      colors.forEach((c) => colorMap.set(c.id, c));
    }

    return items.map((item) => ({
      ...item,
      colors: Array.isArray(item.colors)
        ? item.colors.map((id: string) => colorMap.get(id)).filter(Boolean)
        : [],
    }));
  }

  async resolveColorIds(identifiers: string[]): Promise<string[]> {
    if (!identifiers || identifiers.length === 0) return [];

    const colors = await this.colorRepo.find({
      where: [{ name: In(identifiers) }, { hex: In(identifiers) }],
      select: ['id'],
    });

    return colors.map((c) => c.id);
  }

  async ensureCategoryExists(categoryId: string) {
    const exists = await this.categoryRepo.exist({
      where: { id: categoryId },
    });

    if (!exists) {
      throw new BadRequestException('Invalid category_id');
    }
  }

  extractImageUrl(image: any): string | null {
    if (!image) return null;
    if (typeof image === 'string') {
      try {
        return JSON.parse(image)?.url ?? null;
      } catch {
        return null;
      }
    }
    return image?.url ?? null;
  }
}
