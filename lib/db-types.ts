// TypeScript types for database entities

export interface User {
  email: string
  name: string
  password_hash?: string
  created_at: Date
  updated_at: Date
}

export interface InstrumentType {
  code: "cash" | "bond" | "stock" | "other"
  name: string
  description?: string
}

export interface Instrument {
  instrument_type_code: InstrumentType["code"]
  code: string
  name: string
  external_symbol?: string
  description?: string
  created_at: Date
}

export interface Account {
  user_email: string
  parent_user_email?: string | null
  parent_account_name?: string | null
  name: string
  account_type: "bank_account" | "portfolio" | "grouped"
  bank_name?: string
  created_at: Date
  updated_at: Date
}

export interface AccountInstrument {
  account_user_email: string
  account_name: string
  instrument_code: string
  quantity: number
  updated_at: Date
}

export interface InstrumentPrice {
  instrument_code: string
  price_date: Date
  price: number
  currency_code: string
  as_of?: Date
  created_at: Date
}

export interface ImportedFile {
  user_email: string
  filename: string
  file_path?: string
  upload_date: Date
  status: "pending" | "processing" | "completed" | "failed"
  rows_processed: number
  errors_count: number
  error_details?: string
}

export interface Transaction {
  account_user_email: string
  account_name: string
  instrument_code: string
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
  account_user_email: string
  account_name: string
  user_email: string
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
  fx_rate_to_base?: number
  valuation_base?: number
}

export interface PortfolioTotal {
  account_user_email: string
  account_name: string
  user_email: string
  user_name: string
  currency_code: string
  total_value: number
  total_value_base?: number
  instruments_count: number
  last_price_date: Date
  base_currency_code?: string
}

export interface TransactionHistory {
  transaction_id: number
  transaction_date: Date
  transaction_type: string
  account_user_email: string
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
