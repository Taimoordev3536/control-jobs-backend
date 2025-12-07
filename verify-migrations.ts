import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME
});

ds.initialize().then(async () => {
  console.log('✓ Connected to live database\n');
  
  // Check survey table columns
  const columns = await ds.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'survey' 
    ORDER BY ordinal_position
  `);
  
  console.log('Survey table columns:');
  columns.forEach((col: any) => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });
  
  // Check for CASCADE constraint
  const constraints = await ds.query(`
    SELECT 
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    LEFT JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'survey' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'jobId';
  `);
  
  console.log('\nSurvey jobId foreign key constraint:');
  if (constraints.length > 0) {
    console.log(`  ✓ Constraint: ${constraints[0].constraint_name}`);
    console.log(`  ✓ References: ${constraints[0].foreign_table_name}`);
    console.log(`  ✓ Delete rule: ${constraints[0].delete_rule}`);
  } else {
    console.log('  ✗ No foreign key constraint found');
  }
  
  await ds.destroy();
  console.log('\n✓ Verification complete');
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
