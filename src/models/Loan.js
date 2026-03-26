const { query } = require('../database/connection');
const Transaction = require('./Transaction');

class Loan {
  static async create(loanData) {
    const {
      member_id,
      amount,
      interest_rate,
      term_months,
      application_date = new Date().toISOString().split('T')[0]
    } = loanData;

    // Generate loan number
    const loan_number = await this.generateLoanNumber();

    // Calculate loan details
    const monthlyInterestRate = parseFloat(interest_rate) / 12;
    const monthlyPayment = (parseFloat(amount) * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, term_months)) / 
                          (Math.pow(1 + monthlyInterestRate, term_months) - 1);
    const totalAmount = parseFloat(amount) + (monthlyPayment * term_months) - parseFloat(amount);
    const balance = parseFloat(amount);

    const sql = `
      INSERT INTO loans (
        member_id, loan_number, amount, interest_rate, term_months,
        monthly_payment, total_amount, balance, application_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      member_id,
      loan_number,
      amount,
      interest_rate,
      term_months,
      monthlyPayment.toFixed(2),
      totalAmount.toFixed(2),
      balance,
      application_date
    ];

    try {
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create loan: ${error.message}`);
    }
  }

  static async generateLoanNumber() {
    const year = new Date().getFullYear();
    const prefix = `LOAN${year}`;
    
    // Get the last loan number for this year
    const sql = 'SELECT loan_number FROM loans WHERE loan_number LIKE $1 ORDER BY loan_number DESC LIMIT 1';
    const result = await query(sql, [`${prefix}%`]);
    
    let sequence = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].loan_number;
      const lastSequence = parseInt(lastNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  static async findById(id) {
    const sql = `
      SELECT l.*, m.first_name, m.last_name, m.email, m.member_number
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async findByLoanNumber(loan_number) {
    const sql = `
      SELECT l.*, m.first_name, m.last_name, m.email, m.member_number
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.loan_number = $1
    `;
    const result = await query(sql, [loan_number]);
    return result.rows[0];
  }

  static async findByMemberId(memberId, status = null) {
    let sql = `
      SELECT l.*, m.first_name, m.last_name, m.email, m.member_number
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.member_id = $1
    `;
    const params = [memberId];

    if (status) {
      sql += ' AND l.status = $2';
      params.push(status);
    }

    sql += ' ORDER BY l.created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  static async findAll(page = 1, limit = 10, status = null) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT l.*, m.first_name, m.last_name, m.email, m.member_number
      FROM loans l
      JOIN members m ON l.member_id = m.id
    `;
    let countSql = 'SELECT COUNT(*) FROM loans';
    const params = [];

    if (status) {
      sql += ' WHERE l.status = $1';
      countSql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY l.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [loansResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, status ? [status] : [])
    ]);

    return {
      loans: loansResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    };
  }

  static async approveLoan(loanId, accountId, approvedBy) {
    const loan = await this.findById(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== 'pending') {
      throw new Error('Loan can only be approved if status is pending');
    }

    try {
      await query('BEGIN');

      // Update loan status
      const updateSql = `
        UPDATE loans 
        SET status = 'approved', approval_date = CURRENT_DATE, start_date = CURRENT_DATE,
            end_date = CURRENT_DATE + INTERVAL '${loan.term_months} months'
        WHERE id = $1
        RETURNING *
      `;
      const updatedLoan = await query(updateSql, [loanId]);

      // Disburse loan amount to account
      await Transaction.create({
        account_id: accountId,
        member_id: loan.member_id,
        transaction_type: 'loan_disbursement',
        amount: loan.amount,
        description: `Loan disbursement for ${loan.loan_number}`,
        reference_number: loan.loan_number,
        created_by: approvedBy
      });

      // Update loan status to active after disbursement
      await query('UPDATE loans SET status = $1 WHERE id = $2', ['active', loanId]);

      await query('COMMIT');

      return updatedLoan.rows[0];
    } catch (error) {
      await query('ROLLBACK');
      throw new Error(`Failed to approve loan: ${error.message}`);
    }
  }

  static async makePayment(loanId, accountId, paymentAmount, paymentMethod, paidBy) {
    const loan = await this.findById(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== 'active') {
      throw new Error('Loan must be active to make payments');
    }

    if (parseFloat(paymentAmount) > parseFloat(loan.balance)) {
      throw new Error('Payment amount exceeds loan balance');
    }

    try {
      await query('BEGIN');

      // Calculate interest and principal portions
      const monthlyInterest = parseFloat(loan.balance) * (parseFloat(loan.interest_rate) / 12);
      const principalAmount = Math.min(parseFloat(paymentAmount), parseFloat(loan.balance));
      const interestAmount = Math.min(monthlyInterest, parseFloat(paymentAmount) - principalAmount);

      // Record loan payment
      const paymentSql = `
        INSERT INTO loan_payments (loan_id, payment_amount, principal_amount, interest_amount, payment_method)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const paymentResult = await query(paymentSql, [loanId, paymentAmount, principalAmount, interestAmount, paymentMethod]);

      // Update loan balance and amount paid
      const newBalance = parseFloat(loan.balance) - principalAmount;
      const newAmountPaid = parseFloat(loan.amount_paid) + principalAmount;
      
      const updateSql = `
        UPDATE loans 
        SET amount_paid = $1, balance = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const updatedLoan = await query(updateSql, [newAmountPaid, newBalance, loanId]);

      // Record transaction
      const transaction = await Transaction.create({
        account_id: accountId,
        member_id: loan.member_id,
        transaction_type: 'loan_payment',
        amount: paymentAmount,
        description: `Loan payment for ${loan.loan_number}`,
        reference_number: loan.loan_number,
        created_by: paidBy
      });

      // Update loan payment with transaction ID
      await query('UPDATE loan_payments SET transaction_id = $1 WHERE id = $2', [transaction.id, paymentResult.rows[0].id]);

      // Mark loan as completed if fully paid
      if (newBalance <= 0) {
        await query('UPDATE loans SET status = $1, end_date = CURRENT_DATE WHERE id = $2', ['completed', loanId]);
      }

      await query('COMMIT');

      return {
        payment: paymentResult.rows[0],
        loan: updatedLoan.rows[0],
        transaction: transaction
      };
    } catch (error) {
      await query('ROLLBACK');
      throw new Error(`Failed to make loan payment: ${error.message}`);
    }
  }

  static async getLoanPayments(loanId) {
    const sql = `
      SELECT lp.*, tl.transaction_id, tl.created_at as payment_date
      FROM loan_payments lp
      LEFT JOIN transaction_logs tl ON lp.transaction_id = tl.id
      WHERE lp.loan_id = $1
      ORDER BY lp.created_at DESC
    `;
    const result = await query(sql, [loanId]);
    return result.rows;
  }

  static async getLoanStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_loans,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_loans,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_loans,
        COUNT(CASE WHEN status = 'defaulted' THEN 1 END) as defaulted_loans,
        COALESCE(SUM(amount), 0) as total_loan_amount,
        COALESCE(SUM(amount_paid), 0) as total_amount_paid,
        COALESCE(SUM(balance), 0) as total_outstanding_balance,
        COALESCE(AVG(amount), 0) as average_loan_amount
      FROM loans
    `;
    
    const result = await query(sql);
    return result.rows[0];
  }

  static async getMonthlyLoanSummary(months = 12) {
    const sql = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as loans_created,
        COALESCE(SUM(amount), 0) as total_amount_disbursed,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as loans_completed,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as amount_completed
      FROM loans
      WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;

    const result = await query(sql);
    return result.rows;
  }

  static async getDelinquentLoans() {
    const sql = `
      SELECT 
        l.*, m.first_name, m.last_name, m.email, m.member_number,
        EXTRACT(DAYS FROM CURRENT_DATE - l.end_date) as days_overdue
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.status = 'active'
      AND l.end_date < CURRENT_DATE
      ORDER BY l.end_date ASC
    `;

    const result = await query(sql);
    return result.rows;
  }
}

module.exports = Loan;
