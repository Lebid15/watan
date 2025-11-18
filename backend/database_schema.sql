-- ============================================
-- AHLA DATABASE SCHEMA
-- Multi-tenant gaming product reseller platform
-- ============================================

-- ============================================
-- MULTI-TENANCY & USERS
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    logo_url TEXT,
    wallet_balance DECIMAL(15,4) DEFAULT 0,
    credit_line DECIMAL(15,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- End users belong to tenants (can buy from and sell to each other)
CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    phone_number VARCHAR(20),
    password_hash TEXT NOT NULL,
    api_token TEXT UNIQUE,
    
    -- Each user chooses ONE base currency (IMMUTABLE after creation)
    base_currency_id UUID NOT NULL REFERENCES currencies(id),
    
    price_tier_id UUID REFERENCES price_tiers(id),
    wallet_balance DECIMAL(15,4) DEFAULT 0,
    credit_line DECIMAL(15,4) DEFAULT 0, -- can overdraft up to this limit
    
    -- User can act as provider (sell to other users)
    can_sell_to_others BOOLEAN DEFAULT false,
    seller_priority INTEGER DEFAULT 999, -- lower = higher priority
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, username)
);

-- Tenant admins/staff
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    phone_number VARCHAR(20),
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'viewer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Super admin users (platform administrators)
CREATE TABLE super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    password_hash TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TOTP/2FA support for all user types
CREATE TABLE user_security (
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('end_user', 'tenant_user', 'super_admin')),
    user_id UUID NOT NULL,
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[],
    last_password_change TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_type, user_id)
);

-- ============================================
-- PRODUCTS & CATEGORIES
-- ============================================

-- Categories for grouping products (games/apps)
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    logo_url TEXT,
    icon_url TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master product catalog (managed by super_admin)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES product_categories(id),
    
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    
    -- Base costs in USD (from providers)
    base_cost_usd DECIMAL(10,4) NOT NULL,
    
    -- Product configuration
    available BOOLEAN DEFAULT true,
    customizable BOOLEAN DEFAULT false, -- can users enter custom amounts?
    
    -- Quantity/amount limits (for customizable products)
    min_amount DECIMAL(10,2),
    max_amount DECIMAL(10,2),
    
    -- Input parameters required from customer
    -- e.g., ["uid", "server"], ["phone_number"], ["email"], etc.
    input_parameters JSONB DEFAULT '[]',
    
    sort_order INTEGER DEFAULT 0,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenants select which products they want to offer
CREATE TABLE tenant_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    enabled BOOLEAN DEFAULT true,
    
    -- Optional overrides
    custom_name VARCHAR(255),
    custom_display_name VARCHAR(255),
    
    -- Tenant can override base cost if they have special arrangements
    custom_cost_usd DECIMAL(10,4),
    
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id)
);

-- ============================================
-- PRICING
-- ============================================

CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- USD, TRY, SYP, EUR, etc.
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant-published exchange rates (all in USD base)
CREATE TABLE tenant_exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    currency_id UUID NOT NULL REFERENCES currencies(id),
    rate_to_usd DECIMAL(15,8) NOT NULL, -- how much USD for 1 unit of this currency
    effective_from TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES tenant_users(id),
    UNIQUE(tenant_id, currency_id, effective_from)
);

-- Log of all exchange rate changes
CREATE TABLE exchange_rate_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    currency_id UUID NOT NULL REFERENCES currencies(id),
    old_rate DECIMAL(15,8),
    new_rate DECIMAL(15,8) NOT NULL,
    changed_by_user_id UUID REFERENCES tenant_users(id),
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price tiers (up to 5 per tenant)
CREATE TABLE price_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier_level INTEGER NOT NULL CHECK (tier_level BETWEEN 1 AND 5),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, tier_level)
);

-- Product pricing per tier
-- Prices are in USD, converted to end user's base currency at order time
CREATE TABLE product_tier_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_tier_id UUID NOT NULL REFERENCES price_tiers(id) ON DELETE CASCADE,
    
    price_usd DECIMAL(10,4) NOT NULL,
    
    -- For customizable products: pricing formula
    price_formula VARCHAR(50) CHECK (price_formula IN ('fixed', 'per_unit', 'tiered')),
    formula_config JSONB, -- e.g., {"base": 1.0, "per_unit": 0.01, "tiers": [...]}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, price_tier_id)
);

-- ============================================
-- PROVIDERS / FULFILLMENT SOURCES
-- ============================================

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('znet', 'zdk', 'AHLA', 'barakat', 'own_codes')),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    base_url TEXT,
    active BOOLEAN DEFAULT true,
    
    -- For tracking provider financials
    wallet_balance DECIMAL(15,4) DEFAULT 0,
    debt DECIMAL(15,4) DEFAULT 0,
    currency_id UUID REFERENCES currencies(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider credentials (can be tenant-specific or global)
CREATE TABLE provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = super_admin/global credentials
    
    credential_type VARCHAR(50) NOT NULL, -- 'api_token', 'username_password', etc.
    credentials JSONB NOT NULL, -- encrypted: {token, username, password, phone_number, etc.}
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Map products to providers for auto-fulfillment
CREATE TABLE provider_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    external_product_id VARCHAR(255) NOT NULL, -- ID in provider's system
    external_name VARCHAR(255),
    
    -- Provider's cost for this product
    cost_usd DECIMAL(10,4) NOT NULL,
    
    priority INTEGER DEFAULT 0, -- lower = higher priority (try first)
    available BOOLEAN DEFAULT true,
    
    -- Provider-specific metadata
    metadata JSONB, -- znet_oyun, znet_kupur, zdk_id, etc.
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, external_product_id)
);

-- End users who can fulfill orders for others (P2P fulfillment)
CREATE TABLE user_provider_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Seller's cost for this product
    cost_usd DECIMAL(10,4) NOT NULL,
    
    available BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0, -- for tracking inventory
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_user_id, product_id)
);

-- ============================================
-- ORDERS
-- ============================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    
    quantity INTEGER DEFAULT 1,
    
    -- PRICING (order-level snapshot)
    -- End user's cost (what they saw/entered initially)
    user_entered_cost DECIMAL(10,4) NOT NULL,
    user_cost_currency_id UUID NOT NULL REFERENCES currencies(id),
    
    -- End user's payment amount (after conversion)
    user_payment_amount DECIMAL(10,4) NOT NULL,
    user_payment_currency_id UUID NOT NULL REFERENCES currencies(id),
    
    -- Exchange rate used at order time
    exchange_rate_used DECIMAL(15,8),
    
    -- ACTUAL cost after fulfillment (from provider)
    actual_cost_usd DECIMAL(10,4),
    actual_cost_currency VARCHAR(10),
    actual_cost_amount DECIMAL(10,4),
    
    -- Wallet tracking (before deduction)
    user_wallet_before DECIMAL(15,4),
    user_wallet_after DECIMAL(15,4),
    
    -- FULFILLMENT
    fulfillment_type VARCHAR(10) NOT NULL CHECK (fulfillment_type IN ('manual', 'auto')),
    fulfilled_by_type VARCHAR(20) CHECK (fulfilled_by_type IN ('provider', 'end_user', 'tenant_user')),
    fulfilled_by_id UUID, -- ID of provider, end_user, or tenant_user
    external_order_id VARCHAR(255), -- provider's order ID (if auto)
    
    -- STATUS
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'failed')),
    
    -- Customer input fields (UID, server, phone, etc.)
    customer_input JSONB,
    
    -- RESULTS
    result_codes TEXT[], -- PIN codes, serial numbers, etc.
    provider_message TEXT,
    provider_response JSONB, -- raw response from provider
    
    -- TIMESTAMPS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_to_provider_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- NOTES
    notes_count INTEGER DEFAULT 0,
    internal_notes TEXT
);

CREATE INDEX idx_orders_tenant_user ON orders(tenant_id, end_user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE TABLE order_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_by_user_type VARCHAR(20) NOT NULL CHECK (created_by_user_type IN ('end_user', 'tenant_user', 'super_admin')),
    created_by_user_id UUID NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track which provider was used and the actual cost (supports retries)
CREATE TABLE order_fulfillment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    fulfillment_source_type VARCHAR(20) NOT NULL CHECK (fulfillment_source_type IN ('provider', 'end_user', 'code_inventory')),
    fulfillment_source_id UUID, -- provider_id, end_user_id, or code_inventory_id
    
    attempt_number INTEGER DEFAULT 1,
    
    -- Request details
    request_sent_at TIMESTAMP,
    request_payload JSONB,
    
    -- Response details
    response_received_at TIMESTAMP,
    response_status INTEGER,
    response_payload JSONB,
    
    -- Cost details
    provider_cost_usd DECIMAL(10,4),
    provider_cost_currency VARCHAR(10),
    provider_cost_amount DECIMAL(10,4),
    
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CODE INVENTORY (Pre-purchased codes)
-- ============================================

CREATE TABLE code_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES providers(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    serial VARCHAR(255),
    pin VARCHAR(255),
    
    -- Cost when purchased
    cost_usd DECIMAL(10,4) NOT NULL,
    cost_currency VARCHAR(10),
    cost_amount DECIMAL(10,4),
    
    used BOOLEAN DEFAULT false,
    used_in_order_id UUID REFERENCES orders(id),
    
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by_user_type VARCHAR(20) CHECK (added_by_user_type IN ('tenant_user', 'super_admin')),
    added_by_user_id UUID,
    
    used_at TIMESTAMP,
    
    metadata JSONB
);

CREATE INDEX idx_code_inventory_product_unused ON code_inventory(product_id, used);
CREATE INDEX idx_code_inventory_used ON code_inventory(used);

-- ============================================
-- WALLET & TRANSACTIONS
-- ============================================

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('end_user', 'tenant', 'provider')),
    owner_id UUID NOT NULL,
    
    -- Wallet currency
    currency_id UUID NOT NULL REFERENCES currencies(id),
    
    balance DECIMAL(15,4) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_type, owner_id, currency_id)
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    
    -- Transaction details
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'order_payment', 'order_refund', 'transfer', 'adjustment', 'settlement')),
    amount DECIMAL(15,4) NOT NULL,
    currency_id UUID NOT NULL REFERENCES currencies(id),
    
    -- Balance tracking (snapshot)
    balance_before DECIMAL(15,4) NOT NULL,
    balance_after DECIMAL(15,4) NOT NULL,
    
    -- STATUS
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'accepted', 'rejected')),
    
    -- Payment method (for deposits/withdrawals)
    payment_rail_type VARCHAR(20) CHECK (payment_rail_type IN ('trust_fund', 'bank_account', 'cash', 'binance', 'hawala', 'other')),
    payment_rail_details JSONB,
    
    -- Related entities
    related_order_id UUID REFERENCES orders(id),
    related_user_type VARCHAR(20) CHECK (related_user_type IN ('end_user', 'tenant_user', 'super_admin')),
    related_user_id UUID,
    
    -- TIMESTAMPS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Additional
    note TEXT,
    metadata JSONB
);

CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('end_user', 'tenant_user', 'super_admin')),
    recipient_id UUID NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    
    channel VARCHAR(10) DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id, read);

-- Announcements from super_admin to tenants
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('all_tenants', 'specific_tenant')),
    target_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    announcement_type VARCHAR(20) DEFAULT 'info' CHECK (announcement_type IN ('info', 'success', 'warning', 'update', 'announcement')),
    
    active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES super_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_announcements_target ON announcements(target_type, target_tenant_id, active);

-- ============================================
-- STATIC CONTENT
-- ============================================

CREATE TABLE instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'ar',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE static_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    page_type VARCHAR(20) DEFAULT 'custom' CHECK (page_type IN ('who_are_we', 'terms', 'privacy', 'faq', 'custom')),
    language VARCHAR(10) DEFAULT 'ar',
    
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug, language)
);

-- ============================================
-- AUDIT & LOGGING
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    actor_type VARCHAR(20) CHECK (actor_type IN ('end_user', 'tenant_user', 'super_admin', 'system')),
    actor_id UUID,
    
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    
    changes JSONB,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

CREATE INDEX idx_end_users_tenant ON end_users(tenant_id, status);
CREATE INDEX idx_end_users_base_currency ON end_users(base_currency_id);
CREATE INDEX idx_end_users_can_sell ON end_users(can_sell_to_others, seller_priority) WHERE can_sell_to_others = true;

CREATE INDEX idx_products_category ON products(category_id, available);
CREATE INDEX idx_products_customizable ON products(customizable) WHERE customizable = true;

CREATE INDEX idx_tenant_products_tenant ON tenant_products(tenant_id, enabled);

CREATE INDEX idx_tenant_exchange_rates_lookup ON tenant_exchange_rates(tenant_id, currency_id, effective_from DESC);

CREATE INDEX idx_provider_products_lookup ON provider_products(provider_id, product_id, available);
CREATE INDEX idx_provider_products_priority ON provider_products(product_id, priority, available) WHERE available = true;

CREATE INDEX idx_user_provider_products_seller ON user_provider_products(seller_user_id, available);
CREATE INDEX idx_user_provider_products_product ON user_provider_products(product_id, available) WHERE available = true;

-- ============================================
-- HELPFUL VIEWS FOR QUERIES
-- ============================================

-- View: Current exchange rates per tenant
CREATE VIEW v_current_exchange_rates AS
SELECT DISTINCT ON (tenant_id, currency_id)
    tenant_id,
    currency_id,
    rate_to_usd,
    effective_from
FROM tenant_exchange_rates
ORDER BY tenant_id, currency_id, effective_from DESC;

-- View: Active end users who can sell
CREATE VIEW v_active_sellers AS
SELECT 
    u.*,
    t.name as tenant_name,
    t.subdomain as tenant_subdomain
FROM end_users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.can_sell_to_others = true
  AND u.status = 'active'
  AND t.status = 'active';

-- View: Order summary with related info
CREATE VIEW v_order_summary AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.fulfillment_type,
    o.created_at,
    o.completed_at,
    
    t.name as tenant_name,
    t.subdomain as tenant_subdomain,
    
    u.username as user_username,
    u.email as user_email,
    u.display_name as user_display_name,
    
    p.name as product_name,
    p.code as product_code,
    
    pc.name as product_category_name,
    
    o.user_payment_amount,
    c.code as payment_currency,
    
    o.actual_cost_usd
FROM orders o
JOIN tenants t ON o.tenant_id = t.id
JOIN end_users u ON o.end_user_id = u.id
JOIN products p ON o.product_id = p.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
JOIN currencies c ON o.user_payment_currency_id = c.id;

-- View: User wallet balances with credit available
CREATE VIEW v_user_wallet_status AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    u.tenant_id,
    t.name as tenant_name,
    u.wallet_balance,
    u.credit_line,
    (u.wallet_balance + u.credit_line) as available_balance,
    c.code as base_currency,
    c.symbol as currency_symbol
FROM end_users u
JOIN tenants t ON u.tenant_id = t.id
JOIN currencies c ON u.base_currency_id = c.id;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE tenants IS 'Multi-tenant stores/resellers';
COMMENT ON TABLE end_users IS 'End customers who can buy and optionally sell products';
COMMENT ON TABLE tenant_users IS 'Tenant administrators and staff';
COMMENT ON TABLE super_admins IS 'Platform administrators';

COMMENT ON COLUMN end_users.base_currency_id IS 'User base currency - IMMUTABLE after account creation';
COMMENT ON COLUMN end_users.credit_line IS 'Maximum overdraft allowed - can go negative up to this amount';
COMMENT ON COLUMN end_users.can_sell_to_others IS 'If true, this user can fulfill orders for other users (P2P)';

COMMENT ON TABLE products IS 'Master product catalog - shared across all tenants';
COMMENT ON TABLE tenant_products IS 'Products selected by each tenant from master catalog';

COMMENT ON TABLE tenant_exchange_rates IS 'Tenant-published exchange rates (USD base)';
COMMENT ON TABLE exchange_rate_change_log IS 'Complete history of all exchange rate changes';

COMMENT ON TABLE price_tiers IS 'Up to 5 pricing tiers per tenant for customer segmentation';
COMMENT ON TABLE product_tier_prices IS 'Product prices per tier (in USD)';

COMMENT ON COLUMN orders.user_entered_cost IS 'Price shown to user initially (stays fixed even if actual cost differs)';
COMMENT ON COLUMN orders.actual_cost_usd IS 'Actual cost from provider after fulfillment';
COMMENT ON COLUMN orders.fulfilled_by_type IS 'Who fulfilled: provider, another end_user, or tenant_user manually';

COMMENT ON TABLE user_provider_products IS 'Products that end users can sell to other users (P2P marketplace)';
COMMENT ON TABLE code_inventory IS 'Pre-purchased codes for manual fulfillment or fallback';

COMMENT ON TABLE transactions IS 'All wallet transactions including deposits, withdrawals, orders, and settlements';
COMMENT ON COLUMN transactions.type IS 'settlement = credit line repayment transaction';
