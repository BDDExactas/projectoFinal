// TypeScript types for database entities

export interface User {
  id: number
  email: string
  name: string
  password_hash?: string
  created_at: Date
  updated_at: Date
}

export interface InstrumentType {
  id: number
  code: "cash" | "bond" | "stock" | "other"
  name: string
  description?: string
}

export interface Instrument {
  id: number
  instrument_type_id: number
  code: string
  name: string
  external_symbol?: string
  description?: string
  created_at: Date
}

export interface Account {
  id: number
  user_id: number
  parent_account_id?: number
  name: string
  account_type: "bank_account" | "portfolio" | "grouped"
  bank_name?: string
  created_at: Date
  updated_at: Date
}

export interface AccountInstrument {
  id: number
  account_id: number
  instrument_id: number
  quantity: number
  updated_at: Date
}

export interface InstrumentPrice {
  id: number
  instrument_id: number
  price_date: Date
  price: number
  currency_code: string
  as_of?: Date
  created_at: Date
}

export interface ImportedFile {
  id: number
  user_id: number
  filename: string
  file_path?: string
  upload_date: Date
  status: "pending" | "processing" | "completed" | "failed"
  rows_processed: number
  errors_count: number
  error_details?: string
}

export interface Transaction {
  id: number
  account_id: number
  instrument_id: number
  imported_file_id?: number
  transaction_date: Date
  transaction_type: "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "interest"
  quantity: number
  price?: number
  total_amount?: number
  currency_code: string
  description?: string
  created_at: Date
}

// View types
export interface AccountValuation {
  account_id: number
  account_name: string
  user_id: number
  user_name: string
  instrument_code: string
  instrument_name: string
  instrument_type: string
  quantity: number
  current_price: number
  average_price?: number | null
  valuation: number
  currency_code: string
  price_date: Date
}

export interface PortfolioTotal {
  account_id: number
  account_name: string
  user_id: number
  user_name: string
  currency_code: string
  total_value: number
  instruments_count: number
  last_price_date: Date
}

export interface TransactionHistory {
  transaction_id: number
  transaction_date: Date
  transaction_type: string
  account_name: string
  user_name: string
  instrument_code: string
  instrument_name: string
  quantity: number
  price?: number
  total_amount?: number
  currency_code: string
  description?: string
  source_file?: string
}

export interface InstrumentPerformance {
  instrument_code: string
  instrument_name: string
  instrument_type: string
  current_price: number
  current_date: Date
  previous_price?: number
  previous_date?: Date
  price_change_percent: number
  currency_code: string
}
