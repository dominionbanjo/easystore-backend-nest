import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import slugify from 'slugify';
import { Store } from '../entities/store.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';

interface ColorResolvableItem {
  colors?: unknown[];
}

@Injectable()
export class StoreHelperService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,
  ) {}

  async resolveColorsForList<T>(items: T[]): Promise<T[]> {
    const allColorIds = new Set<string>();
    items.forEach((item) => {
      const colors = (item as ColorResolvableItem).colors;
      if (Array.isArray(colors)) {
        colors.forEach((c) => {
          if (typeof c === 'string') allColorIds.add(c);
        });
      }
    });

    if (allColorIds.size === 0) return items;

    const colors = await this.colorRepo.find({
      where: { id: In([...allColorIds]) },
      select: ['id', 'name', 'hex'],
    });

    const colorMap = new Map(colors.map((c) => [c.id, c]));

    return items.map((item) => {
      const itemColors = (item as ColorResolvableItem).colors;
      return {
        ...item,
        colors: Array.isArray(itemColors)
          ? itemColors
              .map((id) => (typeof id === 'string' ? colorMap.get(id) : id))
              .filter(Boolean)
          : [],
      };
    });
  }

  async generateUniqueSlug(
    name: string,
    manager?: EntityManager,
  ): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let i = 1;
    const repo = manager ? manager.getRepository(Store) : this.storeRepo;

    while (await repo.findOne({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }
}
