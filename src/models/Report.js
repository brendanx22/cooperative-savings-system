const { query } = require('../database/connection');
const moment = require('moment');

class Report {
  static async generateBalanceSheet(asOfDate = null) {
    const dateFilter = asOfDate ? `WHERE t.created_at <= '${asOfDate}'` : '';
    
    // Assets
    const assetsSql = `
      SELECT 
        'Cash and Bank Accounts' as category,
        COALESCE(SUM(a.balance), 0) as amount
      FROM accounts a
      ${dateFilter ? `JOIN transaction_logs t ON a.id = t.account_id ${dateFilter}` : ''}
      WHERE a.status = 'active'
      
      UNION ALL
      
      SELECT 
        'Loans to Members' as category,
        COALESCE(SUM(l.balance), 0) as amount
      FROM loans l
      WHERE l.status IN ('active', 'approved')
      
      UNION ALL
      
      SELECT 
        'Other Assets' as category,
        0.00 as amount
    `;

    // Liabilities
    const liabilitiesSql = `
      SELECT 
        'Member Deposits' as category,
        COALESCE(SUM(a.balance), 0) as amount
      FROM accounts a
      WHERE a.status = 'active'
      
      UNION ALL
      
      SELECT 
        'Other Liabilities' as category,
        0.00 as amount
    `;

    // Equity
    const equitySql = `
      SELECT 
        'Retained Earnings' as category,
        (
          SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'fee' THEN t.amount ELSE -t.amount END), 0)
          FROM transaction_logs t
          WHERE t.transaction_type IN ('fee', 'interest')
          ${dateFilter ? `AND t.created_at <= '${asOfDate}'` : ''}
        ) as amount
    `;

    try {
      const [assetsResult, liabilitiesResult, equityResult] = await Promise.all([
        query(assetsSql),
        query(liabilitiesSql),
        query(equitySql)
      ]);

      const totalAssets = assetsResult.rows.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const totalLiabilities = liabilitiesResult.rows.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const totalEquity = equityResult.rows.reduce((sum, item) => sum + parseFloat(item.amount), 0);

      return {
        as_of_date: asOfDate || moment().format('YYYY-MM-DD'),
        assets: {
          items: assetsResult.rows,
          total: totalAssets
        },
        liabilities: {
          items: liabilitiesResult.rows,
          total: totalLiabilities
        },
        equity: {
          items: equityResult.rows,
          total: totalEquity
        },
        total_liabilities_equity: totalLiabilities + totalEquity,
        is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
      };
    } catch (error) {
      throw new Error(`Failed to generate balance sheet: ${error.message}`);
    }
  }

  static async generateIncomeStatement(startDate, endDate) {
    const sql = `
      SELECT 
        'Interest Income' as category,
        'income' as type,
        COALESCE(SUM(CASE WHEN transaction_type = 'interest' AND amount > 0 THEN amount ELSE 0 END), 0) as amount
      FROM transaction_logs
      WHERE created_at >= $1 AND created_at <= $2
      
      UNION ALL
      
      SELECT 
        'Fee Income' as category,
        'income' as type,
        COALESCE(SUM(CASE WHEN transaction_type = 'fee' AND amount > 0 THEN amount ELSE 0 END), 0) as amount
      FROM transaction_logs
      WHERE created_at >= $1 AND created_at <= $2
      
      UNION ALL
      
      SELECT 
        'Interest Expense' as category,
        'expense' as type,
        COALESCE(SUM(CASE WHEN transaction_type = 'interest' AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) as amount
      FROM transaction_logs
      WHERE created_at >= $1 AND created_at <= $2
      
      UNION ALL
      
      SELECT 
        'Operating Expenses' as category,
        'expense' as type,
        0.00 as amount
    `;

    try {
      const result = await query(sql, [startDate, endDate]);
      
      const income = result.rows.filter(item => item.type === 'income');
      const expenses = result.rows.filter(item => item.type === 'expense');
      
      const totalIncome = income.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const netIncome = totalIncome - totalExpenses;

      return {
        period: {
          start_date: startDate,
          end_date: endDate
        },
        income: {
          items: income,
          total: totalIncome
        },
        expenses: {
          items: expenses,
          total: totalExpenses
        },
        net_income: netIncome
      };
    } catch (error) {
      throw new Error(`Failed to generate income statement: ${error.message}`);
    }
  }

  static async generateMemberStatement(memberId, startDate, endDate) {
    const memberSql = 'SELECT * FROM members WHERE id = $1';
    const accountsSql = 'SELECT * FROM accounts WHERE member_id = $1';
    const transactionsSql = `
      SELECT t.*, a.account_number
      FROM transaction_logs t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.member_id = $1 AND t.created_at >= $2 AND t.created_at <= $3
      ORDER BY t.created_at DESC
    `;
    const loansSql = 'SELECT * FROM loans WHERE member_id = $1';

    try {
      const [memberResult, accountsResult, transactionsResult, loansResult] = await Promise.all([
        query(memberSql, [memberId]),
        query(accountsSql, [memberId]),
        query(transactionsSql, [memberId, startDate, endDate]),
        query(loansSql, [memberId])
      ]);

      const member = memberResult.rows[0];
      if (!member) {
        throw new Error('Member not found');
      }

      const totalBalance = accountsResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const totalLoanBalance = loansResult.rows.reduce((sum, loan) => sum + parseFloat(loan.balance), 0);

      return {
        member: member,
        period: {
          start_date: startDate,
          end_date: endDate
        },
        accounts: {
          items: accountsResult.rows,
          total_balance: totalBalance
        },
        loans: {
          items: loansResult.rows,
          total_balance: totalLoanBalance
        },
        transactions: transactionsResult.rows,
        summary: {
          opening_balance: 0, // Would need to calculate from previous period
          net_change: 0, // Would need to calculate from transactions
          closing_balance: totalBalance
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate member statement: ${error.message}`);
    }
  }

  static async generateTransactionReport(startDate, endDate, transactionType = null) {
    let sql = `
      SELECT 
        t.*,
        a.account_number,
        m.first_name,
        m.last_name,
        m.member_number
      FROM transaction_logs t
      JOIN accounts a ON t.account_id = a.id
      JOIN members m ON t.member_id = m.id
      WHERE t.created_at >= $1 AND t.created_at <= $2
    `;
    const params = [startDate, endDate];

    if (transactionType) {
      sql += ' AND t.transaction_type = $3';
      params.push(transactionType);
    }

    sql += ' ORDER BY t.created_at DESC';

    try {
      const result = await query(sql, params);
      
      // Calculate summary statistics
      const summary = {
        total_transactions: result.rows.length,
        total_amount: result.rows.reduce((sum, item) => sum + parseFloat(item.amount), 0),
        transaction_types: {}
      };

      result.rows.forEach(transaction => {
        const type = transaction.transaction_type;
        if (!summary.transaction_types[type]) {
          summary.transaction_types[type] = {
            count: 0,
            total_amount: 0
          };
        }
        summary.transaction_types[type].count++;
        summary.transaction_types[type].total_amount += parseFloat(transaction.amount);
      });

      return {
        period: {
          start_date: startDate,
          end_date: endDate
        },
        transactions: result.rows,
        summary: summary
      };
    } catch (error) {
      throw new Error(`Failed to generate transaction report: ${error.message}`);
    }
  }

  static async generateLoanPortfolioReport(asOfDate = null) {
    const dateFilter = asOfDate ? `WHERE created_at <= '${asOfDate}'` : '';
    
    const sql = `
      SELECT 
        l.*,
        m.first_name,
        m.last_name,
        m.member_number,
        EXTRACT(DAYS FROM CURRENT_DATE - l.end_date) as days_overdue
      FROM loans l
      JOIN members m ON l.member_id = m.id
      ORDER BY l.created_at DESC
    `;

    try {
      const result = await query(sql);
      
      // Calculate portfolio statistics
      const portfolio = {
        total_loans: result.rows.length,
        total_amount: result.rows.reduce((sum, loan) => sum + parseFloat(loan.amount), 0),
        total_balance: result.rows.reduce((sum, loan) => sum + parseFloat(loan.balance), 0),
        total_paid: result.rows.reduce((sum, loan) => sum + parseFloat(loan.amount_paid), 0),
        status_breakdown: {},
        overdue_loans: 0,
        overdue_amount: 0
      };

      result.rows.forEach(loan => {
        const status = loan.status;
        if (!portfolio.status_breakdown[status]) {
          portfolio.status_breakdown[status] = {
            count: 0,
            total_amount: 0,
            total_balance: 0
          };
        }
        portfolio.status_breakdown[status].count++;
        portfolio.status_breakdown[status].total_amount += parseFloat(loan.amount);
        portfolio.status_breakdown[status].total_balance += parseFloat(loan.balance);

        // Check for overdue loans
        if (loan.status === 'active' && loan.end_date && new Date(loan.end_date) < new Date()) {
          portfolio.overdue_loans++;
          portfolio.overdue_amount += parseFloat(loan.balance);
        }
      });

      return {
        as_of_date: asOfDate || moment().format('YYYY-MM-DD'),
        loans: result.rows,
        portfolio: portfolio
      };
    } catch (error) {
      throw new Error(`Failed to generate loan portfolio report: ${error.message}`);
    }
  }

  static async generateAgingReport() {
    const sql = `
      SELECT 
        l.loan_number,
        l.amount,
        l.balance,
        l.end_date,
        m.member_number,
        m.first_name,
        m.last_name,
        CASE 
          WHEN l.end_date < CURRENT_DATE - INTERVAL '30 days' THEN '30-60 days'
          WHEN l.end_date < CURRENT_DATE - INTERVAL '60 days' THEN '60-90 days'
          WHEN l.end_date < CURRENT_DATE - INTERVAL '90 days' THEN '90+ days'
          WHEN l.end_date < CURRENT_DATE THEN 'Current'
          ELSE 'Not Due'
        END as aging_bucket,
        EXTRACT(DAYS FROM CURRENT_DATE - l.end_date) as days_overdue
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.status = 'active'
      ORDER BY l.end_date ASC
    `;

    try {
      const result = await query(sql);
      
      // Group by aging buckets
      const agingBuckets = {
        'Current': { count: 0, amount: 0 },
        '30-60 days': { count: 0, amount: 0 },
        '60-90 days': { count: 0, amount: 0 },
        '90+ days': { count: 0, amount: 0 },
        'Not Due': { count: 0, amount: 0 }
      };

      result.rows.forEach(loan => {
        const bucket = loan.aging_bucket;
        agingBuckets[bucket].count++;
        agingBuckets[bucket].amount += parseFloat(loan.balance);
      });

      return {
        as_of_date: moment().format('YYYY-MM-DD'),
        loans: result.rows,
        aging_summary: agingBuckets
      };
    } catch (error) {
      throw new Error(`Failed to generate aging report: ${error.message}`);
    }
  }
}

module.exports = Report;
