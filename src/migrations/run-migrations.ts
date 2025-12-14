import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  username: process.env.DB_USER || process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DB_PASS || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'your_db',
  synchronize: false,
  logging: true,
  entities: [path.join(__dirname, '..', '..', 'src', '**', '*.entity.{ts,js}')],
  ssl: {
    rejectUnauthorized: false
  },
});

async function runAllMigrations() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir).filter(f => /^(\d+).*\.ts$/.test(f)).sort();
    for (const file of files) {
      // Skip run scripts
      if (file.includes('run-')) continue;
      const modulePath = path.join(migrationsDir, file);
      const migrationModule = await import(modulePath);

      // Try to locate a migration class or instance in the module exports
      let migrationInstance: any = null;

      // 1) Named/class exports
      for (const exported of Object.values(migrationModule)) {
        const expAny = exported as any
        if (typeof exported === 'function') {
          const proto = expAny.prototype
          if (proto && (typeof proto.up === 'function' || typeof proto.down === 'function')) {
            // It's a class-like export
            migrationInstance = new expAny()
            break
          }
        } else if (expAny && typeof expAny === 'object') {
          // 2) Exported object with up/down methods
          if (typeof expAny.up === 'function' || typeof expAny.down === 'function') {
            migrationInstance = expAny
            break
          }
        }
      }

      // 3) Fallback to default or first export
      if (!migrationInstance) {
        const maybe = (migrationModule as any).default || Object.values(migrationModule)[0]
        if (maybe) {
          if (typeof maybe === 'function') {
            try {
              migrationInstance = new (maybe as any)()
            } catch (e) {
              // If construction fails, check if it's an object
              if (maybe && typeof maybe === 'object' && typeof maybe.up === 'function') {
                migrationInstance = maybe
              }
            }
          } else if (maybe && typeof maybe === 'object' && typeof maybe.up === 'function') {
            migrationInstance = maybe
          }
        }
      }

      if (!migrationInstance) {
        console.warn(`Skipping migration ${file}: no migration class or object with up/down methods found.`)
        continue
      }

      console.log('Applying migration:', file)
      await migrationInstance.up(queryRunner)
    }
    console.log('All migrations applied');
  } catch (err) {
    console.error('Migration failed', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

runAllMigrations();
