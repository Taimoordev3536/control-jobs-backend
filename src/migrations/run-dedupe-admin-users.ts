import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.DATABASE_HOST,
  port: +(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  username: process.env.DB_USER || process.env.DATABASE_USERNAME,
  password: process.env.DB_PASS || process.env.DATABASE_PASS || process.env.DATABASE_PASSWORD,
  database: process.env.DB_NAME || process.env.DATABASE_NAME,
  synchronize: false,
  logging: false,
  ssl: { rejectUnauthorized: false },
});

const MERGE_FIELDS = [
  'permission',
  'nif',
  'responsible',
  'address',
  'street',
  'street_number',
  'floor_door',
  'postal_code',
  'city',
  'province',
  'country',
  'latitude',
  'longitude',
  'landline',
  'mobile',
  'logo_public_id',
  'logo_url',
];

async function run() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.startTransaction();
  try {
    const dupUsers: Array<{ user_id: number }> = await qr.query(`
      SELECT user_id FROM cjobs_admin_users
      WHERE parent_user_id IS NULL
      GROUP BY user_id HAVING COUNT(*) > 1;
    `);

    for (const { user_id } of dupUsers) {
      const rows: any[] = await qr.query(
        `SELECT * FROM cjobs_admin_users WHERE user_id = $1 AND parent_user_id IS NULL ORDER BY id ASC;`,
        [user_id],
      );
      const survivor = rows.find((r) => r.is_default) ?? rows[0];

      const merged: Record<string, any> = {};
      for (const field of MERGE_FIELDS) {
        let value = survivor[field];
        if (value === null || value === undefined) {
          const donor = rows.find((r) => r[field] !== null && r[field] !== undefined);
          if (donor) value = donor[field];
        }
        merged[field] = value ?? null;
      }

      const setClause = MERGE_FIELDS.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      await qr.query(
        `UPDATE cjobs_admin_users SET ${setClause}, is_default = true WHERE id = $${MERGE_FIELDS.length + 1};`,
        [...MERGE_FIELDS.map((f) => merged[f]), survivor.id],
      );

      const losers = rows.filter((r) => r.id !== survivor.id).map((r) => r.id);
      if (losers.length) {
        await qr.query(
          `DELETE FROM cjobs_admin_users WHERE id = ANY($1::int[]);`,
          [losers],
        );
      }
      console.log(`user ${user_id}: kept #${survivor.id}, removed ${JSON.stringify(losers)}`);
    }

    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_user_id_toplevel
        ON cjobs_admin_users (user_id) WHERE parent_user_id IS NULL;
    `);

    await qr.commitTransaction();
    console.log('✅ Done');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('Dedupe failed:', err);
    process.exitCode = 1;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}
run();
