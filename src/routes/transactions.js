const express = require('express');
const Transaction = require('../models/Transaction');
const { validate, schemas } = require('../middleware/validation');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Create transaction
router.post('/', auth, async (req, res) => {
  try {
    const { account_id, transaction_type, amount, description, reference_number } = req.body;

    if (!account_id || !transaction_type || !amount) {
      return res.status(400).json({ error: 'Account ID, transaction type, and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const transaction = await Transaction.create({
      account_id,
      member_id: req.member.id,
      transaction_type,
      amount,
      description,
      reference_number,
      created_by: req.member.id
    });

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if transaction belongs to current member or if admin
    if (transaction.member_id !== req.member.id && !req.member.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for current member
router.get('/member/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const transactionType = req.query.transaction_type || null;

    const result = await Transaction.findByMemberId(
      req.member.id,
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

// Get transaction summary for current member
router.get('/member/summary', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const summary = await Transaction.getMemberTransactionSummary(req.member.id, days);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes

// Get all transactions (admin only)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const transactionType = req.query.transaction_type || null;

    // For admin, we'll need to implement a different method to get all transactions
    // For now, let's get transaction statistics
    const stats = await Transaction.getTransactionStats(startDate, endDate);
    
    res.json({
      message: 'Admin transaction statistics',
      stats,
      note: 'Use specific member or account endpoints for detailed transactions'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction statistics (admin only)
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    
    const stats = await Transaction.getTransactionStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily transaction summary (admin only)
router.get('/admin/daily-summary', adminAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const summary = await Transaction.getDailyTransactionSummary(days);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transactions by member ID (admin only)
router.get('/admin/member/:memberId', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const transactionType = req.query.transaction_type || null;

    const result = await Transaction.findByMemberId(
      req.params.memberId,
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

// Get transactions by account ID (admin only)
router.get('/admin/account/:accountId', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const transactionType = req.query.transaction_type || null;

    const result = await Transaction.findByAccountId(
      req.params.accountId,
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

module.exports = router;
