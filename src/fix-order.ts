import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCustomer } from './modules/commerce-module/product/entities/product-customer.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pcRepo = app.get<Repository<ProductCustomer>>(
    getRepositoryToken(ProductCustomer),
  );

  const orderId = 'ed20843e-f0de-449f-bdb4-3d2fe95594f4';
  const buyerId = '5580023d-6605-4302-8541-e39927c16a1b';
  const productId = 'e9480bcd-1be1-41b2-9be7-e18637136fb2';
  const vendorId = 'acb42092-b350-4b62-8967-b0a82d872d13';

  // Check if already exists
  const existing = await pcRepo.findOne({
    where: { order_id: orderId, product_id: productId },
  });

  if (!existing) {
    const pc = pcRepo.create({
      order_id: orderId,
      user_id: buyerId,
      product_id: productId,
      vendor_id: vendorId,
      customer_name: 'Dominion Adebanjo',
      customer_email: 'nomibik225@hudisk.com',
    });
    await pcRepo.save(pc);
    console.log('✅ Back-filled verified purchase for order:', orderId);
  } else {
    console.log('ℹ️ Verified purchase already exists for this order/product.');
  }

  await app.close();
}

void bootstrap();
