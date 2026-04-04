import React, { useState, useEffect } from "react";
import { Plus, Minus, History, RefreshCw, Search } from "lucide-react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";
import { stockService, AvailableItem, StockHistory, StockOperation } from "../../services/stockService";

const StockManagement: React.FC = () => {
    const [items, setItems] = useState<AvailableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Selected item for operation
    const [selectedItem, setSelectedItem] = useState<AvailableItem | null>(null);
    const [quantity, setQuantity] = useState("");
    const [notes, setNotes] = useState("");
    const [operationType, setOperationType] = useState<"in" | "out">("in");
    const [searchTerm, setSearchTerm] = useState("");

    // History view
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<StockHistory[]>([]);

    useEffect(() => {
        fetchAvailableItems();
    }, []);

    const fetchAvailableItems = async () => {
        setLoading(true);
        try {
            const data = await stockService.getAvailableItems();
            setItems(data);
            setError(null);
        } catch (err) {
            console.error("Error fetching items:", err);
            setError("Failed to load inventory items");
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const data = await stockService.getStockHistory(
                selectedItem?.id,
                undefined,
                100
            );
            setHistory(data);
        } catch (err) {
            console.error("Error fetching history:", err);
            setError("Failed to load stock history");
        }
    };

    const handleSelectItem = (item: AvailableItem) => {
        setSelectedItem(item);
        setQuantity("");
        setNotes("");
        setError(null);
        setSuccess(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedItem || !quantity || parseInt(quantity) <= 0) {
            setError("Please select an item and enter a valid quantity");
            return;
        }

        const qty = parseInt(quantity);

        if (operationType === "out" && qty > selectedItem.currentQuantity) {
            setError(
                `Insufficient quantity. Available: ${selectedItem.currentQuantity}, Requested: ${qty}`
            );
            return;
        }

        try {
            setLoading(true);

            const operation: StockOperation = {
                itemId: selectedItem.id,
                quantity: qty,
                notes: notes || undefined,
                unit: selectedItem.unit,
            };

            if (operationType === "in") {
                await stockService.recordStockIn(operation);
                setSuccess(
                    `✅ Stock in recorded: +${qty} ${selectedItem.unit} of ${selectedItem.name}`
                );
            } else {
                await stockService.recordStockOut(operation);
                setSuccess(
                    `✅ Stock out recorded: -${qty} ${selectedItem.unit} of ${selectedItem.name}`
                );
            }

            // Refresh items
            await fetchAvailableItems();

            // Reset form
            setSelectedItem(null);
            setQuantity("");
            setNotes("");
            setError(null);

            // Clear success message after 5 seconds
            setTimeout(() => setSuccess(null), 5000);
        } catch (err: any) {
            console.error("Error recording stock operation:", err);
            setError(err.message || "Failed to record stock operation");
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(
        (item: AvailableItem) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {error && (
                <Alert
                    variant="error"
                    title="Error"
                    onDismiss={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {success && (
                <Alert
                    variant="success"
                    title="Success"
                    onDismiss={() => setSuccess(null)}
                >
                    {success}
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Item Selection */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <h2 className="text-xl font-semibold">Select Item</h2>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <Input
                                    placeholder="Search items..."
                                    value={searchTerm}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                    icon={<Search className="h-4 w-4" />}
                                    className="mb-0"
                                />
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {loading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                        <p className="mt-2 text-gray-600">Loading items...</p>
                                    </div>
                                ) : filteredItems.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No items found</p>
                                ) : (
                                    filteredItems.map((item: AvailableItem) => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectItem(item)}
                                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${selectedItem?.id === item.id
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:border-gray-300"
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        {item.name}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        {item.description}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Category: {item.category}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p
                                                        className={`text-lg font-bold ${item.currentQuantity > item.minQuantity
                                                            ? "text-green-600"
                                                            : item.currentQuantity > 0
                                                                ? "text-yellow-600"
                                                                : "text-red-600"
                                                            }`}
                                                    >
                                                        {item.currentQuantity}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {item.unit}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Operation Form */}
                <div>
                    <Card>
                        <CardHeader>
                            <h2 className="text-xl font-semibold">
                                {operationType === "in" ? "Stock In" : "Stock Out"}
                            </h2>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Operation Type Selection */}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOperationType("in");
                                            setError(null);
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${operationType === "in"
                                            ? "bg-green-600 text-white"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            }`}
                                    >
                                        <Plus className="h-4 w-4" />
                                        In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOperationType("out");
                                            setError(null);
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${operationType === "out"
                                            ? "bg-red-600 text-white"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            }`}
                                    >
                                        <Minus className="h-4 w-4" />
                                        Out
                                    </button>
                                </div>

                                {/* Selected Item Info */}
                                {selectedItem && (
                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <p className="font-semibold text-gray-900">
                                            {selectedItem.name}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Current: {selectedItem.currentQuantity} {selectedItem.unit}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Min: {selectedItem.minQuantity} {selectedItem.unit}
                                        </p>
                                    </div>
                                )}

                                {/* Quantity Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Quantity ({selectedItem?.unit || "unit"})
                                    </label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                                        placeholder="Enter quantity"
                                        className="mb-0"
                                        required
                                    />
                                </div>

                                {/* Notes Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Notes (Optional)
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                                        placeholder="Add notes..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                    />
                                </div>

                                {/* Submit Button */}
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={!selectedItem || !quantity || loading}
                                    className="w-full"
                                >
                                    {loading ? "Processing..." : "Record"}
                                </Button>

                                {/* History Button */}
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => {
                                        if (selectedItem) {
                                            fetchHistory();
                                            setShowHistory(true);
                                        }
                                    }}
                                    icon={<History className="h-4 w-4" />}
                                    className="w-full"
                                    disabled={!selectedItem}
                                >
                                    View History
                                </Button>

                                {/* Refresh Button */}
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={fetchAvailableItems}
                                    icon={<RefreshCw className="h-4 w-4" />}
                                    className="w-full"
                                >
                                    Refresh
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-2xl font-bold">
                                Stock History - {selectedItem?.name}
                            </h2>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            {history.length === 0 ? (
                                <p className="text-center text-gray-600 py-8">No history found</p>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((record: StockHistory) => (
                                        <div
                                            key={record.id}
                                            className={`p-3 border-l-4 rounded ${record.type === "in"
                                                ? "border-green-500 bg-green-50"
                                                : "border-red-500 bg-red-50"
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold">
                                                        <span
                                                            className={
                                                                record.type === "in"
                                                                    ? "text-green-700"
                                                                    : "text-red-700"
                                                            }
                                                        >
                                                            {record.type === "in" ? "+" : "-"}
                                                            {record.quantity}
                                                        </span>{" "}
                                                        {record.unit}
                                                    </p>
                                                    {record.notes && (
                                                        <p className="text-sm text-gray-700 mt-1">
                                                            Notes: {record.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-600">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(record.created_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManagement;
