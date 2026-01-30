import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'postgres',
  synchronize: false,
  logging: true,
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  ssl: process.env.DATABASE_HOST?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false,
});

async function runSpecificMigrations() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    // Skip old QR code migrations, run only the new ones
    const migrationsToRun = [
      '20251017_add_monthly_weekday_columns.ts',
      '20251023_create_survey_table.ts',
      '20251106_add_total_week_hours_to_seasonal_schedule.ts',
      '20251110_change_seasonal_schedule_dates_to_day_month.ts',
      '20251207_add_cascade_to_survey_job.ts',
      '20251207_add_weekly_days_to_survey.ts',
      '20251212_add_signing_method_fields.ts',
      '20260130_add_address_components_to_work_center.ts',
    ];

    for (const file of migrationsToRun) {
      console.log(`\n📝 Applying migration: ${file}`);
      try {
        const modulePath = path.join(__dirname, file);
        const migrationModule = await import(modulePath);

        let migrationInstance: any = null;
        for (const exported of Object.values(migrationModule)) {
          const expAny = exported as any;
          if (typeof exported === 'function') {
            const proto = expAny.prototype;
            if (proto && (typeof proto.up === 'function')) {
              migrationInstance = new expAny();
              break;
            }
          }
        }

        if (migrationInstance && typeof migrationInstance.up === 'function') {
          await migrationInstance.up(queryRunner);
          console.log(`✅ Migration ${file} completed successfully`);
        } else {
          console.log(`⚠️  No valid migration found in ${file}, skipping...`);
        }
      } catch (error: any) {
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.code === '42P07' || // table exists
            error.code === '42701') {  // column exists
          console.log(`ℹ️  Migration ${file} already applied, skipping...`);
        } else {
          console.error(`❌ Migration ${file} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n🎉 All migrations completed!');
  } catch (error) {
    console.error('\n❌ Migration process failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

runSpecificMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
