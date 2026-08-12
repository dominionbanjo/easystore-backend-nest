import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import slugify from 'slugify';
import { Store } from '../entities/store.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';

interface ColorSourceItem {
  variants?: Array<{ combinations?: Record<string, string> }>;
  options?: { name?: string; values?: string[] }[] | null;
}

@Injectable()
export class StoreHelperService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,
  ) {}

  /**
   * Resolve color swatches ({ id, name, hex }) for product card items.
   *
   * Colors are no longer stored as raw columns on the product — they are
   * derived from variant combinations and product options (e.g. a "Color"
   * option with values like "Red"). One batched lookup, never N+1.
   */
  async resolveColorsForList<T>(items: T[]): Promise<T[]> {
    const colorNames = new Set<string>();
    const namesByItem = new Map<ColorSourceItem, string[]>();

    for (const item of items) {
      const src = item as unknown as ColorSourceItem;
      const names = new Set<string>();

      for (const v of src.variants ?? []) {
        if (!v.combinations) continue;
        for (const [key, val] of Object.entries(v.combinations)) {
          if (val && key.toLowerCase().includes('color')) names.add(val);
        }
      }

      for (const opt of src.options ?? []) {
        if (opt?.name && opt.name.toLowerCase().includes('color')) {
          for (const val of opt.values ?? []) {
            if (val) names.add(val);
          }
        }
      }

      if (names.size > 0) {
        namesByItem.set(src, [...names]);
        names.forEach((n) => colorNames.add(n));
      }
    }

    if (namesByItem.size === 0) return items;

    const colors = await this.colorRepo
      .createQueryBuilder('color')
      .select(['color.id', 'color.name', 'color.hex'])
      .where('LOWER(color.name) IN (:...names)', {
        names: [...colorNames].map((n) => n.toLowerCase()),
      })
      .orderBy('color.vendor_id', 'ASC', 'NULLS FIRST')
      .addOrderBy('color.created_at', 'ASC')
      .getMany();

    const colorMap = new Map<string, ProductColor>();
    for (const c of colors) {
      const key = c.name.toLowerCase();
      if (!colorMap.has(key)) colorMap.set(key, c);
    }

    const resolvedByItem = new Map<
      ColorSourceItem,
      { id: string; name: string; hex: string }[]
    >();
    for (const [item, names] of namesByItem.entries()) {
      resolvedByItem.set(
        item,
        names
          .map((n) => colorMap.get(n.toLowerCase()))
          .filter((c): c is ProductColor => Boolean(c))
          .map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
      );
    }

    return items.map((item) => {
      const resolved = resolvedByItem.get(item as unknown as ColorSourceItem);
      return resolved ? { ...item, colors: resolved } : item;
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
