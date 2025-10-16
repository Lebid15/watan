import pg from 'pg';
const { Pool } = pg;


const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'watan',
  user: 'watan',
  password: 'changeme',
});

async function checkLastOrders() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        status, 
        "manualNote", 
        "providerMessage", 
        "lastMessage", 
        "externalOrderId",
        "createdAt",
        "userIdentifier"
      FROM product_orders 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
    
    console.log('=== آخر 5 طلبات ===\n');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Order ID: ${row.id}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Manual Note: ${row.manualNote || 'NULL'}`);
      console.log(`   Provider Message: ${row.providerMessage || 'NULL'}`);
      console.log(`   Last Message: ${row.lastMessage || 'NULL'}`);
      console.log(`   External Order ID: ${row.externalOrderId || 'NULL'}`);
      console.log(`   User Identifier: ${row.userIdentifier || 'NULL'}`);
      console.log(`   Created At: ${row.createdAt}`);
      console.log('---\n');
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkLastOrders();
