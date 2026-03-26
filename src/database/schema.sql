-- Cooperative Savings System Database Schema

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS transaction_logs CASCADE;
DROP TABLE IF EXISTS loan_payments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS cooperative_settings CASCADE;

-- Cooperative Settings Table
CREATE TABLE cooperative_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Members Table
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    member_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    join_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts Table
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(20) DEFAULT 'savings' CHECK (account_type IN ('savings', 'fixed', 'current')),
    balance DECIMAL(15,2) DEFAULT 0.00,
    minimum_balance DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loans Table
CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    loan_number VARCHAR(20) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    term_months INTEGER NOT NULL,
    monthly_payment DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0.00,
    balance DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'defaulted')),
    application_date DATE DEFAULT CURRENT_DATE,
    approval_date DATE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Payments Table
CREATE TABLE loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    payment_amount DECIMAL(15,2) NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    transaction_id INTEGER REFERENCES transaction_logs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction Logs Table
CREATE TABLE transaction_logs (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'loan_disbursement', 'loan_payment', 'transfer_in', 'transfer_out', 'interest', 'fee')),
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(50),
    created_by INTEGER REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX idx_members_member_number ON members(member_number);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_accounts_member_id ON accounts(member_id);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);
CREATE INDEX idx_loans_member_id ON loans(member_id);
CREATE INDEX idx_loans_loan_number ON loans(loan_number);
CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_transaction_logs_account_id ON transaction_logs(account_id);
CREATE INDEX idx_transaction_logs_member_id ON transaction_logs(member_id);
CREATE INDEX idx_transaction_logs_transaction_id ON transaction_logs(transaction_id);
CREATE INDEX idx_transaction_logs_created_at ON transaction_logs(created_at);

-- Create Update Timestamp Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create Triggers for Updated At
CREATE TRIGGER update_cooperative_settings_updated_at BEFORE UPDATE ON cooperative_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Default Cooperative Settings
INSERT INTO cooperative_settings (setting_key, setting_value, description) VALUES
('cooperative_name', 'Your Cooperative Society', 'Name of the cooperative society'),
('cooperative_address', '123 Main Street, City, Country', 'Address of the cooperative'),
('cooperative_phone', '+1234567890', 'Phone number of the cooperative'),
('cooperative_email', 'info@cooperative.com', 'Email of the cooperative'),
('minimum_deposit', '100.00', 'Minimum deposit amount'),
('maximum_daily_withdrawal', '50000.00', 'Maximum daily withdrawal amount'),
('loan_interest_rate', '0.0500', 'Default loan interest rate'),
('loan_processing_fee', '0.0100', 'Loan processing fee rate'),
('late_payment_fee', '50.00', 'Late payment fee amount'),
('savings_interest_rate', '0.0300', 'Savings account interest rate');
