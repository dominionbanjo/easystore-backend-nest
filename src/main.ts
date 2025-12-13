import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(), // logs all requests
    new ResponseInterceptor(), // wraps all responses {status, message, data}
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
