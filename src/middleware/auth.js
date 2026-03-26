const jwt = require('jsonwebtoken');
const Member = require('../models/Member');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const member = await Member.findById(decoded.id);
    
    if (!member) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    if (member.status !== 'active') {
      return res.status(401).json({ error: 'Account is not active.' });
    }

    req.member = member;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    // First run regular auth
    await auth(req, res, () => {
      // Check if user is admin (you might want to add an is_admin field to members table)
      if (!req.member.is_admin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }
      next();
    });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed.' });
  }
};

module.exports = { auth, adminAuth };
