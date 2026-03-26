const express = require('express');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { validate, schemas } = require('../middleware/validation');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Create new account
router.post('/', auth, validate(schemas.account), async (req, res) => {
  try {
    const account = await Account.create(req.member.id, req.body);
    res.status(201).json({
      message: 'Account created successfully',
      account
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all accounts for current member
router.get('/', auth, async (req, res) => {
  try {
    const accounts = await Account.findByMemberId(req.member.id);
    res.json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if account belongs to current member or if admin
    if (account.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summary = await Account.getAccountSummary(account.id);
    
    res.json({
      account: summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deposit to account
router.post('/:id/deposit', auth, async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Deposit amount must be positive' });
    }

    const account = await Account.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (account.status !== 'active') {
      return res.status(400).json({ error: 'Account is not active' });
    }

    const transaction = await Transaction.create({
      account_id: account.id,
      member_id: account.member_id,
      transaction_type: 'deposit',
      amount,
      description: description || `Deposit to account ${account.account_number}`,
      created_by: req.member.id
    });

    res.status(201).json({
      message: 'Deposit successful',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Withdraw from account
router.post('/:id/withdraw', auth, async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Withdrawal amount must be positive' });
    }

    const account = await Account.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (account.status !== 'active') {
      return res.status(400).json({ error: 'Account is not active' });
    }

    const transaction = await Transaction.create({
      account_id: account.id,
      member_id: account.member_id,
      transaction_type: 'withdrawal',
      amount,
      description: description || `Withdrawal from account ${account.account_number}`,
      created_by: req.member.id
    });

    res.status(201).json({
      message: 'Withdrawal successful',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account transactions
router.get('/:id/transactions', auth, async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const transactionType = req.query.transaction_type || null;

    const result = await Transaction.findByAccountId(
      account.id, 
      page, 
      limit, 
      startDate, 
      endDate, 
      transactionType
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes

// Get all accounts (admin only)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || null;

    const result = await Account.findAll(page, limit, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update account status (admin only)
router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'frozen'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const account = await Account.updateStatus(req.params.id, status);
    
    res.json({
      message: 'Account status updated successfully',
      account
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account statistics (admin only)
router.get('/stats/overview', adminAuth, async (req, res) => {
  try {
    const stats = await Account.getAccountStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
