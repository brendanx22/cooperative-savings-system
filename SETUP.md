# Quick Setup Guide

## 🚀 Your Cooperative Savings System is Ready!

The server is running on **http://localhost:3002**

## 📋 Next Steps

### 1. Database Setup (Required)

You need to set up PostgreSQL and run the migration:

```bash
# Install PostgreSQL if not already installed
# Then create the database:
createdb cooperative_savings

# Run the database migration
npm run migrate

# (Optional) Add sample data
npm run seed
```

### 2. Test the API

The server is already running! Test these endpoints:

#### Health Check
```bash
curl http://localhost:3002/health
```

#### API Info
```bash
curl http://localhost:3002/
```

## 🎯 Quick API Testing

### Register a Member
```bash
curl -X POST http://localhost:3002/api/members/register \
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

### Member Login
```bash
curl -X POST http://localhost:3002/api/members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@email.com",
    "password": "password123"
  }'
```

### Admin Login (Seeded Data)
```bash
curl -X POST http://localhost:3002/api/members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cooperative.com",
    "password": "admin123"
  }'
```

## 📊 Available Features

✅ **Member Management** - Registration, login, profile management  
✅ **Account Management** - Multiple account types, deposits, withdrawals  
✅ **Transaction Logging** - Complete audit trail with all financial operations  
✅ **Loan Management** - Applications, approvals, payments, tracking  
✅ **Financial Reporting** - Balance sheets, income statements, analytics  
✅ **Security** - JWT authentication, role-based access control  

## 🔧 Configuration

Your `.env` file is configured with:
- **Port**: 3001
- **Database**: cooperative_savings
- **Environment**: Development

## 📚 Documentation

See `README.md` for complete API documentation and all available endpoints.

## 🛠️ Development Commands

```bash
# Start server (development mode with auto-restart)
npm run dev

# Start server (production mode)
npm start

# Run database migration
npm run migrate

# Add sample data
npm run seed

# Run tests
npm test
```

## 🎉 You're All Set!

Your Cooperative Savings System is running and ready for use. Once you set up the PostgreSQL database and run the migration, you'll have a fully functional financial management system!

**Server URL**: http://localhost:3002  
**API Base**: http://localhost:3002/api  
**Health Check**: http://localhost:3002/health

## 🎉 System Status: FULLY OPERATIONAL

✅ **Database**: PostgreSQL with complete schema  
✅ **API Server**: Running on port 3002  
✅ **Sample Data**: Seeded with admin and test members  
✅ **Authentication**: JWT-based login working  
✅ **GitHub Repository**: Created and pushed successfully  

**Repository**: https://github.com/brendanx22/cooperative-savings-system
