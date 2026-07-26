/**
 * Boots the whole Nest container and exits.
 *
 * Catches missing-provider and circular-dependency errors, which tsc cannot
 * see and unit tests miss because they construct services by hand. Needs a
 * reachable database.
 *
 *   npm run verify:boot
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
(async () => {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  await app.init();
  console.log('APP BOOTED - all dependencies resolved');
  await app.close();
  process.exit(0);
})().catch((e) => { console.error('BOOT FAILED:', e.message); process.exit(1); });
