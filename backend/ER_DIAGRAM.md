# Ahla Database - Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANCY & USER MANAGEMENT                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │  super_admins│
                              │──────────────│
                              │ id (PK)      │
                              │ email        │
                              │ username     │
                              │ password_hash│
                              └──────────────┘
                                      │
                              ┌───────┴───────┐
                              │    creates    │
                              ▼               ▼
                      ┌──────────────┐  ┌──────────────┐
                      │   tenants    │  │announcements │
                      │──────────────│  │──────────────│
                      │ id (PK)      │◄─┤ target_t... │
                      │ name         │  │ title        │
                      │ subdomain    │  │ content      │
                      │ wallet_bal...│  └──────────────┘
                      │ credit_line  │
                      └──────┬───────┘
                             │ owns
                ┌────────────┼────────────┬──────────────┐
                ▼            ▼            ▼              ▼
        ┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
        │  end_users   │ │tenant_   │ │tenant_     │ │price_tiers   │
        │──────────────│ │users     │ │products    │ │──────────────│
        │ id (PK)      │ │──────────│ │────────────│ │ id (PK)      │
        │ tenant_id(FK)│ │id (PK)   │ │id (PK)     │ │ tenant_id(FK)│
        │ email        │ │tenant... │ │tenant_id   │ │ tier_level   │
        │ username     │ │email     │ │product_id  │ │ name         │
        │ base_curr... │ │role      │ │enabled     │ └──────────────┘
        │ wallet_bal...│ └──────────┘ └────────────┘         │
        │ credit_line  │                                      │
        │ can_sell_... │◄─────────────────────────────────────┘
        │ seller_pri...│                 assigns              
        └──────┬───────┘
               │ has
               ├──────────────────┬────────────────┬────────────────┐
               ▼                  ▼                ▼                ▼
        ┌──────────────┐   ┌──────────────┐ ┌──────────┐  ┌──────────────┐
        │   orders     │   │ wallets      │ │notific...│  │user_security │
        │──────────────│   │──────────────│ │──────────│  │──────────────│
        │ id (PK)      │   │ id (PK)      │ │id (PK)   │  │ user_type    │
        │ end_user_id  │   │ owner_type   │ │recipient │  │ user_id      │
        │ product_id   │   │ owner_id     │ │title     │  │ totp_secret  │
        │ status       │   │ balance      │ │message   │  │ totp_enabled │
        │ user_ent...  │   └──────┬───────┘ └──────────┘  └──────────────┘
        │ actual_co... │          │
        │ fulfilled... │          │ contains
        └──────┬───────┘          ▼
               │           ┌──────────────┐
               │           │ transactions │
               │           │──────────────│
               │           │ id (PK)      │
               │           │ wallet_id(FK)│
               │           │ type         │
               │◄──────────┤ amount       │
               │  related  │ balance_bef..│
               │           │ balance_aft..│
               │           │ related_or...│
               │           └──────────────┘
               │
               │ details
               ▼
        ┌──────────────────────┐
        │ order_fulfillment_   │
        │ details              │
        │──────────────────────│
        │ id (PK)              │
        │ order_id (FK)        │
        │ fulfillment_source...│
        │ attempt_number       │
        │ provider_cost_usd    │
        │ success              │
        └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTS & CATALOG                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │ product_categories   │
                    │──────────────────────│
                    │ id (PK)              │
                    │ name (PUBG, FF, etc) │
                    │ logo_url             │
                    └──────────┬───────────┘
                               │ contains
                               ▼
                    ┌──────────────────────┐
                    │     products         │
                    │──────────────────────│
                    │ id (PK)              │
                    │ category_id (FK)     │
                    │ code                 │
                    │ name                 │
                    │ base_cost_usd        │
                    │ customizable         │
                    │ min_amount           │
                    │ max_amount           │
                    │ input_parameters     │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┬────────────────┐
                │              │              │                │
                ▼              ▼              ▼                ▼
    ┌────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │tenant_products │ │provider_     │ │user_provider │ │code_inventory│
    │────────────────│ │products      │ │_products     │ │──────────────│
    │ id (PK)        │ │──────────────│ │──────────────│ │ id (PK)      │
    │ tenant_id (FK) │ │ id (PK)      │ │ id (PK)      │ │ product_id   │
    │ product_id(FK) │ │ provider_id  │ │ seller_us... │ │ serial       │
    │ enabled        │ │ product_id   │ │ product_id   │ │ pin          │
    │ custom_cost... │ │ external_id  │ │ cost_usd     │ │ used         │
    └────────┬───────┘ │ cost_usd     │ │ stock_qty    │ │ used_in_or...│
             │         │ priority     │ │ available    │ └──────────────┘
             │         │ available    │ └──────────────┘
             │         └──────────────┘
             │ priced by
             ▼
    ┌──────────────────────┐
    │ product_tier_prices  │
    │──────────────────────│
    │ id (PK)              │
    │ tenant_id (FK)       │
    │ product_id (FK)      │
    │ price_tier_id (FK)   │
    │ price_usd            │
    │ price_formula        │
    │ formula_config       │
    └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDERS & FULFILLMENT                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │    providers         │
                    │──────────────────────│
                    │ id (PK)              │
                    │ type (znet/zdk/etc)  │
                    │ name                 │
                    │ base_url             │
                    │ wallet_balance       │
                    │ debt                 │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
    ┌────────────────────┐ ┌──────────────┐ ┌──────────────┐
    │provider_credentials│ │provider_     │ │code_inventory│
    │────────────────────│ │products      │ │──────────────│
    │ id (PK)            │ │──────────────│ │ provider_id  │
    │ provider_id (FK)   │ │ provider_id  │ │ (FK)         │
    │ tenant_id (FK)     │ │ product_id   │ └──────────────┘
    │ credential_type    │ │ external_id  │
    │ credentials (JSON) │ │ cost_usd     │
    └────────────────────┘ │ priority     │
                           └──────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PRICING & CURRENCIES                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │    currencies        │
                    │──────────────────────│
                    │ id (PK)              │
                    │ code (USD/TRY/SYP)   │
                    │ name                 │
                    │ symbol               │
                    └──────────┬───────────┘
                               │ used in
                ┌──────────────┼──────────────┬────────────────┐
                │              │              │                │
                ▼              ▼              ▼                ▼
    ┌────────────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐
    │tenant_exchange_    │ │end_users     │ │orders    │ │wallets   │
    │rates               │ │──────────────│ │──────────│ │──────────│
    │────────────────────│ │ base_curr... │ │ user_... │ │currency..│
    │ id (PK)            │ └──────────────┘ └──────────┘ └──────────┘
    │ tenant_id (FK)     │
    │ currency_id (FK)   │
    │ rate_to_usd        │
    │ effective_from     │
    └────────┬───────────┘
             │ logged in
             ▼
    ┌──────────────────────┐
    │exchange_rate_change_ │
    │log                   │
    │──────────────────────│
    │ id (PK)              │
    │ tenant_id (FK)       │
    │ currency_id (FK)     │
    │ old_rate             │
    │ new_rate             │
    │ changed_by_user_id   │
    │ changed_at           │
    └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ORDERS & FULFILLMENT FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  end_users   │
    └──────┬───────┘
           │ creates
           ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                         orders                               │
    │──────────────────────────────────────────────────────────────│
    │ id (PK)                  order_number                        │
    │ tenant_id (FK)           end_user_id (FK)                    │
    │ product_id (FK)          quantity                            │
    │                                                               │
    │ ┌─────────────── PRICING ────────────────┐                  │
    │ │ user_entered_cost      (initial price)  │                  │
    │ │ user_payment_amount    (after convert)  │                  │
    │ │ exchange_rate_used     (snapshot)       │                  │
    │ │ actual_cost_usd        (from provider)  │                  │
    │ └─────────────────────────────────────────┘                  │
    │                                                               │
    │ ┌─────────────── FULFILLMENT ────────────┐                  │
    │ │ fulfillment_type       (manual/auto)    │                  │
    │ │ fulfilled_by_type      (who?)           │                  │
    │ │ fulfilled_by_id        (their ID)       │                  │
    │ │ status                 (pending→done)    │                  │
    │ └─────────────────────────────────────────┘                  │
    │                                                               │
    │ ┌─────────────── RESULTS ────────────────┐                  │
    │ │ result_codes[]         (PIN/serial)     │                  │
    │ │ provider_message       (response)       │                  │
    │ │ provider_response      (raw JSON)       │                  │
    │ └─────────────────────────────────────────┘                  │
    └──────────┬───────────────────────────────────────────────────┘
               │
       ┌───────┴───────┬──────────────┬──────────────┐
       │               │              │              │
       ▼               ▼              ▼              ▼
┌────────────┐  ┌────────────┐ ┌────────────┐ ┌────────────┐
│order_      │  │order_      │ │transactions│ │audit_logs  │
│notes       │  │fulfillment_│ │────────────│ │────────────│
│────────────│  │details     │ │ order_id   │ │ order_id   │
│ order_id   │  │────────────│ │ type       │ │ action     │
│ note       │  │ order_id   │ │ amount     │ │ changes    │
│ created_by │  │ attempt_#  │ └────────────┘ └────────────┘
└────────────┘  │ source_type│
                │ source_id  │
                │ success    │
                │ error_msg  │
                └────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                    FULFILLMENT SOURCE OPTIONS                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                Order can be fulfilled by:

    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │   providers  │      │  end_users   │      │code_inventory│
    │──────────────│      │──────────────│      │──────────────│
    │ type: znet   │  OR  │ can_sell:    │  OR  │ serial + pin │
    │ type: zdk    │      │ true         │      │ pre-bought   │
    │ type: barakat│      │ seller_pri...│      │ codes        │
    │ API auto     │      │ P2P market   │      │ manual       │
    └──────────────┘      └──────────────┘      └──────────────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │ order_fulfillment_details│
                    │──────────────────────────│
                    │ Tracks each attempt      │
                    │ Supports retries         │
                    │ Logs success/failure     │
                    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                    WALLET & CREDIT LINE SYSTEM                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
    │                       end_users                             │
    │─────────────────────────────────────────────────────────────│
    │ wallet_balance        500.00  (current balance)             │
    │ credit_line          1000.00  (can go negative up to this)  │
    │                                                              │
    │ Available Balance = wallet_balance + credit_line = 1500.00  │
    └─────────────────────┬───────────────────────────────────────┘
                          │
                          │ tracks via
                          ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    transactions                             │
    │─────────────────────────────────────────────────────────────│
    │ type: deposit        (+)  Add money                         │
    │ type: order_payment  (-)  Deduct for purchase               │
    │ type: settlement     (+)  Repay credit line                 │
    │ type: order_refund   (+)  Return money                      │
    │ type: transfer       (±)  Between users                     │
    │                                                              │
    │ balance_before:      500.00                                 │
    │ balance_after:      -200.00  ← Can go negative!             │
    └─────────────────────────────────────────────────────────────┘

    Example Flow:
    1. User has: balance=500, credit_line=1000
    2. Places order for 700
    3. After order: balance=-200 (using 200 of credit)
    4. Available remaining: 1000 - 200 = 800 more credit
    5. User deposits 500 (settlement)
    6. After deposit: balance=300 (back to positive)


┌─────────────────────────────────────────────────────────────────────────────────┐
│                    USEFUL VIEWS                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────┐
    │ v_current_exchange_rates   │  ← Latest rate per tenant/currency
    │────────────────────────────│
    │ tenant_id                  │
    │ currency_id                │
    │ rate_to_usd                │
    │ effective_from             │
    └────────────────────────────┘

    ┌────────────────────────────┐
    │ v_active_sellers           │  ← Users who can sell (P2P)
    │────────────────────────────│
    │ user details               │
    │ tenant info                │
    │ where can_sell_to_others   │
    └────────────────────────────┘

    ┌────────────────────────────┐
    │ v_order_summary            │  ← Complete order details
    │────────────────────────────│
    │ orders joined with         │
    │ tenants, users, products   │
    │ categories, currencies     │
    └────────────────────────────┘

    ┌────────────────────────────┐
    │ v_user_wallet_status       │  ← Balance + available credit
    │────────────────────────────│
    │ wallet_balance             │
    │ credit_line                │
    │ available_balance (calc)   │
    └────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                    KEY BUSINESS RULES                                            │
└─────────────────────────────────────────────────────────────────────────────────┘

✓ Multi-Tenancy:    Each tenant has isolated end_users and orders
✓ Immutable:        User's base_currency_id cannot change after creation
✓ Credit System:    Users can overdraft up to credit_line
✓ P2P Marketplace:  Users can sell to each other (can_sell_to_others=true)
✓ Price Stability:  user_entered_cost never changes (even if actual cost differs)
✓ Exchange Rates:   Tenant-controlled, all changes logged
✓ Fulfillment:      Auto (API) or Manual, supports retries
✓ Pricing Tiers:    Up to 5 per tenant for customer segmentation
✓ Master Catalog:   Products shared, tenants select what they offer
✓ Customizable:     Products can allow custom amounts (min/max validation)
✓ Audit Trail:      Complete logging of all actions and changes

```

---

## Table Counts

| Category | Count | Tables |
|----------|-------|--------|
| **User Management** | 5 | tenants, end_users, tenant_users, super_admins, user_security |
| **Products** | 4 | product_categories, products, tenant_products, user_provider_products |
| **Pricing** | 5 | currencies, tenant_exchange_rates, exchange_rate_change_log, price_tiers, product_tier_prices |
| **Providers** | 3 | providers, provider_credentials, provider_products |
| **Orders** | 3 | orders, order_notes, order_fulfillment_details |
| **Wallet** | 2 | wallets, transactions |
| **Inventory** | 1 | code_inventory |
| **Notifications** | 2 | notifications, announcements |
| **Content** | 2 | instructions, static_pages |
| **Audit** | 1 | audit_logs |
| **TOTAL** | **28** | Plus 4 views |

---

## Foreign Key Relationships: 58

Every FK is indexed for performance!
