import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { configureCloudinary } from './common/config/cloudinary.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔧 Cloudinary
  configureCloudinary();

  // 🌍 CORS (safe for cookies & auth)
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://easystore.com', 'https://admin.easystore.com']
        : true, // allow all origins in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ✅ GLOBAL VALIDATION
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // throw on extra fields
      transform: true, // JSON → DTO instance
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 🌍 GLOBAL INTERCEPTORS
  app.useGlobalInterceptors(
    new LoggingInterceptor(), // logs all requests
    new ResponseInterceptor(), // wraps responses { status, message, data }
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
