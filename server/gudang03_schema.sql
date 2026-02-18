-- Gudang 03 Database Schema
-- Run this in Supabase SQL Editor

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create items table
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  quantity INT NOT NULL DEFAULT 0,
  "minQuantity" INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'pcs',
  status VARCHAR(50) DEFAULT 'in-stock',
  price DECIMAL(15, 2) DEFAULT 0,
  "isActive" INT DEFAULT 1,
  "lastRestocked" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id VARCHAR(255) PRIMARY KEY,
  "project_name" VARCHAR(255),
  "requester_id" VARCHAR(255) REFERENCES users(id),
  reason TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  "due_date" DATE,
  status VARCHAR(50) DEFAULT 'pending',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create request_items table
CREATE TABLE IF NOT EXISTS request_items (
  id SERIAL PRIMARY KEY,
  "request_id" VARCHAR(255) REFERENCES requests(id) ON DELETE CASCADE,
  "item_id" INT REFERENCES items(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create stock_history table
CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  "item_id" INT REFERENCES items(id) ON DELETE CASCADE,
  "change_type" VARCHAR(50) NOT NULL,
  "quantity_before" INT NOT NULL,
  "quantity_change" INT NOT NULL,
  "quantity_after" INT NOT NULL,
  notes TEXT,
  "created_by" VARCHAR(255),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  "user_id" VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  message TEXT,
  "is_read" INT DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Insert Default Users
-- Passwords are in plain text for simplicity as a starter (the app supports both)
-- Admin: admin@gudang.com / admin123
INSERT INTO users (id, name, email, password, role) 
VALUES ('user_admin_01', 'Admin Gudang 03', 'admin@gudang.com', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Manager: manager@gudang.com / manager123
INSERT INTO users (id, name, email, password, role) 
VALUES ('user_manager_01', 'Manager Gudang 03', 'manager@gudang.com', 'manager123', 'manager')
ON CONFLICT (email) DO NOTHING;
