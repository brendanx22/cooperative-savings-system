const express = require('express');
const Report = require('../models/Report');
const { validate, schemas } = require('../middleware/validation');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Generate balance sheet (admin only)
router.get('/balance-sheet', adminAuth, async (req, res) => {
  try {
    const asOfDate = req.query.as_of_date || null;
    const balanceSheet = await Report.generateBalanceSheet(asOfDate);
    res.json(balanceSheet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate income statement (admin only)
router.get('/income-statement', adminAuth, validate(schemas.reportParams), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const incomeStatement = await Report.generateIncomeStatement(start_date, end_date);
    res.json(incomeStatement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate member statement
router.get('/member-statement/:memberId', auth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Check if member is requesting their own statement or if admin
    if (req.params.memberId != req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const memberStatement = await Report.generateMemberStatement(
      req.params.memberId,
      start_date,
      end_date
    );

    res.json(memberStatement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate transaction report (admin only)
router.get('/transactions', adminAuth, async (req, res) => {
  try {
    const { start_date, end_date, transaction_type } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const transactionReport = await Report.generateTransactionReport(
      start_date,
      end_date,
      transaction_type
    );

    res.json(transactionReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate loan portfolio report (admin only)
router.get('/loan-portfolio', adminAuth, async (req, res) => {
  try {
    const asOfDate = req.query.as_of_date || null;
    const portfolioReport = await Report.generateLoanPortfolioReport(asOfDate);
    res.json(portfolioReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate aging report (admin only)
router.get('/aging', adminAuth, async (req, res) => {
  try {
    const agingReport = await Report.generateAgingReport();
    res.json(agingReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard statistics (admin only)
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const Member = require('../models/Member');
    const Account = require('../models/Account');
    const Transaction = require('../models/Transaction');
    const Loan = require('../models/Loan');

    // Get all statistics in parallel
    const [
      memberStats,
      accountStats,
      transactionStats,
      loanStats,
      balanceSheet,
      delinquentLoans
    ] = await Promise.all([
      Member.getMemberStats(),
      Account.getAccountStats(),
      Transaction.getTransactionStats(),
      Loan.getLoanStats(),
      Report.generateBalanceSheet(),
      Loan.getDelinquentLoans()
    ]);

    res.json({
      members: memberStats,
      accounts: accountStats,
      transactions: transactionStats,
      loans: loanStats,
      balance_sheet: balanceSheet,
      delinquent_loans: delinquentLoans.length,
      system_health: {
        total_assets: balanceSheet.assets.total,
        total_liabilities: balanceSheet.liabilities.total,
        total_equity: balanceSheet.equity.total,
        is_balanced: balanceSheet.is_balanced
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get member dashboard
router.get('/member-dashboard', auth, async (req, res) => {
  try {
    const Member = require('../models/Member');
    const Account = require('../models/Account');
    const Transaction = require('../models/Transaction');
    const Loan = require('../models/Loan');

    // Get member's data
    const [member, accounts, transactionSummary, loans] = await Promise.all([
      Member.findById(req.member.id),
      Account.findByMemberId(req.member.id),
      Transaction.getMemberTransactionSummary(req.member.id, 30),
      Loan.findByMemberId(req.member.id)
    ]);

    const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance), 0);
    const totalLoanBalance = loans.reduce((sum, loan) => sum + parseFloat(loan.balance), 0);
    const activeLoans = loans.filter(loan => loan.status === 'active').length;

    res.json({
      member,
      accounts: {
        items: accounts,
        total_balance: totalBalance,
        count: accounts.length
      },
      transactions: {
        summary: transactionSummary,
        recent_count: transactionSummary.total_transactions
      },
      loans: {
        items: loans,
        total_balance: totalLoanBalance,
        active_count: activeLoans,
        total_count: loans.length
      },
      net_worth: totalBalance - totalLoanBalance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export report data (admin only)
router.get('/export/:reportType', adminAuth, async (req, res) => {
  try {
    const { reportType } = req.params;
    const { start_date, end_date, format = 'json' } = req.query;

    let data;
    
    switch (reportType) {
      case 'balance-sheet':
        data = await Report.generateBalanceSheet();
        break;
      case 'income-statement':
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'Start date and end date are required for income statement' });
        }
        data = await Report.generateIncomeStatement(start_date, end_date);
        break;
      case 'transactions':
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'Start date and end_date are required for transaction report' });
        }
        data = await Report.generateTransactionReport(start_date, end_date);
        break;
      case 'loan-portfolio':
        data = await Report.generateLoanPortfolioReport();
        break;
      case 'aging':
        data = await Report.generateAgingReport();
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    if (format === 'csv') {
      // Convert to CSV (simplified version)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('CSV export not implemented yet');
    } else {
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
