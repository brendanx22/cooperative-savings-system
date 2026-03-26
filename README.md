# Cooperative Savings System

A comprehensive cooperative savings management system built with Node.js, PostgreSQL, and Express.js. This system provides complete financial management capabilities including member management, transaction logging, loan management, and financial reporting.

## Features

### Core Functionality
- **Member Management**: Complete CRUD operations for cooperative members
- **Account Management**: Multiple account types (savings, fixed, current)
- **Transaction Logging**: Comprehensive transaction tracking with audit trails
- **Loan Management**: Loan applications, approvals, payments, and tracking
- **Financial Reporting**: Balance sheets, income statements, member statements, and more

### Security & Authentication
- JWT-based authentication
- Role-based access control (member/admin)
- Password hashing with bcrypt
- Input validation and sanitization

### Reporting & Analytics
- Real-time balance sheets
- Income and expense statements
- Member account statements
- Loan portfolio reports
- Aging reports for delinquent loans
- Transaction analytics and summaries

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with advanced SQL features
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi for input validation
- **Security**: Helmet, CORS, bcrypt
- **Logging**: Morgan for request logging

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd cooperative-savings-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb cooperative_savings

# Copy environment configuration
cp .env.example .env

# Edit .env file with your database credentials
```

### 4. Environment Configuration
Update `.env` file with your settings:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cooperative_savings
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Cooperative Configuration
COOPERATIVE_NAME=Your Cooperative Society
COOPERATIVE_ADDRESS=123 Main Street, City, Country
COOPERATIVE_PHONE=+1234567890
COOPERATIVE_EMAIL=info@cooperative.com

# Transaction Settings
MINIMUM_DEPOSIT=100
MAXIMUM_DAILY_WITHDRAWAL=50000
LOAN_INTEREST_RATE=0.05
```

### 5. Database Migration
```bash
# Run database schema migration
npm run migrate
```

### 6. Seed Sample Data (Optional)
```bash
# Populate database with sample data
npm run seed
```

### 7. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Members
- `POST /members/register` - Register new member
- `POST /members/login` - Member login
- `GET /members/profile` - Get current member profile
- `PUT /members/profile` - Update member profile
- `PUT /members/password` - Change password
- `GET /members` - Get all members (admin only)
- `GET /members/:id` - Get member by ID (admin only)
- `PUT /members/:id` - Update member (admin only)
- `DELETE /members/:id` - Delete member (admin only)

#### Accounts
- `POST /accounts` - Create new account
- `GET /accounts` - Get member's accounts
- `GET /accounts/:id` - Get account by ID
- `POST /accounts/:id/deposit` - Deposit to account
- `POST /accounts/:id/withdraw` - Withdraw from account
- `GET /accounts/:id/transactions` - Get account transactions
- `GET /accounts/admin/all` - Get all accounts (admin only)
- `PUT /accounts/:id/status` - Update account status (admin only)

#### Transactions
- `POST /transactions` - Create transaction
- `GET /transactions/:id` - Get transaction by ID
- `GET /transactions/member/transactions` - Get member's transactions
- `GET /transactions/member/summary` - Get member transaction summary
- `GET /transactions/admin/stats` - Get transaction statistics (admin only)
- `GET /transactions/admin/daily-summary` - Get daily summary (admin only)

#### Loans
- `POST /loans/apply` - Apply for loan
- `GET /loans` - Get member's loans
- `GET /loans/:id` - Get loan by ID
- `POST /loans/:id/payment` - Make loan payment
- `GET /loans/:id/payments` - Get loan payments
- `GET /loans/admin/all` - Get all loans (admin only)
- `POST /loans/:id/approve` - Approve loan (admin only)
- `GET /loans/admin/delinquent` - Get delinquent loans (admin only)

#### Reports
- `GET /reports/balance-sheet` - Generate balance sheet (admin only)
- `GET /reports/income-statement` - Generate income statement (admin only)
- `GET /reports/member-statement/:memberId` - Generate member statement
- `GET /reports/transactions` - Generate transaction report (admin only)
- `GET /reports/loan-portfolio` - Generate loan portfolio report (admin only)
- `GET /reports/aging` - Generate aging report (admin only)
- `GET /reports/dashboard` - Get dashboard statistics (admin only)
- `GET /reports/member-dashboard` - Get member dashboard

### Sample API Usage

#### Register a New Member
```bash
curl -X POST http://localhost:3000/api/members/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@email.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, Country",
    "date_of_birth": "1990-05-15",
    "password": "password123"
  }'
```

#### Member Login
```bash
curl -X POST http://localhost:3000/api/members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@email.com",
    "password": "password123"
  }'
```

#### Make a Deposit
```bash
curl -X POST http://localhost:3000/api/accounts/1/deposit \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "description": "Monthly savings deposit"
  }'
```

#### Apply for a Loan
```bash
curl -X POST http://localhost:3000/api/loans/apply \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "interest_rate": 0.05,
    "term_months": 12
  }'
```

## Database Schema

The system uses PostgreSQL with the following main tables:

- **members**: Member information and authentication
- **accounts**: Member accounts with balances
- **transaction_logs**: Complete transaction history
- **loans**: Loan applications and tracking
- **loan_payments**: Loan payment records
- **cooperative_settings**: System configuration

## Project Structure

```
cooperative-savings-system/
├── src/
│   ├── database/
│   │   ├── connection.js      # Database connection
│   │   ├── schema.sql         # Database schema
│   │   ├── migrate.js         # Migration script
│   │   └── seed.js            # Sample data
│   ├── models/
│   │   ├── Member.js          # Member model
│   │   ├── Account.js         # Account model
│   │   ├── Transaction.js     # Transaction model
│   │   ├── Loan.js            # Loan model
│   │   └── Report.js          # Report model
│   ├── routes/
│   │   ├── members.js         # Member routes
│   │   ├── accounts.js        # Account routes
│   │   ├── transactions.js    # Transaction routes
│   │   ├── loans.js           # Loan routes
│   │   └── reports.js         # Report routes
│   ├── middleware/
│   │   ├── auth.js            # Authentication middleware
│   │   └── validation.js      # Input validation
│   └── server.js              # Express server
├── package.json
├── .env.example
└── README.md
```

## Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Password Security**: bcrypt hashing with salt rounds
3. **Input Validation**: Joi validation schemas
4. **SQL Injection**: Parameterized queries
5. **CORS**: Configured for cross-origin requests
6. **Rate Limiting**: Consider implementing for production
7. **HTTPS**: Use in production environments

## Development

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

The server will automatically restart on file changes using nodemon.

### Database Reset
```bash
# Drop and recreate database
dropdb cooperative_savings
createdb cooperative_savings
npm run migrate
npm run seed
```

## Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use a process manager like PM2
3. Configure reverse proxy (nginx/Apache)
4. Set up SSL/TLS
5. Configure database backups
6. Set up monitoring and logging
7. Review security settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact:
- Email: support@cooperative.com
- Phone: +1234567890

---

**Note**: This is a demonstration system. For production use, ensure proper security measures, testing, and compliance with financial regulations in your jurisdiction.
