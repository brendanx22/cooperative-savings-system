const express = require('express');
const jwt = require('jsonwebtoken');
const Member = require('../models/Member');
const Account = require('../models/Account');
const { validate, schemas } = require('../middleware/validation');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Register new member
router.post('/register', validate(schemas.member), async (req, res) => {
  try {
    // Check if email already exists
    const existingMember = await Member.findByEmail(req.body.email);
    if (existingMember) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const member = await Member.create(req.body);
    
    // Create default savings account
    await Account.create(member.id, { account_type: 'savings' });

    // Generate JWT token
    const token = jwt.sign({ id: member.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Member registered successfully',
      member,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    const member = await Member.findByEmail(email);
    if (!member) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await Member.verifyPassword(password, member.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (member.status !== 'active') {
      return res.status(401).json({ error: 'Account is not active' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: member.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({
      message: 'Login successful',
      member: {
        id: member.id,
        member_number: member.member_number,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone,
        status: member.status
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current member profile
router.get('/profile', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.member.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get member's accounts
    const accounts = await Account.findByMemberId(member.id);

    res.json({
      member,
      accounts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update member profile
router.put('/profile', auth, validate(schemas.memberUpdate), async (req, res) => {
  try {
    const member = await Member.update(req.member.id, req.body);
    res.json({
      message: 'Profile updated successfully',
      member
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const member = await Member.findById(req.member.id);
    const isValidPassword = await Member.verifyPassword(current_password, member.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await Member.updatePassword(req.member.id, new_password);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes

// Get all members (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || null;

    const result = await Member.findAll(page, limit, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get member by ID (admin only)
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const accounts = await Account.findByMemberId(member.id);
    
    res.json({
      member,
      accounts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update member (admin only)
router.put('/:id', adminAuth, validate(schemas.memberUpdate), async (req, res) => {
  try {
    const member = await Member.update(req.params.id, req.body);
    res.json({
      message: 'Member updated successfully',
      member
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete member (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const member = await Member.delete(req.params.id);
    res.json({
      message: 'Member deleted successfully',
      member
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get member statistics (admin only)
router.get('/stats/overview', adminAuth, async (req, res) => {
  try {
    const stats = await Member.getMemberStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
