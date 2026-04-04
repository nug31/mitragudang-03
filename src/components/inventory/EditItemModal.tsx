import React, { useState, useEffect } from "react";
import { Item, ItemCategory } from "../../types";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import Button from "../ui/Button";
import { X } from "lucide-react";
import { categoryService } from "../../services/categoryService";

interface EditItemModalProps {
  item: Item;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  onClose,
  onUpdate,
}) => {
  const [formData, setFormData] = useState<Omit<Item, "id" | "status">>({
    name: item.name,
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    lastRestocked: item.lastRestocked,
    unit: item.unit || "pcs", // Default to item's unit or 'pcs'
  });

  const [loading, setLoading] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState([
    { value: "electronics", label: "Electronics" },
    { value: "office-supplies", label: "Office Supplies" },
    { value: "cleaning-materials", label: "Cleaning Materials" },
    { value: "furniture", label: "Furniture" },
    { value: "software", label: "Software" },
    { value: "other", label: "Other" },
  ]);

  const unitOptions = [
    { value: "pcs", label: "Pieces (pcs)" },
    { value: "rim", label: "Rim" },
    { value: "box", label: "Box" },
    { value: "pack", label: "Pack" },
  ];

  // Function to fetch categories from the database
  const fetchCategories = async () => {
    try {
      const options = await categoryService.getCategoryOptions();
      setCategoryOptions(options);
    } catch (error) {
      console.error("Error fetching category options:", error);
    }
  };

  // Fetch categories when the component mounts
  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Only send fields that have changed
      const updates: Partial<Item> = {};

      if (formData.name !== item.name) updates.name = formData.name;
      if (formData.description !== item.description)
        updates.description = formData.description;
      if (formData.category !== item.category)
        updates.category = formData.category;
      if (formData.quantity !== item.quantity)
        updates.quantity = formData.quantity;
      if (formData.minQuantity !== item.minQuantity)
        updates.minQuantity = formData.minQuantity;
      if (formData.unit !== item.unit)
        updates.unit = formData.unit;

      // If quantity changed, update lastRestocked
      if (formData.quantity !== item.quantity) {
        updates.lastRestocked = new Date().toISOString();
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await onUpdate(item.id, updates);
      }

      onClose();
    } catch (error) {
      console.error("Error updating item:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Edit Item</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label="Item Name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />

          <Select
            label="Category"
            value={formData.category}
            onChange={(e) =>
              setFormData({
                ...formData,
                category: e.target.value as ItemCategory,
              })
            }
            options={categoryOptions}
            required
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Quantity"
              type="number"
              min="0"
              value={formData.quantity.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value) || 0,
                })
              }
              required
            />

            <Select
              label="Unit"
              value={formData.unit}
              onChange={(e) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              options={unitOptions}
              required
            />

            <Input
              label="Min Quantity"
              type="number"
              min="0"
              value={formData.minQuantity.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({
                  ...formData,
                  minQuantity: parseInt(e.target.value) || 0,
                })
              }
              required
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditItemModal;
