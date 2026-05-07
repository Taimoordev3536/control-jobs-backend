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
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ViewOnlyBlockerInterceptor } from './modules/auth/guards/view-only-blocker.guard';
import { types as pgTypes } from 'pg';

// Postgres `timestamp without time zone` columns return as a tz-naive string;
// node-postgres parses them in the Node process's local timezone by default,
// which silently shifts the value when the server runs outside UTC. Force
// every tz-naive timestamp to be read as UTC so dates round-trip correctly
// regardless of where the backend or developer runs.
// OID 1114 = timestamp without time zone.
pgTypes.setTypeParser(1114, (str: string) => new Date(`${str}Z`));

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

  // Use global response interceptor + VIEW_ONLY sub-user write blocker
  app.useGlobalInterceptors(
    new ViewOnlyBlockerInterceptor(),
    new TransformInterceptor(),
  );

  // Use global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Attach Socket.IO adapter so gateways bind under the same HTTP server
  app.useWebSocketAdapter(new IoAdapter(app));

  const configService = app.get<ConfigService>(ConfigService);
  // Use PORT from environment (Render provides this) or fallback to HTTP_PORT or 5000
  const port = process.env.PORT || configService.get<number>('HTTP_PORT') || 5000;

  // CRITICAL: Listen on 0.0.0.0 for Render (not just localhost)
  await app.listen(port, '0.0.0.0');
}
bootstrap();
