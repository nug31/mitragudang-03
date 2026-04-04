import React, { useState, useEffect } from "react";
import { X, Package, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import Button from "../ui/Button";
import { API_BASE_URL } from "../../config";

interface StockHistoryEntry {
    id: number;
    item_id: number;
    change_type: string;
    quantity_before: number;
    quantity_change: number;
    quantity_after: number;
    reference_id?: string;
    notes?: string;
    created_by?: string;
    created_at: string;
    item_name?: string;
    category?: string;
}

interface StockHistoryModalProps {
    itemId?: string; // Made optional
    itemName?: string; // Made optional
    onClose: () => void;
}

const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
    itemId,
    itemName,
    onClose,
}) => {
    const [history, setHistory] = useState<StockHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentQuantity, setCurrentQuantity] = useState(0);
    const [summary, setSummary] = useState({
        current_quantity: 0,
        total_in: 0,
        total_out: 0
    });

    // Determines if we are viewing a single item or all items
    const isSingleItem = !!itemId;

    useEffect(() => {
        fetchHistory();
    }, [itemId]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            let url;

            if (itemId) {
                // Individual item history - use the specific endpoint
                url = `${API_BASE_URL}/stock-history/item/${itemId}`;
            } else {
                // Global history - use Plan B: piggyback on items endpoint
                url = `${API_BASE_URL}/items?include_history=true`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to fetch stock history');
            }

            const data = await response.json();

            if (itemId) {
                setHistory(data.history || []);
                if (data.item) {
                    setSummary({
                        current_quantity: data.item.quantity || 0, // Assuming 'quantity' is the current stock
                        total_in: data.history?.filter((h: StockHistoryEntry) => h.quantity_change > 0)
                            .reduce((sum: number, h: StockHistoryEntry) => sum + h.quantity_change, 0) || 0,
                        total_out: data.history?.filter((h: StockHistoryEntry) => h.quantity_change < 0)
                            .reduce((sum: number, h: StockHistoryEntry) => sum + Math.abs(h.quantity_change), 0) || 0,
                    });
                }
            } else {
                // Handle Plan B response structure: [{...}, ...] for items, or we need to check if history came back attached
                // Actually the backend sends { items: [...], history: [...] } when include_history is true
                // But wait, standard get items returns array. My backend change returns object if include_history is true.

                if (data.history) {
                    setHistory(data.history);
                } else if (Array.isArray(data)) {
                    // Fallback/Safety: If backend ignores param and sends items array, we have no history
                    setHistory([]);
                } else {
                    setHistory([]);
                }
                setSummary({ current_quantity: 0, total_in: 0, total_out: 0 }); // Reset summary for global view
            }
        } catch (error) {
            console.error('Error fetching stock history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getChangeTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            opening: "Stok Awal",
            restock: "Penambahan",
            request: "Permintaan",
            adjustment: "Penyesuaian",
            closing: "Stok Akhir",
        };
        return labels[type] || type;
    };

    const getChangeTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            opening: "bg-blue-100 text-blue-800",
            restock: "bg-green-100 text-green-800",
            request: "bg-orange-100 text-orange-800",
            adjustment: "bg-purple-100 text-purple-800",
            closing: "bg-gray-100 text-gray-800",
        };
        return colors[type] || "bg-gray-100 text-gray-800";
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
                    <div className="flex items-center gap-3">
                        <Package className="h-6 w-6 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {isSingleItem ? "Kartu Stok" : "Riwayat Perubahan Stok"}
                            </h2>
                            {isSingleItem && (
                                <p className="text-blue-100 text-sm">{itemName}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-blue-800 rounded-full p-1"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Summary (Only for Single Item) */}
                {isSingleItem && (
                    <div className="p-4 bg-gray-50 border-b">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-sm text-gray-500">Stok Saat Ini</p>
                                <p className="text-2xl font-bold text-gray-900">{currentQuantity}</p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-sm text-gray-500">Total Masuk</p>
                                <p className="text-2xl font-bold text-green-600">
                                    +{history.filter(h => h.quantity_change > 0).reduce((sum, h) => sum + h.quantity_change, 0)}
                                </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-sm text-gray-500">Total Keluar</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {history.filter(h => h.quantity_change < 0).reduce((sum, h) => sum + h.quantity_change, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* History Table */}
                <div className="overflow-auto max-h-[60vh]">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                            <p>Belum ada riwayat perubahan stok</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                                    {!isSingleItem && (
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barang</th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Masuk</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Keluar</th>
                                    {isSingleItem && (
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saldo</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {history.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                            {formatDate(entry.created_at)}
                                        </td>
                                        {!isSingleItem && (
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                {entry.item_name || "-"}
                                                <div className="text-xs text-gray-500 font-normal">{entry.category || "-"}</div>
                                            </td>
                                        )}
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(entry.change_type)}`}>
                                                {getChangeTypeLabel(entry.change_type)}
                                            </span>
                                            {entry.notes && (
                                                <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {entry.quantity_change > 0 && (
                                                <span className="text-green-600 font-medium flex items-center justify-center gap-1">
                                                    <TrendingUp className="h-4 w-4" />
                                                    +{entry.quantity_change}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {entry.quantity_change < 0 && (
                                                <span className="text-red-600 font-medium flex items-center justify-center gap-1">
                                                    <TrendingDown className="h-4 w-4" />
                                                    {entry.quantity_change}
                                                </span>
                                            )}
                                        </td>
                                        {isSingleItem && (
                                            <td className="px-4 py-3 text-center font-semibold text-gray-900">
                                                {entry.quantity_after}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Tutup
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default StockHistoryModal;
