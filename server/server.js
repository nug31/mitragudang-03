const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.production') });
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://gudang-mitra-app.netlify.app',
        'https://mitragudang.netlify.app',
        'https://gudangmitra.netlify.app',
        process.env.CORS_ORIGIN
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));

app.use(express.json());

// Request logging & Netlify path fix
app.use((req, res, next) => {
    // If the request comes through Netlify Functions but doesn't have the /api prefix in the internal URL
    // some setups might strip it. Let's ensure it matches our routes.
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    // Normalize path for Netlify Functions if they arrive without /api prefix
    if (!req.url.startsWith('/api') && !req.url.startsWith('/.netlify')) {
        req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
        console.log(`Normalized URL to: ${req.url}`);
    }
    next();
});

// Diagnostic Endpoints
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Gudang Mitra Unified API Server (Supabase)',
        version: '2.1.0-supabase',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', file: 'server.js', db: 'supabase' });
});

// Login endpoint
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        const users = result.rows;

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const user = users[0];
        let passwordMatches = false;

        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            passwordMatches = await bcrypt.compare(password, user.password);
        } else {
            passwordMatches = user.password === password;
        }

        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        res.json({
            success: true,
            message: "Login successful",
            user: { id: user.id, username: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// Items API
app.get("/api/items", async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM items WHERE "isActive" = 1 OR "isActive" IS NULL');
        const items = result.rows;
        const formatted = items.map(item => ({
            id: item.id.toString(),
            name: item.name,
            description: item.description,
            category: item.category,
            quantity: item.quantity || 0,
            minQuantity: item["minQuantity"] || 0,
            unit: item.unit || 'pcs',
            status: item.quantity > 0 ? (item.quantity <= (item["minQuantity"] || 0) ? "low-stock" : "in-stock") : "out-of-stock",
            price: item.price || 0
        }));
        res.json(formatted);
    } catch (error) {
        console.error("Fetch items error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/items/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM items WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        const item = result.rows[0];
        res.json({
            id: item.id.toString(),
            name: item.name,
            description: item.description,
            category: item.category,
            quantity: item.quantity || 0,
            minQuantity: item["minQuantity"] || 0,
            unit: item.unit || 'pcs',
            status: item.quantity > 0 ? (item.quantity <= (item["minQuantity"] || 0) ? "low-stock" : "in-stock") : "out-of-stock",
            price: item.price || 0
        });
    } catch (error) {
        console.error("Fetch item by ID error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stock History & Summary
app.get("/api/stock-summary", async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfMonthStr = startOfMonth.toISOString();

        // Get current total stock
        const stockResult = await db.query('SELECT COALESCE(SUM(quantity), 0) as closing_stock FROM items WHERE "isActive" = 1 OR "isActive" IS NULL');
        const closingStock = parseFloat(stockResult.rows[0].closing_stock);

        // Get monthly changes
        const inResult = await db.query('SELECT COALESCE(SUM("quantity_change"), 0) as total_in FROM stock_history WHERE "quantity_change" > 0 AND "createdAt" >= $1', [startOfMonthStr]);
        const outResult = await db.query('SELECT COALESCE(SUM(ABS("quantity_change")), 0) as total_out FROM stock_history WHERE "quantity_change" < 0 AND "createdAt" >= $1', [startOfMonthStr]);

        const totalIn = parseFloat(inResult.rows[0].total_in);
        const totalOut = parseFloat(outResult.rows[0].total_out);
        const openingStock = closingStock - totalIn + totalOut;

        res.json({
            opening_stock: openingStock,
            total_in: totalIn,
            total_out: totalOut,
            closing_stock: closingStock,
            period: 'month',
            period_start: startOfMonthStr
        });
    } catch (error) {
        console.error("Stock Summary Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Global Stock History (last 30 days)
app.get("/api/stock-history", async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

        const result = await db.query(`
            SELECT sh.*, i.name as item_name, i.category 
            FROM stock_history sh 
            JOIN items i ON sh."item_id" = i.id 
            WHERE sh."createdAt" >= $1
            ORDER BY sh."createdAt" DESC
        `, [thirtyDaysAgoStr]);

        res.json({ history: result.rows });
    } catch (error) {
        console.error("Global Stock History error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/stock-history/item/:itemId", async (req, res) => {
    try {
        const { itemId } = req.params;
        const result = await db.query(`
      SELECT sh.*, i.name as item_name 
      FROM stock_history sh 
      JOIN items i ON sh."item_id" = i.id 
      WHERE sh."item_id" = $1 
      ORDER BY sh."createdAt" ASC
    `, [itemId]);
        const history = result.rows;

        const itemResult = await db.query("SELECT * FROM items WHERE id = $1", [itemId]);
        res.json({ item: itemResult.rows[0] || null, history });
    } catch (error) {
        console.error("Stock History error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Setup Categories Table Endpoint
app.get("/api/setup-categories", async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed from Items if table is empty
        const countRes = await db.query('SELECT COUNT(*) FROM categories');
        if (parseInt(countRes.rows[0].count) === 0) {
            await db.query(`
                INSERT INTO categories (name, description)
                SELECT DISTINCT category, category || ' items'
                FROM items
                WHERE category IS NOT NULL AND category != ''
                ON CONFLICT (name) DO NOTHING;
            `);
        }

        res.json({ success: true, message: "Categories table setup complete" });
    } catch (error) {
        console.error("Setup categories error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Categories API - with robust auto-sync and on-the-fly migration (Netlify compatible)
app.get("/api/categories", async (req, res) => {
    try {
        // 0. Ensure table and constraints exist (Robustness for partial migrations)
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Migration: Add createdAt if missing
            await db.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='createdAt') THEN 
                        ALTER TABLE categories ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP; 
                    END IF; 
                END $$;
            `);

            // Migration: Add updatedAt if missing
            await db.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='updatedAt') THEN 
                        ALTER TABLE categories ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP; 
                    END IF; 
                END $$;
            `);

            // Migration: Add UNIQUE constraint if missing
            await db.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key') THEN 
                        ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name); 
                    END IF; 
                END $$;
            `);
        } catch (setupErr) {
            console.warn("Pre-fetch setup warning (ignorable if table exists):", setupErr.message);
        }

        // 1. Try to fetch existing categories
        let result = await db.query("SELECT * FROM categories ORDER BY name");

        // 2. Sync with items table (Self-Healing) - IMPROVED: Case-insensitive check & only ACTIVE items
        const missingResult = await db.query(`
            SELECT DISTINCT i.category 
            FROM items i 
            LEFT JOIN categories c ON LOWER(i.category) = LOWER(c.name)
            WHERE (i."isActive" = 1 OR i."isActive" IS NULL)
            AND i.category IS NOT NULL 
            AND i.category != '' 
            AND c.id IS NULL
        `);

        if (missingResult.rows.length > 0) {
            console.log(`Found ${missingResult.rows.length} missing categories. Syncing...`);
            for (const row of missingResult.rows) {
                // Ensure we don't insert duplicate if another row in the same loop matches by case
                await db.query(`
                    INSERT INTO categories (name, description) 
                    VALUES ($1, $2) 
                    ON CONFLICT (name) DO NOTHING
                `, [row.category, `${row.category} items`]);
            }
            result = await db.query("SELECT * FROM categories ORDER BY name");
        }

        res.json({ success: true, categories: result.rows });
    } catch (error) {
        console.error("Categories API Error:", error);
        // Provide enough detail to debug in browser console
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            detail: "Database error occurred during category fetch/sync. Check server logs or connection."
        });
    }
});

app.post("/api/categories", async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Name required" });

        const result = await db.query(
            'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
            [name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Create category error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put("/api/categories/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const result = await db.query(
            'UPDATE categories SET name = $1, description = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *',
            [name, description, id]
        );

        if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Category not found" });

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Update category error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete("/api/categories/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category is in use
        const catResult = await db.query('SELECT name FROM categories WHERE id = $1', [id]);
        if (catResult.rows.length > 0) {
            const categoryName = catResult.rows[0].name;
            const useCount = await db.query('SELECT COUNT(*) FROM items WHERE category = $1 AND ("isActive" = 1 OR "isActive" IS NULL)', [categoryName]);

            if (parseInt(useCount.rows[0].count) > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Tidak dapat menghapus. Masih ada ${useCount.rows[0].count} barang aktif yang menggunakan kategori "${categoryName}". Silakan ubah kategori barang tersebut terlebih dahulu.`
                });
            }
        }

        const result = await db.query('DELETE FROM categories WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Category not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Delete category error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Users API
app.get("/api/users", async (req, res) => {
    try {
        const result = await db.query("SELECT id, name, email, role FROM users");
        res.json(result.rows);
    } catch (error) {
        console.error("Users error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/users", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Check if user already exists
        const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email already registered" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        const result = await db.query(
            'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [userId, name, email, hashedPassword, role || 'user']
        );

        const newUser = result.rows[0];
        res.status(201).json({
            success: true,
            user: { id: newUser.id, username: newUser.name, email: newUser.email, role: newUser.role }
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Requests API
app.get("/api/requests", async (req, res) => {
    try {
        // Fetch last 200 requests to avoid timeout with large datasets
        const result = await db.query(`
      SELECT 
        r.*, 
        u.name as requester_name, 
        u.email as requester_email,
        (
          SELECT json_agg(json_build_object(
            'item_id', ri."item_id", 
            'quantity', ri.quantity, 
            'name', i.name, 
            'category', i.category
          ))
          FROM request_items ri
          JOIN items i ON ri."item_id" = i.id
          WHERE ri."request_id" = r.id
        ) as items
      FROM requests r
      LEFT JOIN users u ON r."requester_id" = u.id
      ORDER BY r."createdAt" DESC
      LIMIT 200
    `);
        res.json(result.rows);
    } catch (error) {
        console.error("Requests fetch error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/requests/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(`
      SELECT 
        r.*, 
        u.name as requester_name, 
        u.email as requester_email,
        (
          SELECT json_agg(json_build_object(
            'item_id', ri."item_id", 
            'quantity', ri.quantity, 
            'name', i.name, 
            'category', i.category
          ))
          FROM request_items ri
          JOIN items i ON ri."item_id" = i.id
          WHERE ri."request_id" = r.id
        ) as items
      FROM requests r
      LEFT JOIN users u ON r."requester_id" = u.id
      WHERE r."requester_id" = $1
      ORDER BY r."createdAt" DESC
    `, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error("User requests fetch error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/requests/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(`
      SELECT r.*, u.name as requester_name, u.email as requester_email
      FROM requests r
      LEFT JOIN users u ON r."requester_id" = u.id
      WHERE r.id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        const request = result.rows[0];
        const itemResult = await db.query(`
      SELECT ri.*, i.name, i.category
      FROM request_items ri
      JOIN items i ON ri."item_id" = i.id
      WHERE ri."request_id" = $1
    `, [id]);

        res.json({ ...request, items: itemResult.rows });
    } catch (error) {
        console.error("Fetch request by ID error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete("/api/requests/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM requests WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Delete request error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/requests", async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { project_name, requester_id, reason, priority, due_date, items } = req.body;
        if (!project_name || !items || !items.length) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await client.query('BEGIN');

        const requestId = uuidv4();
        await client.query(`
      INSERT INTO requests (id, project_name, requester_id, reason, priority, due_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `, [requestId, project_name, requester_id, reason || "", priority || "medium", due_date || null]);

        for (const item of items) {
            await client.query(`
        INSERT INTO request_items (request_id, item_id, quantity)
        VALUES ($1, $2, $3)
      `, [requestId, item.item_id, item.quantity]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, id: requestId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Create request error:", error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Update item and record history
app.put("/api/items/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, notes, historyNotes, userId, name, description, category, minQuantity, unit, price } = req.body;

        const existingResult = await db.query('SELECT quantity FROM items WHERE id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        const oldQty = existingResult.rows[0].quantity;
        const actualNotes = historyNotes || notes || 'Manual update';

        // Filter valid updates and map to quoted names where necessary (for PostgreSQL/Supabase)
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (category !== undefined) updates.category = category;
        if (quantity !== undefined) updates.quantity = quantity;
        if (minQuantity !== undefined) updates['"minQuantity"'] = minQuantity; // Quoted for camelCase in PG
        if (unit !== undefined) updates.unit = unit;
        if (price !== undefined) updates.price = price;

        if (Object.keys(updates).length === 0) {
            return res.json({ success: true, message: "No updates provided" });
        }

        // Build update query
        const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates);
        values.push(id);

        const updateQuery = `UPDATE items SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`;
        const updatedResult = await db.query(updateQuery, values);
        const updatedItem = updatedResult.rows[0];

        // History logging
        if (quantity !== undefined && quantity !== oldQty) {
            await db.query(`
                INSERT INTO stock_history ("item_id", "change_type", "quantity_before", "quantity_change", "quantity_after", notes, "created_by")
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                id,
                quantity > oldQty ? 'restock' : 'adjustment',
                oldQty || 0,
                (quantity || 0) - (oldQty || 0),
                quantity,
                actualNotes,
                userId
            ]);
        }

        res.json(updatedItem);
    } catch (error) {
        console.error("Update item error detail:", error);
        res.status(500).json({
            success: false,
            error: error.message,
            detail: "Error updating item. Ensure all field names match the database schema."
        });
    }
});

// Dashboard Stats
app.get("/api/dashboard/stats", async (req, res) => {
    try {
        const usersCount = await db.query("SELECT COUNT(*) FROM users");
        const itemStatsResult = await db.query('SELECT COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_quantity FROM items WHERE "isActive" = 1 OR "isActive" IS NULL');
        const requestStatsResult = await db.query('SELECT COUNT(*) as total_requests, SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN status = $2 THEN 1 ELSE 0 END) as approved_count FROM requests', ['pending', 'approved']);
        const lowStockResult = await db.query('SELECT COUNT(*) as low_stock_count FROM items WHERE ("isActive" = 1 OR "isActive" IS NULL) AND quantity <= COALESCE("minQuantity", 0)');
        const categoryCount = await db.query('SELECT COUNT(DISTINCT category) FROM items');

        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
        const recentRequestsCount = await db.query('SELECT COUNT(*) FROM requests WHERE "createdAt" >= $1', [sevenDaysAgo]);

        // Fetch top requested items
        const topRequestedResult = await db.query(`
            SELECT i.name, SUM(ri.quantity) as "totalRequested"
            FROM request_items ri
            JOIN items i ON ri."item_id" = i.id
            GROUP BY i.name
            ORDER BY "totalRequested" DESC
            LIMIT 5
        `);

        // Fetch recent activity (combining request creation/status change)
        const recentActivityRequests = await db.query(`
            SELECT r.id, 'request_created' as type, 
                   'Request created for ' || r.project_name as description, 
                   r."createdAt" as timestamp, u.name as user
            FROM requests r
            LEFT JOIN users u ON r."requester_id" = u.id
            ORDER BY r."createdAt" DESC
            LIMIT 10
        `);

        res.json({
            totalUsers: parseInt(usersCount.rows[0].count),
            totalItems: parseInt(itemStatsResult.rows[0].total_items),
            totalQuantity: parseFloat(itemStatsResult.rows[0].total_quantity),
            totalRequests: parseInt(requestStatsResult.rows[0].total_requests),
            pendingRequests: parseInt(requestStatsResult.rows[0].pending_count || 0),
            approvedRequests: parseInt(requestStatsResult.rows[0].approved_count || 0),
            lowStockItems: parseInt(lowStockResult.rows[0].low_stock_count),
            totalCategories: parseInt(categoryCount.rows[0].count || 0),
            recentRequests: parseInt(recentRequestsCount.rows[0].count || 0),
            usersByRole: { admin: 0, manager: 0, user: 0 },
            requestsByStatus: {
                pending: parseInt(requestStatsResult.rows[0].pending_count || 0),
                approved: parseInt(requestStatsResult.rows[0].approved_count || 0),
                denied: 0,
                fulfilled: 0
            },
            topRequestedItems: topRequestedResult.rows.map(r => ({
                name: r.name,
                totalRequested: parseInt(r.totalRequested)
            })),
            recentActivity: recentActivityRequests.rows
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new item
app.post("/api/items", async (req, res) => {
    try {
        const { name, description, category, quantity, minQuantity, price, unit } = req.body;
        const result = await db.query(
            'INSERT INTO items (name, description, category, quantity, "minQuantity", price, unit, status, "isActive") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [name, description, category, quantity || 0, minQuantity || 0, price || 0, unit || 'pcs', 'in-stock', 1]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Create item error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete item (soft delete)
app.delete("/api/items/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE items SET "isActive" = 0 WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Delete item error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dashboard Individual Endpoints for compatibility
app.get("/api/dashboard/users", async (req, res) => {
    try {
        const result = await db.query("SELECT COUNT(*) FROM users");
        const adminCount = await db.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        const managerCount = await db.query("SELECT COUNT(*) FROM users WHERE role = 'manager'");
        const userCount = await db.query("SELECT COUNT(*) FROM users WHERE role = 'user'");

        res.json({
            totalUsers: parseInt(result.rows[0].count),
            usersByRole: {
                admin: parseInt(adminCount.rows[0].count),
                manager: parseInt(managerCount.rows[0].count),
                user: parseInt(userCount.rows[0].count)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/dashboard/items", async (req, res) => {
    try {
        const itemStats = await db.query('SELECT COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_quantity FROM items WHERE "isActive" = 1 OR "isActive" IS NULL');
        const lowStock = await db.query('SELECT COUNT(*) as low_stock_count FROM items WHERE ("isActive" = 1 OR "isActive" IS NULL) AND quantity <= COALESCE("minQuantity", 0)');
        const categories = await db.query('SELECT COUNT(DISTINCT category) FROM items');

        res.json({
            totalItems: parseInt(itemStats.rows[0].total_items),
            totalQuantity: parseFloat(itemStats.rows[0].total_quantity),
            lowStockItems: parseInt(lowStock.rows[0].low_stock_count),
            totalCategories: parseInt(categories.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/dashboard/requests", async (req, res) => {
    try {
        const stats = await db.query('SELECT COUNT(*) as total_requests, SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN status = $2 THEN 1 ELSE 0 END) as approved_count FROM requests', ['pending', 'approved']);
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
        const recent = await db.query('SELECT COUNT(*) FROM requests WHERE "createdAt" >= $1', [sevenDaysAgo]);

        res.json({
            totalRequests: parseInt(stats.rows[0].total_requests),
            requestsByStatus: {
                pending: parseInt(stats.rows[0].pending_count || 0),
                approved: parseInt(stats.rows[0].approved_count || 0),
                denied: 0,
                fulfilled: 0
            },
            recentRequests: parseInt(recent.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/dashboard/top-items", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT i.name, SUM(ri.quantity) as "totalRequested"
            FROM request_items ri
            JOIN items i ON ri."item_id" = i.id
            GROUP BY i.name
            ORDER BY "totalRequested" DESC
            LIMIT 5
        `);
        res.json(result.rows.map(r => ({ ...r, totalRequested: parseInt(r.totalRequested) })));
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/dashboard/activity", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.id, 'request_created' as type, 
                   'Request created for ' || r.project_name as description, 
                   r."createdAt" as timestamp, u.name as user
            FROM requests r
            LEFT JOIN users u ON r."requester_id" = u.id
            ORDER BY r."createdAt" DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update request status with stock deduction and history
app.patch("/api/requests/:id/status", async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { id } = req.params;
        const { status, approved_by } = req.body;

        await client.query('BEGIN');

        // 1. Get current status to check if we should process stock
        const requestResult = await client.query("SELECT status FROM requests WHERE id = $1", [id]);
        if (requestResult.rows.length === 0) throw new Error("Request not found");

        const oldStatus = requestResult.rows[0].status;

        // 2. If approving and not already approved, perform stock operations
        if (status === "approved" && oldStatus !== "approved") {
            // Fetch all items in this request with current item data in ONE query
            const itemsResult = await client.query(`
                SELECT ri."item_id", ri.quantity as requested_qty, 
                       i.quantity as current_qty, i."minQuantity", i.name
                FROM request_items ri
                JOIN items i ON ri."item_id" = i.id
                WHERE ri."request_id" = $1
            `, [id]);

            const items = itemsResult.rows;

            if (items.length > 0) {
                // Perform updates one by one within the transaction for absolute stability
                for (const item of items) {
                    const newQty = Math.max(0, item.current_qty - item.requested_qty);
                    const itemStatus = newQty === 0 ? "out-of-stock" : (newQty <= (item.minQuantity || 0) ? "low-stock" : "in-stock");

                    // Update item
                    await client.query('UPDATE items SET quantity = $1, status = $2 WHERE id = $3', [newQty, itemStatus, item.item_id]);

                    // Insert history
                    const note = `Approved request ${id}`;
                    await client.query(`
                        INSERT INTO stock_history ("item_id", "change_type", "quantity_before", "quantity_change", "quantity_after", notes, "created_by")
                        VALUES ($1, 'request', $2, $3, $4, $5, $6)
                    `, [item.item_id, item.current_qty, -item.requested_qty, newQty, note, approved_by || null]);
                }
            }
        }

        // 3. Update request status
        await client.query("UPDATE requests SET status = $1, \"updatedAt\" = NOW() WHERE id = $2", [status, id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Update request status error:", error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Item-specific summary (Stock Card view)
app.get("/api/stock-summary/items", async (req, res) => {
    try {
        const { item_id } = req.query;
        if (item_id) {
            const result = await db.query("SELECT i.name, sh.* FROM stock_history sh JOIN items i ON sh.item_id = i.id WHERE sh.item_id = $1 ORDER BY sh.created_at DESC", [item_id]);
            return res.json(result.rows);
        }
        const result = await db.query("SELECT i.name, COALESCE(SUM(sh.quantity_change), 0) as total_change FROM items i LEFT JOIN stock_history sh ON i.id = sh.item_id GROUP BY i.id, i.name");
        res.json(result.rows);
    } catch (error) {
        console.error("Item summary error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Notifications API
app.get("/api/notifications/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query('SELECT * FROM notifications WHERE "user_id" = $1 ORDER BY "createdAt" DESC LIMIT 50', [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error("Notifications fetch error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE notifications SET "is_read" = 1 WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Read notification error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/notifications/user/:userId/unread-count", async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query('SELECT COUNT(*) FROM notifications WHERE "user_id" = $1 AND "is_read" = 0', [userId]);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error("Unread count error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch("/api/notifications/user/:userId/mark-all-read", async (req, res) => {
    try {
        const { userId } = req.params;
        await db.query('UPDATE notifications SET "is_read" = 1 WHERE "user_id" = $1', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error("Mark all read error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/notifications", async (req, res) => {
    try {
        const { user_id, type, message, related_item_id } = req.body;
        const result = await db.query(
            'INSERT INTO notifications ("user_id", type, message, "related_item_id", "is_read", "createdAt") VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
            [user_id, type, message, related_item_id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Create notification error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Handled above in consolidated endpoint

app.get("/api/dashboard/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const requestsStats = await db.query('SELECT status, COUNT(*) FROM requests WHERE requester_id = $1 GROUP BY status', [userId]);

        const stats = {
            total: 0,
            pending: 0,
            approved: 0,
            denied: 0,
            fulfilled: 0
        };

        requestsStats.rows.forEach(row => {
            const count = parseInt(row.count);
            stats.total += count;
            if (row.status === 'pending') stats.pending = count;
            if (row.status === 'approved') stats.approved = count;
            if (row.status === 'denied' || row.status === 'rejected') stats.denied = count;
            if (row.status === 'fulfilled' || row.status === 'completed') stats.fulfilled = count;
        });

        const itemsCount = await db.query('SELECT COUNT(*) FROM items WHERE "isActive" = 1 OR "isActive" IS NULL');
        const categoryCount = await db.query('SELECT COUNT(DISTINCT category) FROM items');

        const now = new Date();
        const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30)).toISOString();
        const recentRequestsCount = await db.query('SELECT COUNT(*) FROM requests WHERE requester_id = $1 AND "createdAt" >= $2', [userId, thirtyDaysAgo]);

        // Fetch user's top requested items
        const topItemsResult = await db.query(`
            SELECT i.name, i.category, SUM(ri.quantity) as "totalRequested"
            FROM request_items ri
            JOIN requests r ON ri."request_id" = r.id
            JOIN items i ON ri."item_id" = i.id
            WHERE r."requester_id" = $1
            GROUP BY i.name, i.category
            ORDER BY "totalRequested" DESC
            LIMIT 5
        `, [userId]);

        // Fetch user's recent activity
        const activityResult = await db.query(`
            SELECT r.id, 'request_created' as type, 
                   'You created a request for ' || r.project_name as description, 
                   r."createdAt" as timestamp, r.status
            FROM requests r
            WHERE r."requester_id" = $1
            ORDER BY r."createdAt" DESC
            LIMIT 10
        `, [userId]);

        res.json({
            myRequests: stats,
            availableItems: parseInt(itemsCount.rows[0].count || 0),
            availableCategories: parseInt(categoryCount.rows[0].count || 0),
            recentRequests: parseInt(recentRequestsCount.rows[0].count || 0),
            myTopRequestedItems: topItemsResult.rows.map(r => ({
                name: r.name,
                totalRequested: parseInt(r.totalRequested),
                category: r.category
            })),
            myRecentActivity: activityResult.rows.map(r => ({
                id: r.id,
                type: 'request_created',
                description: r.description,
                timestamp: r.timestamp,
                status: r.status
            }))
        });
    } catch (error) {
        console.error("User dashboard stats error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// User by email
app.get("/api/users/email/:email", async (req, res) => {
    try {
        const { email } = req.params;
        const result = await db.query("SELECT id, name, email, role FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Fetch user by email error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test connection
app.get("/api/test-connection", async (req, res) => {
    try {
        const result = await db.query('SELECT 1');
        res.json({ success: true, message: "Database connection successful (Supabase/PostgreSQL)" });
    } catch (error) {
        console.error("Test connection error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export the app for serverless use
module.exports = app;

// Start the server only if run directly (not as a module)
if (require.main === module) {
    // Run auto-migration on startup
    (async () => {
        try {
            // Create categories table
            await db.query(`
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Seed from items if empty
            try {
                const countRes = await db.query('SELECT COUNT(*) FROM categories');
                if (parseInt(countRes.rows[0].count) === 0) {
                    await db.query(`
                        INSERT INTO categories (name, description)
                        SELECT DISTINCT category, category || ' items'
                        FROM items
                        WHERE category IS NOT NULL AND category != ''
                        ON CONFLICT (name) DO NOTHING;
                    `);
                    console.log("✅ Categories table seeded from existing items.");
                }
            } catch (seedErr) {
                console.error("Seeding error (non-fatal):", seedErr.message);
            }
        } catch (err) {
            console.error("❌ Auto-migration failed:", err.message);
        }
    })();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Unified server running on port ${PORT} with Supabase`);
    });
}
