# Ahla Database Guide

## 📊 How to View Everything in DBeaver

### Method 1: Import and Visualize Schema

1. **Create a New Database Connection**
   - Open DBeaver
   - Click `Database` → `New Database Connection`
   - Select your database (PostgreSQL, MySQL, etc.)
   - Configure connection details

2. **Execute the Schema**
   - Open `database_schema.sql`
   - Select all (Ctrl+A)
   - Execute (Ctrl+Enter or F9)
   - Wait for completion

3. **View ER Diagram**
   - In Database Navigator, right-click your database/schema
   - Select `View Diagram` or `ER Diagram`
   - DBeaver will auto-generate visual representation
   - You can:
     - Drag tables around
     - See relationships (foreign keys)
     - Export as image (PNG, SVG)

### Method 2: Use Database Navigator

1. **Expand Database Structure**
   ```
   Your Database
   └── Schemas
       └── public (or your schema)
           ├── Tables (32 tables)
           ├── Views (4 views)
           └── Indexes
   ```

2. **Browse Tables**
   - Click on any table to see:
     - **Columns** tab: All fields, types, constraints
     - **Foreign Keys** tab: Relationships
     - **Indexes** tab: Performance indexes
     - **Data** tab: Browse actual data
     - **ER Diagram** tab: Visual for this table

3. **Useful Right-Click Options**
   - `Generate SQL` → `SELECT` - Quick query template
   - `View Diagram` - See table relationships
   - `Export Data` - Export to CSV, JSON, etc.

### Method 3: Custom ER Diagram

1. **Create Custom Diagram**
   - Right-click database → `Create` → `ER Diagram`
   - Name it "AHLA Complete Schema"
   - Select all tables or specific groups:
     - User Management (tenants, end_users, tenant_users, super_admins)
     - Products (products, product_categories, tenant_products)
     - Orders (orders, order_notes, order_fulfillment_details)
     - Pricing (currencies, price_tiers, product_tier_prices)
     - Wallet (wallets, transactions)

2. **Customize Diagram**
   - Drag and arrange tables logically
   - Use toolbar to:
     - Show/hide columns
     - Adjust table size
     - Change layout (hierarchical, circular, etc.)
   - Save diagram for future reference

### Method 4: SQL Queries to Explore

```sql
-- List all tables with row counts
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- View all foreign key relationships
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- View all indexes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## 🗂️ Database Structure Overview

### Core Entities (32 Tables, 4 Views)

#### 👥 User Management (5 tables)
- `tenants` - Multi-tenant stores
- `end_users` - Customers (can buy and sell)
- `tenant_users` - Store admins/staff
- `super_admins` - Platform administrators
- `user_security` - 2FA/TOTP settings

#### 📦 Products (4 tables)
- `product_categories` - Games/apps (PUBG, Free Fire, etc.)
- `products` - Master catalog
- `tenant_products` - Tenant selections from catalog
- `user_provider_products` - P2P marketplace inventory

#### 💰 Pricing (5 tables)
- `currencies` - USD, TRY, SYP, etc.
- `tenant_exchange_rates` - Current rates per tenant
- `exchange_rate_change_log` - Historical changes
- `price_tiers` - Up to 5 tiers per tenant
- `product_tier_prices` - Prices per tier

#### 🔌 Providers (3 tables)
- `providers` - Znet, ZDK, Barakat, etc.
- `provider_credentials` - API keys/passwords
- `provider_products` - Provider catalog mapping

#### 🛒 Orders (3 tables)
- `orders` - Main order data
- `order_notes` - Comments on orders
- `order_fulfillment_details` - Provider attempts log

#### 💳 Wallet & Transactions (2 tables)
- `wallets` - Balance tracking
- `transactions` - All money movements

#### 📦 Inventory (1 table)
- `code_inventory` - Pre-purchased codes

#### 🔔 Notifications (2 tables)
- `notifications` - User notifications
- `announcements` - Tenant announcements

#### 📄 Content (2 tables)
- `instructions` - Product instructions
- `static_pages` - CMS pages

#### 📝 Audit (1 table)
- `audit_logs` - Complete action history

#### 📊 Views (4 views)
- `v_current_exchange_rates` - Latest rates
- `v_active_sellers` - Users who can sell
- `v_order_summary` - Order details joined
- `v_user_wallet_status` - User balances + credit

---

## 🔑 Key Relationships

### Multi-Tenancy Hierarchy
```
tenants
├── end_users (customers - isolated per tenant)
├── tenant_users (staff)
├── tenant_products (product selection)
├── tenant_exchange_rates (pricing control)
├── price_tiers (1-5 tiers)
└── orders
```

### Product Flow
```
product_categories
└── products (master catalog)
    ├── tenant_products (tenant selection)
    ├── provider_products (fulfillment sources)
    ├── user_provider_products (P2P sellers)
    └── product_tier_prices (pricing)
```

### Order Fulfillment
```
end_user → order → fulfillment attempt
                  ├── provider (znet, zdk, etc.)
                  ├── end_user (P2P)
                  └── code_inventory (fallback)
```

### Wallet System
```
end_user
├── wallet_balance (current balance)
├── credit_line (overdraft limit)
└── transactions (history)
    ├── deposit (add money)
    ├── order_payment (deduct)
    ├── settlement (repay credit)
    └── refund (return money)
```

---

## 💡 Important Features

### 1. Credit Line System
- Users can overdraft up to their `credit_line`
- Actual balance can go negative
- Use `v_user_wallet_status` view to see available balance:
  ```sql
  SELECT * FROM v_user_wallet_status WHERE user_id = 'xxx';
  -- Shows: wallet_balance, credit_line, available_balance
  ```

### 2. P2P Marketplace
- End users with `can_sell_to_others = true` can fulfill orders
- They maintain inventory in `user_provider_products`
- Order gets `fulfilled_by_type = 'end_user'`

### 3. Immutable Base Currency
- Each `end_user` selects ONE `base_currency_id` at signup
- Cannot be changed later
- All their orders, wallet, transactions use this currency

### 4. Dynamic Exchange Rates
- Tenants publish their own rates in `tenant_exchange_rates`
- Use `v_current_exchange_rates` view for latest rates
- All changes logged in `exchange_rate_change_log`

### 5. Customizable Products
- Products with `customizable = true` allow custom amounts
- Use `min_amount` and `max_amount` for validation
- Pricing formulas in `product_tier_prices.formula_config`

### 6. Order Cost Tracking
- `user_entered_cost` - shown to user (never changes)
- `user_payment_amount` - after currency conversion
- `actual_cost_usd` - real cost from provider (filled after completion)
- This allows showing users consistent pricing while tracking actual costs

---

## 🔍 Useful Queries

### Get tenant's products with current prices
```sql
SELECT 
    t.name as tenant,
    p.name as product,
    pt.name as tier,
    ptp.price_usd,
    p.base_cost_usd,
    (ptp.price_usd - p.base_cost_usd) as margin
FROM tenant_products tp
JOIN tenants t ON tp.tenant_id = t.id
JOIN products p ON tp.product_id = p.id
JOIN product_tier_prices ptp ON ptp.product_id = p.id AND ptp.tenant_id = t.id
JOIN price_tiers pt ON ptp.price_tier_id = pt.id
WHERE tp.enabled = true
ORDER BY t.name, p.name, pt.tier_level;
```

### Find users with negative balance (using credit)
```sql
SELECT 
    username,
    email,
    wallet_balance,
    credit_line,
    (wallet_balance + credit_line) as available_balance,
    base_currency_id
FROM end_users
WHERE wallet_balance < 0
ORDER BY wallet_balance ASC;
```

### Order fulfillment success rate
```sql
SELECT 
    fulfillment_type,
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY fulfillment_type), 2) as percentage
FROM orders
GROUP BY fulfillment_type, status
ORDER BY fulfillment_type, status;
```

### Top selling products
```sql
SELECT 
    p.name,
    pc.name as category,
    COUNT(o.id) as total_orders,
    SUM(o.user_payment_amount) as total_revenue_usd,
    AVG(o.user_payment_amount) as avg_order_value
FROM orders o
JOIN products p ON o.product_id = p.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE o.status = 'completed'
GROUP BY p.id, p.name, pc.name
ORDER BY total_orders DESC
LIMIT 20;
```

### Active P2P sellers with inventory
```sql
SELECT 
    u.username,
    u.email,
    p.name as product,
    upp.stock_quantity,
    upp.cost_usd,
    upp.available
FROM user_provider_products upp
JOIN end_users u ON upp.seller_user_id = u.id
JOIN products p ON upp.product_id = p.id
WHERE u.can_sell_to_others = true
  AND upp.available = true
  AND upp.stock_quantity > 0
ORDER BY u.username, p.name;
```

---

## 📈 Performance Tips

### Indexed Fields (Already Created)
- All foreign keys are indexed
- Common query patterns (tenant_id, status, created_at)
- Composite indexes for frequent joins

### Query Optimization
- Use views for complex repeated queries
- Add EXPLAIN ANALYZE to understand query plans
- Consider partitioning `orders` and `transactions` by date for large datasets

### Maintenance
```sql
-- Update table statistics
ANALYZE;

-- Rebuild indexes (if needed)
REINDEX DATABASE your_database_name;

-- Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🎨 DBeaver Tips

### Customize Your Workspace
1. **Split Editors**: Drag tabs to split view (schema + data)
2. **Pin Frequently Used**: Right-click table → `Pin Tab`
3. **Bookmarks**: Add frequently used queries to bookmarks
4. **Color Code**: Right-click tables → `Properties` → Change color

### Keyboard Shortcuts
- `Ctrl+Enter` - Execute query
- `Ctrl+]` - Format SQL
- `Ctrl+Space` - Auto-complete
- `F4` - View table properties
- `Ctrl+F7` - Find text in results

### Export Data
1. Right-click query results or table
2. `Export Data`
3. Choose format: CSV, JSON, SQL, Excel, etc.
4. Configure options and export

---

## 🚀 Next Steps

1. **Run Schema**: Execute `database_schema.sql` in your database
2. **Create ER Diagram**: Use DBeaver's visual tools
3. **Seed Data**: Create sample tenants, users, products
4. **Test Queries**: Try the example queries above
5. **Build API**: Connect your backend to this schema

---

## 📞 Schema Summary

- **32 Tables**: Complete data model
- **4 Views**: Pre-built queries for common needs
- **22 Indexes**: Optimized for performance
- **Foreign Keys**: Data integrity enforced
- **Comments**: Documentation in database
- **Constraints**: Data validation at DB level

**Database is production-ready!** 🎉
