import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreTemplate } from '../entities/store-template.entity';

@Injectable()
export class ThemeSeederService implements OnModuleInit {
  private readonly logger = new Logger(ThemeSeederService.name);

  constructor(
    @InjectRepository(StoreTemplate)
    private readonly templateRepo: Repository<StoreTemplate>,
  ) {}

  async onModuleInit() {
    await this.seedTemplates();
  }

  private async seedTemplates() {
    const defaultTemplates = [
      {
        name: 'Default',
        description: 'The standard EazyStore layout.',
        default_config: {
          header_style: 'standard',
          primary_color: '#17c06e', // Default primary (EazyStore Green)
          font_family: 'Inter, sans-serif',
          layout_style: 'grid',
        },
      },
      {
        name: 'Vanguard',
        description:
          'Minimalist and High-Fashion design, ideal for luxury boutiques.',
        default_config: {
          header_style: 'centered',
          primary_color: '#000000',
          font_family: 'Playfair Display, serif',
          layout_style: 'oversized_images',
        },
      },
      {
        name: 'The Bazaar',
        description:
          'Information-dense layout with sidebar categories, best for general retail.',
        default_config: {
          header_style: 'search_heavy',
          primary_color: '#f59e0b',
          font_family: 'Roboto, sans-serif',
          layout_style: 'sidebar_grid',
        },
      },
      {
        name: 'Editorial',
        description:
          'Content-first storytelling layout, great for organic products.',
        default_config: {
          header_style: 'transparent',
          primary_color: '#4ade80',
          font_family: 'Lora, serif',
          layout_style: 'hero_banners',
        },
      },
      {
        name: 'Titan',
        description: 'Dark-tech industrial aesthetic with neon accents.',
        default_config: {
          header_style: 'minimal',
          primary_color: '#22d3ee',
          font_family: 'Fira Code, monospace',
          layout_style: 'border_grid',
          dark_mode_default: true,
        },
      },
      {
        name: 'Heritage',
        description: 'Traditional artisanal look with earthy colors.',
        default_config: {
          header_style: 'classic',
          primary_color: '#b45309',
          font_family: 'Merriweather, serif',
          layout_style: 'card_based',
        },
      },
    ];

    for (const template of defaultTemplates) {
      const exists = await this.templateRepo.findOne({
        where: { name: template.name },
      });
      if (!exists) {
        const newTemplate = this.templateRepo.create(template);
        await this.templateRepo.save(newTemplate);
        this.logger.log(`Seeded StoreTemplate: ${template.name}`);
      } else {
        // Update default config if it changed
        exists.default_config = template.default_config;
        exists.description = template.description;
        await this.templateRepo.save(exists);
        this.logger.log(`Updated StoreTemplate config: ${template.name}`);
      }
    }
  }
}
