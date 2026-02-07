import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProductCategory } from '../modules/commerce-module/product-category/entities/product-category.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';

async function fixSlugs() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const categoryRepo = app.get<Repository<ProductCategory>>(
    getRepositoryToken(ProductCategory),
  );

  const categories = await categoryRepo.find({ where: { slug: null as any } });
  console.log(`Found ${categories.length} categories with null slugs.`);

  for (const category of categories) {
    if (!category.name) continue;
    const baseSlug = slugify(category.name, { lower: true, strict: true });
    let slug = baseSlug;
    let i = 1;

    // Check for collisions
    while (await categoryRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    category.slug = slug;
    await categoryRepo.save(category);
    console.log(`Updated category "${category.name}" with slug "${slug}".`);
  }

  await app.close();
  console.log('Finished fixing slugs.');
}

fixSlugs().catch((err) => {
  console.error('Error fixing slugs:', err);
  process.exit(1);
});
