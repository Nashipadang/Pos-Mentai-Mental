-- Enable uuid-ossp extension for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. USERS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK(role IN ('owner', 'kasir', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 2. CATEGORIES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- ── 3. PRODUCTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL CHECK(price >= 0),
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 4. INGREDIENTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    current_stock DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
    min_threshold DECIMAL(12,2) CHECK(min_threshold >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 5. RECIPES (BOM) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(12,3) NOT NULL CHECK(quantity > 0),
    CONSTRAINT unique_product_ingredient UNIQUE(product_id, ingredient_id)
);

-- ── 6. CUSTOMERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    total_transactions INT NOT NULL DEFAULT 0 CHECK(total_transactions >= 0),
    total_spent DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK(total_spent >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 7. TRANSACTIONS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_amount DECIMAL(15,2) NOT NULL CHECK(total_amount >= 0),
    payment_method VARCHAR(50) NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'midtrans')),
    payment_status VARCHAR(50) NOT NULL CHECK(payment_status IN ('pending', 'paid', 'failed', 'expired')),
    midtrans_order_id VARCHAR(255),
    midtrans_token VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 8. TRANSACTION ITEMS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK(quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL CHECK(unit_price >= 0),
    subtotal DECIMAL(15,2) NOT NULL CHECK(subtotal >= 0)
);

-- ── 9. STOCK MOVEMENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK(type IN ('in', 'out')),
    quantity DECIMAL(12,3) NOT NULL CHECK(quantity > 0),
    notes VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── SEED INITIAL TEST DATA ────────────────────────────────────────────────────
-- Default bcrypt hash for 'password123'
-- Passwords hash generated via standard bcrypt cost = 10
INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES
('a1111111-1111-1111-1111-111111111111', 'Reza (Owner)', 'owner@mentaimental.com', '$2a$10$joEZ111d/BVqrjkHRE7mq.a0iJtqq5SbfUW7qZ901rRusbPKFVAiO', 'owner', true),
('a2222222-2222-2222-2222-222222222222', 'Dewi (Kasir)', 'kasir@mentaimental.com', '$2a$10$joEZ111d/BVqrjkHRE7mq.a0iJtqq5SbfUW7qZ901rRusbPKFVAiO', 'kasir', true),
('a3333333-3333-3333-3333-333333333333', 'Budi (Staff)', 'staff@mentaimental.com', '$2a$10$joEZ111d/BVqrjkHRE7mq.a0iJtqq5SbfUW7qZ901rRusbPKFVAiO', 'staff', true)
ON CONFLICT (email) DO NOTHING;

-- Seed Categories
INSERT INTO categories (id, name) VALUES
(1, 'Dimsum Original'),
(2, 'Dimsum Mentai'),
(3, 'Saus & Kemasan'),
(4, 'Minuman')
ON CONFLICT (id) DO NOTHING;

-- Seed Products
INSERT INTO products (id, category_id, name, price, is_active) VALUES
('b1111111-1111-1111-1111-111111111111', 1, 'Dimsum Original (5 Pcs)', 18000.00, true),
('b2222222-2222-2222-2222-222222222222', 2, 'Dimsum Mentai Original (5 Pcs)', 25000.00, true),
('b3333333-3333-3333-3333-333333333333', 2, 'Dimsum Mentai Mozzarella (5 Pcs)', 28000.00, true),
('b4444444-4444-4444-4444-444444444444', 3, 'Saus Mentai Botol (200ml)', 35000.00, true),
('b5555555-5555-5555-5555-555555555555', 4, 'Es Teh Manis', 5000.00, true)
ON CONFLICT (id) DO NOTHING;

-- Seed Ingredients
INSERT INTO ingredients (id, name, unit, current_stock, min_threshold) VALUES
('e1111111-1111-1111-1111-111111111111', 'Ayam Giling', 'g', 8500.00, 2000.00),
('e2222222-2222-2222-2222-222222222222', 'Kulit Dimsum', 'pcs', 450.00, 100.00),
('e3333333-3333-3333-3333-333333333333', 'Saus Mentai', 'ml', 3500.00, 1000.00),
('e4444444-4444-4444-4444-444444444444', 'Keju Mozzarella', 'g', 1200.00, 300.00),
('e5555555-5555-5555-5555-555555555555', 'Aluminium Foil Box', 'pcs', 90.00, 20.00),
('e6666666-6666-6666-6666-666666666666', 'Cup Gelas Plastik', 'pcs', 120.00, 30.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Recipe BOM (komposisi resep)
INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES
-- Dimsum Original (5 pcs)
('b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 100.000), -- 100g ayam
('b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 5.000),   -- 5 kulit dimsum
('b1111111-1111-1111-1111-111111111111', 'e5555555-5555-5555-5555-555555555555', 1.000),   -- 1 foil box

-- Dimsum Mentai Original (5 pcs)
('b2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 100.000), -- 100g ayam
('b2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 5.000),   -- 5 kulit dimsum
('b2222222-2222-2222-2222-222222222222', 'e3333333-3333-3333-3333-333333333333', 40.000),  -- 40ml saus mentai
('b2222222-2222-2222-2222-222222222222', 'e5555555-5555-5555-5555-555555555555', 1.000),   -- 1 foil box

-- Dimsum Mentai Mozzarella (5 pcs)
('b3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111', 100.000), -- 100g ayam
('b3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 5.000),   -- 5 kulit dimsum
('b3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 40.000),  -- 40ml saus mentai
('b3333333-3333-3333-3333-333333333333', 'e4444444-4444-4444-4444-444444444444', 30.000),  -- 30g mozzarella
('b3333333-3333-3333-3333-333333333333', 'e5555555-5555-5555-5555-555555555555', 1.000),   -- 1 foil box

-- Saus Mentai Botol (200ml)
('b4444444-4444-4444-4444-444444444444', 'e3333333-3333-3333-3333-333333333333', 200.000), -- 200ml saus mentai

-- Es Teh Manis
('b5555555-5555-5555-5555-555555555555', 'e6666666-6666-6666-6666-666666666666', 1.000)    -- 1 cup gelas
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

-- Seed Customers
INSERT INTO customers (id, name, phone, total_transactions, total_spent) VALUES
('f1111111-1111-1111-1111-111111111111', 'Nakul', '081234567890', 5, 125000.00),
('f2222222-2222-2222-2222-222222222222', 'Aisyah', '082198765432', 3, 73000.00)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for categories after seeds
SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1), true);

-- ── 10. TOKEN BLACKLIST ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 11. SETTINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
('store_name', 'Mentai Mental'),
('store_address', 'Jl. Margonda Raya No. 123, Depok'),
('receipt_header', 'MENTAI MENTAL'),
('receipt_footer', 'Terima kasih atas pesanan Anda!\nMentai Mental - Dimsum Mentai Juara')
ON CONFLICT (key) DO NOTHING;

-- ── 12. PROMOS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK(type IN ('percentage', 'flat')),
    value DECIMAL(15,2) NOT NULL CHECK(value >= 0),
    min_transaction DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK(min_transaction >= 0),
    max_discount DECIMAL(15,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE promos ADD COLUMN IF NOT EXISTS max_discount DECIMAL(15,2);

-- Alter transactions table to support coupon/promos
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS promo_code VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0;

-- Seed default promo codes
INSERT INTO promos (code, type, value, min_transaction, max_discount, is_active) VALUES
('MENTAIPAS', 'percentage', 10.00, 50000.00, 15000.00, true), -- 10% off (min Rp 50.000, capped at Rp 15.000)
('MENTAIHEBAT', 'flat', 5000.00, 30000.00, NULL, true)      -- Rp 5.000 off (min Rp 30.000)
ON CONFLICT (code) DO NOTHING;
