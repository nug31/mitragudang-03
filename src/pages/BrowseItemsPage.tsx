import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Item, ItemCategory, ItemRequest } from "../types";
import MainLayout from "../components/layout/MainLayout";
import { Card, CardContent } from "../components/ui/Card";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import {
  Search,
  Filter,
  RefreshCw,
  ShoppingBag,
  Package,
  ShoppingCart,
  Calendar,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { itemService } from "../services/itemService";
import { categoryService } from "../services/categoryService";
import { API_BASE_URL } from "../config";
import Alert from "../components/ui/Alert";
import { Link } from "react-router-dom";
import RequestItemModal from "../components/requests/RequestItemModal";
import BorrowItemModal from "../components/loans/BorrowItemModal";
import { normalizeCategory, categoriesAreEqual } from "../utils/categoryUtils";

const BrowseItemsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedBorrowItem, setSelectedBorrowItem] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    // Fetch items from the API
    fetchItems();
    // Fetch categories from the API
    fetchCategories();
  }, []);

  // Function to fetch categories from the database
  const fetchCategories = async () => {
    try {
      // Directly fetch from API to bypass categoryService issues
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.categories && Array.isArray(data.categories)) {
          // Format categories for display
          const formatCategoryName = (categoryString: string): string => {
            const categoryMapping: Record<string, string> = {
              'cleaning-materials': 'Cleaning Materials',
              'office-supplies': 'Office Supplies',
              'Office-supplies': 'Office Supplies',
              'electronics': 'Electronics',
              'furniture': 'Furniture',
              'other': 'Other'
            };
            return categoryMapping[categoryString] ||
                   categoryString.split('-').map(word =>
                     word.charAt(0).toUpperCase() + word.slice(1)
                   ).join(' ');
          };

          const options = data.categories.map((categoryName: string) => ({
            value: categoryName,
            label: formatCategoryName(categoryName),
          }));

          // Add the "All Categories" option at the beginning
          const allCategoriesOption = { value: "all", label: "All Categories" };
          setCategoryOptions([allCategoriesOption, ...options]);
          console.log("Categories loaded successfully:", options);
        }
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      // Keep the default categories if there's an error
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    setError(null); // Clear any previous errors
    try {
      console.log("BrowseItemsPage: Fetching items from itemService...");

      // Use the itemService which handles environment variables correctly
      const fetchedItems = await itemService.getAllItems();
      console.log("BrowseItemsPage: Items received from itemService:", fetchedItems);

      setItems(fetchedItems);
      // Clear error on successful fetch
      setError(null);
    } catch (err) {
      console.error("BrowseItemsPage: Error fetching items:", err);
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const [categoryOptions, setCategoryOptions] = useState([
    { value: "all", label: "All Categories" },
    { value: "electronics", label: "Electronics" },
    { value: "office-supplies", label: "Office Supplies" },
    { value: "cleaning-materials", label: "Cleaning Materials" },
    { value: "furniture", label: "Furniture" },
    { value: "software", label: "Software" },
    { value: "other", label: "Other" },
  ]);

  const filteredItems = items.filter((item) => {
    // Use the utility function for category comparison
    if (
      categoryFilter !== "all" &&
      !categoriesAreEqual(item.category, categoryFilter)
    )
      return false;

    // Case-insensitive search in name and description
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = item.name.toLowerCase().includes(searchTermLower);
      const descriptionMatch = item.description
        ?.toLowerCase()
        .includes(searchTermLower);

      if (!nameMatch && !descriptionMatch) {
        return false;
      }
    }

    return true;
  });

  const resetFilters = () => {
    setCategoryFilter("all");
    setSearchTerm("");
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <div className="flex items-center">
          <ShoppingBag className="h-6 w-6 text-blue-600 mr-2" />
          <h1 className="text-2xl font-bold text-gray-900">
            Browse Available Items
          </h1>
        </div>
        <p className="mt-1 text-gray-600">
          Browse our catalog of available items
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Error"
          onDismiss={() => setError(null)}
          className="mb-6"
        >
          {error}
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-0"
            />
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categoryOptions}
              className="mb-0"
            />
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              <Filter className="h-4 w-4 inline-block mr-1" />
              <span>{filteredItems.length} items found</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Package className="h-12 w-12 text-gray-400 mx-auto animate-pulse" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Loading items...
          </h3>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Package className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No items found
          </h3>
          <p className="mt-2 text-gray-600">
            Try adjusting your filters to see more results.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="hover:shadow-lg transition-shadow duration-200"
            >
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium text-gray-900">
                      {item.category.charAt(0).toUpperCase() +
                        item.category.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Available Quantity:</span>
                    <span className="font-medium text-gray-900">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span
                      className={`font-medium ${
                        item.status === "in-stock"
                          ? "text-green-600"
                          : item.status === "low-stock"
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {item.status
                        .split("-")
                        .map(
                          (word) => word.charAt(0).toUpperCase() + word.slice(1)
                        )
                        .join(" ")}
                    </span>
                  </div>
                </div>

                {isAuthenticated &&
                  item.status !== "out-of-stock" &&
                  item.quantity > 0 && (
                    <div className="mt-4">
                      {item.category.toLowerCase() === 'electronics' ? (
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => setSelectedBorrowItem(item)}
                          icon={<Calendar className="h-4 w-4" />}
                        >
                          Borrow
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => setSelectedItem(item)}
                          icon={<ShoppingCart className="h-4 w-4" />}
                        >
                          Request
                        </Button>
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selectedItem && (
        <RequestItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={(request: ItemRequest) => {
            console.log("Request created:", request);
            // The RequestItemModal will handle navigation automatically
            // No additional logic needed here since modal handles the redirect
          }}
        />
      )}
      {selectedBorrowItem && (
        <BorrowItemModal
          item={selectedBorrowItem}
          onClose={() => setSelectedBorrowItem(null)}
          onSuccess={() => {
            console.log("Item borrowed successfully");
            setSelectedBorrowItem(null);
            // Optionally refresh items or show success message
          }}
        />
      )}
    </MainLayout>
  );
};

export default BrowseItemsPage;
