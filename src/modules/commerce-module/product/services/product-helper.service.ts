import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from '../../product-category/entities/product-category.entity';

@Injectable()
export class ProductHelperService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  // resolveColorsForList and resolveColorIds removed — colors/sizes
  // are no longer stored on the Product entity; use variants instead.

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
