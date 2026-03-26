const bcrypt = require('bcryptjs');
const Member = require('../models/Member');
const Account = require('../models/Account');
const { query } = require('./connection');

async function seed() {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await query(`
      INSERT INTO members (member_number, first_name, last_name, email, phone, address, date_of_birth, password_hash, is_admin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      'ADMIN2024001',
      'System',
      'Administrator',
      'admin@cooperative.com',
      '+1234567890',
      '123 Admin Street, City, Country',
      '1980-01-01',
      adminPassword,
      true
    ]);

    const admin = adminResult.rows[0];
    console.log('Admin user created:', admin.member_number);

    // Create sample members
    const sampleMembers = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@email.com',
        phone: '+1234567891',
        address: '123 Main St, City, Country',
        date_of_birth: '1990-05-15',
        password: 'password123'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@email.com',
        phone: '+1234567892',
        address: '456 Oak Ave, City, Country',
        date_of_birth: '1985-08-22',
        password: 'password123'
      },
      {
        first_name: 'Robert',
        last_name: 'Johnson',
        email: 'robert.johnson@email.com',
        phone: '+1234567893',
        address: '789 Pine Rd, City, Country',
        date_of_birth: '1975-12-10',
        password: 'password123'
      }
    ];

    const createdMembers = [];
    for (const memberData of sampleMembers) {
      const member = await Member.create(memberData);
      createdMembers.push(member);
      
      // Create savings account for each member
      await Account.create(member.id, { account_type: 'savings', minimum_balance: 100 });
      
      console.log(`Member created: ${member.member_number} - ${member.first_name} ${member.last_name}`);
    }

    // Create some sample transactions
    const Transaction = require('../models/Transaction');
    
    for (const member of createdMembers) {
      const accounts = await Account.findByMemberId(member.id);
      const account = accounts[0];

      // Add some deposits
      await Transaction.create({
        account_id: account.id,
        member_id: member.id,
        transaction_type: 'deposit',
        amount: Math.floor(Math.random() * 5000) + 1000,
        description: 'Initial deposit',
        created_by: admin.id
      });

      await Transaction.create({
        account_id: account.id,
        member_id: member.id,
        transaction_type: 'deposit',
        amount: Math.floor(Math.random() * 2000) + 500,
        description: 'Monthly savings',
        created_by: member.id
      });

      // Add some withdrawals
      await Transaction.create({
        account_id: account.id,
        member_id: member.id,
        transaction_type: 'withdrawal',
        amount: Math.floor(Math.random() * 500) + 100,
        description: 'Cash withdrawal',
        created_by: member.id
      });

      console.log(`Sample transactions created for ${member.member_number}`);
    }

    // Create a sample loan
    const Loan = require('../models/Loan');
    const johnMember = createdMembers[0];
    const johnAccounts = await Account.findByMemberId(johnMember.id);
    
    const loan = await Loan.create({
      member_id: johnMember.id,
      amount: 10000,
      interest_rate: 0.05,
      term_months: 12
    });

    console.log(`Sample loan created: ${loan.loan_number}`);

    // Update cooperative settings
    await query(`
      UPDATE cooperative_settings 
      SET setting_value = $1 
      WHERE setting_key = 'cooperative_name'
    `, ['Demo Cooperative Society']);

    await query(`
      UPDATE cooperative_settings 
      SET setting_value = $1 
      WHERE setting_key = 'cooperative_address'
    `, ['123 Demo Street, Demo City, Demo Country']);

    console.log('Database seeding completed successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@cooperative.com / admin123');
    console.log('Sample members:');
    sampleMembers.forEach((member, index) => {
      console.log(`  ${member.first_name} ${member.last_name}: ${member.email} / password123`);
    });

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seed().then(() => {
    console.log('Seeding process finished.');
    process.exit(0);
  });
}

module.exports = { seed };
