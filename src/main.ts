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

  // ✅ GLOBAL VALIDATION (THIS WAS MISSING)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // throw on extra fields
      transform: true, // JSON → DTO instance
    }),
  );

  // 🌍 Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(), // logs all requests
    new ResponseInterceptor(), // wraps responses { status, message, data }
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
