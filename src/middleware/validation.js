const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

const schemas = {
  member: Joi.object({
    first_name: Joi.string().min(2).max(100).required(),
    last_name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[+]?[\d\s\-()]+$/).optional(),
    address: Joi.string().max(500).optional(),
    date_of_birth: Joi.date().max('now').required(),
    password: Joi.string().min(6).required()
  }),

  memberUpdate: Joi.object({
    first_name: Joi.string().min(2).max(100).optional(),
    last_name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[+]?[\d\s\-()]+$/).optional(),
    address: Joi.string().max(500).optional(),
    date_of_birth: Joi.date().max('now').optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended').optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  account: Joi.object({
    account_type: Joi.string().valid('savings', 'fixed', 'current').default('savings'),
    minimum_balance: Joi.number().min(0).default(0)
  }),

  transaction: Joi.object({
    account_id: Joi.number().integer().positive().required(),
    transaction_type: Joi.string().valid('deposit', 'withdrawal', 'interest', 'fee').required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().max(500).optional(),
    reference_number: Joi.string().max(50).optional()
  }),

  loan: Joi.object({
    member_id: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().required(),
    interest_rate: Joi.number().positive().max(1).required(),
    term_months: Joi.number().integer().positive().required(),
    application_date: Joi.date().default(() => new Date().toISOString().split('T')[0])
  }),

  loanPayment: Joi.object({
    payment_amount: Joi.number().positive().required(),
    payment_method: Joi.string().max(50).required()
  }),

  reportParams: Joi.object({
    start_date: Joi.date().required(),
    end_date: Joi.date().min(Joi.ref('start_date')).required(),
    transaction_type: Joi.string().valid('deposit', 'withdrawal', 'loan_disbursement', 'loan_payment', 'interest', 'fee').optional()
  }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().optional()
  })
};

module.exports = { validate, schemas };
