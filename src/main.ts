import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SwaggerModule } from '@nestjs/swagger';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { configureCloudinary } from './common/config/cloudinary.config';
import { swaggerConfig } from './common/config/swagger.config';
import { getCorsOrigins, isDevEnvironment } from './common/config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔧 Cloudinary
  configureCloudinary();

  // 🌍 CORS — localhost/dev bypass ONLY when NODE_ENV=development.
  // Every other environment (production, staging, unset) gets the strict
  // HTTPS allowlist, which never contains localhost.
  app.enableCors({
    origin: isDevEnvironment() ? true : getCorsOrigins(),
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

  // 🔌 WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // 📖 Swagger documentation
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
