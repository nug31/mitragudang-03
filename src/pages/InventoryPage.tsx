import React, { useState, useEffect } from "react";
import { Item } from "../types";
import { useAuth } from "../contexts/AuthContext";
import MainLayout from "../components/layout/MainLayout";
import { Card, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Logo from "../components/ui/Logo";
import {
  Plus,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  ListFilter,
  Search,

  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import InventoryList from "../components/inventory/InventoryList";
import AddItemModal from "../components/inventory/AddItemModal";
import EditItemModal from "../components/inventory/EditItemModal";
import ImportItemsModal from "../components/inventory/ImportItemsModal";
import CategoryManagement from "../components/inventory/CategoryManagement";
import BrowseItemsModal from "../components/inventory/BrowseItemsModal";


import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import * as XLSX from "xlsx";
import { itemService } from "../services/itemService";
import { categoryService } from "../services/categoryService";
import { normalizeCategory, categoriesAreEqual } from "../utils/categoryUtils";
import { API_BASE_URL } from "../config";

const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryOptions, setCategoryOptions] = useState([
    { value: "all", label: "All Categories" },
    { value: "electronics", label: "Electronics" },
    { value: "office-supplies", label: "Office Supplies" },
    { value: "cleaning-materials", label: "Cleaning Materials" },
    { value: "furniture", label: "Furniture" },
    { value: "software", label: "Software" },
    { value: "other", label: "Other" },
  ]);

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "in-stock", label: "In Stock" },
    { value: "low-stock", label: "Low Stock" },
    { value: "out-of-stock", label: "Out of Stock" },
  ];

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  // Function to fetch categories from the database
  const fetchCategories = async () => {
    try {
      // Get category options from the categoryService
      const options = await categoryService.getCategoryOptions();

      // Add the "All Categories" option at the beginning
      const allCategoriesOption = { value: "all", label: "All Categories" };
      setCategoryOptions([allCategoriesOption, ...options]);
    } catch (err) {
      console.error("Error fetching categories:", err);
      // Keep the default categories if there's an error
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      console.log("InventoryPage: Fetching items directly from API...");

      // Direct API call
      const response = await fetch(`${API_BASE_URL}/items`);
      console.log("InventoryPage: Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("InventoryPage: Items received directly from API:", data);

      // Map the data to the expected format
      const formattedItems = data.map((item: any) => {
        // Use the utility function to normalize the category
        const normalizedCategory = normalizeCategory(item.category);

        return {
          id: item.id?.toString() || "0",
          name: item.name || "Unknown Item",
          description: item.description || "",
          category: normalizedCategory,
          quantity: typeof item.quantity === "number" ? item.quantity : 0,
          minQuantity:
            typeof item.minQuantity === "number" ? item.minQuantity : 0,
          status: item.status || "in-stock",
          lastRestocked: item.lastRestocked,
          price: item.price,
        };
      });

      console.log("InventoryPage: Formatted items:", formattedItems);
      setItems(formattedItems);
    } catch (err) {
      console.error("InventoryPage: Error fetching items:", err);
      setError("Failed to load inventory items");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (newItem: Omit<Item, "id" | "status">) => {
    try {
      const response = await itemService.createItem(newItem);
      if (response) {
        // Normalize the item before adding to state (id to string, category normalization)
        const createdItem: Item = {
          ...response,
          id: response.id?.toString() || "0",
          category: normalizeCategory(response.category),
          status: response.status || "in-stock",
          quantity: response.quantity || 0,
          minQuantity: response.minQuantity || 0
        };

        setItems((prev) => [...prev, createdItem]);
        setShowAddModal(false);
      } else {
        setError("Failed to add item");
      }
    } catch (err) {
      console.error("Error adding item:", err);
      setError("Failed to add item");
    }
  };

  const handleImportItems = async (newItems: Omit<Item, "id" | "status">[]) => {
    try {
      setLoading(true);

      // Create items one by one
      const createdItems: Item[] = [];

      for (const item of newItems) {
        try {
          const createdItem = await itemService.createItem(item);
          if (createdItem) {
            createdItems.push(createdItem);
          }
        } catch (itemErr) {
          console.error("Error importing individual item:", itemErr);
          // Continue with other items even if one fails
        }
      }

      if (createdItems.length > 0) {
        setItems((prev) => [...prev, ...createdItems]);
        console.log(
          `Successfully imported ${createdItems.length} out of ${newItems.length} items`
        );
      } else {
        setError("Failed to import any items");
      }
    } catch (err) {
      console.error("Error importing items:", err);
      setError("Failed to import items");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<Item>) => {
    try {
      const updatedItem = await itemService.updateItem(id, updates);
      if (updatedItem) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? updatedItem : item))
        );
        // Removed fetchItems() call to prevent scroll reset
        // Local state is already updated correctly above
      } else {
        setError("Failed to update item");
      }
    } catch (err) {
      console.error("Error updating item:", err);
      setError("Failed to update item");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      const success = await itemService.deleteItem(id);
      if (success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setError(null); // Clear any previous errors
      } else {
        setError("Failed to delete item");
      }
    } catch (err: any) {
      console.error("Error deleting item:", err);
      // Show the specific error message from the server
      const errorMessage = err.message || "Failed to delete item";
      setError(errorMessage);
    }
  };

  const filteredItems = items.filter((item) => {
    // Use the utility function for category comparison
    if (
      categoryFilter !== "all" &&
      !categoriesAreEqual(item.category, categoryFilter)
    )
      return false;

    // Status filter
    if (statusFilter !== "all" && item.status !== statusFilter) return false;

    // Case-insensitive search in name and description
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = item.name?.toLowerCase().includes(searchTermLower);
      const descriptionMatch = item.description
        ?.toLowerCase()
        .includes(searchTermLower);

      if (!nameMatch && !descriptionMatch) {
        return false;
      }
    }

    return true;
  });

  // Define the stock history entry interface (matching database column names)
  interface StockHistoryEntry {
    id: number;
    item_id: number;
    change_type: string;
    quantity_before: number;
    quantity_change: number;
    quantity_after: number;
    notes?: string;
    created_by?: string;
    createdAt: string; // Database uses camelCase
    item_name?: string;
    category?: string;
  }

  const fetchStockHistory = async (): Promise<StockHistoryEntry[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/stock-history`);
      if (!response.ok) {
        throw new Error("Failed to fetch stock history");
      }
      const data = await response.json();
      return data.history || [];
    } catch (err) {
      console.error("Error fetching stock history:", err);
      return [];
    }
  };

  const exportIncomingStockToExcel = async () => {
    try {
      setLoading(true);
      const history = await fetchStockHistory();

      // Filter for incoming stock (positive quantity_change)
      const incomingHistory = history.filter((entry) => entry.quantity_change > 0);

      if (incomingHistory.length === 0) {
        alert("Tidak ada riwayat barang masuk untuk diekspor.");
        return;
      }

      const exportData = incomingHistory.map((entry) => {
        const date = new Date(entry.createdAt);
        const isValidDate = !isNaN(date.getTime());
        return {
          Tanggal: isValidDate ? date.toLocaleDateString("id-ID") : "-",
          Jam: isValidDate ? date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
          "Nama Barang": entry.item_name || `Item #${entry.item_id}`,
          Kategori: entry.category || "-",
          "Perubahan (+)": `+${entry.quantity_change}`,
          "Stok Sebelum": entry.quantity_before,
          "Stok Setelah": entry.quantity_after,
          Catatan: entry.notes || "-",
          "Oleh": entry.created_by || "-",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Barang Masuk");

      const filename = `Barang_Masuk_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error("Error exporting incoming stock:", err);
      setError("Failed to export incoming stock history");
    } finally {
      setLoading(false);
    }
  };

  const exportOutgoingStockToExcel = async () => {
    try {
      setLoading(true);
      const history = await fetchStockHistory();

      // Filter for outgoing stock (negative quantity_change)
      const outgoingHistory = history.filter((entry) => entry.quantity_change < 0);

      if (outgoingHistory.length === 0) {
        alert("Tidak ada riwayat barang keluar untuk diekspor.");
        return;
      }

      const exportData = outgoingHistory.map((entry) => {
        const date = new Date(entry.createdAt);
        const isValidDate = !isNaN(date.getTime());
        return {
          Tanggal: isValidDate ? date.toLocaleDateString("id-ID") : "-",
          Jam: isValidDate ? date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
          "Nama Barang": entry.item_name || `Item #${entry.item_id}`,
          Kategori: entry.category || "-",
          "Perubahan (-)": entry.quantity_change,
          "Stok Sebelum": entry.quantity_before,
          "Stok Setelah": entry.quantity_after,
          Catatan: entry.notes || "-",
          "Oleh": entry.created_by || "-",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Barang Keluar");

      const filename = `Barang_Keluar_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error("Error exporting outgoing stock:", err);
      setError("Failed to export outgoing stock history");
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setCategoryFilter("all");
    setStatusFilter("all");
    setSearchTerm("");
  };



  return (
    <MainLayout>
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center">
            <Logo size={24} className="mr-3" />
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Inventory Management
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage and track your inventory items
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:gap-3">

            <Button
              variant="outline"
              onClick={exportIncomingStockToExcel}
              icon={<ArrowUpCircle className="h-4 w-4 text-green-600" />}
              className="flex-shrink-0 border-green-200 text-green-700 hover:bg-green-50"
              size="sm"
            >
              Barang Masuk (Excel)
            </Button>
            <Button
              variant="outline"
              onClick={exportOutgoingStockToExcel}
              icon={<ArrowDownCircle className="h-4 w-4 text-red-600" />}
              className="flex-shrink-0 border-red-200 text-red-700 hover:bg-red-50"
              size="sm"
            >
              Barang Keluar (Excel)
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowBrowseModal(true)}
              icon={<Search className="h-4 w-4" />}
              className="flex-shrink-0"
              size="sm"
            >
              <span className="hidden sm:inline">Browse Items</span>
              <span className="sm:hidden">Browse</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowImportModal(true)}
              icon={<FileSpreadsheet className="h-4 w-4" />}
              className="flex-shrink-0"
              size="sm"
            >
              <span className="hidden sm:inline">Import Excel</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowCategoryModal(true)}
              icon={<ListFilter className="h-4 w-4" />}
              className="flex-shrink-0"
              size="sm"
            >
              Categories
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
              icon={<Plus className="h-4 w-4" />}
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">Add New Item</span>
              <span className="sm:hidden">Add Item</span>
            </Button>
          </div>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
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

      <InventoryList
        items={filteredItems}
        onUpdate={handleUpdateItem}
        onDelete={handleDeleteItem}
        onEdit={(item) => setEditingItem(item)}

        isLoading={loading}
      />

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddItem}
        />
      )}

      {showImportModal && (
        <ImportItemsModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportItems}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdate={handleUpdateItem}
        />
      )}





      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Manage Categories</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Close
                </Button>
              </div>
              <CategoryManagement onCategoryChange={fetchCategories} />
            </div>
          </div>
        </div>
      )}

      {showBrowseModal && (
        <BrowseItemsModal
          items={items}
          onClose={() => setShowBrowseModal(false)}
          onSelectItem={(item) => {
            setEditingItem(item);
            setShowBrowseModal(false);
          }}
        />
      )}
    </MainLayout>
  );
};

export default InventoryPage;
