import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Hit on a schedule from outside (see .github/workflows/keepalive.yml). The query
// is what keeps the free-tier database from being paused for inactivity, so it
// must actually reach Postgres — a static 200 would defeat the purpose.
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      // public endpoint — the reason stays in the server log, not the response
      throw new ServiceUnavailableException({ ok: false, db: 'down' });
    }
    return {
      ok: true,
      db: 'up',
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    };
  }
}
