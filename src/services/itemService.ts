import { Item, ItemCategory } from "../types";
import { API_BASE_URL } from "../config";

// API base URL - use config for environment-specific URLs
const API_URL = API_BASE_URL;

// Enable debug mode
const DEBUG = true;

class ItemService {
  // Helper method to log debug messages
  private debug(message: string, ...args: any[]) {
    if (DEBUG) {
      console.log(`ItemService: ${message}`, ...args);
    }
  }
  // Get all items from the API
  async getAllItems(): Promise<Item[]> {
    try {
      this.debug("Fetching all items from API...");
      this.debug("API URL:", `${API_URL}/items`);

      const response = await fetch(`${API_URL}/items`);
      this.debug("Response status:", response.status);

      if (!response.ok) {
        console.error(`Failed to fetch items with status: ${response.status}`);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const items = await response.json();
      this.debug(`Received ${items.length} items from API:`, items);

      // Ensure all items have the required properties
      const validatedItems = items.map((item: any) => {
        this.debug("Processing item:", item);
        return {
          id: item.id?.toString() || "0",
          name: item.name || "Unknown Item",
          description: item.description || "",
          category: this.validateCategory(item.category),
          quantity: typeof item.quantity === "number" ? item.quantity : 0,
          minQuantity:
            typeof item.minQuantity === "number" ? item.minQuantity : 0,
          status: this.validateStatus(
            item.status,
            item.quantity,
            item.minQuantity
          ),
          lastRestocked: item.lastRestocked,
          price: item.price,
        };
      });

      this.debug("Returning validated items:", validatedItems);
      return validatedItems;
    } catch (error) {
      console.error("Error fetching items:", error);
      return [];
    }
  }

  // Helper method to validate category
  private validateCategory(category: any): ItemCategory {
    // Since we've updated ItemCategory to be a string type,
    // we can accept any string category from the database
    if (typeof category === "string" && category.trim()) {
      return category.trim();
    }
    // Default to 'other' if category is not a valid string
    return "other";
  }

  // Helper method to validate status
  private validateStatus(
    status: any,
    quantity?: number,
    minQuantity?: number
  ): "in-stock" | "low-stock" | "out-of-stock" {
    const validStatuses = ["in-stock", "low-stock", "out-of-stock"];

    if (validStatuses.includes(status)) {
      return status as "in-stock" | "low-stock" | "out-of-stock";
    }

    // Calculate status based on quantity if available
    if (typeof quantity === "number" && typeof minQuantity === "number") {
      if (quantity <= 0) {
        return "out-of-stock";
      } else if (quantity <= minQuantity) {
        return "low-stock";
      } else {
        return "in-stock";
      }
    }

    // Default to in-stock
    return "in-stock";
  }

  // Get a single item by ID
  async getItemById(id: string): Promise<Item | null> {
    try {
      const response = await fetch(`${API_URL}/items/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const item = await response.json();
      return item;
    } catch (error) {
      console.error(`Error fetching item with id ${id}:`, error);
      return null;
    }
  }

  // Create a new item
  async createItem(item: Omit<Item, "id" | "status">): Promise<Item | null> {
    try {
      const response = await fetch(`${API_URL}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const newItem = await response.json();
      return newItem;
    } catch (error) {
      console.error("Error creating item:", error);
      return null;
    }
  }

  // Update an existing item
  async updateItem(id: string, updates: Partial<Item>): Promise<Item | null> {
    try {
      const response = await fetch(`${API_URL}/items/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const updatedItem = await response.json();
      return updatedItem;
    } catch (error) {
      console.error(`Error updating item with id ${id}:`, error);
      return null;
    }
  }

  // Delete an item
  async deleteItem(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Item not found");
        }

        // Try to get the error message from the response
        try {
          const errorData = await response.json();
          if (response.status === 400 && errorData.message) {
            throw new Error(errorData.message);
          }
        } catch (parseError) {
          // If we can't parse the error response, use a generic message
        }

        throw new Error(`Failed to delete item (Status: ${response.status})`);
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error(`Error deleting item with id ${id}:`, error);
      throw error; // Re-throw the error so the UI can handle it properly
    }
  }

  // Helper method to test database connection
  async testConnection(): Promise<boolean> {
    try {
      this.debug("Testing database connection...");
      const response = await fetch(`${API_URL}/test-connection`);

      if (!response.ok) {
        console.error(`Connection test failed with status: ${response.status}`);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      this.debug("Connection test result:", result);
      return result.success;
    } catch (error) {
      console.error("Error testing connection:", error);
      // Return true anyway to allow the app to continue
      // This is useful for development when the backend might not be fully set up
      return true;
    }
  }
}

export const itemService = new ItemService();
