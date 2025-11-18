# Ahla Platform - Complete Database Design Summary

## Executive Overview

This is a **multi-tenant gaming product reseller platform** with:
- **32 tables** supporting complete business operations
- **Multi-currency** system with immutable user base currency
- **P2P marketplace** where users can sell to each other
- **Credit line system** allowing overdraft purchases
- **Flexible fulfillment** via providers (ZNet/ZDK), user sellers, or pre-bought codes
- **Dynamic pricing tiers** per tenant
- **Complete audit trail** for all operations

---

## 1. CORE ARCHITECTURE

### 1.1 Super Admin Layer
**Table: `super_admins`**
- Platform-level administrators who manage the entire system
- Can create/manage tenants
- Can send announcements to tenants

**Functions:**
- Create new tenant accounts
- Broadcast announcements to all or specific tenants
- Monitor platform-wide operations

---

### 1.2 Multi-Tenancy (Tenant Isolation)

**Table: `tenants`**
```
Key Fields:
- subdomain (unique)         → Used for routing (e.g., tenant1.AHLA.com)
- name, logo_url             → Branding
- wallet_balance (USD)       → Tenant's operational funds
- active                     → Can be disabled by super admin
```

**What Each Tenant Gets:**
1. **Isolated user base** (`end_users`) - complete separation between tenants
2. **Custom product catalog** (`tenant_products`) - choose which products to offer
3. **Own exchange rates** (`tenant_exchange_rates`) - set their own currency rates
4. **Price tiers** (`price_tiers`) - create user pricing groups (I, II, III, etc.)
5. **Staff accounts** (`tenant_users`) - internal team members
6. **Provider credentials** (`provider_credentials`) - own API keys for ZNet/ZDK
7. **Static pages** (`static_pages`) - custom content (About Us, Terms, etc.)
8. **Order management** - see only their tenant's orders

**Tenant Business Model:**
- Buys products at base cost (USD)
- Sets exchange rates for local currencies (TRY, SYP, etc.)
- Defines markup via price tiers
- Earns profit = (user_payment_amount) - (actual_cost_usd)
- Can offer credit lines to users (overdraft)

---

## 2. USER MANAGEMENT

### 2.1 End Users (Customers)

**Table: `end_users`**
```
Key Fields:
- tenant_id                  → Which tenant owns this user
- email, username            → Authentication
- base_currency_id           → Set ONCE, never changes (immutable)
- wallet_balance             → Current funds
- credit_line                → Overdraft limit (e.g., 1000.00)
- price_tier_id              → Tenant-assigned pricing group (I, II, III, etc.)
- can_sell_to_others         → Allows tenant staff to route inbound reseller orders to this account
- api_token_hash             → For API access
- totp_enabled               → Two-factor authentication
```

**User Capabilities:**
1. **Place Orders** - Buy gaming products (codes, top-ups, subscriptions)
2. **Wallet Management** - Deposit, track balance, use credit line
3. **Credit System** - Can go negative up to credit_line amount
4. **P2P Selling** - If `can_sell_to_others=true`, can list products for others to buy
5. **Price Tier** - Determined and locked by the tenant; users cannot self-select or change tiers
6. **API Access** - Can integrate via api_token for automated ordering
7. **Multi-Currency** - Wallet in their base_currency, but all costs calculated in USD

**Credit Line Example:**
```
User Setup:
- wallet_balance: 500.00
- credit_line: 1000.00
- Available funds: 1500.00

Order for 700.00:
- After order: wallet_balance = -200.00 (used 200 of credit)
- Remaining credit: 800.00

Deposit 500.00:
- After deposit: wallet_balance = 300.00
- Full credit restored: 1000.00
```

### 2.2 Tenant Staff Users

**Table: `tenant_users`**
```
Key Fields:
- tenant_id                  → Which tenant they work for
- email, username            → Staff authentication
- role                       → admin, manager, support, accountant
- permissions JSON           → Granular access control
```

**Staff Roles & Functions:**
- **Admin**: Full access, can modify exchange rates, manage products
- **Manager**: View reports, manage orders, user management
- **Support**: Handle customer issues, view orders, add order notes
- **Accountant**: Financial reports, transaction review

**What Staff Can Do:**
1. Manually fulfill orders
2. Set/update exchange rates (logged in `exchange_rate_change_log`)
3. Manage tenant product catalog
4. Add notes to orders
5. Adjust user credit lines
6. View audit logs

---

## 3. PRODUCT CATALOG SYSTEM

### 3.1 Master Product List

**Table: `products`**
```
Key Fields:
- code (UNIQUE)              → Global identifier (e.g., PUBG_100UC)
- name                       → Product name
- display_name               → User-facing name
- category_id                → Product category
- base_cost_usd              → Foundation cost in USD
- icon_url                   → Product image
- customizable               → When true, checkout collects user metadata and lets them enter a custom unit/quantity
- min_quantity, max_quantity → Purchase limits
- active                     → Can be disabled globally
```

**Function:**
- Global master list of all available gaming products
- Tenants select which products to offer from this list
- Base cost is the absolute minimum (wholesale price)
- When `customizable = true`, the product definition specifies the extra inputs plus an optional custom quantity field that activates only for that product

### 3.2 Product Categories

**Table: `product_categories`**
```
Examples:
- Mobile Games (PUBG, Free Fire, Mobile Legends)
- PC/Console (Steam, PlayStation, Xbox)
- Subscriptions (Netflix, Spotify, Apple Music)
- Gift Cards (iTunes, Google Play, Amazon)
- In-Game Currency (V-Bucks, COD Points, Riot Points)
```

### 3.3 Tenant Product Selection

**Table: `tenant_products`**
```
Key Fields:
- tenant_id + product_id     → Which products this tenant offers
- enabled                    → Can temporarily disable
- custom_name                → Override product name
- custom_display_name        → Override display name
- custom_cost_usd            → Override base cost (if special deal)
- sort_order                 → Display ordering
```

**Function:**
- Each tenant picks products from master list
- Can customize names/costs per tenant
- Enables/disables products independently
- Example: Tenant A offers 50 products, Tenant B offers 200

---

## 4. PRICING SYSTEM

### 4.1 Currencies

**Table: `currencies`**
```
Examples:
- USD (United States Dollar) - symbol: $
- TRY (Turkish Lira) - symbol: ₺
- SYP (Syrian Pound) - symbol: £S
- EUR (Euro) - symbol: €
```

**Key Rule:** 
- **All costs stored in USD** (base_cost_usd, actual_cost_usd, cost_usd)
- User's payment calculated in their base_currency
- Exchange rates convert between currencies
- Each end user inherits the exchange rate table maintained by their tenant; users cannot override it

### 4.2 Exchange Rates (Per Tenant)

**Table: `tenant_exchange_rates`**
```
Key Fields:
- tenant_id + currency_id    → Each tenant sets own rates
- rate_to_usd                → Conversion rate to USD
- effective_from             → When this rate became active
- last_updated_by            → Which staff user changed it
```

**Example:**
```
Tenant A (Turkish market):
- TRY → USD rate: 0.032 (31.25 TRY = 1 USD)

Tenant B (Syrian market):
- SYP → USD rate: 0.00079 (1265 SYP = 1 USD)

Product cost: 10.00 USD
- Tenant A user pays: 312.50 TRY
- Tenant B user pays: 12,650 SYP
```

**Rate Change Logging:**

**Table: `exchange_rate_change_log`**
- Tracks every rate change
- Old rate → New rate
- Who changed it
- Reason for change
- Timestamp

**Why Per-Tenant Rates?**
- Different markets have different margins
- Local competition considerations
- Regional payment processor fees
- Tenant's profit strategy

### 4.3 Price Tiers (User Pricing Groups)

**Table: `price_tiers`**
```
Key Fields:
- tenant_id                  → Each tenant defines own tiers
- tier_name                  → "Tier I", "VIP", "Wholesale", etc.
- tier_level                 → Numeric level (1=highest price, 4=lowest)
- description                → Who this tier is for
```

**Table: `product_tier_prices`**
```
Key Fields:
- product_id + tier_id       → Price for this product in this tier
- price_usd                  → Price in USD
```

**Pricing Example:**
```
Product: PUBG 100 UC
- Base cost: 1.00 USD

Tenant's Price Tiers:
- Tier I (Retail):     1.50 USD (50% markup)
- Tier II (Regular):   1.30 USD (30% markup)
- Tier III (VIP):      1.15 USD (15% markup)
- Tier IV (Wholesale): 1.05 USD (5% markup)
- Tier V (Partner):    1.02 USD (2% markup)

**Tier Limit:** Maximum 5 tiers per tenant
**Price Management:** Can set prices manually per product or bulk update

User in Tier II with TRY base currency:
- Price: 1.30 USD
- Exchange rate: 31.25 TRY/USD
- User pays: 40.63 TRY
```

**Function:**
- Reward loyal customers with better prices
- Wholesale pricing for resellers
- Volume-based discounts
- Flexible profit margins

---

## 5. ORDER PROCESSING

### 5.1 Orders Table

**Table: `orders`**
```
Critical Fields:

Relationships:
- tenant_id                  → Which tenant received this order
- end_user_id                → Which customer placed it
- product_id                 → What product was ordered

Pricing (IMMUTABLE - never changes after order creation):
- user_entered_cost          → Price shown to user at checkout
- user_payment_currency_id   → Currency user paid in
- user_payment_amount        → Amount user actually paid

Real Costs:
- actual_cost_usd            → Real provider cost (can differ from user_entered_cost)
- exchange_rate_snapshot     → Rate at time of order

Fulfillment:
- fulfillment_type           → 'manual' or 'auto'
- fulfilled_by_type          → 'provider', 'tenant_user', 'code_inventory' (only tenant staff/resellers can fulfill manually)
- fulfilled_by_id            → ID of the fulfiller
- status                     → 'pending', 'processing', 'completed', 'failed', 'rejected'

Results:
- result_codes               → JSON array of PINs/serials delivered
- additional_user_inputs     → JSON (player ID, email, etc.)
- provider_response          → Raw API response from provider

Provider API request/response formats are documented in `docs/znet.md` and `docs/zdk.md` (Barakat/Appstore are ZDK tenants sharing the same API shape).

Wallet Impact:
- wallet_balance_before      → User's balance before order
- wallet_balance_after       → User's balance after order
```

**Order Lifecycle:**
1. **User initiates order** → Creates pending order
2. **Payment deducted** → From wallet (can go negative using credit_line)
3. **Fulfillment attempted** → Via provider/user/code
4. **Status updated** → Completed/failed
5. **Result delivered** → Codes stored in result_codes
6. **Audit logged** → All changes tracked

**Key Features:**

**Price Stability:**
- `user_entered_cost` is frozen at order creation
- Even if exchange rates change, user's price doesn't
- Protects user from rate fluctuations during processing

**Flexible Fulfillment Sources:**
Can be fulfilled by:
1. **Provider APIs** (ZNet, ZDK) - Auto fulfillment
2. **Tenant reseller staff** - Tenant users who manually fulfill on behalf of their managed end users
   - Future enhancement: treat trusted tenant resellers as API-based auto sources
3. **Code Inventory** - Pre-bought codes

### 5.2 Order Notes

**Table: `order_notes`**
```
Key Fields:
- order_id                   → Which order
- note_text                  → Comment/note
- created_by_user_id         → Staff member who added it
- created_by_type            → 'tenant_user', 'super_admin'
- visibility                 → 'internal', 'customer'
```

**Function:**
- Staff communication about order issues
- Customer service notes
- Internal tracking
- Can be visible to customer or internal only

### 5.3 Fulfillment Details

**Table: `order_fulfillment_details`**
```
Key Fields:
- order_id                   → Which order
- attempt_number             → 1st attempt, 2nd retry, etc.
- source_type                → 'provider', 'tenant_user', 'code_inventory'
- Tenant users own/manage end users, act as organizational fulfillment accounts, and never place orders themselves
- source_id                  → ID of the source
- success                    → true/false
- error_message              → If failed, why?
- provider_raw_response      → Full API response
- cost_at_attempt            → Cost at this attempt
```

**Function:**
- Tracks every fulfillment attempt
- Enables retry logic
- Debugging failed orders
- Cost tracking per attempt (provider prices can change)

**Multi-Attempt Example:**
```
Order #12345 for PUBG 100 UC:

Attempt 1:
- Source: ZNet provider
- Result: Failed (insufficient balance)
- Cost: 1.00 USD

Attempt 2:
- Source: ZDK provider
- Result: Failed (product unavailable)
- Cost: 1.05 USD

Attempt 3:
- Source: P2P user (seller_id: abc-123)
- Result: Success
- Cost: 1.10 USD
- Final delivery
```

---

## 6. FULFILLMENT SOURCES

### 6.1 External Providers (ZNet, ZDK)

**Table: `providers`**
```
Key Fields:
- type                       → 'znet', 'zdk', 'custom_api'
- name                       → Provider name
- base_url                   → API endpoint
- wallet_balance             → Provider balance tracking
- active                     → Can be disabled
```

**Table: `provider_credentials`**
```
Key Fields:
- provider_id                → Which provider
- tenant_id                  → Which tenant owns these credentials
- credentials JSON           → Encrypted: {token, username, password, api_key}
- active                     → Can rotate credentials
```

**Why Per-Tenant Credentials?**
- Each tenant uses their own ZNet/ZDK account
- Tenants can store multiple ZNet/ZDK accounts when they operate several reseller profiles
- Separate billing
- Independent balances
- Security isolation

**Table: `provider_products`**
```
Key Fields:
- provider_id + product_id   → Maps provider's products to master list
- external_product_id        → Provider's ID for this product
- cost_usd                   → Provider's current price
- priority                   → If multiple providers, which to try first
- available                  → Provider has stock

ZNet-Specific Fields:
- znet_adi_name              → ZNet product name
- znet_fiyat_price           → ZNet price
- znet_oyun                  → ZNet game identifier
- znet_kupur                 → ZNet coupon code
- znet_bilgi_id              → ZNet info ID

ZDK-Specific Fields:
- zdk_id                     → ZDK product ID

Cross-System:
- AHLA_id                   → Internal AHLA ID
- external_name              → Generic provider name
- metadata JSON              → Any other provider data
```

**Auto-Fulfillment Flow:**
1. Order created for PUBG 100 UC
2. Tenant users define fulfillment destinations per product (individually or in bulk) choosing manual, fixed provider, or the paid "fulfill by best price" mode
3. For best-price flows, the system queries `provider_products` WHERE product_id = PUBG AND available = true, ranks by live cost, then attempts in that order
4. Attempts Provider #1 (ZNet)
5. If fails, tries Provider #2 (ZDK)
6. If all fail, marks as manual fulfillment needed

### 6.2 P2P Marketplace (User-to-User)

**Table: `user_provider_products`**
```
Key Fields:
- seller_user_id             → Tenant user (reseller staff) offering fulfillment
- product_id                 → What product they're selling
- cost_usd                   → Their price (must be > base_cost)
- available                  → Currently available to sell
- stock_quantity             → Optional cap on how many units they can fulfill
```

**How It Works:**
1. Tenant reseller staff (managing end users who can_sell_to_others = true) lists PUBG 100 UC at 1.10 USD
2. Another end user from the same tenant places an order
3. System finds the cheapest configured source (which could be that reseller staff member)
4. Order is assigned to the tenant user for fulfillment
5. The reseller's wallet is credited with their selling price once fulfilled
6. The purchasing end user receives the product code

**P2P Benefits:**
- Users can resell codes
- Provides fulfillment redundancy
- Enables wholesale customers to resell
- Creates marketplace ecosystem

### 6.3 Pre-Bought Code Inventory

**Table: `code_inventory`**
```
Key Fields:
- product_id                 → What product this code is for
- serial_number              → Card serial (if applicable)
- pin_code                   → PIN/redemption code
- provider_id                → Where it was bought from
- cost_usd                   → What we paid for it
- used                       → Has it been used in an order?
- used_in_order_id           → Which order consumed it
- expires_at                 → Expiration date
```

**Function:**
- Pre-buy codes in bulk at discount
- Instant fulfillment (no API delay)
- Use for products with unstable API
- Bulk purchase inventory management

**Fulfillment Flow:**
1. Order created for iTunes $50 card
2. System checks `code_inventory` WHERE product_id = iTunes50 AND used = false
3. Finds available code
4. Marks as used, links to order_id
5. Delivers code to customer
6. Updates order status to completed

---

## 7. WALLET & FINANCIAL SYSTEM

### 7.1 Wallets (Multi-Entity)

**Table: `wallets`**
```
Key Fields:
- owner_type                 → 'end_user', 'provider'
- owner_id                   → ID of the owner
- currency_id                → Which currency this wallet holds
- balance                    → Current balance (can be negative)
```

**Who Has Wallets:**
1. **End Users** - Customer balance in their base_currency
2. **Providers** - Snapshot of provider balances for reconciliation (tenants reference provider statements rather than holding tenant wallets inside AHLA)

Tenants themselves do not receive wallet rows; their treasury data is derived from provider reports plus aggregated end-user activity.


**Multi-Currency Support:**
- Each user has ONE wallet in their base_currency
- Providers can expose balances in multiple currencies for reporting
- All conversions use the tenant's exchange rates when end users spend

### 7.2 Transactions

**Table: `transactions`**
```
Key Fields:
- wallet_id                  → Which wallet
- type                       → 'deposit', 'order_payment', 'settlement', 'order_refund', 'transfer'
- amount                     → Transaction amount
- currency_id                → Transaction currency
- related_order_id           → If related to an order

Balance Tracking:
- balance_before             → Wallet balance before this transaction
- balance_after              → Wallet balance after this transaction
- Every fulfillment or rejection event must capture these before/after snapshots for traceability
Payment Rails:
- payment_rail_type          → 'trust_fund', 'bank_account', 'cash', 'binance', 'hawala', 'other'
- payment_rail_details JSON  → Payment method details

Metadata:
- description                → Transaction description
- created_at                 → Timestamp
```

**Transaction Types:**

1. **deposit** - User adds money
   ```
   User deposits 100 TRY
   - balance_before: 50.00
   - amount: +100.00
   - balance_after: 150.00
   - payment_rail: bank_account
   ```

2. **order_payment** - User buys product
   ```
   User orders 50 USD product (1562.50 TRY)
   - balance_before: 150.00
   - amount: -1562.50
   - balance_after: -1412.50 (using credit!)
   - related_order_id: order-123
   ```

3. **settlement** - User repays credit
   ```
   User deposits to repay credit
   - balance_before: -1412.50
   - amount: +2000.00
   - balance_after: 587.50
   - payment_rail: binance
   ```

4. **order_refund** - Order cancelled/failed
   ```
   Order failed, refund user
   - balance_before: -1412.50
   - amount: +1562.50
   - balance_after: 150.00
   - related_order_id: order-123
   ```

5. **transfer** - User-to-user transfer (if enabled)
   ```
   User A sends to User B
   - User A: -100.00
   - User B: +100.00
   ```

### 7.3 Payment Rails

**Payment Rail Types & Details (JSON):**

1. **trust_fund**
   ```json
   {
     "name": "Main Trust Fund",
     "note": "Primary deposit method"
   }
   ```

2. **bank_account**
   ```json
   {
     "name": "Bank Transfer",
     "card_holder_name": "John Doe",
     "iban": "TR330006100519786457841326",
     "note": "Personal account"
   }
   ```

3. **cash**
   ```json
   {
     "agent_name": "Ali Shop",
     "location": "Istanbul, Turkey",
     "note": "Corner shop deposit"
   }
   ```

4. **binance**
   ```json
   {
     "iban": "USDT_TRC20",
     "network": "TRC20",
     "address": "TXX...XXX",
     "note": "Crypto payment"
   }
   ```

5. **hawala**
   ```json
   {
     "recipient": "Mohammed Transfer",
     "destination": "Damascus",
     "agent": "Local agent #42",
     "note": "Informal transfer"
   }
   ```

6. **other**
   ```json
   {
     "name": "PayPal",
     "email": "user@example.com",
     "note": "International payment"
   }
   ```

**Function:**
- Flexible payment method tracking
- Compliance and auditing
- Reconciliation with payment providers
- Regional payment method support

---

## 8. NOTIFICATIONS & CONTENT

### 8.1 Announcements

**Table: `announcements`**
```
Key Fields:
- tenant_id                  → Which tenant (NULL = all tenants)
- created_by_admin_id        → Which super admin created it
- title, content             → Announcement text
- type                       → 'info', 'warning', 'critical', 'maintenance'
- priority                   → Display ordering
- active                     → Can be archived
- published_at               → When to show it
- expires_at                 → Auto-hide after this date
```

**Function:**
- Super admin broadcasts to tenants
- Tenant broadcasts to their users
- System maintenance notices
- New feature announcements
- Policy updates

### 8.2 Instructions (Product-Specific)

**Table: `instructions`**
```
Key Fields:
- tenant_id                  → Which tenant's instructions
- product_id                 → Which product (NULL = general)
- instruction_text           → HTML/markdown content
- language                   → 'en', 'tr', 'ar', etc.
- display_location           → 'checkout', 'product_page', 'email'
```

**Examples:**
```
Product: PUBG Mobile UC
Instructions (checkout):
"Please enter your Player ID in the format: 5123456789. 
You can find this in PUBG Mobile > Settings > Account."

Product: Steam Wallet
Instructions (email):
"To redeem your Steam code:
1. Open Steam client
2. Click Games > Activate a Product
3. Enter your code"
```

### 8.3 Static Pages

**Table: `static_pages`**
```
Key Fields:
- tenant_id                  → Which tenant's page
- slug                       → URL slug (e.g., 'about-us', 'terms')
- title                      → Page title
- content                    → HTML content
- language                   → Page language
- published                  → Is it live?
```

**Common Pages:**
- About Us
- Terms of Service
- Privacy Policy
- Contact Us
- FAQ
- How It Works

---

## 9. AUDIT & SECURITY

### 9.1 Audit Logs

**Table: `audit_logs`**
```
Key Fields:
- tenant_id                  → Which tenant
- user_id                    → Who did it
- user_type                  → 'end_user', 'tenant_user', 'super_admin'
- action_type                → 'create', 'update', 'delete', 'login', 'order', 'payment'
- entity_type                → 'order', 'product', 'user', 'exchange_rate'
- entity_id                  → ID of affected entity
- changes JSON               → Before/after values
- ip_address                 → User's IP
- user_agent                 → Browser/app info
- created_at                 → Timestamp
```

**What's Logged:**
- All order creations/updates
- Exchange rate changes
- User account modifications
- Login attempts (success/fail)
- Product catalog changes
- Payment transactions
- Administrative actions

**Example Log Entry:**
```json
{
  "action_type": "update",
  "entity_type": "exchange_rate",
  "entity_id": "rate-abc-123",
  "changes": {
    "rate_to_usd": {
      "old": 0.032,
      "new": 0.031
    },
    "reason": "Market adjustment"
  },
  "user_id": "staff-xyz-789",
  "user_type": "tenant_user",
  "ip_address": "192.168.1.100",
  "created_at": "2025-11-15T10:30:00Z"
}
```

### 9.2 Exchange Rate Change Log

**Table: `exchange_rate_change_log`**
```
Key Fields:
- tenant_id                  → Which tenant
- currency_id                → Which currency
- old_rate_to_usd            → Previous rate
- new_rate_to_usd            → New rate
- changed_by_user_id         → Staff who changed it
- change_reason              → Why changed
- changed_at                 → Timestamp
```

**Function:**
- Dedicated rate change tracking
- Compliance requirement
- Dispute resolution
- Rate history analysis

---

## 10. KEY BUSINESS FUNCTIONS

### 10.1 Order Placement Flow

**Step-by-Step:**

1. **User browses products**
   - Sees products filtered by `tenant_products` (tenant's catalog)
   - Prices shown based on user's `price_tier_id`
   - Displayed in user's `base_currency`

2. **User selects product**
   - Product: PUBG Mobile 100 UC
   - Base cost: 1.00 USD
   - User's tier (Tier II): 1.30 USD
   - User's currency (TRY): 31.25 TRY/USD
   - **Final price shown: 40.63 TRY**

3. **User enters required info**
   - Player ID: 5123456789
   - Stored in `additional_user_inputs` JSON

4. **System calculates costs**
   ```
   user_entered_cost = 1.30 USD
   user_payment_amount = 40.63 TRY
   exchange_rate_snapshot = 31.25
   ```

5. **Check wallet balance**
   ```
   wallet_balance: 20.00 TRY
   credit_line: 1000.00 TRY
   total_available: 1020.00 TRY
   order_cost: 40.63 TRY
   ✓ Sufficient funds (including credit)
   ```

6. **Create order**
   ```sql
   INSERT INTO orders (
     tenant_id, end_user_id, product_id,
     user_entered_cost, user_payment_amount, user_payment_currency_id,
     wallet_balance_before, wallet_balance_after,
     status, fulfillment_type
   ) VALUES (
     'tenant-123', 'user-456', 'pubg-100uc',
     1.30, 40.63, 'try-currency',
     20.00, -20.63,
     'pending', 'auto'
   )
   ```

7. **Create transaction**
   ```sql
   INSERT INTO transactions (
     wallet_id, type, amount, currency_id,
     balance_before, balance_after,
     related_order_id
   ) VALUES (
     'wallet-789', 'order_payment', -40.63, 'try-currency',
     20.00, -20.63,
     'order-new-id'
   )
   ```

8. **Attempt fulfillment**
   - Query `provider_products` for PUBG 100 UC
   - Find available providers, order by priority
   - Try Provider 1 (ZNet)

9. **ZNet API call**
   ```
   POST https://api.znet.com/order
   {
     "product_id": "znet_bilgi_id_12345",
     "player_id": "5123456789",
     "quantity": 1
   }
   ```

10. **Provider response**
    ```json
    {
      "success": true,
      "order_id": "znet-order-99999",
      "codes": [
        {"pin": "XXXX-XXXX-XXXX"}
      ],
      "cost": 1.00
    }
    ```

11. **Update order**
    ```sql
    UPDATE orders SET
      status = 'completed',
      result_codes = '["XXXX-XXXX-XXXX"]',
      actual_cost_usd = 1.00,
      provider_response = '{...}',
      fulfilled_by_type = 'provider',
      fulfilled_by_id = 'provider-znet'
    WHERE id = 'order-new-id'
    ```

12. **Create fulfillment record**
    ```sql
    INSERT INTO order_fulfillment_details (
      order_id, attempt_number, source_type, source_id,
      success, cost_at_attempt, provider_raw_response
    ) VALUES (
      'order-new-id', 1, 'provider', 'provider-znet',
      true, 1.00, '{...}'
    )
    ```

13. **Deliver to user**
    - Email with code
    - In-app notification
    - Order history updated

14. **Profit calculation**
    ```
    User paid: 1.30 USD (in TRY equivalent)
    Actual cost: 1.00 USD
    Tenant profit: 0.30 USD
    ```

### 10.2 P2P Order Fulfillment

**Scenario: Tenant User A fulfills an order for their end user B (B belongs to Tenant A)**

1. **User A lists product**
   ```sql
   INSERT INTO user_provider_products (
     seller_user_id, product_id, cost_usd,
     available, stock_quantity
   ) VALUES (
     'user-seller-a', 'pubg-100uc', 1.10,
     true, 50
   )
   ```

2. **End User B (within Tenant A) places order**
   - System finds cheapest source scoped to Tenant A
   - Finds User A's reseller listing at 1.10 USD

3. **Order created**
   ```
   fulfilled_by_type = 'tenant_user'
   fulfilled_by_id = 'user-seller-a'
   actual_cost_usd = 1.10
   ```

4. **Notify User A**
   - "You have a new order to fulfill"
   - User A provides the code manually or via API

5. **User A delivers code**
   - Enters code in fulfillment interface
   - Or sends via API

6. **Payment to User A**
   ```sql
   INSERT INTO transactions (
     wallet_id, type, amount,
     balance_before, balance_after,
     related_order_id
   ) VALUES (
     'user-a-wallet', 'p2p_sale', 1.10,
     50.00, 51.10,
     'order-id'
   )
   ```

7. **Order completed**
   - User B receives code
   - User A credited 1.10 USD
   - Tenant earns: (1.30 - 1.10) = 0.20 USD

### 10.3 Manual Fulfillment

**When Auto Fails:**

1. **Order status: pending**
   - All providers failed
   - No P2P sellers available
   - No codes in inventory

2. **Staff notified**
   - Appears in "Manual Orders" dashboard

3. **Staff fulfills**
   ```
   Staff Option 1: Buy from alternative source
   Staff Option 2: Use personal codes
   Staff Option 3: Contact customer for alternative
   ```

4. **Staff enters code**
   ```sql
   UPDATE orders SET
     status = 'completed',
     result_codes = '["MANUAL-CODE-123"]',
     fulfilled_by_type = 'tenant_user',
     fulfilled_by_id = 'staff-id',
     actual_cost_usd = 1.05
   ```

5. **Add note**
   ```sql
   INSERT INTO order_notes (
     order_id, note_text, created_by_user_id,
     visibility
   ) VALUES (
     'order-id', 'Manually fulfilled from backup provider',
     'staff-id', 'internal'
   )
   ```

### 10.4 Exchange Rate Management

Each tenant maintains its own exchange rate table for the end users it owns; updates never bleed across tenants.
**Staff Updates Rate:**

1. **Staff logs in**
   - Has permission: "manage_exchange_rates"

2. **Views current rates**
   ```
   TRY → USD: 0.032 (31.25 TRY = 1 USD)
   Last updated: 2025-11-10
   ```

3. **Updates rate**
   ```
   New rate: 0.031 (32.26 TRY = 1 USD)
   Reason: "Market adjustment due to inflation"
   ```

4. **System logs change**
   ```sql
   INSERT INTO exchange_rate_change_log (
     tenant_id, currency_id,
     old_rate_to_usd, new_rate_to_usd,
     changed_by_user_id, change_reason
   ) VALUES (
     'tenant-id', 'try-currency',
     0.032, 0.031,
     'staff-id', 'Market adjustment due to inflation'
   )
   ```

5. **Updates rate**
   ```sql
   UPDATE tenant_exchange_rates SET
     rate_to_usd = 0.031,
     last_updated_by = 'staff-id',
     effective_from = NOW()
   WHERE tenant_id = 'tenant-id'
     AND currency_id = 'try-currency'
   ```

6. **Audit log**
   ```sql
   INSERT INTO audit_logs (
     tenant_id, user_id, user_type,
     action_type, entity_type, entity_id,
     changes
   ) VALUES (
     'tenant-id', 'staff-id', 'tenant_user',
     'update', 'exchange_rate', 'rate-id',
     '{"rate_to_usd": {"old": 0.032, "new": 0.031}}'
   )
   ```

7. **Effect on future orders**
   ```
   Old: Product 1.30 USD = 40.63 TRY
   New: Product 1.30 USD = 41.94 TRY (more expensive for user)
   ```

**Note:** Existing orders NOT affected (price frozen)
each tenant sets their own exchange rates
staff do not set exchange rates
maticulous logs kept to resolve disputes
---

## 11. VIEWS (Computed Data)

### View: `v_user_available_balance`
```sql
Purpose: Calculate total available funds (wallet + credit line)

Columns:
- user_id
- wallet_balance
- credit_line
- available_balance (wallet + credit)
- currency_code
```

### View: `v_product_prices_by_tier`
```sql
Purpose: Get all product prices for all tiers with currency conversion

Columns:
- product_id, product_name
- tier_id, tier_name
- price_usd
- price_in_currency (converted to user's currency)
- currency_code
```

### View: `v_order_summary`
```sql
Purpose: Complete order information with user/product/tenant details

Columns:
- order_id, status, created_at
- user_email, user_name
- product_name, product_code
- tenant_name
- user_payment_amount, currency_code
- profit (user_entered_cost - actual_cost_usd)
```

### View: `v_tenant_financial_summary`
```sql
Purpose: Tenant's financial performance

Columns:
- tenant_id, tenant_name
- total_orders
- total_revenue_usd
- total_cost_usd
- total_profit_usd
- average_profit_margin
- wallet_balance
```

---

## 12. INDEXES & PERFORMANCE

**All foreign keys are indexed automatically.**

**Additional performance indexes:**

### Orders Table:
- `idx_status_created` (status, created_at) - For filtering pending orders
- `idx_user_created` (end_user_id, created_at) - User order history
- `idx_tenant_created` (tenant_id, created_at) - Tenant reports

### Transactions Table:
- `idx_wallet_created` (wallet_id, created_at) - Wallet history
- `idx_type_created` (type, created_at) - Transaction reports

### Provider Products Table:
- `idx_priority` (priority, available) - Fulfillment source selection
- `idx_zdk_id` (zdk_id) - Provider ID lookups
- `idx_znet_bilgi_id` (znet_bilgi_id) - Provider ID lookups

### Audit Logs:
- `idx_tenant_action_created` (tenant_id, action_type, created_at) - Audit queries

---

## 13. DATA INTEGRITY RULES

### Cascading Deletes:
- **Tenant deleted** → All related data deleted (users, orders, products, rates)
- **User deleted** → Orders remain (for financial records), wallet deleted
- **Product deleted** → Soft delete only (active = false), orders remain

### Constraints:
- **Unique tenant subdomain** - No duplicate subdomains
- **Unique user email per tenant** - Same email can exist in different tenants
- **Unique product code** - Global product identifier
- **Unique provider product mapping** - One provider can't map same external_id twice

### Immutable Fields (Never Change After Creation):
- `end_users.base_currency_id` - Currency set once
- `orders.user_entered_cost` - Price frozen at order time
- `orders.user_payment_amount` - Payment amount frozen
- `orders.exchange_rate_snapshot` - Rate frozen
- `transactions.balance_before` - Historical record
- `transactions.balance_after` - Historical record

### Validation Rules:
- `credit_line` ≥ 0 - Can't have negative credit line
- `wallet_balance` can be negative (up to credit_line)
- `actual_cost_usd` ≥ 0 - Can't have negative costs
- `priority` ≥ 0 - Priority must be positive
- `stock_quantity` ≥ 0 - Can't have negative stock

---

## 14. SECURITY FEATURES

### Password Security:
- All passwords stored as `password_hash` (bcrypt/argon2)
- TOTP (Time-based One-Time Password) support via `totp_secret`
- API tokens stored as hashes

### Access Control:
- Tenant isolation enforced at query level
- Staff permissions stored in JSON
- Role-based access control (RBAC)

### Sensitive Data:
- Provider credentials encrypted in JSON
- Payment rail details stored securely
- PII (Personal Identifiable Information) protected

### Audit Trail:
- All changes logged with IP address and user agent
- Exchange rate changes require reason
- Order modifications tracked in audit_logs
??? login will use Google or Facebook accounts and some kind of a provider to fix the hassel of password restoring and so on
??? while testing and working locally, we'll need an alternative
---

## 15. SCALABILITY CONSIDERATIONS

### Database Sharding Strategy:
- **Shard by tenant_id** - Each tenant's data can move to separate server
- All tables have tenant_id for sharding key

### Read Replicas:
- Reports and analytics can use read replicas
- Views optimized for reporting queries

### Caching Strategy:
- Product catalog (rarely changes)
- Exchange rates (cache per tenant, TTL 1 hour)
- Price tiers (cache per tenant)
- Provider credentials (cache securely)

### Archive Strategy:
- Old orders → Archive table after 1 year
- Old transactions → Archive table after 2 years
- Audit logs → Archive after 1 year (keep recent for quick access)

---

## 16. INTEGRATION POINTS

### Provider APIs (ZNet, ZDK):
**Required API Endpoints:**
- Order product
- Check balance
- Get product list
- Get order status
- Cancel order (if supported)

**Stored in `providers.base_url`:**
- ZNet: `https://api.znet.com`
- ZDK: `https://api.zdk.com`

### Webhooks (Incoming):
- Provider order status updates
- Payment processor callbacks
- Balance updates from providers

### Webhooks (Outgoing):
- Notify tenants of order completion
- Alert on low provider balance
- Rate change notifications

### REST API for Tenants:
**End User API:**
- `GET /products` - List available products
- `POST /orders` - Create order
- `GET /orders/:id` - Get order status
- `GET /wallet` - Get wallet balance
- `POST /wallet/deposit` - Create deposit request

**Tenant Staff API:**
- `GET /dashboard/stats` - Dashboard data
- `POST /products/enable` - Enable/disable products
- `PUT /exchange-rates` - Update rates
- `GET /orders?status=pending` - Get orders needing attention

---

## SUMMARY CHECKLIST

### ✅ Complete Features:

**User Management:**
- [x] Multi-tenant isolation
- [x] End user accounts with immutable base currency
- [x] Staff accounts with role-based permissions
- [x] Credit line system (overdraft)
- [x] Two-factor authentication (TOTP)
- [x] API token access

**Product Catalog:**
- [x] Master product list
- [x] Product categories
- [x] Tenant-specific product selection
- [x] Custom product names per tenant
- [x] Product customization fields (player ID, etc.)

**Pricing:**
- [x] Multi-currency support
- [x] Tenant-specific exchange rates
- [x] Price tiers (I, II, III, IV, etc.)
- [x] Product-tier price matrix
- [x] Exchange rate change logging

**Order Processing:**
- [x] Order placement with frozen pricing
- [x] Auto fulfillment via providers
- [x] P2P marketplace fulfillment
- [x] Manual fulfillment by staff
- [x] Pre-bought code inventory
- [x] Order notes and communication
- [x] Fulfillment attempt tracking
- [x] Retry logic support

**Financial:**
- [x] Multi-entity wallets (users, tenants, providers)
- [x] Transaction tracking
- [x] Payment rail flexibility
- [x] Credit line management
- [x] Negative balance support
- [x] Profit tracking

**Provider Integration:**
- [x] Multiple provider support (ZNet, ZDK)
- [x] Provider-specific product mappings
- [x] Per-tenant provider credentials
- [x] Provider priority system
- [x] Provider balance tracking

**Content & Communication:**
- [x] Announcements system
- [x] Product instructions
- [x] Static pages per tenant
- [x] Multi-language support

**Audit & Security:**
- [x] Comprehensive audit logs
- [x] Exchange rate change history
- [x] IP and user agent tracking
- [x] Encrypted credentials
- [x] Password security

**Reporting:**
- [x] User available balance view
- [x] Product prices by tier view
- [x] Order summary view
- [x] Tenant financial summary view

---

## NEXT STEPS RECOMMENDATIONS

1. **Review Required:**
   - [ ] Confirm all business rules match your requirements
   - [ ] Verify provider API field mappings (ZNet/ZDK)
   - [ ] Check payment rail types cover all cases
   - [ ] Validate price tier logic

2. **Missing Features?**
   - [ ] User referral system?
   - [ ] Discount coupons/promo codes?
   - [ ] Loyalty points system?
   - [ ] Subscription products?
   - [ ] Recurring orders?

3. **Backend Development:**
   - [ ] API endpoints
   - [ ] Provider integrations
   - [ ] Webhook handlers
   - [ ] Background jobs (fulfillment queue)

4. **Frontend Development:**
   - [ ] User dashboard
   - [ ] Staff admin panel
   - [ ] Super admin panel
   - [ ] Product catalog UI

5. **DevOps:**
   - [ ] Database backups
   - [ ] Monitoring and alerts
   - [ ] Performance optimization
   - [ ] Security audit

---

**Total Tables:** 32
**Total Views:** 4
**Total Relationships:** 50+
**Database Engine:** MySQL 8.4.6
**Character Set:** utf8mb4_unicode_ci
**Storage Engine:** InnoDB

**Document Version:** 1.0
**Last Updated:** 2025-11-15
