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

  // 🌍 CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://easystore01.netlify.app', 'https://eazystore.com.ng']
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ✅ Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 🌍 Interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
