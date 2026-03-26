const { query } = require('../database/connection');

class Account {
  static async create(memberId, accountData) {
    const {
      account_type = 'savings',
      minimum_balance = 0.00
    } = accountData;

    // Generate account number
    const account_number = await this.generateAccountNumber();

    const sql = `
      INSERT INTO accounts (member_id, account_number, account_type, minimum_balance)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [memberId, account_number, account_type, minimum_balance];

    try {
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create account: ${error.message}`);
    }
  }

  static async generateAccountNumber() {
    const year = new Date().getFullYear();
    const prefix = `ACC${year}`;
    
    // Get the last account number for this year
    const sql = 'SELECT account_number FROM accounts WHERE account_number LIKE $1 ORDER BY account_number DESC LIMIT 1';
    const result = await query(sql, [`${prefix}%`]);
    
    let sequence = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].account_number;
      const lastSequence = parseInt(lastNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  static async findById(id) {
    const sql = `
      SELECT a.*, m.first_name, m.last_name, m.email, m.member_number
      FROM accounts a
      JOIN members m ON a.member_id = m.id
      WHERE a.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async findByAccountNumber(account_number) {
    const sql = `
      SELECT a.*, m.first_name, m.last_name, m.email, m.member_number
      FROM accounts a
      JOIN members m ON a.member_id = m.id
      WHERE a.account_number = $1
    `;
    const result = await query(sql, [account_number]);
    return result.rows[0];
  }

  static async findByMemberId(memberId) {
    const sql = `
      SELECT a.*, m.first_name, m.last_name, m.email, m.member_number
      FROM accounts a
      JOIN members m ON a.member_id = m.id
      WHERE a.member_id = $1
      ORDER BY a.created_at DESC
    `;
    const result = await query(sql, [memberId]);
    return result.rows;
  }

  static async findAll(page = 1, limit = 10, status = null) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT a.*, m.first_name, m.last_name, m.email, m.member_number
      FROM accounts a
      JOIN members m ON a.member_id = m.id
    `;
    let countSql = 'SELECT COUNT(*) FROM accounts';
    const params = [];

    if (status) {
      sql += ' WHERE a.status = $1';
      countSql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [accountsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, status ? [status] : [])
    ]);

    return {
      accounts: accountsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    };
  }

  static async updateBalance(accountId, newBalance) {
    const sql = `
      UPDATE accounts 
      SET balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await query(sql, [newBalance, accountId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update account balance: ${error.message}`);
    }
  }

  static async updateStatus(accountId, status) {
    const sql = `
      UPDATE accounts 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await query(sql, [status, accountId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update account status: ${error.message}`);
    }
  }

  static async delete(id) {
    // Check if account has transactions
    const transactionCheck = await query('SELECT id FROM transaction_logs WHERE account_id = $1 LIMIT 1', [id]);

    if (transactionCheck.rows.length > 0) {
      throw new Error('Cannot delete account with existing transactions');
    }

    const sql = 'DELETE FROM accounts WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async getAccountStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_accounts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_accounts,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_accounts,
        COUNT(CASE WHEN status = 'frozen' THEN 1 END) as frozen_accounts,
        COUNT(CASE WHEN account_type = 'savings' THEN 1 END) as savings_accounts,
        COUNT(CASE WHEN account_type = 'fixed' THEN 1 END) as fixed_accounts,
        COUNT(CASE WHEN account_type = 'current' THEN 1 END) as current_accounts,
        COALESCE(SUM(balance), 0) as total_balance,
        COALESCE(AVG(balance), 0) as average_balance
      FROM accounts
    `;
    
    const result = await query(sql);
    return result.rows[0];
  }

  static async getAccountSummary(accountId) {
    const sql = `
      SELECT 
        a.*,
        m.first_name,
        m.last_name,
        m.member_number,
        m.email,
        (
          SELECT COUNT(*) 
          FROM transaction_logs tl 
          WHERE tl.account_id = a.id 
          AND tl.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ) as transactions_last_30_days,
        (
          SELECT COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0)
          FROM transaction_logs tl 
          WHERE tl.account_id = a.id 
          AND tl.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ) as deposits_last_30_days,
        (
          SELECT COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0)
          FROM transaction_logs tl 
          WHERE tl.account_id = a.id 
          AND tl.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ) as withdrawals_last_30_days
      FROM accounts a
      JOIN members m ON a.member_id = m.id
      WHERE a.id = $1
    `;
    
    const result = await query(sql, [accountId]);
    return result.rows[0];
  }
}

module.exports = Account;
