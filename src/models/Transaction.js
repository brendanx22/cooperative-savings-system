const { query } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const Account = require('./Account');

class Transaction {
  static async create(transactionData) {
    const {
      account_id,
      member_id,
      transaction_type,
      amount,
      description,
      reference_number,
      created_by
    } = transactionData;

    // Generate unique transaction ID
    const transaction_id = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Get current account balance
    const account = await Account.findById(account_id);
    if (!account) {
      throw new Error('Account not found');
    }

    if (account.status !== 'active') {
      throw new Error('Account is not active');
    }

    const balance_before = parseFloat(account.balance);
    let balance_after = balance_before;

    // Validate and calculate new balance based on transaction type
    switch (transaction_type) {
      case 'deposit':
        balance_after = balance_before + parseFloat(amount);
        break;
      case 'withdrawal':
        balance_after = balance_before - parseFloat(amount);
        if (balance_after < parseFloat(account.minimum_balance)) {
          throw new Error('Insufficient funds - minimum balance requirement not met');
        }
        break;
      case 'loan_disbursement':
        balance_after = balance_before + parseFloat(amount);
        break;
      case 'loan_payment':
        balance_after = balance_before - parseFloat(amount);
        if (balance_after < parseFloat(account.minimum_balance)) {
          throw new Error('Insufficient funds for loan payment');
        }
        break;
      case 'interest':
        balance_after = balance_before + parseFloat(amount);
        break;
      case 'fee':
        balance_after = balance_before - parseFloat(amount);
        break;
      default:
        throw new Error('Invalid transaction type');
    }

    const sql = `
      INSERT INTO transaction_logs (
        transaction_id, account_id, member_id, transaction_type, 
        amount, balance_before, balance_after, description, 
        reference_number, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      transaction_id,
      account_id,
      member_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_number,
      created_by
    ];

    try {
      // Start transaction
      await query('BEGIN');

      // Insert transaction record
      const result = await query(sql, values);
      const transaction = result.rows[0];

      // Update account balance
      await Account.updateBalance(account_id, balance_after);

      // Commit transaction
      await query('COMMIT');

      return transaction;
    } catch (error) {
      await query('ROLLBACK');
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  static async findById(id) {
    const sql = `
      SELECT t.*, a.account_number, m.first_name, m.last_name, m.member_number
      FROM transaction_logs t
      JOIN accounts a ON t.account_id = a.id
      JOIN members m ON t.member_id = m.id
      WHERE t.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async findByTransactionId(transaction_id) {
    const sql = `
      SELECT t.*, a.account_number, m.first_name, m.last_name, m.member_number
      FROM transaction_logs t
      JOIN accounts a ON t.account_id = a.id
      JOIN members m ON t.member_id = m.id
      WHERE t.transaction_id = $1
    `;
    const result = await query(sql, [transaction_id]);
    return result.rows[0];
  }

  static async findByAccountId(accountId, page = 1, limit = 10, startDate = null, endDate = null, transactionType = null) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT t.*, a.account_number, m.first_name, m.last_name, m.member_number
      FROM transaction_logs t
      JOIN accounts a ON t.account_id = a.id
      JOIN members m ON t.member_id = m.id
      WHERE t.account_id = $1
    `;
    let countSql = 'SELECT COUNT(*) FROM transaction_logs WHERE account_id = $1';
    const params = [accountId];

    if (startDate) {
      sql += ` AND t.created_at >= $${params.length + 1}`;
      countSql += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND t.created_at <= $${params.length + 1}`;
      countSql += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (transactionType) {
      sql += ` AND t.transaction_type = $${params.length + 1}`;
      countSql += ` AND transaction_type = $${params.length + 1}`;
      params.push(transactionType);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [transactionsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, [accountId])
    ]);

    return {
      transactions: transactionsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    };
  }

  static async findByMemberId(memberId, page = 1, limit = 10, startDate = null, endDate = null, transactionType = null) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT t.*, a.account_number
      FROM transaction_logs t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.member_id = $1
    `;
    let countSql = 'SELECT COUNT(*) FROM transaction_logs WHERE member_id = $1';
    const params = [memberId];

    if (startDate) {
      sql += ` AND t.created_at >= $${params.length + 1}`;
      countSql += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND t.created_at <= $${params.length + 1}`;
      countSql += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (transactionType) {
      sql += ` AND t.transaction_type = $${params.length + 1}`;
      countSql += ` AND transaction_type = $${params.length + 1}`;
      params.push(transactionType);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [transactionsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, [memberId])
    ]);

    return {
      transactions: transactionsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    };
  }

  static async getTransactionStats(startDate = null, endDate = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN transaction_type = 'deposit' THEN 1 END) as deposit_count,
        COUNT(CASE WHEN transaction_type = 'withdrawal' THEN 1 END) as withdrawal_count,
        COUNT(CASE WHEN transaction_type = 'loan_disbursement' THEN 1 END) as loan_disbursement_count,
        COUNT(CASE WHEN transaction_type = 'loan_payment' THEN 1 END) as loan_payment_count,
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(CASE WHEN transaction_type = 'loan_disbursement' THEN amount ELSE 0 END), 0) as total_loan_disbursements,
        COALESCE(SUM(CASE WHEN transaction_type = 'loan_payment' THEN amount ELSE 0 END), 0) as total_loan_payments,
        COALESCE(SUM(amount), 0) as total_transaction_volume
      FROM transaction_logs
    `;

    const params = [];

    if (startDate) {
      sql += ` WHERE created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      sql += startDate ? ` AND created_at <= $${params.length + 1}` : ` WHERE created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    const result = await query(sql, params);
    return result.rows[0];
  }

  static async getDailyTransactionSummary(days = 30) {
    const sql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as daily_deposits,
        COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as daily_withdrawals,
        COALESCE(SUM(amount), 0) as daily_volume
      FROM transaction_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const result = await query(sql);
    return result.rows;
  }

  static async getMemberTransactionSummary(memberId, days = 30) {
    const sql = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(amount), 0) as total_volume,
        MAX(created_at) as last_transaction_date
      FROM transaction_logs
      WHERE member_id = $1
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `;

    const result = await query(sql, [memberId]);
    return result.rows[0];
  }
}

module.exports = Transaction;
