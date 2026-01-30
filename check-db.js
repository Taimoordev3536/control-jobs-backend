const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.winvpaehafsbplfkrcqb',
  password: 'vVE5M5_fnKZQfnb',
  database: 'postgres'
});

async function checkTables() {
  await client.connect();
  
  // Check existing tables
  const tablesResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('\n✅ Existing tables in Supabase:');
  tablesResult.rows.forEach(r => console.log(`  - ${r.table_name}`));
  
  // Check qr_codes structure if it exists
  const qrCodesCheck = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'qr_codes' 
    ORDER BY ordinal_position
  `);
  
  if (qrCodesCheck.rows.length > 0) {
    console.log('\n📋 QR Codes table structure:');
    qrCodesCheck.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
  }
  
  await client.end();
}

checkTables().catch(err => {
  console.error('Error:', err);
  client.end();
});
