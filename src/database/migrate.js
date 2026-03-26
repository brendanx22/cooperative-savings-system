const fs = require('fs');
const path = require('path');
const { query } = require('./connection');

async function migrate() {
  try {
    console.log('Starting database migration...');
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await query(schema);
    
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate().then(() => {
    console.log('Migration process finished.');
    process.exit(0);
  });
}

module.exports = { migrate };
