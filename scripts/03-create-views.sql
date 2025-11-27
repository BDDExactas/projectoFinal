-- Analytical views for dashboards

-- View: Account valuations with current prices
CREATE OR REPLACE VIEW v_account_valuations AS
SELECT 
  a.id AS account_id,
  a.name AS account_name,
  a.user_id,
  u.name AS user_name,
  i.code AS instrument_code,
  i.name AS instrument_name,
  it.name AS instrument_type,
  ai.quantity,
  COALESCE(ip.price, 0) AS current_price,
  COALESCE(tp.average_price, NULL) AS average_price,
  COALESCE(ai.quantity * ip.price, 0) AS valuation,
  ip.currency_code,
  ip.price_date
FROM accounts a
JOIN users u ON a.user_id = u.id
JOIN account_instruments ai ON a.id = ai.account_id
JOIN instruments i ON ai.instrument_id = i.id
JOIN instrument_types it ON i.instrument_type_id = it.id
LEFT JOIN LATERAL (
  SELECT price, currency_code, price_date, as_of
  FROM instrument_prices
  WHERE instrument_id = i.id
  ORDER BY as_of DESC, price_date DESC
  LIMIT 1
) ip ON true
-- Average historical price for the instrument (average of all recorded prices)
LEFT JOIN LATERAL (
  SELECT AVG(ip.price) AS average_price
  FROM instrument_prices ip
  WHERE ip.instrument_id = i.id
) tp ON true
WHERE ai.quantity > 0;

-- View: Total portfolio value by account
CREATE OR REPLACE VIEW v_portfolio_totals AS
SELECT 
  account_id,
  account_name,
  user_id,
  user_name,
  currency_code,
  SUM(valuation) AS total_value,
  COUNT(DISTINCT instrument_code) AS instruments_count,
  MAX(price_date) AS last_price_date
FROM v_account_valuations
GROUP BY account_id, account_name, user_id, user_name, currency_code;

-- View: Transaction history with details
CREATE OR REPLACE VIEW v_transaction_history AS
SELECT 
  t.id AS transaction_id,
  t.transaction_date,
  t.transaction_type,
  a.name AS account_name,
  u.name AS user_name,
  i.code AS instrument_code,
  i.name AS instrument_name,
  t.quantity,
  t.price,
  t.total_amount,
  t.currency_code,
  t.description,
  if_table.filename AS source_file
FROM transactions t
JOIN accounts a ON t.account_id = a.id
JOIN users u ON a.user_id = u.id
JOIN instruments i ON t.instrument_id = i.id
LEFT JOIN imported_files if_table ON t.imported_file_id = if_table.id
ORDER BY t.transaction_date DESC;

-- View: Instrument performance (price changes)
CREATE OR REPLACE VIEW v_instrument_performance AS
SELECT 
  i.code AS instrument_code,
  i.name AS instrument_name,
  it.name AS instrument_type,
  ip_current.price AS current_price,
  ip_current.price_date AS current_date,
  ip_previous.price AS previous_price,
  ip_previous.price_date AS previous_date,
  CASE 
    WHEN ip_previous.price > 0 THEN 
      ((ip_current.price - ip_previous.price) / ip_previous.price * 100)
    ELSE 0
  END AS price_change_percent,
  ip_current.currency_code
FROM instruments i
JOIN instrument_types it ON i.instrument_type_id = it.id
LEFT JOIN LATERAL (
  SELECT price, price_date, currency_code, as_of
  FROM instrument_prices
  WHERE instrument_id = i.id
  ORDER BY as_of DESC, price_date DESC
  LIMIT 1
) ip_current ON true
LEFT JOIN LATERAL (
  SELECT price, price_date, as_of
  FROM instrument_prices
  WHERE instrument_id = i.id
    AND as_of < ip_current.as_of
  ORDER BY as_of DESC, price_date DESC
  LIMIT 1
) ip_previous ON true;
