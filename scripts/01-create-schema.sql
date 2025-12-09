-- 1. Limpieza (Orden inverso por dependencias)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS account_instruments CASCADE;
DROP TABLE IF EXISTS instrument_prices CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS instruments CASCADE;
DROP TABLE IF EXISTS instrument_types CASCADE;
DROP TABLE IF EXISTS imported_files CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Users
-- Clave Natural: El email (es único por definición en el sistema)
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Instrument Types
-- Clave Natural: El código del tipo (ej: 'bond', 'stock')
CREATE TABLE IF NOT EXISTS instrument_types (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- 4. Instruments
-- Clave Natural: El ticker o código del instrumento (ej: 'AAPL', 'AL30')
CREATE TABLE IF NOT EXISTS instruments (
  code VARCHAR(50) PRIMARY KEY,
  instrument_type_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  external_symbol VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_instruments_type 
    FOREIGN KEY (instrument_type_code) 
    REFERENCES instrument_types(code) 
    ON UPDATE CASCADE
);

-- 5. Accounts
-- Clave Natural Compuesta: Un usuario + El nombre que le dio a su cuenta
-- Asumimos que un usuario no puede tener dos cuentas con el nombre "Ahorros"
CREATE TABLE IF NOT EXISTS accounts (
  user_email VARCHAR(255),
  name VARCHAR(255),
  parent_account_name VARCHAR(255), -- Para carteras anidadas
  
  account_type VARCHAR(50) NOT NULL,
  bank_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_email, name),
  
  CONSTRAINT fk_accounts_user 
    FOREIGN KEY (user_email) 
    REFERENCES users(email) 
    ON UPDATE CASCADE ON DELETE CASCADE,
    
  CONSTRAINT fk_accounts_parent 
    FOREIGN KEY (user_email, parent_account_name) 
    REFERENCES accounts(user_email, name) 
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- 6. Imported Files
-- Clave Natural Compuesta: Usuario + Nombre archivo + Fecha subida
-- Esto garantiza unicidad aunque se suba el mismo archivo dos veces
CREATE TABLE IF NOT EXISTS imported_files (
  user_email VARCHAR(255),
  filename VARCHAR(255),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  file_path VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  rows_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details TEXT,
  
  PRIMARY KEY (user_email, filename, upload_date),
  
  CONSTRAINT fk_files_user 
    FOREIGN KEY (user_email) 
    REFERENCES users(email) 
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- 7. Account Instruments (Tabla Pivote)
-- Clave Natural: La combinación de la cuenta (Usuario+Nombre) y el Instrumento (Código)
CREATE TABLE IF NOT EXISTS account_instruments (
  user_email VARCHAR(255),
  account_name VARCHAR(255),
  instrument_code VARCHAR(50),
  
  quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_email, account_name, instrument_code),
  
  CONSTRAINT fk_ai_account 
    FOREIGN KEY (user_email, account_name) 
    REFERENCES accounts(user_email, name) 
    ON UPDATE CASCADE ON DELETE CASCADE,
    
  CONSTRAINT fk_ai_instrument 
    FOREIGN KEY (instrument_code) 
    REFERENCES instruments(code) 
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- 8. Instrument Prices
-- Clave Natural: Instrumento + Fecha
CREATE TABLE IF NOT EXISTS instrument_prices (
  instrument_code VARCHAR(50),
  price_date DATE NOT NULL,
  
  price DECIMAL(18, 8) NOT NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'ARS',
  as_of TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (instrument_code, price_date),
  
  CONSTRAINT fk_prices_instrument 
    FOREIGN KEY (instrument_code) 
    REFERENCES instruments(code) 
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- 9. Transactions
-- Clave Natural: Aquí es complejo. Una transacción se define por Dónde, Qué y Cuándo.
-- Usaremos Cuenta + Instrumento + Fecha + Created_At para unicidad.
-- Nota cómo las FKs se vuelven grandes porque arrastran las claves compuestas de arriba.
CREATE TABLE IF NOT EXISTS transactions (
  -- Referencia a Account
  user_email VARCHAR(255),
  account_name VARCHAR(255),
  
  -- Referencia a Instrument
  instrument_code VARCHAR(50),
  
  -- Referencia a Imported Files (Opcional)
  file_filename VARCHAR(255),
  file_upload_date TIMESTAMP,
  -- Nota: file_user_email es redundante con user_email, pero necesario para la FK estricta
  -- si quisiéramos integridad referencial pura, aunque asumimos que es el mismo usuario.
  
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  transaction_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 8),
  total_amount DECIMAL(18, 8),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'ARS',
  description TEXT,
  
  -- La PK es la combinación de todo lo necesario para que sea único un evento
  PRIMARY KEY (user_email, account_name, instrument_code, transaction_date, created_at),
  
  CONSTRAINT fk_trans_account 
    FOREIGN KEY (user_email, account_name) 
    REFERENCES accounts(user_email, name) 
    ON UPDATE CASCADE ON DELETE CASCADE,
    
  CONSTRAINT fk_trans_instrument 
    FOREIGN KEY (instrument_code) 
    REFERENCES instruments(code) 
    ON UPDATE CASCADE,
    
  CONSTRAINT fk_trans_file 
    FOREIGN KEY (user_email, file_filename, file_upload_date) 
    REFERENCES imported_files(user_email, filename, upload_date) 
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- Índices (Ajustados a las nuevas columnas de texto)
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_trans_instrument ON transactions(instrument_code);
CREATE INDEX IF NOT EXISTS idx_prices_date ON instrument_prices(price_date);