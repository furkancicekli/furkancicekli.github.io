-- Admin users (auth implemented in a later phase)
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  serial_no TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','sold')),
  material TEXT,
  size TEXT,
  price INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE product_translations (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('tr','en','ar')),
  name TEXT,
  description TEXT,
  story TEXT,
  PRIMARY KEY (product_id, lang)
);

CREATE TABLE product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image','video')),
  r2_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'gallery' CHECK (kind IN ('gallery','raw_material','process')),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE process_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  image_r2_key TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE process_step_translations (
  step_id INTEGER NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('tr','en','ar')),
  text TEXT,
  PRIMARY KEY (step_id, lang)
);

CREATE TABLE faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE faq_translations (
  faq_id INTEGER NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('tr','en','ar')),
  question TEXT,
  answer TEXT,
  PRIMARY KEY (faq_id, lang)
);

CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_no TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE,
  buyer_name TEXT,
  issued_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_product_media_product ON product_media(product_id);
CREATE INDEX idx_certificates_qr ON certificates(qr_token);
