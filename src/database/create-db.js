const { Pool } = require('pg');
require('dotenv').config();

async function createDatabase() {
  const dbName = process.env.DB_NAME || 'cooperative_savings';
  
  // Connect to default postgres database to create our database
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Connect to default database
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Creating database...');
    await pool.query(`CREATE DATABASE ${dbName}`);
    console.log(`Database '${dbName}' created successfully!`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log(`Database '${dbName}' already exists.`);
    } else {
      console.error('Error creating database:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createDatabase().then(() => {
    console.log('Database creation process finished.');
    process.exit(0);
  }).catch(error => {
    console.error('Database creation failed:', error);
    process.exit(1);
  });
}

module.exports = { createDatabase };
