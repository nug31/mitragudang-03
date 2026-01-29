import React from "react";
import { Item } from "../../types";
import { Card, CardContent } from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { Edit, Trash2, Package, AlertTriangle } from "lucide-react";

interface InventoryListProps {
  items: Item[];
  onUpdate: (id: string, updates: Partial<Item>) => void;
  onDelete: (id: string) => void;
  onEdit: (item: Item) => void;

  isLoading?: boolean;
}

const InventoryList: React.FC<InventoryListProps> = ({
  items,
  onUpdate,
  onDelete,
  onEdit,

  isLoading = false,
}) => {
  const getStatusBadge = (status: Item["status"]) => {
    switch (status) {
      case "in-stock":
        return <Badge variant="success">In Stock</Badge>;
      case "low-stock":
        return <Badge variant="warning">Low Stock</Badge>;
      case "out-of-stock":
        return <Badge variant="danger">Out of Stock</Badge>;
      default:
        return null;
    }
  };

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity >= 0) {
      onUpdate(id, { quantity: newQuantity });
    }
  };

  const handleMinQuantityChange = (id: string, newMinQuantity: number) => {
    if (newMinQuantity >= 0) {
      onUpdate(id, { minQuantity: newMinQuantity });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-gray-600">Loading inventory...</p>
      </div>
    );
  }

  // Debug information
  console.log("InventoryList received items:", items);

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
        <Package className="h-12 w-12 text-gray-400 mx-auto" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          No items found
        </h3>
        <p className="mt-2 text-gray-600">
          Start by adding some items to your inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((item) => (
        <Card
          key={item.id}
          className="hover:shadow-md transition-shadow duration-200"
        >
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {item.name}
                  </h3>
                  {getStatusBadge(item.status)}
                </div>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.description}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 lg:flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item)}
                  icon={<Edit className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  Edit
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(item.id)}
                  icon={<Trash2 className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  Delete
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Category</p>
                <p className="text-base font-semibold text-gray-900 capitalize">
                  {(item.category || "").replace("-", " ")}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">
                  Current Quantity
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity - 1)
                    }
                    disabled={item.quantity <= 0}
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleQuantityChange(
                        item.id,
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-20 text-center font-semibold text-lg"
                    min="0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity + 1)
                    }
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    +
                  </Button>
                </div>
                <div className="mt-2 text-center text-sm font-medium text-gray-600">
                  Unit: {item.unit || 'pcs'}
                </div>
                {item.quantity <= item.minQuantity && (
                  <div className="mt-2 flex items-center justify-center text-amber-600 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    <span>Low stock</span>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">
                  Min. Quantity
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleMinQuantityChange(item.id, item.minQuantity - 1)
                    }
                    disabled={item.minQuantity <= 0}
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={item.minQuantity}
                    onChange={(e) =>
                      handleMinQuantityChange(
                        item.id,
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-20 text-center font-semibold text-lg"
                    min="0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleMinQuantityChange(item.id, item.minQuantity + 1)
                    }
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {item.lastRestocked && (
              <p className="mt-4 text-xs text-gray-500">
                Last restocked:{" "}
                {new Date(item.lastRestocked).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "Asia/Jakarta"
                })}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default InventoryList;
