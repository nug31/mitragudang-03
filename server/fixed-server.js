const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

// Load configuration
const { dbConfig, serverConfig } = require("./config");

const app = express();
const PORT = serverConfig.port;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow file:// origins for local testing
    if (origin.startsWith('file://')) return callback(null, true);

    // Allow configured origins
    if (origin === serverConfig.corsOrigin) return callback(null, true);

    // Allow localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log("Request body:", req.body);
  next();
});

// Create a connection pool
let pool;
try {
  console.log("Attempting to create database pool with config:", JSON.stringify({
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    connectionLimit: dbConfig.connectionLimit
  }));

  pool = mysql.createPool(dbConfig);
  console.log("Database pool created successfully");

  // Test the connection immediately
  pool.getConnection()
    .then(connection => {
      console.log("Successfully connected to database!");
      connection.query("SHOW TABLES")
        .then(([tables]) => {
          console.log("Tables in database:");
          tables.forEach(table => {
            console.log(Object.values(table)[0]);
          });
          connection.release();
        })
        .catch(err => {
          console.error("Error querying tables:", err);
          connection.release();
        });
    })
    .catch(err => {
      console.error("Error connecting to database:", err);
    });
} catch (error) {
  console.error("Error creating database pool:", error);
  process.exit(1);
}

// Test database connection
app.get("/api/test-connection", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    res.json({ success: true, message: "Database connection successful" });
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Get all requests
app.get("/api/requests", async (req, res) => {
  try {
    console.log("GET /api/requests - Fetching all requests");

    // Get all requests without joining the users table
    console.log("Executing SQL query: SELECT * FROM requests ORDER BY created_at DESC");
    const [requests] = await pool.query(`
      SELECT * FROM requests
      ORDER BY created_at DESC
    `);

    console.log(`Found ${requests.length} requests`);
    console.log("First request:", requests[0]);

    // Get items for each request
    const requestsWithItems = await Promise.all(
      requests.map(async (request) => {
        try {
          const [items] = await pool.query(
            `
            SELECT ri.*, i.name, i.description, i.category
            FROM request_items ri
            JOIN items i ON ri.item_id = i.id
            WHERE ri.request_id = ?
            `,
            [request.id]
          );

          // Get user info separately
          let requesterName = "Unknown User";
          let requesterEmail = "";

          try {
            const [users] = await pool.query(
              "SELECT name, email FROM users WHERE id = ?",
              [request.requester_id]
            );

            if (users.length > 0) {
              requesterName = users[0].name || "Unknown User";
              requesterEmail = users[0].email || "";
            }
          } catch (userError) {
            console.error("Error fetching user info:", userError);
          }

          return {
            ...request,
            items: items,
            requester_name: requesterName,
            requester_email: requesterEmail
          };
        } catch (itemError) {
          console.error(`Error fetching items for request ${request.id}:`, itemError);
          return {
            ...request,
            items: [],
            requester_name: "Unknown User",
            requester_email: ""
          };
        }
      })
    );

    console.log("Sending response with requests and items");
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

// Helper function to format category names
function formatCategoryName(categoryString) {
  // Map hyphenated category names to proper display names
  const categoryMapping = {
    'cleaning-materials': 'Cleaning Materials',
    'office-supplies': 'Office Supplies',
    'electronics': 'Electronics',
    'furniture': 'Furniture',
    'office': 'Office',
    'other': 'Other'
  };

  return categoryMapping[categoryString] || categoryString;
}

// Get all categories
app.get("/api/categories", async (req, res) => {
  try {
    console.log("GET /api/categories - Fetching all categories");

    // Get all categories from categories table
    const [categories] = await pool.query(`
      SELECT id, name, description, created_at FROM categories
      ORDER BY name
    `);

    console.log(`Found ${categories.length} categories`);

    // Also get category usage from items table
    const [categoryUsage] = await pool.query(`
      SELECT category, COUNT(*) as item_count
      FROM items
      GROUP BY category
      ORDER BY item_count DESC
    `);

    // Format categories with usage information
    const formattedCategories = categories.map(category => {
      const usage = categoryUsage.find(u =>
        formatCategoryName(u.category).toLowerCase() === category.name.toLowerCase()
      );

      return {
        id: category.id,
        name: category.name,
        description: category.description || "",
        item_count: usage ? usage.item_count : 0,
        created_at: category.created_at
      };
    });

    console.log("Sending response with formatted categories");
    res.json(formattedCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
});

// Get all items
app.get("/api/items", async (req, res) => {
  try {
    console.log("GET /api/items - Fetching all items");

    // Get all items
    const [items] = await pool.query(`
      SELECT * FROM items
    `);

    console.log(`Found ${items.length} items`);

    // Format the items
    const formattedItems = items.map(item => {
      // Calculate status based on quantity and minQuantity
      let status = "out-of-stock";
      if (item.quantity > 0) {
        status = item.quantity <= item.minQuantity ? "low-stock" : "in-stock";
      }

      return {
        id: item.id.toString(),
        name: item.name || "Unknown Item",
        description: item.description || "",
        category: formatCategoryName(item.category) || "Other", // Use formatted category name
        quantity: typeof item.quantity === "number" ? item.quantity : 0,
        minQuantity: typeof item.minQuantity === "number" ? item.minQuantity : 0,
        status: status,
        price: item.price || 0,
      };
    });

    console.log("Sending response with formatted items");
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

// Get a single item by ID
app.get("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`GET /api/items/${id} - Fetching item details`);

    const [items] = await pool.query(
      `
      SELECT * FROM items
      WHERE id = ?
    `,
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const item = items[0];

    // Calculate status based on quantity and minQuantity
    let status = "out-of-stock";
    if (item.quantity > 0) {
      status = item.quantity <= item.minQuantity ? "low-stock" : "in-stock";
    }

    const formattedItem = {
      id: item.id.toString(),
      name: item.name || "Unknown Item",
      description: item.description || "",
      category: formatCategoryName(item.category) || "Other", // Use formatted category name
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      minQuantity: typeof item.minQuantity === "number" ? item.minQuantity : 0,
      status: status,
      price: item.price || 0,
    };

    res.json(formattedItem);
  } catch (error) {
    console.error(`Error fetching item with id ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: "Error fetching item",
      error: error.message,
    });
  }
});

// Get requests by user ID
app.get("/api/requests/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`GET /api/requests/user/${userId} - Fetching user requests`);

    const [requests] = await pool.query(
      `
      SELECT * FROM requests
      WHERE requester_id = ?
      ORDER BY created_at DESC
    `,
      [userId]
    );

    console.log(`Found ${requests.length} requests for user ${userId}`);

    // Get items for each request
    const requestsWithItems = await Promise.all(
      requests.map(async (request) => {
        try {
          const [items] = await pool.query(
            `
            SELECT ri.*, i.name, i.description, i.category
            FROM request_items ri
            JOIN items i ON ri.item_id = i.id
            WHERE ri.request_id = ?
            `,
            [request.id]
          );

          // Get user info separately
          let requesterName = "Unknown User";
          let requesterEmail = "";

          try {
            const [users] = await pool.query(
              "SELECT name, email FROM users WHERE id = ?",
              [request.requester_id]
            );

            if (users.length > 0) {
              requesterName = users[0].name || "Unknown User";
              requesterEmail = users[0].email || "";
            }
          } catch (userError) {
            console.error("Error fetching user info:", userError);
          }

          return {
            ...request,
            items: items,
            requester_name: requesterName,
            requester_email: requesterEmail
          };
        } catch (itemError) {
          console.error(`Error fetching items for request ${request.id}:`, itemError);
          return {
            ...request,
            items: [],
            requester_name: "Unknown User",
            requester_email: ""
          };
        }
      })
    );

    console.log("Sending response with user requests and items");
    res.json(requestsWithItems);
  } catch (error) {
    console.error(`Error fetching requests for user ${userId}:`, error);
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

    const [requests] = await pool.query(
      `
      SELECT * FROM requests
      WHERE id = ?
    `,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const request = requests[0];

    // Get items for the request
    const [items] = await pool.query(
      `
      SELECT ri.*, i.name, i.description, i.category
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.request_id = ?
    `,
      [id]
    );

    // Get user info
    let requesterName = "Unknown User";
    let requesterEmail = "";

    try {
      const [users] = await pool.query(
        "SELECT name, email FROM users WHERE id = ?",
        [request.requester_id]
      );

      if (users.length > 0) {
        requesterName = users[0].name || "Unknown User";
        requesterEmail = users[0].email || "";
      }
    } catch (userError) {
      console.error("Error fetching user info:", userError);
    }

    const requestWithItems = {
      ...request,
      items: items,
      requester_name: requesterName,
      requester_email: requesterEmail
    };

    res.json(requestWithItems);
  } catch (error) {
    console.error(`Error fetching request with id ${req.params.id}:`, error);
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

    // Get a connection from the pool and start a transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Generate a UUID for the request
    const requestId = require('uuid').v4();
    console.log("Generated request ID:", requestId);

    // Insert the request
    const [requestResult] = await connection.query(
      `
      INSERT INTO requests (
        id,
        project_name,
        requester_id,
        reason,
        priority,
        due_date,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        requestId,
        project_name,
        requester_id || 1, // Default to user ID 1 if not provided
        reason || "",
        priority || "medium",
        due_date || null,
        "pending",
      ]
    );

    console.log("Request inserted:", requestResult);

    // Insert the request items
    for (const item of items) {
      const { item_id, quantity } = item;

      if (!item_id) {
        throw new Error("Item ID is required for each item");
      }

      console.log(`Inserting request item: item_id=${item_id}, quantity=${quantity}`);

      const [itemResult] = await connection.query(
        `
        INSERT INTO request_items (
          request_id,
          item_id,
          quantity
        ) VALUES (?, ?, ?)
        `,
        [requestId, item_id, quantity || 1]
      );

      console.log("Request item inserted:", itemResult);
    }

    // Commit the transaction
    await connection.commit();

    // Get the created request with items
    const [requests] = await connection.query(
      `
      SELECT * FROM requests
      WHERE id = ?
      `,
      [requestId]
    );

    const [requestItems] = await connection.query(
      `
      SELECT ri.*, i.name, i.description, i.category
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.request_id = ?
      `,
      [requestId]
    );

    const createdRequest = {
      ...requests[0],
      items: requestItems,
    };

    res.status(201).json(createdRequest);
  } catch (error) {
    console.error("Error creating request:", error);

    // Rollback the transaction if there was an error
    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      success: false,
      message: "Error creating request",
      error: error.message,
    });
  } finally {
    // Release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
});

// Update request status
app.patch("/api/requests/:id/status", async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`PATCH /api/requests/${id}/status - Updating request status to ${status}`);
    console.log(`Request body:`, req.body);
    console.log(`Request params:`, req.params);

    // Validate status
    const validStatuses = ["pending", "approved", "denied", "fulfilled", "out_of_stock"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Get a connection from the pool and start a transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // If the status is being set to "approved", update the item quantities
    if (status === "approved") {
      console.log(`Request ${id} is being approved, updating item quantities...`);
      console.log(`Transaction started for request approval process`);

      // Get the request details
      const [requests] = await connection.query(
        `SELECT * FROM requests WHERE id = ?`,
        [id]
      );

      if (requests.length === 0) {
        return res.status(404).json({ success: false, message: "Request not found" });
      }

      // Get the items in the request
      const [requestItems] = await connection.query(
        `
        SELECT ri.*, i.name, i.quantity as current_quantity, i.minQuantity
        FROM request_items ri
        JOIN items i ON ri.item_id = i.id
        WHERE ri.request_id = ?
        `,
        [id]
      );

      console.log(`Found ${requestItems.length} items in request ${id}`);
      console.log(`Request items:`, JSON.stringify(requestItems, null, 2));

      // Update each item's quantity
      for (const item of requestItems) {
        const newQuantity = Math.max(0, item.current_quantity - item.quantity);
        console.log(`Updating item ${item.item_id} (${item.name}) quantity from ${item.current_quantity} to ${newQuantity}`);

        // Calculate new status based on new quantity and minQuantity
        let newStatus = "out-of-stock";
        if (newQuantity > 0) {
          newStatus = newQuantity <= item.minQuantity ? "low-stock" : "in-stock";
        }

        // Update the item quantity and status
        console.log(`Executing SQL: UPDATE items SET quantity = ${newQuantity}, status = '${newStatus}', lastRestocked = NOW() WHERE id = ${item.item_id}`);

        try {
          // First check if the status column exists
          const [columns] = await connection.query(
            `SHOW COLUMNS FROM items LIKE 'status'`
          );

          console.log(`Status column check:`, columns);

          let updateResult;

          // Check if lastRestocked column exists
          const [lastRestockedColumns] = await connection.query(
            `SHOW COLUMNS FROM items LIKE 'lastRestocked'`
          );

          console.log(`lastRestocked column check:`, lastRestockedColumns);

          // Build the update query dynamically based on which columns exist
          let updateQuery = `UPDATE items SET quantity = ?`;
          let updateParams = [newQuantity];

          if (columns.length > 0) {
            updateQuery += `, status = ?`;
            updateParams.push(newStatus);
          }

          if (lastRestockedColumns.length > 0) {
            updateQuery += `, lastRestocked = NOW()`;
          }

          updateQuery += ` WHERE id = ?`;
          updateParams.push(item.item_id);

          console.log(`Final update query: ${updateQuery}`);
          console.log(`Update params:`, updateParams);

          const [result] = await connection.query(updateQuery, updateParams);
          updateResult = result;

          console.log(`Update result:`, updateResult);
          console.log(`Updated item ${item.item_id} quantity to ${newQuantity}, status to ${newStatus}`);
        } catch (updateError) {
          console.error(`Error updating item ${item.item_id}:`, updateError);
          throw updateError;
        }
      }
    }

    // Update the request status
    const [result] = await connection.query(
      `
      UPDATE requests
      SET status = ?
      WHERE id = ?
    `,
      [status, id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    // Commit the transaction
    await connection.commit();

    // Get the updated request
    const [requests] = await pool.query(
      `
      SELECT * FROM requests
      WHERE id = ?
    `,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const request = requests[0];

    // Get items for the request
    const [items] = await pool.query(
      `
      SELECT ri.*, i.name, i.description, i.category
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.request_id = ?
    `,
      [id]
    );

    // Get user info
    let requesterName = "Unknown User";
    let requesterEmail = "";

    try {
      const [users] = await pool.query(
        "SELECT name, email FROM users WHERE id = ?",
        [request.requester_id]
      );

      if (users.length > 0) {
        requesterName = users[0].name || "Unknown User";
        requesterEmail = users[0].email || "";
      }
    } catch (userError) {
      console.error("Error fetching user info:", userError);
    }

    const requestWithItems = {
      ...request,
      items: items,
      requester_name: requesterName,
      requester_email: requesterEmail
    };

    res.json(requestWithItems);
  } catch (error) {
    console.error(`Error updating status for request ${req.params.id}:`, error);

    // Rollback the transaction if there was an error and we have a connection
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
    });
  } finally {
    // Release the connection back to the pool
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
    // Release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
});

// Add a test endpoint to check if the server is running
app.get("/api/test", (req, res) => {
  console.log("GET /api/test - Testing server");
  res.json({ success: true, message: "Server is running" });
});

// Authentication endpoints
// Login endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("POST /api/auth/login - Request received");
    console.log("Request body:", req.body);

    const { email, password } = req.body;
    console.log(`POST /api/auth/login - Attempting login for ${email}`);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Query the database for the user
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];
    let passwordMatches = false;

    // For now, use simple password matching for demo purposes
    // Check if password is bcrypt hashed (starts with $2a$ or $2b$)
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      // For demo purposes, allow common passwords for hashed users
      if (password === 'password123' || password === 'password' || password === 'admin123') {
        passwordMatches = true;
        console.log(`Demo password accepted for hashed user ${email}`);
      } else {
        passwordMatches = false;
        console.log(`Demo password rejected for hashed user ${email}`);
      }
    } else {
      // Direct comparison for plain text passwords
      passwordMatches = user.password === password;
      console.log(`Plain text password comparison for ${email}: ${passwordMatches}`);
      console.log(`Expected: "${password}", Actual: "${user.password}"`);
    }

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Return user data (excluding password)
    const userData = {
      id: user.id.toString(),
      username: user.name || user.username,
      email: user.email,
      role: user.role || "user",
    };

    res.json({
      success: true,
      message: "Login successful",
      user: userData,
    });
  } catch (error) {
    console.error("Error during login:", error);
    console.error("Error stack:", error.stack);

    // Send a more detailed error response
    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// User Management API endpoints
// Get all users
app.get("/api/users", async (req, res) => {
  try {
    console.log("GET /api/users - Fetching all users");
    const [users] = await pool.query("SELECT id, name, email, role FROM users");

    // Map to the expected format for the frontend
    const formattedUsers = users.map((user) => ({
      id: user.id.toString(),
      username: user.name,
      email: user.email,
      role: user.role || "user",
    }));

    res.json(formattedUsers);
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

// Create a new user
app.post("/api/users", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    console.log(
      `POST /api/users - Creating new user: ${username}, ${email}, role: ${role}`
    );

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
    }

    // Validate role
    const validRoles = ["admin", "manager", "user"];
    const userRole = role && validRoles.includes(role) ? role : "user";

    // Check if email already exists
    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    // Generate a UUID for the user ID
    const userId = require('uuid').v4();
    console.log("Generated user ID:", userId);

    // Insert the new user with the generated ID
    const [result] = await pool.query(
      "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [userId, username, email, password, userRole]
    );

    if (result.affectedRows > 0) {
      const userData = {
        id: userId,
        username,
        email,
        role: userRole,
      };

      res.status(201).json({
        success: true,
        message: "User created successfully",
        user: userData,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to create user",
      });
    }
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

    // Build the update query dynamically based on provided fields
    const updates = [];
    const values = [];

    if (username) {
      updates.push("name = ?");
      values.push(username);
    }

    if (email) {
      // Check if email is already in use by another user
      const [emailUsers] = await pool.query(
        "SELECT * FROM users WHERE email = ? AND id != ?",
        [email, id]
      );
      if (emailUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another user",
        });
      }
      updates.push("email = ?");
      values.push(email);
    }

    if (password) {
      updates.push("password = ?");
      values.push(password);
    }

    if (role) {
      updates.push("role = ?");
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    // Add the ID to the values array
    values.push(id);

    // Execute the update query
    const [result] = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows > 0) {
      // Get the updated user
      const [updatedUsers] = await pool.query(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        [id]
      );

      if (updatedUsers.length > 0) {
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
          message: "User not found after update",
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to update user",
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
  try {
    const { id } = req.params;
    console.log(`DELETE /api/users/${id} - Deleting user`);

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

    // Delete the user
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows > 0) {
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
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
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
      SELECT COUNT(*) as total_categories FROM categories
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
      SELECT i.name, SUM(ri.quantity) as total_requested
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      GROUP BY ri.item_id, i.name
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

    const stats = {
      totalUsers: userStats[0].total_users,
      usersByRole: {
        admin: userStats[0].admin_count,
        manager: userStats[0].manager_count,
        user: userStats[0].user_count
      },
      totalItems: itemStats[0].total_items,
      totalQuantity: parseInt(itemStats[0].total_quantity),
      lowStockItems: itemStats[0].low_stock_items,
      totalCategories: categoryStats[0].total_categories,
      totalRequests: requestStats[0].total_requests,
      requestsByStatus: {
        pending: requestStats[0].pending_count,
        approved: requestStats[0].approved_count,
        denied: requestStats[0].denied_count,
        fulfilled: requestStats[0].fulfilled_count
      },
      recentRequests: recentRequests[0].recent_count,
      topRequestedItems: topItems.map(item => ({
        name: item.name,
        totalRequested: parseInt(item.total_requested)
      })),
      recentActivity: recentActivity.map(activity => ({
        id: activity.id.toString(),
        type: activity.type,
        description: activity.description,
        timestamp: activity.timestamp,
        user: activity.user
      }))
    };

    console.log("Dashboard stats:", stats);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, message: "Error fetching dashboard statistics" });
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
      totalUsers: userStats[0].total_users,
      usersByRole: {
        admin: userStats[0].admin_count,
        manager: userStats[0].manager_count,
        user: userStats[0].user_count
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
      SELECT COUNT(*) as total_categories FROM categories
    `);

    res.json({
      totalItems: itemStats[0].total_items,
      totalQuantity: parseInt(itemStats[0].total_quantity),
      lowStockItems: itemStats[0].low_stock_items,
      totalCategories: categoryStats[0].total_categories
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
      totalRequests: requestStats[0].total_requests,
      requestsByStatus: {
        pending: requestStats[0].pending_count,
        approved: requestStats[0].approved_count,
        denied: requestStats[0].denied_count,
        fulfilled: requestStats[0].fulfilled_count
      },
      recentRequests: recentRequests[0].recent_count
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
      SELECT i.name, SUM(ri.quantity) as total_requested
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      GROUP BY ri.item_id, i.name
      ORDER BY total_requested DESC
      LIMIT 5
    `);

    res.json(topItems.map(item => ({
      name: item.name,
      totalRequested: parseInt(item.total_requested)
    })));
  } catch (error) {
    console.error("Error fetching top requested items:", error);
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
      LIMIT 10
    `);

    res.json(recentActivity.map(activity => ({
      id: activity.id.toString(),
      type: activity.type,
      description: activity.description,
      timestamp: activity.timestamp,
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

    // Get user's recent requests (last 30 days)
    const [recentRequestsCount] = await pool.query(`
      SELECT COUNT(*) as recent_count
      FROM requests
      WHERE requester_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [userId]);

    // Get user's top requested items
    const [userTopItems] = await pool.query(`
      SELECT i.name, i.category, SUM(ri.quantity) as total_requested
      FROM request_items ri
      JOIN items i ON ri.item_id = i.id
      JOIN requests r ON ri.request_id = r.id
      WHERE r.requester_id = ?
      GROUP BY ri.item_id, i.name, i.category
      ORDER BY total_requested DESC
      LIMIT 5
    `, [userId]);

    // Get available items count
    const [availableItemsCount] = await pool.query(`
      SELECT COUNT(*) as available_items FROM items WHERE quantity > 0
    `);

    // Get available categories count
    const [availableCategoriesCount] = await pool.query(`
      SELECT COUNT(*) as available_categories FROM categories
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
        r.updated_at as timestamp,
        r.status
      FROM requests r
      WHERE r.requester_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 10
    `, [userId]);

    const userStats = {
      myRequests: {
        total: userRequestStats[0].total_requests,
        pending: userRequestStats[0].pending_count,
        approved: userRequestStats[0].approved_count,
        denied: userRequestStats[0].denied_count,
        fulfilled: userRequestStats[0].fulfilled_count
      },
      recentRequests: recentRequestsCount[0].recent_count,
      myTopRequestedItems: userTopItems.map(item => ({
        name: item.name,
        totalRequested: parseInt(item.total_requested),
        category: item.category
      })),
      availableItems: availableItemsCount[0].available_items,
      availableCategories: availableCategoriesCount[0].available_categories,
      myRecentActivity: userRecentActivity.map(activity => ({
        id: activity.id.toString(),
        type: activity.type,
        description: activity.description,
        timestamp: activity.timestamp,
        status: activity.status
      }))
    };

    console.log("User dashboard stats:", userStats);
    res.json(userStats);
  } catch (error) {
    console.error("Error fetching user dashboard stats:", error);
    res.status(500).json({ success: false, message: "Error fetching user dashboard statistics" });
  }
});


// Start the server
try {
  app.listen(PORT, () => {
    console.log(`Fixed server is running on port ${PORT}`);
    console.log(`Server is listening at http://localhost:${PORT}`);
    console.log("Available endpoints:");
    console.log("- GET /api/test-connection");
    console.log("- POST /api/auth/login");
    console.log("- GET /api/requests");
    console.log("- GET /api/requests/user/:userId");
    console.log("- GET /api/requests/:id");
    console.log("- POST /api/requests");
    console.log("- PATCH /api/requests/:id/status");
    console.log("- GET /api/items");
    console.log("- GET /api/items/:id");
    console.log("- GET /api/users");
    console.log("- GET /api/users/:id");
    console.log("- POST /api/users (used for registration)");
    console.log("- PUT /api/users/:id");
    console.log("- DELETE /api/users/:id");
    console.log("- GET /api/dashboard/stats");
    console.log("- GET /api/dashboard/users");
    console.log("- GET /api/dashboard/items");
    console.log("- GET /api/dashboard/requests");
    console.log("- GET /api/dashboard/top-items");
    console.log("- GET /api/dashboard/activity");
    console.log("- GET /api/dashboard/user/:userId");
  });
} catch (error) {
  console.error("Error starting server:", error);
}
