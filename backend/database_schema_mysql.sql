-- ============================================
-- AHLA DATABASE SCHEMA - MySQL Version
-- Multi-tenant gaming product reseller platform
-- ============================================

-- Create and use the database
DROP DATABASE IF EXISTS AHLA;
CREATE DATABASE AHLA CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE AHLA;

-- ============================================
-- MULTI-TENANCY & USERS
-- ============================================

CREATE TABLE tenants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    logo_url VARCHAR(500),
    wallet_balance DECIMAL(15,4) DEFAULT 0,
    credit_line DECIMAL(15,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- End users belong to tenants (can buy from and sell to each other)
CREATE TABLE end_users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    phone_number VARCHAR(20),
    password_hash TEXT NOT NULL,
    api_token VARCHAR(500) UNIQUE,
    
    -- Each user chooses ONE base currency (IMMUTABLE after creation)
    base_currency_id CHAR(36) NOT NULL,
    
    price_tier_id CHAR(36),
    wallet_balance DECIMAL(15,4) DEFAULT 0,
    credit_line DECIMAL(15,4) DEFAULT 0 COMMENT 'Can overdraft up to this limit',
    
    -- User can act as provider (sell to other users)
    can_sell_to_others BOOLEAN DEFAULT false COMMENT 'If true, user can fulfill orders for others (P2P)',
    seller_priority INT DEFAULT 999 COMMENT 'Lower = higher priority',
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_email (tenant_id, email),
    UNIQUE KEY uk_tenant_username (tenant_id, username),
    KEY idx_tenant_id (tenant_id),
    KEY idx_base_currency (base_currency_id),
    KEY idx_price_tier (price_tier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenant admins/staff
CREATE TABLE tenant_users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    phone_number VARCHAR(20),
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'viewer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Super admin users (platform administrators)
CREATE TABLE super_admins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    password_hash TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TOTP/2FA support for all user types
CREATE TABLE user_security (
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('end_user', 'tenant_user', 'super_admin')),
    user_id CHAR(36) NOT NULL,
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT false,
    backup_codes JSON,
    last_password_change TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_type, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PRODUCTS & CATEGORIES
-- ============================================

-- Categories for grouping products (games/apps)
CREATE TABLE product_categories (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    logo_url VARCHAR(500),
    icon_url VARCHAR(500),
    description TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master product catalog (managed by super_admin)
CREATE TABLE products (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_id CHAR(36),
    
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    
    -- Base costs in USD (from providers)
    base_cost_usd DECIMAL(10,4) NOT NULL,
    
    -- Product configuration
    available BOOLEAN DEFAULT true,
    customizable BOOLEAN DEFAULT false COMMENT 'Can users enter custom amounts?',
    
    -- Quantity/amount limits (for customizable products)
    min_amount DECIMAL(10,2),
    max_amount DECIMAL(10,2),
    
    -- Input parameters required from customer
    input_parameters JSON COMMENT 'e.g., ["uid", "server"], ["phone_number"]',
    
    sort_order INT DEFAULT 0,
    metadata JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_category (category_id),
    KEY idx_available (available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenants select which products they want to offer
CREATE TABLE tenant_products (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    
    enabled BOOLEAN DEFAULT true,
    
    -- Optional overrides
    custom_name VARCHAR(255),
    custom_display_name VARCHAR(255),
    
    -- Tenant can override base cost if they have special arrangements
    custom_cost_usd DECIMAL(10,4),
    
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_product (tenant_id, product_id),
    KEY idx_tenant_id (tenant_id),
    KEY idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PRICING
-- ============================================

CREATE TABLE currencies (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenant-published exchange rates (all in USD base)
CREATE TABLE tenant_exchange_rates (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    currency_id CHAR(36) NOT NULL,
    rate_to_usd DECIMAL(15,8) NOT NULL COMMENT 'How much USD for 1 unit of this currency',
    effective_from TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by CHAR(36),
    UNIQUE KEY uk_tenant_currency_date (tenant_id, currency_id, effective_from),
    KEY idx_tenant_id (tenant_id),
    KEY idx_currency_id (currency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log of all exchange rate changes
CREATE TABLE exchange_rate_change_log (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    currency_id CHAR(36) NOT NULL,
    old_rate DECIMAL(15,8),
    new_rate DECIMAL(15,8) NOT NULL,
    changed_by_user_id CHAR(36),
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tenant_id (tenant_id),
    KEY idx_currency_id (currency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Price tiers (up to 5 per tenant)
CREATE TABLE price_tiers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    tier_level INT NOT NULL CHECK (tier_level BETWEEN 1 AND 5),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_tier (tenant_id, tier_level),
    KEY idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product pricing per tier
CREATE TABLE product_tier_prices (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    price_tier_id CHAR(36) NOT NULL,
    
    price_usd DECIMAL(10,4) NOT NULL,
    
    -- For customizable products: pricing formula
    price_formula VARCHAR(50) CHECK (price_formula IN ('fixed', 'per_unit', 'tiered')),
    formula_config JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_product_tier (tenant_id, product_id, price_tier_id),
    KEY idx_tenant_id (tenant_id),
    KEY idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PROVIDERS / FULFILLMENT SOURCES
-- ============================================

CREATE TABLE providers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    type VARCHAR(20) NOT NULL CHECK (type IN ('znet', 'zdk', 'AHLA', 'barakat', 'own_codes')),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    base_url VARCHAR(500),
    active BOOLEAN DEFAULT true,
    
    -- For tracking provider financials
    wallet_balance DECIMAL(15,4) DEFAULT 0,
    debt DECIMAL(15,4) DEFAULT 0,
    currency_id CHAR(36),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_type (type),
    KEY idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Provider credentials (can be tenant-specific or global)
CREATE TABLE provider_credentials (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    provider_id CHAR(36) NOT NULL,
    tenant_id CHAR(36),
    
    credential_type VARCHAR(50) NOT NULL,
    credentials JSON NOT NULL COMMENT 'Encrypted: {token, username, password, etc.}',
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_provider_id (provider_id),
    KEY idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map products to providers for auto-fulfillment
CREATE TABLE provider_products (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    provider_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    
    external_product_id VARCHAR(255) NOT NULL COMMENT 'Provider-specific ID (zdk_id, AHLA_id, znet_bilgi_id)',
    external_name VARCHAR(255) COMMENT 'Provider-specific name (znet_adi_name)',
    
    -- Provider's cost for this product
    cost_usd DECIMAL(10,4) NOT NULL,
    
    priority INT DEFAULT 0 COMMENT 'Lower = higher priority',
    available BOOLEAN DEFAULT true,
    
    -- ZNet-specific fields
    znet_adi_name VARCHAR(255) COMMENT 'ZNet product name',
    znet_fiyat_price DECIMAL(10,4) COMMENT 'ZNet price',
    znet_oyun VARCHAR(255) COMMENT 'ZNet game identifier',
    znet_kupur VARCHAR(255) COMMENT 'ZNet coupon/voucher code',
    znet_bilgi_id VARCHAR(255) COMMENT 'ZNet info ID',
    
    -- ZDK-specific fields
    zdk_id VARCHAR(255) COMMENT 'ZDK product ID',
    
    -- AHLA internal ID (if syncing between systems)
    AHLA_id VARCHAR(255) COMMENT 'AHLA internal product ID',
    
    -- Provider-specific metadata (any additional fields)
    metadata JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_provider_external (provider_id, external_product_id),
    KEY idx_product_id (product_id),
    KEY idx_priority (priority, available),
    KEY idx_zdk_id (zdk_id),
    KEY idx_znet_bilgi_id (znet_bilgi_id),
    KEY idx_AHLA_id (AHLA_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- End users who can fulfill orders for others (P2P fulfillment)
CREATE TABLE user_provider_products (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    seller_user_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    
    -- Seller's cost for this product
    cost_usd DECIMAL(10,4) NOT NULL,
    
    available BOOLEAN DEFAULT true,
    stock_quantity INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_seller_product (seller_user_id, product_id),
    KEY idx_product_id (product_id),
    KEY idx_available (available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ORDERS
-- ============================================

CREATE TABLE orders (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    
    tenant_id CHAR(36) NOT NULL,
    end_user_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    
    quantity INT DEFAULT 1,
    
    -- PRICING (order-level snapshot)
    user_entered_cost DECIMAL(10,4) NOT NULL COMMENT 'Price shown initially (never changes)',
    user_cost_currency_id CHAR(36) NOT NULL,
    
    user_payment_amount DECIMAL(10,4) NOT NULL,
    user_payment_currency_id CHAR(36) NOT NULL,
    
    exchange_rate_used DECIMAL(15,8),
    
    -- ACTUAL cost after fulfillment
    actual_cost_usd DECIMAL(10,4) COMMENT 'Real cost from provider',
    actual_cost_currency VARCHAR(10),
    actual_cost_amount DECIMAL(10,4),
    
    -- Wallet tracking
    user_wallet_before DECIMAL(15,4),
    user_wallet_after DECIMAL(15,4),
    
    -- FULFILLMENT
    fulfillment_type VARCHAR(10) NOT NULL CHECK (fulfillment_type IN ('manual', 'auto')),
    fulfilled_by_type VARCHAR(20) CHECK (fulfilled_by_type IN ('provider', 'end_user', 'tenant_user')),
    fulfilled_by_id CHAR(36),
    external_order_id VARCHAR(255),
    
    -- STATUS
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'failed')),
    
    -- Customer input
    customer_input JSON,
    
    -- RESULTS
    result_codes JSON,
    provider_message TEXT,
    provider_response JSON,
    
    -- TIMESTAMPS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_to_provider_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- NOTES
    notes_count INT DEFAULT 0,
    internal_notes TEXT,
    
    KEY idx_tenant_user (tenant_id, end_user_id),
    KEY idx_status (status),
    KEY idx_created_at (created_at),
    KEY idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_notes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id CHAR(36) NOT NULL,
    created_by_user_type VARCHAR(20) NOT NULL CHECK (created_by_user_type IN ('end_user', 'tenant_user', 'super_admin')),
    created_by_user_id CHAR(36) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Track fulfillment attempts
CREATE TABLE order_fulfillment_details (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id CHAR(36) NOT NULL,
    
    fulfillment_source_type VARCHAR(20) NOT NULL CHECK (fulfillment_source_type IN ('provider', 'end_user', 'code_inventory')),
    fulfillment_source_id CHAR(36),
    
    attempt_number INT DEFAULT 1,
    
    request_sent_at TIMESTAMP NULL,
    request_payload JSON,
    
    response_received_at TIMESTAMP NULL,
    response_status INT,
    response_payload JSON,
    
    provider_cost_usd DECIMAL(10,4),
    provider_cost_currency VARCHAR(10),
    provider_cost_amount DECIMAL(10,4),
    
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CODE INVENTORY
-- ============================================

CREATE TABLE code_inventory (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    provider_id CHAR(36),
    product_id CHAR(36) NOT NULL,
    
    serial VARCHAR(255),
    pin VARCHAR(255),
    
    cost_usd DECIMAL(10,4) NOT NULL,
    cost_currency VARCHAR(10),
    cost_amount DECIMAL(10,4),
    
    used BOOLEAN DEFAULT false,
    used_in_order_id CHAR(36),
    
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by_user_type VARCHAR(20) CHECK (added_by_user_type IN ('tenant_user', 'super_admin')),
    added_by_user_id CHAR(36),
    
    used_at TIMESTAMP NULL,
    
    metadata JSON,
    
    KEY idx_product_unused (product_id, used),
    KEY idx_used (used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- WALLET & TRANSACTIONS
-- ============================================

CREATE TABLE wallets (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('end_user', 'tenant', 'provider')),
    owner_id CHAR(36) NOT NULL,
    
    currency_id CHAR(36) NOT NULL,
    balance DECIMAL(15,4) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_owner_currency (owner_type, owner_id, currency_id),
    KEY idx_owner (owner_type, owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    
    wallet_id CHAR(36) NOT NULL,
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'order_payment', 'order_refund', 'transfer', 'adjustment', 'settlement')),
    amount DECIMAL(15,4) NOT NULL,
    currency_id CHAR(36) NOT NULL,
    
    balance_before DECIMAL(15,4) NOT NULL,
    balance_after DECIMAL(15,4) NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'accepted', 'rejected')),
    
    payment_rail_type VARCHAR(20) CHECK (payment_rail_type IN ('trust_fund', 'bank_account', 'cash', 'binance', 'hawala', 'other')),
    payment_rail_details JSON,
    
    related_order_id CHAR(36),
    related_user_type VARCHAR(20) CHECK (related_user_type IN ('end_user', 'tenant_user', 'super_admin')),
    related_user_id CHAR(36),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    note TEXT,
    metadata JSON,
    
    KEY idx_wallet_id (wallet_id),
    KEY idx_status (status),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('end_user', 'tenant_user', 'super_admin')),
    recipient_id CHAR(36) NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    
    channel VARCHAR(10) DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    
    `read` BOOLEAN DEFAULT false,
    read_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    KEY idx_recipient (recipient_type, recipient_id, `read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE announcements (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('all_tenants', 'specific_tenant')),
    target_tenant_id CHAR(36),
    
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    announcement_type VARCHAR(20) DEFAULT 'info' CHECK (announcement_type IN ('info', 'success', 'warning', 'update', 'announcement')),
    
    active BOOLEAN DEFAULT true,
    
    created_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    
    KEY idx_target (target_type, target_tenant_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STATIC CONTENT
-- ============================================

CREATE TABLE instructions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    tenant_id CHAR(36),
    product_id CHAR(36),
    
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'ar',
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tenant_id (tenant_id),
    KEY idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE static_pages (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    tenant_id CHAR(36),
    
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    page_type VARCHAR(20) DEFAULT 'custom' CHECK (page_type IN ('who_are_we', 'terms', 'privacy', 'faq', 'custom')),
    language VARCHAR(10) DEFAULT 'ar',
    
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_slug_lang (tenant_id, slug, language),
    KEY idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- AUDIT & LOGGING
-- ============================================

CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    actor_type VARCHAR(20) CHECK (actor_type IN ('end_user', 'tenant_user', 'super_admin', 'system')),
    actor_id CHAR(36),
    
    tenant_id CHAR(36),
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id CHAR(36),
    
    changes JSON,
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    KEY idx_actor (actor_type, actor_id),
    KEY idx_entity (entity_type, entity_id),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ADD FOREIGN KEYS WITH DESCRIPTIVE NAMES
-- ============================================

-- User Management Relationships
ALTER TABLE end_users
    ADD CONSTRAINT tenant_owns_users FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_has_base_currency FOREIGN KEY (base_currency_id) REFERENCES currencies(id),
    ADD CONSTRAINT user_belongs_to_tier FOREIGN KEY (price_tier_id) REFERENCES price_tiers(id);

ALTER TABLE tenant_users
    ADD CONSTRAINT tenant_has_staff FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Product Relationships
ALTER TABLE products
    ADD CONSTRAINT product_in_category FOREIGN KEY (category_id) REFERENCES product_categories(id);

ALTER TABLE tenant_products
    ADD CONSTRAINT tenant_offers_products FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT tenant_selects_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Pricing Relationships
ALTER TABLE tenant_exchange_rates
    ADD CONSTRAINT tenant_sets_rates FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT rate_for_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
    ADD CONSTRAINT rate_set_by_staff FOREIGN KEY (created_by) REFERENCES tenant_users(id);

ALTER TABLE exchange_rate_change_log
    ADD CONSTRAINT rate_change_for_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT rate_change_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
    ADD CONSTRAINT rate_changed_by_staff FOREIGN KEY (changed_by_user_id) REFERENCES tenant_users(id);

ALTER TABLE price_tiers
    ADD CONSTRAINT tenant_defines_tiers FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE product_tier_prices
    ADD CONSTRAINT tenant_prices_product FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT price_for_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    ADD CONSTRAINT price_for_tier FOREIGN KEY (price_tier_id) REFERENCES price_tiers(id) ON DELETE CASCADE;

-- Provider Relationships
ALTER TABLE providers
    ADD CONSTRAINT provider_uses_currency FOREIGN KEY (currency_id) REFERENCES currencies(id);

ALTER TABLE provider_credentials
    ADD CONSTRAINT credentials_for_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    ADD CONSTRAINT tenant_has_provider_creds FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE provider_products
    ADD CONSTRAINT provider_offers_product FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    ADD CONSTRAINT provider_maps_to_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE user_provider_products
    ADD CONSTRAINT seller_offers_product FOREIGN KEY (seller_user_id) REFERENCES end_users(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_sells_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Order Relationships
ALTER TABLE orders
    ADD CONSTRAINT tenant_receives_order FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_places_order FOREIGN KEY (end_user_id) REFERENCES end_users(id) ON DELETE CASCADE,
    ADD CONSTRAINT order_for_product FOREIGN KEY (product_id) REFERENCES products(id),
    ADD CONSTRAINT order_cost_in_currency FOREIGN KEY (user_cost_currency_id) REFERENCES currencies(id),
    ADD CONSTRAINT order_paid_in_currency FOREIGN KEY (user_payment_currency_id) REFERENCES currencies(id);

ALTER TABLE order_notes
    ADD CONSTRAINT note_for_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE order_fulfillment_details
    ADD CONSTRAINT fulfillment_attempts_for_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- Inventory Relationships
ALTER TABLE code_inventory
    ADD CONSTRAINT code_from_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
    ADD CONSTRAINT code_for_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    ADD CONSTRAINT code_used_in_order FOREIGN KEY (used_in_order_id) REFERENCES orders(id);

-- Wallet Relationships
ALTER TABLE wallets
    ADD CONSTRAINT wallet_in_currency FOREIGN KEY (currency_id) REFERENCES currencies(id);

ALTER TABLE transactions
    ADD CONSTRAINT transaction_for_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    ADD CONSTRAINT transaction_in_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
    ADD CONSTRAINT transaction_related_to_order FOREIGN KEY (related_order_id) REFERENCES orders(id);

-- Notification & Content Relationships
ALTER TABLE announcements
    ADD CONSTRAINT announcement_targets_tenant FOREIGN KEY (target_tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT announcement_created_by_admin FOREIGN KEY (created_by) REFERENCES super_admins(id);

ALTER TABLE instructions
    ADD CONSTRAINT instructions_for_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT instructions_for_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE static_pages
    ADD CONSTRAINT page_belongs_to_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Audit Relationships
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_for_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_end_users_tenant_status ON end_users(tenant_id, status);
CREATE INDEX idx_end_users_can_sell ON end_users(can_sell_to_others, seller_priority);
CREATE INDEX idx_products_category_available ON products(category_id, available);
CREATE INDEX idx_tenant_products_enabled ON tenant_products(tenant_id, enabled);
CREATE INDEX idx_provider_products_available ON provider_products(product_id, priority, available);

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW v_current_exchange_rates AS
SELECT 
    ter.tenant_id,
    ter.currency_id,
    ter.rate_to_usd,
    ter.effective_from
FROM tenant_exchange_rates ter
INNER JOIN (
    SELECT tenant_id, currency_id, MAX(effective_from) as max_date
    FROM tenant_exchange_rates
    GROUP BY tenant_id, currency_id
) latest ON ter.tenant_id = latest.tenant_id 
    AND ter.currency_id = latest.currency_id 
    AND ter.effective_from = latest.max_date;

CREATE VIEW v_active_sellers AS
SELECT 
    u.*,
    t.name as tenant_name,
    t.subdomain as tenant_subdomain
FROM end_users u
INNER JOIN tenants t ON u.tenant_id = t.id
WHERE u.can_sell_to_others = 1
  AND u.status = 'active'
  AND t.status = 'active';

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
INNER JOIN tenants t ON o.tenant_id = t.id
INNER JOIN end_users u ON o.end_user_id = u.id
INNER JOIN products p ON o.product_id = p.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
INNER JOIN currencies c ON o.user_payment_currency_id = c.id;

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
INNER JOIN tenants t ON u.tenant_id = t.id
INNER JOIN currencies c ON u.base_currency_id = c.id;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'MySQL schema created successfully! 32 tables + 4 views ready.' as status;
