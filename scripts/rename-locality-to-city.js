const { Client } = require('pg');
const c = new Client({host:'localhost',port:5432,user:'postgres',password:'taman',database:'controljobs'});
c.connect().then(async () => {
  // First check current columns
  const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='clients' AND column_name IN ('locality','city')");
  console.log('Columns found:', JSON.stringify(res.rows));
  
  // If locality exists but not city, rename it
  const hasLocality = res.rows.some(r => r.column_name === 'locality');
  const hasCity = res.rows.some(r => r.column_name === 'city');
  
  if (hasLocality && !hasCity) {
    await c.query('ALTER TABLE clients RENAME COLUMN locality TO city');
    console.log('Successfully renamed locality to city');
  } else if (hasCity) {
    console.log('Column city already exists - no action needed');
  } else {
    console.log('Neither locality nor city found');
  }
  
  c.end();
}).catch(e => { console.error(e); c.end(); });
