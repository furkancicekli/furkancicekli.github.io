ALTER TABLE products ADD COLUMN weight_grams REAL;
CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_certificates_serial ON certificates(serial_no);
