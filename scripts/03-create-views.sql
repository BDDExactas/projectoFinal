-- Analytical views for dashboards

-- View: Latest FX rates to base currency (price = base currency per 1 unit of currency_code)
CREATE OR REPLACE VIEW v_currency_rates AS
SELECT DISTINCT ON (i.code)
  i.code AS currency_code,
  COALESCE(ip.price, 1) AS rate_to_base,
  COALESCE(ip.price_date, CURRENT_DATE) AS price_date,
  COALESCE(ip.as_of, CURRENT_TIMESTAMP) AS as_of
FROM instruments i
JOIN instrument_types it ON i.instrument_type_code = it.code
LEFT JOIN LATERAL (
  SELECT price, price_date, as_of
  FROM instrument_prices
  WHERE instrument_code = i.code
  ORDER BY price_date DESC, as_of DESC NULLS LAST, created_at DESC
  LIMIT 1
) ip ON true
WHERE it.code = 'cash'
ORDER BY i.code, ip.price_date DESC NULLS LAST, ip.as_of DESC NULLS LAST;

CREATE OR REPLACE VIEW v_account_valuations AS
SELECT 
  ai.user_email AS account_user_email,
  a.name AS account_name,
  a.user_email,
  u.name AS user_name,
  i.code AS instrument_code,
  i.name AS instrument_name,
  it.name AS instrument_type,
  ai.quantity,
  COALESCE(ip.price, 0) AS current_price,
  COALESCE(tp.average_price, NULL) AS average_price,
  COALESCE(ai.quantity * ip.price, 0) AS valuation,
  ip.currency_code,
  ip.price_date,
  COALESCE(cr.rate_to_base, 1) AS fx_rate_to_base,
  COALESCE(ai.quantity * ip.price * COALESCE(cr.rate_to_base, 1), 0) AS valuation_base
FROM accounts a
JOIN users u ON a.user_email = u.email
JOIN account_instruments ai ON a.user_email = ai.user_email AND a.name = ai.account_name
JOIN instruments i ON ai.instrument_code = i.code
JOIN instrument_types it ON i.instrument_type_code = it.code
LEFT JOIN LATERAL (
  SELECT price, currency_code, price_date, as_of
  FROM instrument_prices
  WHERE instrument_code = i.code
  ORDER BY price_date DESC, as_of DESC NULLS LAST, created_at DESC
  LIMIT 1
) ip ON true
LEFT JOIN v_currency_rates cr ON ip.currency_code = cr.currency_code
-- Average historical price for the instrument (average of all recorded prices)
LEFT JOIN LATERAL (
  SELECT AVG(ip.price) AS average_price
  FROM instrument_prices ip
  WHERE ip.instrument_code = i.code
) tp ON true
WHERE ai.quantity > 0;

CREATE OR REPLACE VIEW v_portfolio_totals AS
SELECT 
  account_user_email,
  account_name,
  user_email,
  user_name,
  currency_code,
  SUM(valuation) AS total_value,
  SUM(valuation_base) AS total_value_base,
  COUNT(DISTINCT instrument_code) AS instruments_count,
  MAX(price_date) AS last_price_date,
  COALESCE(
    (
      SELECT currency_code
      FROM v_currency_rates
      WHERE rate_to_base = 1
      ORDER BY currency_code
      LIMIT 1
    ),
    'ARS'
  ) AS base_currency_code
FROM v_account_valuations
GROUP BY account_user_email, account_name, user_email, user_name, currency_code;

-- View: Transaction history with details
CREATE OR REPLACE VIEW v_transaction_history AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY t.transaction_date DESC, t.created_at DESC) AS transaction_id,
  t.transaction_date,
  t.transaction_type,
  t.user_email AS account_user_email,
  t.account_name,
  u.name AS user_name,
  t.instrument_code,
  i.name AS instrument_name,
  t.quantity,
  t.price,
  t.total_amount,
  t.currency_code,
  t.description
FROM transactions t
JOIN users u ON t.user_email = u.email
JOIN instruments i ON t.instrument_code = i.code
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
JOIN instrument_types it ON i.instrument_type_code = it.code
LEFT JOIN LATERAL (
  SELECT price, price_date, currency_code, as_of
  FROM instrument_prices
  WHERE instrument_code = i.code
  ORDER BY price_date DESC, as_of DESC NULLS LAST, created_at DESC
  LIMIT 1
) ip_current ON true
LEFT JOIN LATERAL (
  SELECT price, price_date, as_of
  FROM instrument_prices
  WHERE instrument_code = i.code
    AND as_of < ip_current.as_of
  ORDER BY price_date DESC, as_of DESC NULLS LAST, created_at DESC
  LIMIT 1
) ip_previous ON true;
