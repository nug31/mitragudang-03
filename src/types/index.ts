import React from "react";

export type UserRole = "admin" | "user" | "manager";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export type RequestPriority = "high" | "medium" | "low";
export type RequestStatus = "pending" | "approved" | "rejected" | "completed";

// Allow any string as ItemCategory to support dynamic categories from the database
export type ItemCategory = string;

export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  quantity: number;
  minQuantity: number;
  borrowedQuantity?: number; // For electronics that can be borrowed
  status: "in-stock" | "low-stock" | "out-of-stock";
  lastRestocked?: string;
  price?: number;
  isActive?: number;
  unit?: string; // Unit of measurement (pcs, rim, box, etc.)
}

export interface ItemRequest {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  priority: RequestPriority;
  status: RequestStatus;
  description: string;
  requestedDeliveryDate: string;
  attachment?: string;
  createdAt: string;
  updatedAt: string;
  // Additional fields from API
  projectName?: string;
  requesterName?: string;
  requesterEmail?: string;
  items?: any[];
  unit?: string; // Unit of measurement for the requested item (pcs, rim, box, etc.)
}

// Chat functionality removed
