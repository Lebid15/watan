-- ============================================
-- AHLA DATABASE - SAMPLE SEED DATA
-- Run this AFTER creating the schema
-- ============================================

-- ============================================
-- 1. CURRENCIES
-- ============================================

INSERT INTO currencies (id, code, name, symbol, active) VALUES
('11111111-1111-1111-1111-111111111111', 'USD', 'US Dollar', '$', true),
('22222222-2222-2222-2222-222222222222', 'TRY', 'Turkish Lira', '₺', true),
('33333333-3333-3333-3333-333333333333', 'SYP', 'Syrian Pound', 'ل.س', true),
('44444444-4444-4444-4444-444444444444', 'EUR', 'Euro', '€', true);

-- ============================================
-- 2. SUPER ADMIN
-- ============================================

INSERT INTO super_admins (id, email, username, display_name, password_hash, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@AHLA.com', 'superadmin', 'Super Administrator', 
 '$2b$10$example.hash.here', 'active');

-- ============================================
-- 3. TENANTS
-- ============================================

INSERT INTO tenants (id, name, subdomain, display_name, logo_url, wallet_balance, credit_line, status) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'GameStore Pro', 'gamestore', 'GameStore Pro', 
 'https://example.com/logos/gamestore.png', 5000.00, 10000.00, 'active'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Digital Hub', 'digitalhub', 'Digital Hub', 
 'https://example.com/logos/digitalhub.png', 3000.00, 5000.00, 'active');

-- ============================================
-- 4. PRODUCT CATEGORIES
-- ============================================

INSERT INTO product_categories (id, name, display_name, logo_url, sort_order, active) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'PUBG Mobile', 'PUBG Mobile', 
 'https://example.com/games/pubg.png', 1, true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Free Fire', 'Free Fire', 
 'https://example.com/games/freefire.png', 2, true),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Steam', 'Steam Wallet', 
 'https://example.com/games/steam.png', 3, true),
('10101010-1010-1010-1010-101010101010', 'Mobile Legends', 'Mobile Legends', 
 'https://example.com/games/mlbb.png', 4, true);

-- ============================================
-- 5. PRODUCTS (Master Catalog)
-- ============================================

INSERT INTO products (id, category_id, code, name, display_name, base_cost_usd, available, customizable, min_amount, max_amount, input_parameters, sort_order) VALUES
-- PUBG Products
('20202020-2020-2020-2020-202020202020', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 
 'PUBG_60UC', 'PUBG Mobile 60 UC', 'PUBG 60 UC', 0.85, true, false, NULL, NULL, 
 '["uid", "server"]', 1),
('21212121-2121-2121-2121-212121212121', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 
 'PUBG_325UC', 'PUBG Mobile 325 UC', 'PUBG 325 UC', 4.50, true, false, NULL, NULL, 
 '["uid", "server"]', 2),
('22222222-2121-2121-2121-212121212121', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 
 'PUBG_660UC', 'PUBG Mobile 660 UC', 'PUBG 660 UC', 9.00, true, false, NULL, NULL, 
 '["uid", "server"]', 3),

-- Free Fire Products
('30303030-3030-3030-3030-303030303030', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 
 'FF_100D', 'Free Fire 100 Diamonds', 'FF 100 💎', 1.00, true, false, NULL, NULL, 
 '["uid"]', 1),
('31313131-3131-3131-3131-313131313131', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 
 'FF_500D', 'Free Fire 500 Diamonds', 'FF 500 💎', 4.80, true, false, NULL, NULL, 
 '["uid"]', 2),

-- Steam Products (customizable)
('40404040-4040-4040-4040-404040404040', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 
 'STEAM_CUSTOM', 'Steam Wallet Custom', 'Steam Wallet', 1.00, true, true, 5, 100, 
 '["email"]', 1),

-- Mobile Legends
('50505050-5050-5050-5050-505050505050', '10101010-1010-1010-1010-101010101010', 
 'ML_86D', 'Mobile Legends 86 Diamonds', 'ML 86 💎', 1.20, true, false, NULL, NULL, 
 '["uid", "server"]', 1);

-- ============================================
-- 6. TENANT PRODUCTS (What each tenant offers)
-- ============================================

-- GameStore Pro offers all products
INSERT INTO tenant_products (id, tenant_id, product_id, enabled, custom_cost_usd, sort_order) VALUES
('60606060-6060-6060-6060-606060606060', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '20202020-2020-2020-2020-202020202020', true, NULL, 1),
('61616161-6161-6161-6161-616161616161', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '21212121-2121-2121-2121-212121212121', true, NULL, 2),
('62626262-6262-6262-6262-626262626262', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '30303030-3030-3030-3030-303030303030', true, NULL, 3),
('63636363-6363-6363-6363-636363636363', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '40404040-4040-4040-4040-404040404040', true, NULL, 4);

-- Digital Hub offers selected products
INSERT INTO tenant_products (id, tenant_id, product_id, enabled, custom_cost_usd, sort_order) VALUES
('64646464-6464-6464-6464-646464646464', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 '20202020-2020-2020-2020-202020202020', true, 0.90, 1),
('65656565-6565-6565-6565-656565656565', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 '30303030-3030-3030-3030-303030303030', true, NULL, 2);

-- ============================================
-- 7. PRICE TIERS
-- ============================================

-- GameStore Pro tiers
INSERT INTO price_tiers (id, tenant_id, tier_level, name, display_name, description, sort_order, active) VALUES
('70707070-7070-7070-7070-707070707070', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 1, 'Bronze', 'Bronze Tier', 'Entry level pricing', 1, true),
('71717171-7171-7171-7171-717171717171', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 2, 'Silver', 'Silver Tier', 'Regular customers', 2, true),
('72727272-7272-7272-7272-727272727272', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 3, 'Gold', 'Gold Tier', 'VIP customers', 3, true);

-- Digital Hub tiers
INSERT INTO price_tiers (id, tenant_id, tier_level, name, display_name, description, sort_order, active) VALUES
('73737373-7373-7373-7373-737373737373', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 1, 'Standard', 'Standard', 'Standard pricing', 1, true),
('74747474-7474-7474-7474-747474747474', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 2, 'Premium', 'Premium', 'Premium customers', 2, true);

-- ============================================
-- 8. PRODUCT TIER PRICES
-- ============================================

-- GameStore Pro: PUBG 60 UC pricing
INSERT INTO product_tier_prices (id, tenant_id, product_id, price_tier_id, price_usd, price_formula) VALUES
('80808080-8080-8080-8080-808080808080', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '20202020-2020-2020-2020-202020202020', '70707070-7070-7070-7070-707070707070', 
 1.20, 'fixed'),
('81818181-8181-8181-8181-818181818181', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '20202020-2020-2020-2020-202020202020', '71717171-7171-7171-7171-717171717171', 
 1.10, 'fixed'),
('82828282-8282-8282-8282-828282828282', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '20202020-2020-2020-2020-202020202020', '72727272-7272-7272-7272-727272727272', 
 1.00, 'fixed');

-- GameStore Pro: FF 100D pricing
INSERT INTO product_tier_prices (id, tenant_id, product_id, price_tier_id, price_usd, price_formula) VALUES
('83838383-8383-8383-8383-838383838383', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '30303030-3030-3030-3030-303030303030', '70707070-7070-7070-7070-707070707070', 
 1.50, 'fixed'),
('84848484-8484-8484-8484-848484848484', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '30303030-3030-3030-3030-303030303030', '71717171-7171-7171-7171-717171717171', 
 1.35, 'fixed'),
('85858585-8585-8585-8585-858585858585', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '30303030-3030-3030-3030-303030303030', '72727272-7272-7272-7272-727272727272', 
 1.20, 'fixed');

-- ============================================
-- 9. TENANT EXCHANGE RATES
-- ============================================

-- GameStore Pro rates
INSERT INTO tenant_exchange_rates (id, tenant_id, currency_id, rate_to_usd, effective_from, created_by) VALUES
('90909090-9090-9090-9090-909090909090', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '22222222-2222-2222-2222-222222222222', 0.031, '2024-01-01', NULL), -- TRY
('91919191-9191-9191-9191-919191919191', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '33333333-3333-3333-3333-333333333333', 0.00075, '2024-01-01', NULL); -- SYP

-- Digital Hub rates
INSERT INTO tenant_exchange_rates (id, tenant_id, currency_id, rate_to_usd, effective_from, created_by) VALUES
('92929292-9292-9292-9292-929292929292', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 '22222222-2222-2222-2222-222222222222', 0.032, '2024-01-01', NULL);

-- ============================================
-- 10. TENANT USERS (Staff)
-- ============================================

INSERT INTO tenant_users (id, tenant_id, email, username, display_name, password_hash, role, status) VALUES
('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 'admin@gamestore.com', 'gamestore_admin', 'GameStore Admin', 
 '$2b$10$example.hash.here', 'admin', 'active'),
('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 'admin@digitalhub.com', 'digitalhub_admin', 'Digital Hub Admin', 
 '$2b$10$example.hash.here', 'admin', 'active');

-- ============================================
-- 11. END USERS (Customers)
-- ============================================

-- GameStore Pro customers
INSERT INTO end_users (id, tenant_id, email, username, display_name, phone_number, password_hash, 
                      base_currency_id, price_tier_id, wallet_balance, credit_line, 
                      can_sell_to_others, seller_priority, status) VALUES
('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 'user1@example.com', 'gamer123', 'Ahmed Ali', '+905551234567', 
 '$2b$10$example.hash.here', '22222222-2222-2222-2222-222222222222', 
 '71717171-7171-7171-7171-717171717171', 500.00, 1000.00, false, 999, 'active'),

('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 'seller@example.com', 'powerSeller', 'Pro Seller', '+905559876543', 
 '$2b$10$example.hash.here', '22222222-2222-2222-2222-222222222222', 
 '72727272-7272-7272-7272-727272727272', 2000.00, 5000.00, true, 1, 'active'),

('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 'vip@example.com', 'vipGamer', 'VIP Customer', '+905551111111', 
 '$2b$10$example.hash.here', '11111111-1111-1111-1111-111111111111', 
 '72727272-7272-7272-7272-727272727272', 1500.00, 3000.00, false, 999, 'active');

-- Digital Hub customers
INSERT INTO end_users (id, tenant_id, email, username, display_name, phone_number, password_hash, 
                      base_currency_id, price_tier_id, wallet_balance, credit_line, 
                      can_sell_to_others, seller_priority, status) VALUES
('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
 'user2@example.com', 'digitalUser', 'Fatima Hassan', '+905552222222', 
 '$2b$10$example.hash.here', '22222222-2222-2222-2222-222222222222', 
 '73737373-7373-7373-7373-737373737373', 300.00, 500.00, false, 999, 'active');

-- ============================================
-- 12. PROVIDERS
-- ============================================

INSERT INTO providers (id, type, name, display_name, base_url, active, wallet_balance, debt, currency_id) VALUES
('c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'znet', 'Znet Turkey', 'Znet', 
 'https://api.znet.example.com', true, 0, 0, '22222222-2222-2222-2222-222222222222'),
('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'zdk', 'ZDK Provider', 'ZDK', 
 'https://api.zdk.example.com', true, 0, 0, '22222222-2222-2222-2222-222222222222'),
('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'barakat', 'Barakat Store', 'Barakat', 
 'https://api.x-stor.net', true, 0, 0, '22222222-2222-2222-2222-222222222222');

-- ============================================
-- 13. PROVIDER CREDENTIALS
-- ============================================

INSERT INTO provider_credentials (id, provider_id, tenant_id, credential_type, credentials, active) VALUES
('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', NULL, 
 'username_password', '{"username": "znet_user", "password": "encrypted_pass"}', true),
('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', NULL, 
 'api_token', '{"token": "barakat_api_token_here"}', true);

-- ============================================
-- 14. PROVIDER PRODUCTS
-- ============================================

INSERT INTO provider_products (id, provider_id, product_id, external_product_id, external_name, 
                              cost_usd, priority, available, metadata) VALUES
-- Znet offers PUBG
('e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 
 '20202020-2020-2020-2020-202020202020', 'znet_pubg_60', 'PUBG 60 UC', 
 0.82, 1, true, '{"oyun_bilgi_id": "100", "kupur": "UC60"}'),

-- Barakat offers FF
('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 
 '30303030-3030-3030-3030-303030303030', 'barakat_ff_100', 'Free Fire 100 Diamonds', 
 0.95, 2, true, '{}');

-- ============================================
-- 15. USER PROVIDER PRODUCTS (P2P Marketplace)
-- ============================================

-- PowerSeller offers products to other users
INSERT INTO user_provider_products (id, seller_user_id, product_id, cost_usd, available, stock_quantity) VALUES
('f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 
 '20202020-2020-2020-2020-202020202020', 0.88, true, 50),
('f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 
 '30303030-3030-3030-3030-303030303030', 0.98, true, 30);

-- ============================================
-- 16. CODE INVENTORY
-- ============================================

INSERT INTO code_inventory (id, provider_id, product_id, serial, pin, cost_usd, cost_currency, 
                           cost_amount, used, added_at, added_by_user_type, added_by_user_id) VALUES
('10000000-0000-0000-0000-000000000001', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 
 '20202020-2020-2020-2020-202020202020', 'SER123456', 'PIN789012', 
 0.80, 'TRY', 25.60, false, CURRENT_TIMESTAMP, 'super_admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('10000000-0000-0000-0000-000000000002', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 
 '20202020-2020-2020-2020-202020202020', 'SER123457', 'PIN789013', 
 0.80, 'TRY', 25.60, false, CURRENT_TIMESTAMP, 'super_admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ============================================
-- 17. WALLETS
-- ============================================

-- User wallets
INSERT INTO wallets (id, owner_type, owner_id, currency_id, balance) VALUES
('11000000-0000-0000-0000-000000000001', 'end_user', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 
 '22222222-2222-2222-2222-222222222222', 500.00),
('11000000-0000-0000-0000-000000000002', 'end_user', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 
 '22222222-2222-2222-2222-222222222222', 2000.00),
('11000000-0000-0000-0000-000000000003', 'end_user', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 
 '11111111-1111-1111-1111-111111111111', 1500.00);

-- Tenant wallets
INSERT INTO wallets (id, owner_type, owner_id, currency_id, balance) VALUES
('11000000-0000-0000-0000-000000000004', 'tenant', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
 '11111111-1111-1111-1111-111111111111', 5000.00);

-- ============================================
-- 18. SAMPLE ORDERS
-- ============================================

-- Completed order (auto-fulfilled by provider)
INSERT INTO orders (id, order_number, tenant_id, end_user_id, product_id, quantity, 
                   user_entered_cost, user_cost_currency_id, user_payment_amount, 
                   user_payment_currency_id, exchange_rate_used, actual_cost_usd, 
                   actual_cost_currency, actual_cost_amount, user_wallet_before, user_wallet_after, 
                   fulfillment_type, fulfilled_by_type, fulfilled_by_id, status, 
                   customer_input, result_codes, created_at, completed_at) VALUES
('12000000-0000-0000-0000-000000000001', 'ORD-2024-000001', 
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 
 '20202020-2020-2020-2020-202020202020', 1, 
 1.10, '22222222-2222-2222-2222-222222222222', 35.48, 
 '22222222-2222-2222-2222-222222222222', 0.031, 0.82, 
 'TRY', 26.45, 535.48, 500.00, 
 'auto', 'provider', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'completed', 
 '{"uid": "123456789", "server": "asia"}', ARRAY['CODE123ABC'], 
 CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- Pending order
INSERT INTO orders (id, order_number, tenant_id, end_user_id, product_id, quantity, 
                   user_entered_cost, user_cost_currency_id, user_payment_amount, 
                   user_payment_currency_id, exchange_rate_used, user_wallet_before, user_wallet_after, 
                   fulfillment_type, status, customer_input, created_at) VALUES
('12000000-0000-0000-0000-000000000002', 'ORD-2024-000002', 
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 
 '30303030-3030-3030-3030-303030303030', 1, 
 1.35, '22222222-2222-2222-2222-222222222222', 43.55, 
 '22222222-2222-2222-2222-222222222222', 0.031, 500.00, 456.45, 
 'auto', 'pending', '{"uid": "987654321"}', CURRENT_TIMESTAMP);

-- ============================================
-- 19. ANNOUNCEMENTS
-- ============================================

INSERT INTO announcements (id, target_type, target_tenant_id, title, content, announcement_type, 
                          active, created_by, created_at, expires_at) VALUES
('13000000-0000-0000-0000-000000000001', 'all_tenants', NULL, 
 'System Maintenance', 'Scheduled maintenance on Nov 20, 2024 from 2AM-4AM UTC', 
 'warning', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_TIMESTAMP, 
 CURRENT_TIMESTAMP + INTERVAL '30 days');

-- ============================================
-- 20. NOTIFICATIONS
-- ============================================

INSERT INTO notifications (id, recipient_type, recipient_id, title, message, channel, priority, read) VALUES
('14000000-0000-0000-0000-000000000001', 'end_user', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 
 'Order Completed', 'Your order ORD-2024-000001 has been completed successfully!', 
 'in_app', 'normal', false),
('14000000-0000-0000-0000-000000000002', 'end_user', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 
 'Welcome!', 'Welcome to GameStore Pro! Thanks for joining us.', 
 'in_app', 'low', true);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all data was inserted
SELECT 'Currencies' as table_name, COUNT(*) as count FROM currencies
UNION ALL SELECT 'Tenants', COUNT(*) FROM tenants
UNION ALL SELECT 'Product Categories', COUNT(*) FROM product_categories
UNION ALL SELECT 'Products', COUNT(*) FROM products
UNION ALL SELECT 'Tenant Products', COUNT(*) FROM tenant_products
UNION ALL SELECT 'Price Tiers', COUNT(*) FROM price_tiers
UNION ALL SELECT 'Product Tier Prices', COUNT(*) FROM product_tier_prices
UNION ALL SELECT 'End Users', COUNT(*) FROM end_users
UNION ALL SELECT 'Tenant Users', COUNT(*) FROM tenant_users
UNION ALL SELECT 'Providers', COUNT(*) FROM providers
UNION ALL SELECT 'Provider Products', COUNT(*) FROM provider_products
UNION ALL SELECT 'User Provider Products', COUNT(*) FROM user_provider_products
UNION ALL SELECT 'Code Inventory', COUNT(*) FROM code_inventory
UNION ALL SELECT 'Wallets', COUNT(*) FROM wallets
UNION ALL SELECT 'Orders', COUNT(*) FROM orders
UNION ALL SELECT 'Announcements', COUNT(*) FROM announcements
UNION ALL SELECT 'Notifications', COUNT(*) FROM notifications;

-- View tenant summary
SELECT 
    t.name as tenant,
    COUNT(DISTINCT eu.id) as total_users,
    COUNT(DISTINCT tp.id) as total_products,
    COUNT(DISTINCT pt.id) as total_tiers,
    t.wallet_balance,
    t.credit_line
FROM tenants t
LEFT JOIN end_users eu ON t.id = eu.tenant_id
LEFT JOIN tenant_products tp ON t.id = tp.tenant_id
LEFT JOIN price_tiers pt ON t.id = pt.tenant_id
GROUP BY t.id, t.name, t.wallet_balance, t.credit_line;

-- View user balances
SELECT 
    username,
    wallet_balance,
    credit_line,
    (wallet_balance + credit_line) as available_balance,
    can_sell_to_others
FROM end_users
ORDER BY wallet_balance DESC;

-- View order summary
SELECT * FROM v_order_summary;

-- View current exchange rates
SELECT * FROM v_current_exchange_rates;

-- View active sellers
SELECT * FROM v_active_sellers;

-- Success message
SELECT '✅ Sample data seeded successfully! Database is ready for testing.' as status;
