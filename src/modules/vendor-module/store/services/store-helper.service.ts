import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import slugify from 'slugify';
import { Store } from '../entities/store.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';

@Injectable()
export class StoreHelperService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,
  ) {}

  async resolveColorsForList(items: any[]) {
    const allColorIds = new Set<string>();
    items.forEach((item) => {
      if (Array.isArray(item.colors)) {
        item.colors.forEach((c: any) => {
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

    return items.map((item) => ({
      ...item,
      colors: Array.isArray(item.colors)
        ? item.colors
            .map((id: any) => (typeof id === 'string' ? colorMap.get(id) : id))
            .filter(Boolean)
        : [],
    }));
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
