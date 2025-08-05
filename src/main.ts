import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    cors: true,
  });
  app.use('/.well-known/pki-validation', express.static('.well-known'));

  // Enable CORS
  app.enableCors({
    origin: '*',
  //  origin: ['https://1e28d3c7c115.ngrok-free.app'],
  });

  // Use global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Use global response interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Use global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get<ConfigService>(ConfigService);
  const httpPort = configService.get<number>('HTTP_PORT') || 5000 || 8000;
  const httpsPort = configService.get<number>('HTTPS_PORT') || 443;

  await app.init();

  http.createServer(server).listen(httpPort, () => {
    console.log(`HTTP Server running on port ${httpPort}`);
  });
}
bootstrap();
