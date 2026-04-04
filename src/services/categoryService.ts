import { API_BASE_URL } from "../config";

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

class CategoryService {
  private apiUrl = `${API_BASE_URL}/categories`;

  async getAllCategories(): Promise<Category[]> {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      const data = await response.json();

      // Handle the new API response format: { success: true, categories: [...] }
      if (data.success && data.categories) {
        return data.categories.map((categoryName: string, index: number) => ({
          id: (index + 1).toString(),
          name: this.formatCategoryName(categoryName),
          description: `${this.formatCategoryName(categoryName)} items`
        }));
      }

      // Fallback for old format
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  }

  // Helper method to format category names for display
  private formatCategoryName(categoryString: string): string {
    // Map hyphenated category names to proper display names
    const categoryMapping: Record<string, string> = {
      'cleaning-materials': 'Cleaning Materials',
      'office-supplies': 'Office Supplies',
      'Office-supplies': 'Office Supplies', // Handle inconsistent casing
      'electronics': 'Electronics',
      'furniture': 'Furniture',
      'other': 'Other'
    };

    return categoryMapping[categoryString] ||
           categoryString.split('-').map(word =>
             word.charAt(0).toUpperCase() + word.slice(1)
           ).join(' ');
  }

  async getCategoryOptions(): Promise<{ value: string; label: string }[]> {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      const data = await response.json();

      console.log("Categories API response:", data); // Debug log

      // Handle the new API response format and use original database values
      if (data.success && data.categories && Array.isArray(data.categories)) {
        console.log("Processing categories:", data.categories); // Debug log
        return data.categories.map((categoryName: string) => ({
          value: categoryName, // Use original database value
          label: this.formatCategoryName(categoryName), // Use formatted display name
        }));
      }

      console.error("Invalid response format or categories not an array:", data);
      throw new Error("Invalid response format");
    } catch (error) {
      console.error("Error getting category options:", error);

      // Return default categories if API fails
      return [
        { value: "electronics", label: "Electronics" },
        { value: "office-supplies", label: "Office Supplies" },
        { value: "cleaning-materials", label: "Cleaning Materials" },
        { value: "furniture", label: "Furniture" },
        { value: "other", label: "Other" },
      ];
    }
  }

  async getCategoryById(id: string): Promise<Category> {
    try {
      const response = await fetch(`${this.apiUrl}/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch category: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching category with id ${id}:`, error);
      throw error;
    }
  }

  async createCategory(category: Omit<Category, "id">): Promise<Category> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(category),
      });

      if (!response.ok) {
        throw new Error(`Failed to create category: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }

  async updateCategory(
    id: string,
    category: Partial<Omit<Category, "id">>
  ): Promise<Category> {
    try {
      const response = await fetch(`${this.apiUrl}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(category),
      });

      if (!response.ok) {
        throw new Error(`Failed to update category: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error updating category with id ${id}:`, error);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete category: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error deleting category with id ${id}:`, error);
      throw error;
    }
  }
}

export const categoryService = new CategoryService();
export default categoryService;
