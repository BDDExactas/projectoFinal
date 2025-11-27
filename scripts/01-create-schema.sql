-- Financial Platform Database Schema
-- Based on simplified model: Accounts contain Instruments
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS account_instruments CASCADE;
DROP TABLE IF EXISTS instrument_prices CASCADE;
DROP TABLE IF EXISTS account_valuations CASCADE; -- Por si acaso es una tabla y no vista
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS instruments CASCADE;
DROP TABLE IF EXISTS instrument_types CASCADE;
DROP TABLE IF EXISTS imported_files CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Instrument types (cash, bond, stock, other)
CREATE TABLE IF NOT EXISTS instrument_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL, -- 'cash', 'bond', 'stock', 'other'
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- Instruments (USD, ARS, AL30, YPFD, etc.)
CREATE TABLE IF NOT EXISTS instruments (
  id SERIAL PRIMARY KEY,
  instrument_type_id INTEGER REFERENCES instrument_types(id),
  code VARCHAR(50) UNIQUE NOT NULL, -- 'USD', 'ARS', 'AL30', 'BA24C', 'LOMA', 'METRD', 'YPFD'
  name VARCHAR(255) NOT NULL,
  external_symbol VARCHAR(255), -- Provider-specific ticker (Finnhub, etc.)
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts (bank accounts or portfolios)
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  parent_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, -- For nested portfolios
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'bank_account', 'portfolio', 'grouped'
  bank_name VARCHAR(255), -- Optional, for bank accounts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account instruments (junction table with quantities)
CREATE TABLE IF NOT EXISTS account_instruments (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
  quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, instrument_id)
);

-- Instrument prices (for valuation)
CREATE TABLE IF NOT EXISTS instrument_prices (
  id SERIAL PRIMARY KEY,
  instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  price DECIMAL(18, 8) NOT NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'ARS', -- Price currency
  as_of TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- precise timestamp of quote
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(instrument_id, price_date)
);

-- Imported files (for traceability)
CREATE TABLE IF NOT EXISTS imported_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  rows_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details TEXT
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
  imported_file_id INTEGER REFERENCES imported_files(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest'
  quantity DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 8),
  total_amount DECIMAL(18, 8),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'ARS',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent_id ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_account_instruments_account ON account_instruments(account_id);
CREATE INDEX IF NOT EXISTS idx_account_instruments_instrument ON account_instruments(instrument_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_file ON transactions(imported_file_id);
CREATE INDEX IF NOT EXISTS idx_instrument_prices_instrument ON instrument_prices(instrument_id);
CREATE INDEX IF NOT EXISTS idx_instrument_prices_date ON instrument_prices(price_date);
CREATE INDEX IF NOT EXISTS idx_instrument_prices_asof ON instrument_prices(as_of DESC);
