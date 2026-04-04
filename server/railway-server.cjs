const express = require("express");
const cors = require("cors");
const mysql = require("./pg-shim");
// Load environment variables
require('dotenv').config({ path: '.env.production' });

// Database configuration directly from environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
};

console.log('🚀 Starting Railway server with bcrypt support...');
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
console.log('DB_HOST:', process.env.DB_HOST);

const app = express();
const PORT = process.env.PORT || 3002;

// Define allowed origins
const allowedOrigins = [
  'https://gudang.netlify.app',
  'https://gudang-mitra-app.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

// Add CORS_ORIGIN if it exists and isn't already included
if (process.env.CORS_ORIGIN && !allowedOrigins.includes(process.env.CORS_ORIGIN)) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

console.log('\n=== CORS Configuration ===');
console.log('Allowed origins:');
allowedOrigins.forEach(origin => console.log(`- ${origin}`));
console.log('CORS_ORIGIN from env:', process.env.CORS_ORIGIN);
console.log('========================\n');

// CORS middleware configuration
app.use(cors({
  origin: function (origin, callback) {
    console.log('\n=== CORS Check ===');
    console.log('Request origin:', origin || 'No origin');

    // Allow requests with no origin
    if (!origin) {
      console.log('No origin - request allowed');
      console.log('=================\n');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed');
      console.log('=================\n');
      callback(null, true);
    } else {
      console.log('Origin rejected');
      console.log('=================\n');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 204
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log('\n=== Incoming Request ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Path:', req.url);
  console.log('Origin:', req.headers.origin || 'No origin');
  console.log('======================\n');
  next();
});

// Parse JSON bodies
app.use(express.json());
// Create database pool
let pool;
try {
  pool = mysql.createPool(dbConfig);
  console.log('✅ Database pool created');
} catch (error) {
  console.error('❌ Error creating database pool:', error);
}

// Auto-migrate: Add unit column if it doesn't exist
async function ensureUnitColumn() {
  try {
    console.log('🔧 Checking if unit column exists in items table...');
    const [columns] = await pool.query('DESCRIBE items');
    const hasUnitColumn = columns.some(col => col.Field === 'unit');

    if (!hasUnitColumn) {
      console.log('⚠️  Unit column not found. Adding it now...');
      await pool.query(`
        ALTER TABLE items
        ADD COLUMN unit VARCHAR(50) DEFAULT 'pcs' AFTER quantity
      `);
      console.log('✅ Unit column added successfully!');
    } else {
      console.log('✅ Unit column already exists');
    }
  } catch (error) {
    console.error('❌ Error checking/adding unit column:', error.message);
    // Don't crash the server, just log the error
  }
}

// Run migration on startup
if (pool) {
  ensureUnitColumn().catch(err => console.error('Migration error:', err));
}

// Test endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Gudang Mitra API Server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.1-diagnostic'
  });
});

// Diagnostic endpoint
app.get("/api/v2/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Diagnostic endpoint reachable",
    timestamp: new Date().toISOString(),
    file: "railway-server.cjs"
  });
});

// Test database connection
app.get("/api/test-connection", async (req, res) => {
  try {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();

    res.json({
      success: true,
      message: "Database connection successful",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test stock history table
app.get("/api/debug-history", async (req, res) => {
  try {
    // Check if table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'stock_history'");
    const tableExists = tables.length > 0;

    // Check columns
    let columns = [];
    if (tableExists) {
      const [cols] = await pool.query("DESCRIBE stock_history");
      columns = cols.map(c => c.Field);
    }

    // Try dummy insert
    let insertError = null;
    let insertSuccess = false;
    try {
      await pool.query(
        `INSERT INTO stock_history (item_id, change_type, quantity_before, quantity_change, quantity_after, notes, created_by)
             VALUES (1, 'adjustment', 10, 1, 11, 'Debug Test', 'system')`
      );
      insertSuccess = true;
    } catch (e) {
      insertError = e.message;
    }

    res.json({
      table_exists: tableExists,
      columns: columns,
      insert_success: insertSuccess,
      insert_error: insertError,
      server: 'railway-server.js' // Marker to confirm we hit this file
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stock Summary endpoint - for Dashboard Summary Card
app.get("/api/stock-summary", async (req, res) => {
  try {
    console.log("GET /api/stock-summary - Fetching stock summary");

    // Get current total stock (closing stock)
    const [stockResult] = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as closing_stock
      FROM items
      WHERE isActive = 1 OR isActive IS NULL
    `);
    const closingStock = parseInt(stockResult[0].closing_stock) || 0;

    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

    let totalIn = 0;
    let totalOut = 0;

    // Check if stock_history table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'stock_history'");
    if (tables.length > 0) {
      // Get total incoming (positive changes) this month
      const [inResult] = await pool.query(`
        SELECT COALESCE(SUM(quantity_change), 0) as total_in
        FROM stock_history
        WHERE quantity_change > 0 AND created_at >= ?
      `, [startOfMonthStr]);
      totalIn = parseInt(inResult[0].total_in) || 0;

      // Get total outgoing (negative changes) this month
      const [outResult] = await pool.query(`
        SELECT COALESCE(SUM(ABS(quantity_change)), 0) as total_out
        FROM stock_history
        WHERE quantity_change < 0 AND created_at >= ?
      `, [startOfMonthStr]);
      totalOut = parseInt(outResult[0].total_out) || 0;
    }

    // Calculate opening stock: closing - in + out
    const openingStock = closingStock - totalIn + totalOut;

    const summary = {
      opening_stock: openingStock,
      total_in: totalIn,
      total_out: totalOut,
      closing_stock: closingStock,
      period: 'month',
      period_start: startOfMonthStr
    };

    console.log("Stock summary:", summary);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching stock summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stock summary",
      error: error.message,
    });
  }
});

// Login endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Login attempt for: ${email}`);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Query user from database
    const [users] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    console.log(`Found ${users.length} users with email ${email}`);

    if (users.length === 0) {
      // Let's also check what users exist in the database
      const [allUsers] = await pool.query("SELECT id, name, email, role FROM users LIMIT 5");
      console.log("Available users in database:", allUsers);

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        debug: `No user found with email: ${email}. Available users: ${allUsers.map(u => u.email).join(', ')}`
      });
    }

    const user = users[0];
    console.log(`User found: ${user.email}, checking password...`);
    console.log(`Stored password: "${user.password}", Provided password: "${password}"`);

    // Check password - handle both plain text and bcrypt hashed passwords
    let passwordMatches = false;

    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      // Bcrypt hashed password
      const bcrypt = require('bcrypt');
      passwordMatches = await bcrypt.compare(password, user.password);
      console.log(`Bcrypt password check for ${email}: ${passwordMatches}`);
    } else {
      // Plain text password
      passwordMatches = user.password === password;
      console.log(`Plain text password check for ${email}: ${passwordMatches}`);
    }

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        debug: `Password mismatch for user ${email}`
      });
    }

    // Return user data (excluding password)
    const userData = {
      id: user.id,
      username: user.name,
      email: user.email,
      role: user.role
    };

    res.json({
      success: true,
      message: "Login successful",
      user: userData
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get all items (with /api prefix)
app.get("/api/items", async (req, res) => {
  try {
    console.log("GET /api/items - Fetching all items");

    // First check if items table exists
    const [tableCheck] = await pool.query("SHOW TABLES LIKE 'items'");
    if (tableCheck.length === 0) {
      console.log("Items table does not exist");
      return res.json([]);
    }

    // Get all items
    const [items] = await pool.query("SELECT * FROM items");
    console.log(`Found ${items.length} items in database`);

    // Check if isActive column exists
    const [columns] = await pool.query("DESCRIBE items");
    const hasIsActive = columns.some(col => col.Field === 'isActive');
    const hasBorrowedQuantity = columns.some(col => col.Field === 'borrowed_quantity');
    console.log(`Has isActive column: ${hasIsActive}, Has borrowed_quantity: ${hasBorrowedQuantity}`);

    // Filter active items if isActive column exists
    let activeItems = items;
    if (hasIsActive) {
      activeItems = items.filter(item => item.isActive === 1 || item.isActive === null);
      console.log(`Active items: ${activeItems.length}`);
    }

    const formattedItems = activeItems.map(item => ({
      id: item.id.toString(),
      name: item.name || "Unknown Item",
      description: item.description || "",
      category: item.category || "Other",
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      minQuantity: typeof item.minQuantity === "number" ? item.minQuantity : 0,
      borrowedQuantity: hasBorrowedQuantity && typeof item.borrowed_quantity === "number" ? item.borrowed_quantity : 0,
      status: item.quantity > 0 ? (item.quantity <= item.minQuantity ? "low-stock" : "in-stock") : "out-of-stock",
      price: item.price || 0,
      unit: item.unit || 'pcs',
    }));

    // Check if history is requested (Plan B)
    const { include_history } = req.query;
    if (include_history === 'true') {
      try {
        // Check if stock_history table exists first
        const [historyTable] = await pool.query("SHOW TABLES LIKE 'stock_history'");
        if (historyTable.length > 0) {
          const [history] = await pool.query(`
                    SELECT sh.*, i.name as item_name, i.category
                    FROM stock_history sh
                    JOIN items i ON sh.item_id = i.id
                    ORDER BY sh.created_at DESC
                    LIMIT 100
                `);

          console.log(`Included ${history.length} history entries`);
          return res.json({
            items: formattedItems,
            history: history
          });
        }
      } catch (historyError) {
        console.error("Error fetching history in items endpoint:", historyError);
      }
    }

    console.log(`Returning ${formattedItems.length} formatted items`);
    res.json(formattedItems);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: error.message,
    });
  }
});

// Create a new item
app.post("/api/items", async (req, res) => {
  try {
    console.log("POST /api/items - Creating new item");
    console.log("Request body:", req.body);

    const { name, description, category, quantity, minQuantity, price, unit } = req.body;

    // Validate required fields
    if (!name || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and category are required"
      });
    }

    // Calculate status based on quantity and minQuantity
    let status = "out-of-stock";
    if (quantity > 0) {
      status = quantity <= minQuantity ? "low-stock" : "in-stock";
    }

    // Check if unit column exists
    const [columns] = await pool.query('DESCRIBE items');
    const hasUnitColumn = columns.some(col => col.Field === 'unit');

    // Insert the new item (with or without unit column)
    let result;
    if (hasUnitColumn) {
      [result] = await pool.query(`
        INSERT INTO items (name, description, category, quantity, minQuantity, price, status, isActive, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [name, description, category, quantity || 0, minQuantity || 0, price || 0, status, unit || 'pcs']);
    } else {
      console.log('⚠️  Unit column does not exist, inserting without unit');
      [result] = await pool.query(`
        INSERT INTO items (name, description, category, quantity, minQuantity, price, status, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [name, description, category, quantity || 0, minQuantity || 0, price || 0, status]);
    }

    if (result.insertId) {
      // Fetch the created item
      const [items] = await pool.query("SELECT * FROM items WHERE id = ?", [result.insertId]);
      const item = items[0];

      // Format the response
      const formattedItem = {
        id: item.id.toString(),
        name: item.name,
        description: item.description,
        category: item.category,
        quantity: typeof item.quantity === "number" ? item.quantity : 0,
        minQuantity: typeof item.minQuantity === "number" ? item.minQuantity : 0,
        status: item.quantity > 0 ? (item.quantity <= item.minQuantity ? "low-stock" : "in-stock") : "out-of-stock",
        price: item.price || 0,
        unit: item.unit || 'pcs',
      };

      console.log("Item created successfully:", formattedItem);
      res.status(201).json(formattedItem);
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to create item"
      });
    }
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({
      success: false,
      message: "Error creating item",
      error: error.message,
    });
  }
});

// Update an existing item
app.put("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`PUT /api/items/${id} - Updating item`);
    console.log("Updates:", updates);

    // Check if the item exists and get current quantity for history
    const [existingItems] = await pool.query("SELECT * FROM items WHERE id = ?", [id]);

    if (existingItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const currentItem = existingItems[0];
    const quantityBefore = currentItem.quantity;

    // Check which columns exist in the table
    const [columns] = await pool.query('DESCRIBE items');
    const existingColumns = columns.map(col => col.Field);
    console.log('Existing columns:', existingColumns);

    // Build the update query dynamically
    const updateFields = [];
    const updateValues = [];

    // Only update fields that are provided AND exist in the table
    const allowedFields = ['name', 'description', 'category', 'quantity', 'minQuantity', 'price', 'lastRestocked', 'unit'];

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined && existingColumns.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      } else if (allowedFields.includes(key) && value !== undefined && !existingColumns.includes(key)) {
        console.log(`⚠️  Skipping field '${key}' - column does not exist in database`);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    // Add the id to the values array for the WHERE clause
    updateValues.push(id);

    const query = `UPDATE items SET ${updateFields.join(", ")} WHERE id = ?`;
    console.log("Update query:", query);
    console.log("Update values:", updateValues);

    const [result] = await pool.query(query, updateValues);

    if (result.affectedRows > 0) {
      // Fetch the updated item
      const [updatedItems] = await pool.query("SELECT * FROM items WHERE id = ?", [id]);
      const updatedItem = updatedItems[0];

      // Format the response
      const formattedItem = {
        id: updatedItem.id.toString(),
        name: updatedItem.name || "Unknown Item",
        description: updatedItem.description || "",
        category: updatedItem.category || "Other",
        quantity: typeof updatedItem.quantity === "number" ? updatedItem.quantity : 0,
        minQuantity: typeof updatedItem.minQuantity === "number" ? updatedItem.minQuantity : 0,
        status: updatedItem.quantity > 0 ? (updatedItem.quantity <= updatedItem.minQuantity ? "low-stock" : "in-stock") : "out-of-stock",
        price: updatedItem.price || 0,
        lastRestocked: updatedItem.lastRestocked,
        unit: updatedItem.unit || 'pcs'
      };

      // Record stock history if quantity changed
      if (updates.quantity !== undefined && updates.quantity !== quantityBefore) {
        try {
          const quantityChange = updates.quantity - quantityBefore;
          const changeType = quantityChange > 0 ? 'restock' : 'adjustment';
          const notes = updates.historyNotes || (quantityChange > 0 ? 'Stock added' : 'Stock reduced');

          // Check if table exists first to avoid crashing
          const [tables] = await pool.query("SHOW TABLES LIKE 'stock_history'");
          if (tables.length > 0) {
            await pool.query(
              `INSERT INTO stock_history (item_id, change_type, quantity_before, quantity_change, quantity_after, notes, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, changeType, quantityBefore, quantityChange, updates.quantity, notes, updates.userId || null]
            );
            console.log(`Stock history recorded for item ${id}: ${quantityBefore} -> ${updates.quantity}`);
          }
        } catch (historyError) {
          // Log error but don't fail the request - history is supplementary
          console.error('Error recording stock history:', historyError.message);
        }
      }

      console.log("Item updated successfully:", formattedItem);
      res.json(formattedItem);
    } else {
      res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({
      success: false,
      message: "Error updating item",
      error: error.message,
    });
  }
});

// Delete an item
app.delete("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DELETE /api/items/${id} - Deleting item`);

    // Check if the item exists
    const [existingItems] = await pool.query("SELECT * FROM items WHERE id = ?", [id]);

    if (existingItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // Check if item is referenced in any requests
    const [requestItems] = await pool.query(
      "SELECT COUNT(*) as count FROM request_items WHERE item_id = ?",
      [id]
    );

    if (requestItems[0].count > 0) {
      // If item is referenced in requests, prevent deletion
      console.log(`Cannot delete item ${id}: referenced in ${requestItems[0].count} request(s)`);
      return res.status(400).json({
        success: false,
        message: `Cannot delete this item because it is referenced in ${requestItems[0].count} existing request(s). Please remove it from all requests first.`,
        error: "Item is referenced in requests"
      });
    }

    // Perform the deletion
    const [result] = await pool.query("DELETE FROM items WHERE id = ?", [id]);

    if (result.affectedRows > 0) {
      console.log(`Item ${id} deleted successfully`);
      res.json({
        success: true,
        message: "Item deleted successfully"
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }
  } catch (error) {
    console.error("Error deleting item:", error);

    // Check if it's a foreign key constraint error
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      res.status(400).json({
        success: false,
        message: "Cannot delete item because it is referenced in existing requests",
        error: "Foreign key constraint violation"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error deleting item",
        error: error.message,
      });
    }
  }
});

// Get all items (without /api prefix for Vite proxy)
app.get("/items", async (req, res) => {
  try {
    console.log("GET /items - Fetching all items (proxy)");

    // First check if items table exists
    const [tableCheck] = await pool.query("SHOW TABLES LIKE 'items'");
    if (tableCheck.length === 0) {
      console.log("Items table does not exist");
      return res.json([]);
    }

    // Get all items
    const [items] = await pool.query("SELECT * FROM items");
    console.log(`Found ${items.length} items in database`);

    // Check if isActive column exists
    const [columns] = await pool.query("DESCRIBE items");
    const hasIsActive = columns.some(col => col.Field === 'isActive');
    const hasBorrowedQuantity = columns.some(col => col.Field === 'borrowed_quantity');
    console.log(`Has isActive column: ${hasIsActive}, Has borrowed_quantity: ${hasBorrowedQuantity}`);

    // Filter active items if isActive column exists
    let activeItems = items;
    if (hasIsActive) {
      activeItems = items.filter(item => item.isActive === 1 || item.isActive === null);
      console.log(`Active items: ${activeItems.length}`);
    }

    const formattedItems = activeItems.map(item => ({
      id: item.id.toString(),
      name: item.name || "Unknown Item",
      description: item.description || "",
      category: item.category || "Other",
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      minQuantity: typeof item.minQuantity === "number" ? item.minQuantity : 0,
      borrowedQuantity: hasBorrowedQuantity && typeof item.borrowed_quantity === "number" ? item.borrowed_quantity : 0,
      status: item.quantity > 0 ? (item.quantity <= item.minQuantity ? "low-stock" : "in-stock") : "out-of-stock",
      price: item.price || 0,
    }));

    console.log(`Returning ${formattedItems.length} formatted items`);
    res.json(formattedItems);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: error.message,
    });
  }
});

// Get unique categories (without /api prefix for Vite proxy)
app.get("/categories", async (req, res) => {
  try {
    console.log("GET /categories - Fetching unique categories (proxy)");

    const [rows] = await pool.query("SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category");

    const categories = rows.map(row => row.category);
    console.log(`Found categories:`, categories);

    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
});

// Get unique categories
app.get("/api/categories", async (req, res) => {
  try {
    console.log("GET /api/categories - Fetching unique categories");

    const [rows] = await pool.query("SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category");

    const categories = rows.map(row => row.category);
    console.log(`Found categories:`, categories);

    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
});

// Get all requests
app.get("/api/requests", async (req, res) => {
  try {
    console.log("GET /api/requests - Fetching all requests");

    const [requests] = await pool.query(`
      SELECT r.*, u.name as requester_name, u.email as requester_email
      FROM requests r
      LEFT JOIN users u ON r.requester_id = u.id
      ORDER BY r.created_at DESC
    `);

    // Get items for each request
    const requestsWithItems = await Promise.all(
      requests.map(async (request) => {
        const [items] = await pool.query(
          `
          SELECT ri.*, i.name, i.description, i.category
          FROM request_items ri
          JOIN items i ON ri.item_id = i.id
          WHERE ri.request_id = ?
        `,
          [request.id]
        );

        return {
          ...request,
          items: items,
        };
      })
    );

    console.log(`Returning ${requestsWithItems.length} requests`);
    res.json(requestsWithItems);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching requests",
      error: error.message,
    });
  }
});

// Get all users (for debugging)
app.get("/api/users", async (req, res) => {
  try {
    console.log("GET /api/users - Fetching all users");

    const [users] = await pool.query("SELECT id, name, email, role FROM users");

    res.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
});

// Get a single user by ID
app.get("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`GET /api/users/${id} - Fetching user details`);

    const [users] = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];
    const userData = {
      id: user.id.toString(),
      username: user.name,
      email: user.email,
      role: user.role || "user",
    };

    res.json(userData);
  } catch (error) {
    console.error(`Error fetching user with id ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
});

// Create a new user (registration)
app.post("/api/users", async (req, res) => {
  try {
    console.log("POST /api/users - Creating new user");
    console.log("Request body:", req.body);

    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash the password
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate a UUID for the user
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();

    // Insert the new user
    const [result] = await pool.query(
      `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
      [userId, name, email, hashedPassword, role || "user"]
    );

    console.log("User created successfully:", result);

    // Return user data (excluding password)
    const userData = {
      id: userId,
      username: name,
      email: email,
      role: role || "user",
    };

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
});

// Update a user
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role } = req.body;
    console.log(`PUT /api/users/${id} - Updating user`);

    // Validate role if provided
    if (role) {
      const validRoles = ["admin", "manager", "user"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }
    }

    // Check if user exists
    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (username) {
      updateFields.push("name = ?");
      updateValues.push(username);
    }
    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }
    if (password) {
      // Hash the password
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateFields.push("password = ?");
      updateValues.push(hashedPassword);
    }
    if (role) {
      updateFields.push("role = ?");
      updateValues.push(role);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    // Add the id to the values array for the WHERE clause
    updateValues.push(id);

    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
    const [result] = await pool.query(query, updateValues);

    if (result.affectedRows > 0) {
      // Fetch the updated user (excluding password)
      const [updatedUsers] = await pool.query(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        [id]
      );
      const updatedUser = updatedUsers[0];

      const userData = {
        id: updatedUser.id.toString(),
        username: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role || "user",
      };

      res.json({
        success: true,
        message: "User updated successfully",
        user: userData,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
  } catch (error) {
    console.error(`Error updating user with id ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
});

// Delete a user
app.delete("/api/users/:id", async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    console.log(`DELETE /api/users/${id} - Deleting user`);

    // Get a connection from the pool and start a transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if user exists
    const [existingUsers] = await connection.query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
    if (existingUsers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has any requests
    const [userRequests] = await connection.query(
      "SELECT COUNT(*) as count FROM requests WHERE requester_id = ?",
      [id]
    );

    if (userRequests[0].count > 0) {
      await connection.rollback();
      console.log(`Cannot delete user ${id}: has ${userRequests[0].count} request(s)`);
      return res.status(400).json({
        success: false,
        message: `Cannot delete this user because they have ${userRequests[0].count} existing request(s). Please handle their requests first.`,
        error: "User has existing requests"
      });
    }

    // Check if user has any notifications
    const [userNotifications] = await connection.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ?",
      [id]
    );

    // Delete user notifications first if any exist
    if (userNotifications[0].count > 0) {
      console.log(`Deleting ${userNotifications[0].count} notifications for user ${id}`);
      await connection.query("DELETE FROM notifications WHERE user_id = ?", [id]);
    }

    // Delete the user
    const [result] = await connection.query("DELETE FROM users WHERE id = ?", [id]);

    // Commit the transaction
    await connection.commit();

    if (result.affectedRows > 0) {
      console.log(`User ${id} deleted successfully`);
      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to delete user",
      });
    }
  } catch (error) {
    console.error(`Error deleting user with id ${req.params.id}:`, error);

    // Rollback the transaction if there was an error
    if (connection) {
      try {
        await connection.rollback();
        console.log("Transaction rolled back due to error");
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }

    // Check if it's a foreign key constraint error
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      res.status(400).json({
        success: false,
        message: "Cannot delete user because they have existing requests or other references",
        error: "Foreign key constraint violation"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error deleting user",
        error: error.message,
      });
    }
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
    }
  }
});

// Debug endpoint to check database structure
app.get("/api/debug/users", async (req, res) => {
  try {
    console.log("GET /api/debug/users - Debug user information");

    // Get table structure
    const [structure] = await pool.query("DESCRIBE users");

    // Get all users with passwords (for debugging only)
    const [users] = await pool.query("SELECT * FROM users LIMIT 10");

    res.json({
      success: true,
      table_structure: structure,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Error in debug endpoint",
      error: error.message,
    });
  }
});

// Debug endpoint to check requests table structure
app.get("/api/debug/requests", async (req, res) => {
  try {
    console.log("GET /api/debug/requests - Debug requests table information");

    // Get table structure
    const [structure] = await pool.query("DESCRIBE requests");

    // Get sample requests
    const [requests] = await pool.query("SELECT * FROM requests LIMIT 5");

    res.json({
      success: true,
      table_structure: structure,
      sample_requests: requests,
      count: requests.length
    });
  } catch (error) {
    console.error("Error in debug requests endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Error in debug requests endpoint",
      error: error.message,
    });
  }
});

// Get requests by user ID
app.get("/api/requests/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`GET /api/requests/user/${userId} - Fetching user requests`);

    const [requests] = await pool.query(`
      SELECT r.*, u.name as requester_name, u.email as requester_email
      FROM requests r
      LEFT JOIN users u ON r.requester_id = u.id
      WHERE r.requester_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);

    // Get items for each request
    const requestsWithItems = await Promise.all(
      requests.map(async (request) => {
        const [items] = await pool.query(
          `
          SELECT ri.*, i.name, i.description, i.category
          FROM request_items ri
          JOIN items i ON ri.item_id = i.id
          WHERE ri.request_id = ?
        `,
          [request.id]
        );

        return {
          ...request,
          items: items,
        };
      })
    );

    res.json(requestsWithItems);
  } catch (error) {
    console.error("Error fetching user requests:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user requests",
      error: error.message,
    });
  }
});

// Get a single request by ID
app.get("/api/requests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`GET /api/requests/${id} - Fetching request details`);

    const [requests] = await pool.query(`
      SELECT r.*, u.name as requester_name, u.email as requester_email
      FROM requests r
      LEFT JOIN users u ON r.requester_id = u.id
      WHERE r.id = ?
    `, [id]);

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const request = requests[0];

    // Get items for the request
    const [items] = await pool.query(`
      SELECT ri.*, i.name, i.description, i.category
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.request_id = ?
    `, [id]);

    // Add items to the request
    request.items = items;

    res.json(request);
  } catch (error) {
    console.error("Error fetching request:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching request",
      error: error.message,
    });
  }
});

// Create a new request
app.post("/api/requests", async (req, res) => {
  let connection;
  try {
    console.log("POST /api/requests - Creating new request");
    console.log("Request body:", req.body);

    const {
      project_name,
      requester_id,
      requester_name,
      reason,
      priority,
      due_date,
      items,
    } = req.body;

    // Validate required fields
    if (!project_name || !items || !items.length) {
      console.error("Missing required fields:", {
        project_name,
        requester_id,
        items,
      });
      return res.status(400).json({
        success: false,
        message: "Missing required fields: project_name and items are required",
      });
    }

    // Get a connection from the pool
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Generate a UUID for the request
    const { v4: uuidv4 } = require('uuid');
    const requestId = uuidv4();

    console.log("Generated request ID:", requestId);

    // Insert the main request (without requester_name since it doesn't exist in the table)
    const [requestResult] = await connection.query(
      `
      INSERT INTO requests (
        id, project_name, requester_id, reason, priority, due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `,
      [
        requestId,
        project_name,
        requester_id,
        reason || "",
        priority || "medium",
        due_date || null,
      ]
    );

    console.log("Request inserted:", requestResult);

    // Insert request items
    for (const item of items) {
      const { item_id, quantity } = item;

      if (!item_id || !quantity) {
        throw new Error("Each item must have item_id and quantity");
      }

      await connection.query(
        `
        INSERT INTO request_items (request_id, item_id, quantity)
        VALUES (?, ?, ?)
      `,
        [requestId, item_id, quantity]
      );

      console.log(`Inserted item: ${item_id}, quantity: ${quantity}`);
    }

    // Commit the transaction
    await connection.commit();

    // Fetch the created request with items
    const [createdRequest] = await pool.query(`
      SELECT * FROM requests WHERE id = ?
    `, [requestId]);

    const [requestItems] = await pool.query(`
      SELECT ri.*, i.name, i.description, i.category
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.request_id = ?
    `, [requestId]);

    const response = {
      ...createdRequest[0],
      items: requestItems
    };

    console.log("Request created successfully:", response);

    // Create notifications for admins/managers about the new request
    try {
      console.log("Creating notifications for admins about new request...");

      // Get all admin and manager users
      const [adminUsers] = await pool.query(`
        SELECT id, name FROM users WHERE role IN ('admin', 'manager')
      `);

      console.log(`Found ${adminUsers.length} admin/manager users for notifications`);

      // Create notification for each admin/manager
      for (const admin of adminUsers) {
        const { v4: uuidv4 } = require('uuid');
        const notificationId = uuidv4();

        await pool.query(`
          INSERT INTO notifications (id, user_id, type, message, related_item_id, is_read, created_at)
          VALUES (?, ?, 'request_submitted', ?, ?, 0, NOW())
        `, [
          notificationId,
          admin.id,
          `New request "${project_name}" requires your review`,
          requestId
        ]);

        console.log(`Created notification for admin ${admin.name} (${admin.id})`);
      }

      // Also create a confirmation notification for the requester
      if (requester_id) {
        const { v4: uuidv4 } = require('uuid');
        const requesterNotificationId = uuidv4();

        await pool.query(`
          INSERT INTO notifications (id, user_id, type, message, related_item_id, is_read, created_at)
          VALUES (?, ?, 'request_submitted', ?, ?, 0, NOW())
        `, [
          requesterNotificationId,
          requester_id,
          `Your request "${project_name}" has been submitted and is pending review`,
          requestId
        ]);

        console.log(`Created confirmation notification for requester ${requester_id}`);
      }

    } catch (notificationError) {
      console.error("Error creating notifications:", notificationError);
      // Don't fail the request creation if notifications fail
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating request:", error);

    // Rollback transaction if connection exists
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error creating request",
      error: error.message,
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
    }
  }
});

// Delete a request
app.delete("/api/requests/:id", async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    console.log(`DELETE /api/requests/${id} - Deleting request`);

    // Get a connection from the pool and start a transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if request exists
    const [existingRequests] = await connection.query(
      "SELECT * FROM requests WHERE id = ?",
      [id]
    );
    if (existingRequests.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    // Delete request items first (due to foreign key constraint)
    await connection.query(
      "DELETE FROM request_items WHERE request_id = ?",
      [id]
    );

    // Delete the request
    const [result] = await connection.query(
      "DELETE FROM requests WHERE id = ?",
      [id]
    );

    // Commit the transaction
    await connection.commit();

    if (result.affectedRows > 0) {
      console.log(`Request ${id} deleted successfully`);
      res.json({
        success: true,
        message: "Request deleted successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to delete request",
      });
    }
  } catch (error) {
    console.error(`Error deleting request with id ${req.params.id}:`, error);

    // Rollback the transaction if there was an error
    if (connection) {
      try {
        await connection.rollback();
        console.log("Transaction rolled back due to error");
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error deleting request",
      error: error.message,
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
    }
  }
});

// Update a request
app.patch("/api/requests/:id", async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { project_name, reason, priority, due_date, items } = req.body;

    console.log(`PATCH /api/requests/${id} - Updating request details`);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Update main request fields
    const updateFields = [];
    const updateValues = [];

    if (project_name) {
      updateFields.push("project_name = ?");
      updateValues.push(project_name);
    }
    if (reason !== undefined) {
      updateFields.push("reason = ?");
      updateValues.push(reason);
    }
    if (priority) {
      updateFields.push("priority = ?");
      updateValues.push(priority);
    }
    if (due_date !== undefined) {
      updateFields.push("due_date = ?");
      updateValues.push(due_date);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await connection.query(
        `UPDATE requests SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ?`,
        updateValues
      );
    }

    // Update item quantities if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.item_id && item.quantity !== undefined) {
          await connection.query(
            "UPDATE request_items SET quantity = ? WHERE request_id = ? AND item_id = ?",
            [item.quantity, id, item.item_id]
          );
        }
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Request updated successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`Error updating request ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: "Error updating request",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// Update request status
app.patch("/api/requests/:id/status", async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status, approved_by } = req.body;

    console.log(`PATCH /api/requests/${id}/status - Updating status to: ${status}`);
    console.log(`Request ID: "${id}", Status: "${status}"`);
    console.log(`Request body:`, req.body);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    // Validate status
    const validStatuses = ["pending", "approved", "denied", "fulfilled", "out_of_stock"];
    if (!validStatuses.includes(status)) {
      console.log(`Invalid status provided: ${status}`);
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Get a connection from the pool and start a transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // First, check if the request exists
    console.log(`Checking if request exists with ID: ${id}`);
    const [existingRequests] = await connection.query(`
      SELECT id, status FROM requests WHERE id = ?
    `, [id]);

    console.log(`Found ${existingRequests.length} requests with ID ${id}:`, existingRequests);

    if (existingRequests.length === 0) {
      await connection.rollback();
      console.log(`Request not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Request not found",
        debug: `No request found with ID: ${id}`
      });
    }

    console.log(`Updating request ${id} from status "${existingRequests[0].status}" to "${status}"`);

    // If status is being set to "approved", update item quantities
    if (status === "approved") {
      console.log(`Request ${id} is being approved, updating item quantities...`);

      // Get the items in the request
      const [requestItems] = await connection.query(`
        SELECT ri.*, i.name, i.quantity as current_quantity, i.minQuantity
        FROM request_items ri
        JOIN items i ON ri.item_id = i.id
        WHERE ri.request_id = ?
      `, [id]);

      console.log(`Found ${requestItems.length} items in request ${id}:`, requestItems);

      // Update each item's quantity
      for (const item of requestItems) {
        const newQuantity = Math.max(0, item.current_quantity - item.quantity);
        console.log(`Updating item ${item.item_id} (${item.name}) quantity from ${item.current_quantity} to ${newQuantity}`);

        // Calculate new status based on new quantity and minQuantity
        let newStatus = "out-of-stock";
        if (newQuantity > 0) {
          newStatus = newQuantity <= item.minQuantity ? "low-stock" : "in-stock";
        }

        console.log(`Setting item ${item.item_id} status to: ${newStatus}`);

        // Update the item quantity and status
        const [itemUpdateResult] = await connection.query(`
          UPDATE items
          SET quantity = ?, status = ?, updatedAt = NOW()
          WHERE id = ?
        `, [newQuantity, newStatus, item.item_id]);

        console.log(`Item ${item.item_id} update result:`, itemUpdateResult);

        if (itemUpdateResult.affectedRows === 0) {
          throw new Error(`Failed to update item ${item.item_id} quantity`);
        }
      }

      console.log(`Successfully updated quantities for all items in request ${id}`);
    }

    // Update the request status
    const [updateResult] = await connection.query(
      `UPDATE requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );

    console.log(`Request status update result:`, updateResult);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      console.log(`No rows affected when updating request ${id}`);
      return res.status(404).json({
        success: false,
        message: "Request not found or no changes made",
        debug: `Update affected ${updateResult.affectedRows} rows`
      });
    }

    // Commit the transaction
    await connection.commit();
    console.log(`Successfully committed transaction for request ${id}`);

    // Create notification for the requester about the status change
    try {
      console.log("Creating notification for requester about status change...");

      // Get the request details to find the requester and project name
      const [requestDetails] = await pool.query(`
        SELECT requester_id, project_name FROM requests WHERE id = ?
      `, [id]);

      if (requestDetails.length > 0) {
        const { requester_id, project_name } = requestDetails[0];

        // Create appropriate notification message based on status
        let notificationType = 'request_approved';
        let message = '';

        switch (status) {
          case 'approved':
            notificationType = 'request_approved';
            message = `Your request "${project_name}" has been approved`;
            break;
          case 'denied':
            notificationType = 'request_rejected';
            message = `Your request "${project_name}" has been rejected`;
            break;
          case 'fulfilled':
            notificationType = 'request_fulfilled';
            message = `Your request "${project_name}" has been fulfilled`;
            break;
          case 'out_of_stock':
            notificationType = 'request_rejected';
            message = `Your request "${project_name}" cannot be fulfilled due to insufficient stock`;
            break;
          default:
            // Don't send notification for pending status
            console.log(`No notification needed for status: ${status}`);
            break;
        }

        // Only create notification if we have a message (not for pending status)
        if (message) {
          const { v4: uuidv4 } = require('uuid');
          const notificationId = uuidv4();

          await pool.query(`
            INSERT INTO notifications (id, user_id, type, message, related_item_id, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, NOW())
          `, [
            notificationId,
            requester_id,
            notificationType,
            message,
            id
          ]);

          console.log(`Created notification for requester ${requester_id}: ${message}`);
        }
      }

    } catch (notificationError) {
      console.error("Error creating status change notification:", notificationError);
      // Don't fail the status update if notification fails
    }

    // Fetch the updated request
    const [updatedRequest] = await pool.query(`
      SELECT * FROM requests WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: "Request status updated successfully",
      request: updatedRequest[0],
      debug: `Updated ${updateResult.affectedRows} row(s)`,
      itemsUpdated: status === "approved" ? "Item quantities reduced automatically" : "No item updates needed"
    });

  } catch (error) {
    console.error("Error updating request status:", error);
    console.error("Error stack:", error.stack);

    // Rollback transaction if connection exists
    if (connection) {
      try {
        await connection.rollback();
        console.log("Transaction rolled back due to error");
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error updating request status",
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
    }
  }
});

// Notification endpoints

// Get notifications for a user
app.get("/api/notifications/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`GET /api/notifications/user/${userId} - Fetching user notifications`);

    const [notifications] = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    console.log(`Found ${notifications.length} notifications for user ${userId}`);
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
});

// Get unread notification count for a user
app.get("/api/notifications/user/:userId/unread-count", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`GET /api/notifications/user/${userId}/unread-count - Fetching unread count`);

    const [result] = await pool.query(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `, [userId]);

    const count = result[0].count;
    console.log(`User ${userId} has ${count} unread notifications`);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching unread count",
      error: error.message,
    });
  }
});

// Create a new notification
app.post("/api/notifications", async (req, res) => {
  try {
    console.log("POST /api/notifications - Creating new notification");
    console.log("Request body:", req.body);

    const { user_id, type, message, related_item_id } = req.body;

    // Validate required fields
    if (!user_id || !type || !message) {
      return res.status(400).json({
        success: false,
        message: "user_id, type, and message are required",
      });
    }

    // Generate a UUID for the notification
    const { v4: uuidv4 } = require('uuid');
    const notificationId = uuidv4();

    // Insert the notification
    const [result] = await pool.query(`
      INSERT INTO notifications (id, user_id, type, message, related_item_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, NOW())
    `, [notificationId, user_id, type, message, related_item_id || null]);

    console.log("Notification created:", result);

    // Fetch the created notification
    const [notifications] = await pool.query(`
      SELECT * FROM notifications WHERE id = ?
    `, [notificationId]);

    res.status(201).json(notifications[0]);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    });
  }
});

// Mark a notification as read
app.patch("/api/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`PATCH /api/notifications/${id}/read - Marking notification as read`);

    const [result] = await pool.query(`
      UPDATE notifications SET is_read = 1 WHERE id = ?
    `, [id]);

    if (result.affectedRows > 0) {
      res.json({ success: true, message: "Notification marked as read" });
    } else {
      res.status(404).json({ success: false, message: "Notification not found" });
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    });
  }
});

// Mark all notifications as read for a user
app.patch("/api/notifications/user/:userId/mark-all-read", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`PATCH /api/notifications/user/${userId}/mark-all-read - Marking all notifications as read`);

    const [result] = await pool.query(`
      UPDATE notifications SET is_read = 1 WHERE user_id = ?
    `, [userId]);

    console.log(`Marked ${result.affectedRows} notifications as read for user ${userId}`);
    res.json({
      success: true,
      message: "All notifications marked as read",
      updated_count: result.affectedRows
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking all notifications as read",
      error: error.message,
    });
  }
});

// Delete a notification
app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DELETE /api/notifications/${id} - Deleting notification`);

    const [result] = await pool.query(`
      DELETE FROM notifications WHERE id = ?
    `, [id]);

    if (result.affectedRows > 0) {
      res.json({ success: true, message: "Notification deleted" });
    } else {
      res.status(404).json({ success: false, message: "Notification not found" });
    }
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Dashboard API endpoints
// Get comprehensive dashboard statistics
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    console.log("GET /api/dashboard/stats - Fetching dashboard statistics");

    // Get user statistics
    const [userStats] = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
        SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as manager_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count
      FROM users
    `);

    // Get item statistics
    const [itemStats] = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COUNT(CASE WHEN quantity <= minQuantity THEN 1 END) as low_stock_items
      FROM items
    `);

    // Get category count
    const [categoryStats] = await pool.query(`
      SELECT COUNT(DISTINCT category) as total_categories FROM items WHERE category IS NOT NULL
    `);

    // Get request statistics
    const [requestStats] = await pool.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied_count,
        SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled_count
      FROM requests
    `);

    // Get recent requests (last 7 days)
    const [recentRequests] = await pool.query(`
      SELECT COUNT(*) as recent_count
      FROM requests
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Get top requested items
    const [topItems] = await pool.query(`
      SELECT
        i.name,
        COALESCE(SUM(ri.quantity), 0) as total_requested
      FROM items i
      LEFT JOIN request_items ri ON i.id = ri.item_id
      LEFT JOIN requests r ON ri.request_id = r.id
      GROUP BY i.id, i.name
      ORDER BY total_requested DESC
      LIMIT 5
    `);

    // Get recent activity
    const [recentActivity] = await pool.query(`
      SELECT
        r.id,
        'request_created' as type,
        CONCAT('Request "', r.project_name, '" was created') as description,
        r.created_at as timestamp,
        u.name as user
      FROM requests r
      JOIN users u ON r.requester_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `);

    const dashboardStats = {
      // User statistics
      totalUsers: parseInt(userStats[0].total_users) || 0,
      usersByRole: {
        admin: parseInt(userStats[0].admin_count) || 0,
        manager: parseInt(userStats[0].manager_count) || 0,
        user: parseInt(userStats[0].user_count) || 0
      },

      // Item statistics
      totalItems: parseInt(itemStats[0].total_items) || 0,
      totalQuantity: parseInt(itemStats[0].total_quantity) || 0,
      lowStockItems: parseInt(itemStats[0].low_stock_items) || 0,
      totalCategories: parseInt(categoryStats[0].total_categories) || 0,

      // Request statistics
      totalRequests: parseInt(requestStats[0].total_requests) || 0,
      requestsByStatus: {
        pending: parseInt(requestStats[0].pending_count) || 0,
        approved: parseInt(requestStats[0].approved_count) || 0,
        denied: parseInt(requestStats[0].denied_count) || 0,
        fulfilled: parseInt(requestStats[0].fulfilled_count) || 0
      },
      recentRequests: parseInt(recentRequests[0].recent_count) || 0,

      // Top requested items
      topRequestedItems: topItems.map(item => ({
        name: item.name,
        totalRequested: parseInt(item.total_requested) || 0
      })),

      // Recent activity
      recentActivity: recentActivity.map(activity => ({
        id: activity.id.toString(),
        type: activity.type,
        description: activity.description,
        timestamp: activity.timestamp.toISOString(),
        user: activity.user
      }))
    };

    console.log("Dashboard stats compiled successfully");
    res.json(dashboardStats);

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message
    });
  }
});

// Get user statistics
app.get("/api/dashboard/users", async (req, res) => {
  try {
    const [userStats] = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
        SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as manager_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count
      FROM users
    `);

    res.json({
      totalUsers: parseInt(userStats[0].total_users) || 0,
      usersByRole: {
        admin: parseInt(userStats[0].admin_count) || 0,
        manager: parseInt(userStats[0].manager_count) || 0,
        user: parseInt(userStats[0].user_count) || 0
      }
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ success: false, message: "Error fetching user statistics" });
  }
});

// Get item statistics
app.get("/api/dashboard/items", async (req, res) => {
  try {
    const [itemStats] = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COUNT(CASE WHEN quantity <= minQuantity THEN 1 END) as low_stock_items
      FROM items
    `);

    const [categoryStats] = await pool.query(`
      SELECT COUNT(DISTINCT category) as total_categories FROM items WHERE category IS NOT NULL
    `);

    res.json({
      totalItems: parseInt(itemStats[0].total_items) || 0,
      totalQuantity: parseInt(itemStats[0].total_quantity) || 0,
      lowStockItems: parseInt(itemStats[0].low_stock_items) || 0,
      totalCategories: parseInt(categoryStats[0].total_categories) || 0
    });
  } catch (error) {
    console.error("Error fetching item stats:", error);
    res.status(500).json({ success: false, message: "Error fetching item statistics" });
  }
});

// Get request statistics
app.get("/api/dashboard/requests", async (req, res) => {
  try {
    const [requestStats] = await pool.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied_count,
        SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled_count
      FROM requests
    `);

    const [recentRequests] = await pool.query(`
      SELECT COUNT(*) as recent_count
      FROM requests
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    res.json({
      totalRequests: parseInt(requestStats[0].total_requests) || 0,
      requestsByStatus: {
        pending: parseInt(requestStats[0].pending_count) || 0,
        approved: parseInt(requestStats[0].approved_count) || 0,
        denied: parseInt(requestStats[0].denied_count) || 0,
        fulfilled: parseInt(requestStats[0].fulfilled_count) || 0
      },
      recentRequests: parseInt(recentRequests[0].recent_count) || 0
    });
  } catch (error) {
    console.error("Error fetching request stats:", error);
    res.status(500).json({ success: false, message: "Error fetching request statistics" });
  }
});

// Get top requested items
app.get("/api/dashboard/top-items", async (req, res) => {
  try {
    const [topItems] = await pool.query(`
      SELECT
        i.name,
        COALESCE(SUM(ri.quantity), 0) as total_requested
      FROM items i
      LEFT JOIN request_items ri ON i.id = ri.item_id
      LEFT JOIN requests r ON ri.request_id = r.id
      GROUP BY i.id, i.name
      ORDER BY total_requested DESC
      LIMIT 10
    `);

    res.json(topItems.map(item => ({
      name: item.name,
      totalRequested: parseInt(item.total_requested) || 0
    })));
  } catch (error) {
    console.error("Error fetching top items:", error);
    res.status(500).json({ success: false, message: "Error fetching top requested items" });
  }
});

// Get recent activity
app.get("/api/dashboard/activity", async (req, res) => {
  try {
    const [recentActivity] = await pool.query(`
      SELECT
        r.id,
        'request_created' as type,
        CONCAT('Request "', r.project_name, '" was created') as description,
        r.created_at as timestamp,
        u.name as user
      FROM requests r
      JOIN users u ON r.requester_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

    res.json(recentActivity.map(activity => ({
      id: activity.id.toString(),
      type: activity.type,
      description: activity.description,
      timestamp: activity.timestamp.toISOString(),
      user: activity.user
    })));
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({ success: false, message: "Error fetching recent activity" });
  }
});

// Get user-specific dashboard statistics
app.get("/api/dashboard/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`GET /api/dashboard/user/${userId} - Fetching user dashboard statistics`);

    // Get user's request statistics
    const [userRequestStats] = await pool.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied_count,
        SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled_count
      FROM requests
      WHERE requester_id = ?
    `, [userId]);

    // Get user's recent requests (last 7 days)
    const [recentUserRequests] = await pool.query(`
      SELECT COUNT(*) as recent_count
      FROM requests
      WHERE requester_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [userId]);

    // Get user's top requested items
    const [userTopItems] = await pool.query(`
      SELECT
        i.name,
        COALESCE(SUM(ri.quantity), 0) as total_requested
      FROM items i
      LEFT JOIN request_items ri ON i.id = ri.item_id
      LEFT JOIN requests r ON ri.request_id = r.id AND r.requester_id = ?
      WHERE r.requester_id IS NOT NULL
      GROUP BY i.id, i.name
      ORDER BY total_requested DESC
      LIMIT 5
    `, [userId]);

    // Get available items count
    const [availableItems] = await pool.query(`
      SELECT COUNT(*) as available_items FROM items WHERE quantity > 0
    `);

    // Get available categories count
    const [availableCategories] = await pool.query(`
      SELECT COUNT(DISTINCT category) as available_categories FROM items WHERE category IS NOT NULL
    `);

    // Get user's recent activity
    const [userRecentActivity] = await pool.query(`
      SELECT
        r.id,
        CASE
          WHEN r.status = 'pending' THEN 'request_created'
          WHEN r.status = 'approved' THEN 'request_approved'
          WHEN r.status = 'denied' THEN 'request_denied'
          WHEN r.status = 'fulfilled' THEN 'request_fulfilled'
          ELSE 'request_created'
        END as type,
        CONCAT('Request "', r.project_name, '" was ', r.status) as description,
        r.updated_at as timestamp
      FROM requests r
      WHERE r.requester_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 10
    `, [userId]);

    const userDashboardStats = {
      myRequests: {
        total: parseInt(userRequestStats[0].total_requests) || 0,
        pending: parseInt(userRequestStats[0].pending_count) || 0,
        approved: parseInt(userRequestStats[0].approved_count) || 0,
        denied: parseInt(userRequestStats[0].denied_count) || 0,
        fulfilled: parseInt(userRequestStats[0].fulfilled_count) || 0
      },
      recentRequests: parseInt(recentUserRequests[0].recent_count) || 0,
      myTopRequestedItems: userTopItems.map(item => ({
        name: item.name,
        totalRequested: parseInt(item.total_requested) || 0
      })),
      availableItems: parseInt(availableItems[0].available_items) || 0,
      availableCategories: parseInt(availableCategories[0].available_categories) || 0,
      myRecentActivity: userRecentActivity.map(activity => ({
        id: activity.id.toString(),
        type: activity.type,
        description: activity.description,
        timestamp: activity.timestamp.toISOString()
      }))
    };

    console.log("User dashboard stats compiled successfully");
    res.json(userDashboardStats);

  } catch (error) {
    console.error("Error fetching user dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user dashboard statistics",
      error: error.message
    });
  }
});

// ===== LOAN MANAGEMENT ENDPOINTS =====

// Get all loans (admin/manager only)
app.get("/api/loans", async (req, res) => {
  try {
    console.log("GET /api/loans - Fetching all loans");

    const [loans] = await pool.query(`
      SELECT
        l.id,
        l.user_id as userId,
        l.item_id as itemId,
        l.quantity,
        l.status,
        l.borrowed_date as borrowedDate,
        l.due_date as dueDate,
        l.returned_date as returnedDate,
        l.notes,
        i.name as itemName,
        u.username as userName,
        u.email as userEmail
      FROM loans l
      JOIN items i ON l.item_id = i.id
      JOIN users u ON l.user_id = u.id
      ORDER BY l.borrowed_date DESC
    `);

    console.log(`Found ${loans.length} loans`);
    res.json(loans);
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching loans",
      error: error.message,
    });
  }
});

// Get loans for a specific user
app.get("/api/loans/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("GET /api/loans/user/:userId - Fetching loans for user:", userId);

    const [loans] = await pool.query(`
      SELECT
        l.id,
        l.user_id as userId,
        l.item_id as itemId,
        l.quantity,
        l.status,
        l.borrowed_date as borrowedDate,
        l.due_date as dueDate,
        l.returned_date as returnedDate,
        l.notes,
        i.name as itemName
      FROM loans l
      JOIN items i ON l.item_id = i.id
      WHERE l.user_id = ?
      ORDER BY l.borrowed_date DESC
    `, [userId]);

    console.log(`Found ${loans.length} loans for user ${userId}`);
    res.json(loans);
  } catch (error) {
    console.error("Error fetching user loans:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user loans",
      error: error.message,
    });
  }
});

// Borrow an item
app.post("/api/loans/borrow", async (req, res) => {
  try {
    const { userId, itemId, quantity, dueDate, notes } = req.body;
    console.log("POST /api/loans/borrow - Borrowing item:", { userId, itemId, quantity, dueDate });

    // Validate required fields
    if (!userId || !itemId || !quantity || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "userId, itemId, quantity, and dueDate are required"
      });
    }

    // Check if item exists and is electronic
    const [items] = await pool.query("SELECT * FROM items WHERE id = ? AND isActive = 1", [itemId]);
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const item = items[0];
    if (item.category.toLowerCase() !== 'electronics') {
      return res.status(400).json({
        success: false,
        message: "Only electronic items can be borrowed"
      });
    }

    // Check availability
    const availableQuantity = item.quantity - (item.borrowed_quantity || 0);
    if (quantity > availableQuantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableQuantity} items available for borrowing`
      });
    }

    // Generate loan ID
    const loanId = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create loan record
    await pool.query(`
      INSERT INTO loans (id, user_id, item_id, quantity, status, due_date, notes)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `, [loanId, userId, itemId, quantity, dueDate, notes || null]);

    // Update item borrowed quantity
    await pool.query(`
      UPDATE items
      SET borrowed_quantity = COALESCE(borrowed_quantity, 0) + ?
      WHERE id = ?
    `, [quantity, itemId]);

    // Fetch the created loan with item details
    const [newLoan] = await pool.query(`
      SELECT
        l.id,
        l.user_id as userId,
        l.item_id as itemId,
        l.quantity,
        l.status,
        l.borrowed_date as borrowedDate,
        l.due_date as dueDate,
        l.notes,
        i.name as itemName
      FROM loans l
      JOIN items i ON l.item_id = i.id
      WHERE l.id = ?
    `, [loanId]);

    console.log("Item borrowed successfully:", newLoan[0]);
    res.status(201).json(newLoan[0]);
  } catch (error) {
    console.error("Error borrowing item:", error);
    res.status(500).json({
      success: false,
      message: "Error borrowing item",
      error: error.message,
    });
  }
});

// Return an item
app.post("/api/loans/return", async (req, res) => {
  try {
    const { loanId, notes } = req.body;
    console.log("POST /api/loans/return - Returning item:", { loanId });

    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: "loanId is required"
      });
    }

    // Get loan details
    const [loans] = await pool.query(`
      SELECT l.*, i.name as itemName
      FROM loans l
      JOIN items i ON l.item_id = i.id
      WHERE l.id = ? AND l.status = 'active'
    `, [loanId]);

    if (loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Active loan not found"
      });
    }

    const loan = loans[0];

    // Update loan status
    await pool.query(`
      UPDATE loans
      SET status = 'returned', returned_date = NOW(), notes = CONCAT(COALESCE(notes, ''), ?)
      WHERE id = ?
    `, [notes ? `\nReturn notes: ${notes}` : '', loanId]);

    // Update item borrowed quantity
    await pool.query(`
      UPDATE items
      SET borrowed_quantity = GREATEST(0, COALESCE(borrowed_quantity, 0) - ?)
      WHERE id = ?
    `, [loan.quantity, loan.item_id]);

    // Fetch updated loan
    const [updatedLoan] = await pool.query(`
      SELECT
        l.id,
        l.user_id as userId,
        l.item_id as itemId,
        l.quantity,
        l.status,
        l.borrowed_date as borrowedDate,
        l.due_date as dueDate,
        l.returned_date as returnedDate,
        l.notes,
        i.name as itemName
      FROM loans l
      JOIN items i ON l.item_id = i.id
      WHERE l.id = ?
    `, [loanId]);

    console.log("Item returned successfully:", updatedLoan[0]);
    res.json(updatedLoan[0]);
  } catch (error) {
    console.error("Error returning item:", error);
    res.status(500).json({
      success: false,
      message: "Error returning item",
      error: error.message,
    });
  }
});

// Check item availability for borrowing
app.post("/api/loans/check-availability", async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    console.log("POST /api/loans/check-availability - Checking availability:", { itemId, quantity });

    const [items] = await pool.query(`
      SELECT quantity, COALESCE(borrowed_quantity, 0) as borrowed_quantity
      FROM items
      WHERE id = ? AND isActive = 1
    `, [itemId]);

    if (items.length === 0) {
      return res.json({ available: false, message: "Item not found" });
    }

    const item = items[0];
    const availableQuantity = item.quantity - item.borrowed_quantity;
    const available = quantity <= availableQuantity;

    res.json({
      available,
      availableQuantity,
      message: available ? "Item is available" : `Only ${availableQuantity} items available`
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({
      success: false,
      message: "Error checking availability",
      error: error.message,
    });
  }
});

// Get overdue loans
app.get("/api/loans/overdue", async (req, res) => {
  try {
    console.log("GET /api/loans/overdue - Fetching overdue loans");

    // Update overdue status first
    await pool.query(`
      UPDATE loans
      SET status = 'overdue'
      WHERE status = 'active' AND due_date < CURDATE()
    `);

    const [loans] = await pool.query(`
      SELECT
        l.id,
        l.user_id as userId,
        l.item_id as itemId,
        l.quantity,
        l.status,
        l.borrowed_date as borrowedDate,
        l.due_date as dueDate,
        l.notes,
        i.name as itemName,
        u.username as userName,
        u.email as userEmail
      FROM loans l
      JOIN items i ON l.item_id = i.id
      JOIN users u ON l.user_id = u.id
      WHERE l.status = 'overdue'
      ORDER BY l.due_date ASC
    `);

    console.log(`Found ${loans.length} overdue loans`);
    res.json(loans);
  } catch (error) {
    console.error("Error fetching overdue loans:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching overdue loans",
      error: error.message,
    });
  }
});

// Chat functionality completely removed

// ==================== STOCK HISTORY API ENDPOINTS ====================

// Get all stock history (with optional filters)
app.get("/api/stock-history", async (req, res) => {
  try {
    const { item_id, change_type, start_date, end_date, limit = 100 } = req.query;

    let query = `
      SELECT sh.*, i.name as item_name, i.category
      FROM stock_history sh
      JOIN items i ON sh.item_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (item_id) {
      query += ` AND sh.item_id = ?`;
      params.push(item_id);
    }
    if (change_type) {
      query += ` AND sh.change_type = ?`;
      params.push(change_type);
    }
    if (start_date) {
      query += ` AND sh.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND sh.created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY sh.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [history] = await pool.query(query, params);
    res.json(history);
  } catch (error) {
    console.error("Error fetching stock history:", error);
    res.status(500).json({ success: false, message: "Error fetching stock history", error: error.message });
  }
});

// Get stock history for a specific item (Stock Card)
app.get("/api/stock-history/item/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT sh.*, i.name as item_name, i.category, i.quantity as current_quantity
      FROM stock_history sh
      JOIN items i ON sh.item_id = i.id
      WHERE sh.item_id = ?
    `;
    const params = [itemId];

    if (start_date) {
      query += ` AND sh.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND sh.created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY sh.created_at ASC`;

    const [history] = await pool.query(query, params);

    // Get item details
    const [items] = await pool.query("SELECT * FROM items WHERE id = ?", [itemId]);

    res.json({
      item: items[0] || null,
      history: history
    });
  } catch (error) {
    console.error(`Error fetching stock history for item ${req.params.itemId}:`, error);
    res.status(500).json({ success: false, message: "Error fetching stock history", error: error.message });
  }
});

// Get stock summary for a period
app.get("/api/stock-summary/items", async (req, res) => {
  try {
    const { start_date, end_date, item_id } = req.query;

    let itemFilter = item_id ? `AND sh.item_id = ${pool.escape(item_id)}` : '';

    // Get summary by item
    const query = `
      SELECT 
        i.id as item_id,
        i.name as item_name,
        i.category,
        i.quantity as current_quantity,
        COALESCE(SUM(CASE WHEN sh.quantity_change > 0 THEN sh.quantity_change ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN sh.quantity_change < 0 THEN ABS(sh.quantity_change) ELSE 0 END), 0) as total_out,
        MIN(sh.quantity_before) as opening_stock,
        MAX(sh.quantity_after) as closing_stock,
        COUNT(sh.id) as transaction_count
      FROM items i
      LEFT JOIN stock_history sh ON i.id = sh.item_id
        ${start_date ? `AND sh.created_at >= ${pool.escape(start_date)}` : ''}
        ${end_date ? `AND sh.created_at <= ${pool.escape(end_date)}` : ''}
        ${itemFilter}
      WHERE i.isActive = 1
      ${item_id ? `AND i.id = ${pool.escape(item_id)}` : ''}
      GROUP BY i.id, i.name, i.category, i.quantity
      ORDER BY i.name
    `;

    const [summary] = await pool.query(query);

    // Calculate totals
    const totals = {
      total_items: summary.length,
      total_in: summary.reduce((sum, s) => sum + (parseInt(s.total_in) || 0), 0),
      total_out: summary.reduce((sum, s) => sum + (parseInt(s.total_out) || 0), 0),
      total_transactions: summary.reduce((sum, s) => sum + (parseInt(s.transaction_count) || 0), 0)
    };

    res.json({
      summary: summary,
      totals: totals,
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error("Error fetching stock summary:", error);
    res.status(500).json({ success: false, message: "Error fetching stock summary", error: error.message });
  }
});

// Manually add stock history entry (for adjustments)
app.post("/api/stock-history", async (req, res) => {
  try {
    const { item_id, change_type, quantity_before, quantity_change, quantity_after, reference_id, notes, created_by } = req.body;

    if (!item_id || !change_type || quantity_before === undefined || quantity_change === undefined || quantity_after === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const [result] = await pool.query(
      `INSERT INTO stock_history (item_id, change_type, quantity_before, quantity_change, quantity_after, reference_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, change_type, quantity_before, quantity_change, quantity_after, reference_id || null, notes || null, created_by || null]
    );

    if (result.insertId) {
      const [history] = await pool.query("SELECT * FROM stock_history WHERE id = ?", [result.insertId]);
      res.status(201).json(history[0]);
    } else {
      res.status(400).json({ success: false, message: "Failed to create stock history entry" });
    }
  } catch (error) {
    console.error("Error creating stock history entry:", error);
    res.status(500).json({ success: false, message: "Error creating stock history entry", error: error.message });
  }
});

// ==================== END STOCK HISTORY API ENDPOINTS ====================

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
    timestamp: new Date().toISOString()
  });
});

// Error handler (must be last)
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Railway server running on port ${PORT}`);
  console.log(`📝 Available endpoints:`);
  console.log(`   GET  /`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/test-connection`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/items`);
  console.log(`   POST /api/items`);
  console.log(`   PUT  /api/items/:id`);
  console.log(`   DELETE /api/items/:id`);
  console.log(`   GET  /api/categories`);
  console.log(`   GET  /api/requests`);
  console.log(`   GET  /api/requests/user/:userId`);
  console.log(`   GET  /api/requests/:id`);
  console.log(`   POST /api/requests`);
  console.log(`   PATCH /api/requests/:id/status`);
  console.log(`   GET  /api/users`);
  console.log(`   GET  /api/debug/users`);
  console.log(`   GET  /api/debug/requests`);
  console.log(`   GET  /api/dashboard/stats`);
  console.log(`   GET  /api/dashboard/users`);
  console.log(`   GET  /api/dashboard/items`);
  console.log(`   GET  /api/dashboard/requests`);
  console.log(`   GET  /api/dashboard/top-items`);
  console.log(`   GET  /api/dashboard/activity`);
  console.log(`   GET  /api/dashboard/user/:userId`);
  console.log(`   GET  /api/loans`);
  console.log(`   GET  /api/loans/user/:userId`);
  console.log(`   POST /api/loans/borrow`);
  console.log(`   POST /api/loans/return`);
  console.log(`   POST /api/loans/check-availability`);
  console.log(`   GET  /api/loans/overdue`);
  console.log(`   GET  /api/stock-history`);
  console.log(`   GET  /api/stock-history/item/:itemId`);
  console.log(`   GET  /api/stock-summary`);
  console.log(`\n✅ Server ready with Loan Management System!`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
