-- Seed initial data for instrument types and common instruments

-- Insert instrument types
INSERT INTO instrument_types (code, name, description) VALUES
  ('cash', 'Efectivo', 'Dinero en efectivo o depósitos bancarios'),
  ('bond', 'Bono', 'Títulos de deuda pública o privada'),
  ('stock', 'Acción', 'Acciones de empresas cotizadas'),
  ('other', 'Otro', 'Otros instrumentos financieros')
ON CONFLICT (code) DO NOTHING;

-- Insert common cash instruments (currencies)
INSERT INTO instruments (instrument_type_id, code, name, external_symbol, description) VALUES
  ((SELECT id FROM instrument_types WHERE code = 'cash'), 'ARS', 'Peso Argentino', 'USDARS', 'Moneda local argentina'),
  ((SELECT id FROM instrument_types WHERE code = 'cash'), 'USD', 'Dólar Estadounidense', 'USD', 'Dólar de Estados Unidos'),
  ((SELECT id FROM instrument_types WHERE code = 'cash'), 'EUR', 'Euro', 'EUR', 'Moneda europea')
ON CONFLICT (code) DO NOTHING;

-- Insert common Argentine bonds
INSERT INTO instruments (instrument_type_id, code, name, external_symbol, description) VALUES
  ((SELECT id FROM instrument_types WHERE code = 'bond'), 'AL30', 'Bono AL30', 'AL30.BA', 'Bono soberano argentino 2030'),
  ((SELECT id FROM instrument_types WHERE code = 'bond'), 'BA24C', 'Bono BA24C', 'BA24C.BA', 'Bono de la Ciudad de Buenos Aires 2024')
ON CONFLICT (code) DO NOTHING;

-- Insert common Argentine stocks
INSERT INTO instruments (instrument_type_id, code, name, external_symbol, description) VALUES
  ((SELECT id FROM instrument_types WHERE code = 'stock'), 'YPFD', 'YPF', 'YPFD.BA', 'YPF Sociedad Anónima'),
  ((SELECT id FROM instrument_types WHERE code = 'stock'), 'LOMA', 'Loma Negra', 'LOMA.BA', 'Loma Negra C.I.A.S.A.'),
  ((SELECT id FROM instrument_types WHERE code = 'stock'), 'METRD', 'Metrogas', 'METR.BA', 'Metrogas S.A.')
ON CONFLICT (code) DO NOTHING;

-- Password hash corresponds to the demo password: DemoPass123
INSERT INTO users (email, name, password_hash) VALUES
  ('demo@example.com', 'Usuario Demo', '$2a$12$zNbcQq1q4pYu3pDx2PzvUOiPSlCmC7R4mmuUS85HswkBcxizw6yxC')
ON CONFLICT (email) DO NOTHING;

-- Anchor base currency price to 1 for deterministic FX calculations
INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code)
SELECT id, CURRENT_DATE, 1, 'ARS'
FROM instruments
WHERE code = 'ARS'
ON CONFLICT (instrument_id, price_date) DO NOTHING;
