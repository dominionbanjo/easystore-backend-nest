import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreTemplate } from '../entities/store-template.entity';
import { Store } from '../entities/store.entity';

@Injectable()
export class StoreThemeService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(StoreTemplate)
    private readonly templateRepo: Repository<StoreTemplate>,
  ) {}

  async getTemplates() {
    const templates = await this.templateRepo.find({
      order: { name: 'ASC' },
    });
    return {
      message: 'Templates retrieved successfully',
      data: templates,
    };
  }

  async getStoreTheme(slug: string) {
    const store = await this.storeRepo.findOne({
      where: [{ subdomain: slug }, { slug }],
      relations: ['user', 'theme_setting', 'theme_setting.template'],
      select: ['id', 'slug', 'subdomain', 'user_id', 'status'],
    });

    if (
      !store ||
      store.status !== 'active' ||
      (store.user?.account_status !== 'active' &&
        store.user?.account_status !== 'pending')
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    if (!store.theme_setting || !store.theme_setting.template) {
      // Return default if no explicit setting is found
      const defaultTemplate = await this.templateRepo.findOne({
        where: { name: 'Default' },
      });

      return {
        message: 'Store theme retrieved',
        data: {
          template: defaultTemplate,
          custom_config: {}, // No overrides
        },
      };
    }

    return {
      message: 'Store theme retrieved',
      data: {
        template: store.theme_setting.template,
        custom_config: store.theme_setting.custom_config,
      },
    };
  }
}
