const express = require('express');
const Loan = require('../models/Loan');
const Account = require('../models/Account');
const { validate, schemas } = require('../middleware/validation');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Apply for loan
router.post('/apply', auth, validate(schemas.loan), async (req, res) => {
  try {
    // Check if member has active accounts
    const accounts = await Account.findByMemberId(req.member.id);
    if (accounts.length === 0) {
      return res.status(400).json({ error: 'Member must have at least one active account' });
    }

    const loan = await Loan.create({
      ...req.body,
      member_id: req.member.id
    });

    res.status(201).json({
      message: 'Loan application submitted successfully',
      loan
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loans for current member
router.get('/', auth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const loans = await Loan.findByMemberId(req.member.id, status);
    res.json({ loans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loan by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Check if loan belongs to current member or if admin
    if (loan.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get loan payments
    const payments = await Loan.getLoanPayments(loan.id);

    res.json({
      loan,
      payments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Make loan payment
router.post('/:id/payment', auth, async (req, res) => {
  try {
    const { payment_amount, payment_method, account_id } = req.body;

    if (!payment_amount || payment_amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be positive' });
    }

    if (!payment_method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    if (!account_id) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify account belongs to member
    const account = await Account.findById(account_id);
    if (!account || account.member_id !== loan.member_id) {
      return res.status(400).json({ error: 'Invalid account' });
    }

    const result = await Loan.makePayment(
      loan.id,
      account_id,
      payment_amount,
      payment_method,
      req.member.id
    );

    res.status(201).json({
      message: 'Loan payment successful',
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loan payments
router.get('/:id/payments', auth, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const payments = await Loan.getLoanPayments(loan.id);
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes

// Get all loans (admin only)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || null;

    const result = await Loan.findAll(page, limit, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve loan (admin only)
router.post('/:id/approve', adminAuth, async (req, res) => {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: 'Account ID is required for loan disbursement' });
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Verify account belongs to loan member
    const account = await Account.findById(account_id);
    if (!account || account.member_id !== loan.member_id) {
      return res.status(400).json({ error: 'Invalid account for loan disbursement' });
    }

    const result = await Loan.approveLoan(req.params.id, account_id, req.member.id);

    res.json({
      message: 'Loan approved and disbursed successfully',
      loan: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loan statistics (admin only)
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const stats = await Loan.getLoanStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly loan summary (admin only)
router.get('/admin/monthly-summary', adminAuth, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const summary = await Loan.getMonthlyLoanSummary(months);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get delinquent loans (admin only)
router.get('/admin/delinquent', adminAuth, async (req, res) => {
  try {
    const delinquentLoans = await Loan.getDelinquentLoans();
    res.json({ delinquent_loans: delinquentLoans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loans by member ID (admin only)
router.get('/admin/member/:memberId', adminAuth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const loans = await Loan.findByMemberId(req.params.memberId, status);
    res.json({ loans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
