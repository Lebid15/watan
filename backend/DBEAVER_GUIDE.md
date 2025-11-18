# DBeaver Quick Start Guide for AHLA Database

## 🚀 5-Minute Setup

### Step 1: Install DBeaver (if not already installed)
- Download from: https://dbeaver.io/download/
- Community Edition is free and sufficient

### Step 2: Create Database Connection

1. **Open DBeaver**
2. Click **Database** → **New Database Connection** (or Ctrl+Shift+N)
3. **Select Database Type:**
   - PostgreSQL (recommended)
   - MySQL
   - MariaDB
   - Or your preferred database

4. **Configure Connection:**
   ```
   Host:     localhost (or your server)
   Port:     5432 (PostgreSQL) / 3306 (MySQL)
   Database: AHLA
   Username: your_username
   Password: your_password
   ```

5. Click **Test Connection**
6. If successful, click **Finish**

### Step 3: Execute Schema

1. **Open SQL Editor:**
   - Click SQL Editor icon (or F3)
   - Or right-click connection → **SQL Editor** → **New SQL Script**

2. **Load Schema File:**
   - Click **File** → **Open File**
   - Navigate to `backend/database_schema.sql`
   - Or copy-paste the entire contents

3. **Execute:**
   - Select All (Ctrl+A)
   - Execute (Ctrl+Enter or click ▶️ Execute)
   - Wait for "Script executed successfully"

### Step 4: View ER Diagram

**Method A: Auto-Generate (Easiest)**
1. In **Database Navigator**, expand your connection
2. Expand your database/schema (e.g., `AHLA` → `public`)
3. Right-click on **Tables** folder
4. Select **View Diagram**
5. DBeaver creates visual ER diagram automatically!

**Method B: Custom Diagram**
1. Right-click your database
2. Select **Create** → **ER Diagram**
3. Name it "AHLA Schema"
4. Select tables to include:
   - Select All (Ctrl+A)
   - Or choose specific groups
5. Click **Create**

### Step 5: Explore Data

**Browse Tables:**
```
Database Navigator:
└── AHLA
    └── public
        ├── Tables (32)
        │   ├── tenants
        │   ├── end_users
        │   ├── products
        │   └── ... (double-click to view)
        └── Views (4)
            ├── v_current_exchange_rates
            ├── v_active_sellers
            └── ...
```

**View Table Data:**
- Double-click any table
- Switch to **Data** tab
- You'll see grid view of all rows

---

## 📊 Visual ER Diagram Features

### In the Diagram View:

**Zoom & Pan:**
- `Ctrl + Mouse Wheel` - Zoom in/out
- `Click + Drag` - Pan around
- `Fit to Screen` button - Reset view

**Customize Layout:**
- **Drag tables** to rearrange
- **Layout dropdown** → Choose:
  - `Hierarchical` - Top-down flow
  - `Spring` - Auto-arrange
  - `Grid` - Organized grid
  - `Circle` - Circular layout

**Show/Hide Elements:**
- Right-click diagram → **Diagram Settings**
- Toggle:
  - ☑ Show Columns
  - ☑ Show Data Types
  - ☑ Show Keys
  - ☑ Show Foreign Keys

**Color Code Tables:**
- Right-click table → **Properties** → **Appearance**
- Choose color for different groups:
  - 🟦 Blue = User Management
  - 🟩 Green = Products
  - 🟨 Yellow = Orders
  - 🟥 Red = Financial

**Export Diagram:**
- Right-click diagram → **Export Diagram**
- Formats: PNG, SVG, PDF, GraphML
- Perfect for documentation!

---

## 🔍 Useful DBeaver Features

### 1. Smart Auto-Complete
```sql
SELECT * FROM end_  ← Press Ctrl+Space
-- Shows: end_users table suggestion

SELECT u.user, u.em  ← Press Ctrl+Space
-- Shows: username, email columns
```

### 2. Quick Table Peek
- **Hover** over table name in SQL
- Shows: Columns, Data Types, Keys
- No need to look it up!

### 3. Visual Query Builder
- Right-click table → **Generate SQL** → **SELECT**
- Gets you started with template:
  ```sql
  SELECT id, username, email, tenant_id, ...
  FROM end_users
  WHERE <condition>;
  ```

### 4. Data Export
- Execute query with results
- Right-click results grid
- **Export Data** → Choose format:
  - CSV (for Excel)
  - JSON (for APIs)
  - SQL (INSERT statements)
  - HTML (for reports)

### 5. Bookmark Queries
- Write useful query
- Click **Bookmark** button (⭐)
- Access later from Bookmarks panel
- Organize by folders

### 6. Split View
- Drag SQL tab to right/bottom
- View schema + write queries simultaneously
- Super productive!

---

## 📝 Essential Queries to Try

### Copy these into SQL Editor and execute:

**1. View All Tables:**
```sql
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**2. View All Foreign Keys:**
```sql
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc 
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
```

**3. Test Views:**
```sql
-- Current exchange rates
SELECT * FROM v_current_exchange_rates;

-- Active sellers
SELECT * FROM v_active_sellers;

-- User wallet status
SELECT * FROM v_user_wallet_status;

-- Order summary
SELECT * FROM v_order_summary LIMIT 10;
```

**4. Table Sizes (PostgreSQL):**
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY bytes DESC;
```

---

## 🎨 Recommended DBeaver Settings

### General Settings
1. **Window** → **Preferences**
2. Navigate to settings below:

**SQL Editor:**
```
✓ Auto-completion enabled
✓ Auto-completion case sensitivity: None
✓ Auto-save on execute
✓ Confirm dangerous SQL: ON
```

**Data Editor:**
```
✓ Auto-commit: OFF (safer)
✓ Show row numbers
✓ Show column descriptions as tooltips
```

**ER Diagrams:**
```
✓ Show column types
✓ Show keys and indexes
✓ Use compact notation
Layout: Hierarchical (default)
```

---

## 🎯 Workflow Examples

### Example 1: Explore Tenant's Products

1. **Open Table:** `tenants`
2. **Find Record:** Look at first tenant
3. **Copy UUID:** e.g., `123e4567-e89b-12d3-a456-426614174000`
4. **New SQL Tab:**
   ```sql
   SELECT 
       tp.id,
       p.name as product_name,
       tp.enabled,
       tp.custom_name,
       p.base_cost_usd
   FROM tenant_products tp
   JOIN products p ON tp.product_id = p.id
   WHERE tp.tenant_id = '123e4567-e89b-12d3-a456-426614174000'
   ORDER BY p.name;
   ```
5. **Execute:** See tenant's selected products

### Example 2: Track Order Flow

1. **Query:**
   ```sql
   SELECT * FROM orders WHERE id = '<order_id>';
   ```
2. **Click order_id value** in results
3. **Right-click** → **Navigate** → **Foreign Key**
4. **Choose:**
   - → `end_users` (who ordered)
   - → `products` (what they ordered)
   - → `order_notes` (any comments)
5. Automatically jumps to related records!

### Example 3: Visualize Specific Relationships

1. **Create New Diagram**
2. **Select Only:**
   - `orders`
   - `end_users`
   - `products`
   - `order_fulfillment_details`
   - `transactions`
3. **Apply Layout:** Hierarchical
4. **Result:** See order flow visually

---

## 🔑 Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New SQL Editor | `F3` or `Ctrl+]` |
| Execute Query | `Ctrl+Enter` |
| Execute Script | `Ctrl+Alt+X` |
| Format SQL | `Ctrl+Shift+F` |
| Auto-complete | `Ctrl+Space` |
| Comment/Uncomment | `Ctrl+/` |
| Open Table | `Double-click` |
| Find Text | `Ctrl+F` |
| Find in Files | `Ctrl+H` |
| New Connection | `Ctrl+Shift+N` |

---

## 🐛 Troubleshooting

### Can't See ER Diagram Option?
**Solution:** Make sure you're right-clicking on a **folder** (like Tables) or the **schema/database**, not an individual table.

### Tables Not Showing?
**Solution:** 
1. Right-click connection → **Refresh**
2. Check you're in correct schema (expand tree fully)
3. Ensure SQL executed without errors

### ER Diagram Too Cluttered?
**Solutions:**
1. Create multiple focused diagrams:
   - "User Management" (5 tables)
   - "Products & Orders" (8 tables)
   - "Financial" (4 tables)
2. Use **Hide Column** feature
3. Increase diagram size/zoom out

### Foreign Keys Not Showing?
**Solution:**
1. Right-click diagram → **Diagram Settings**
2. Check ☑ **Show Foreign Keys**
3. Check ☑ **Show Referential Constraints**

### Slow Performance?
**Solutions:**
1. Close unnecessary connections
2. Limit query results: Add `LIMIT 100`
3. Adjust memory: `Window` → `Preferences` → `Memory`
4. Close unused SQL editors

---

## 📚 Next Steps

After setup:

1. ✅ **Seed Sample Data:**
   - Create test tenants
   - Add sample users
   - Insert products

2. ✅ **Test Relationships:**
   - Try creating orders
   - Test foreign key constraints
   - Validate data integrity

3. ✅ **Explore Views:**
   - Query the 4 pre-built views
   - Understand their logic
   - Create custom views

4. ✅ **Export Documentation:**
   - Export ER diagram as PNG
   - Export schema as SQL
   - Document for team

5. ✅ **Build API:**
   - Connect backend to database
   - Implement CRUD operations
   - Test with real data

---

## 💡 Pro Tips

**Tip 1:** Pin frequently used tables
- Right-click table → **Add to Favorites**
- Access from ⭐ Favorites in navigator

**Tip 2:** Use SQL History
- View → SQL History
- See all executed queries
- Re-run previous queries easily

**Tip 3:** Compare Schemas
- Right-click schema → **Tools** → **Compare**
- Useful for dev vs prod comparisons

**Tip 4:** Generate Mock Data
- Right-click table → **Generate SQL**
- Choose **INSERT** with mock data
- Great for testing!

**Tip 5:** Share Diagrams with Team
- Export as SVG (scalable, high quality)
- Include in project documentation
- Update as schema evolves

---

## 🎉 You're Ready!

Your database is now:
- ✓ Fully defined with 32 tables
- ✓ Visually documented with ER diagrams
- ✓ Ready to explore in DBeaver
- ✓ Optimized with indexes
- ✓ Documented with comments

**Start building! 🚀**
