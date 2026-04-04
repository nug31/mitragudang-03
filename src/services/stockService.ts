import { API_BASE_URL } from "../config";

export interface AvailableItem {
    id: number;
    name: string;
    description: string;
    category: string;
    currentQuantity: number;
    minQuantity: number;
    unit: string;
    status: string;
}

export interface StockOperation {
    id?: number;
    itemId: number;
    quantity: number;
    notes?: string;
    userId?: number;
    unit?: string;
}

export interface StockHistory {
    id: number;
    item_id: number;
    item_name: string;
    type: 'in' | 'out';
    quantity: number;
    unit: string;
    notes: string;
    created_by: number | null;
    created_at: string;
}

export interface StockSummary {
    item_id: number;
    item_name: string;
    unit: string;
    total_in: number;
    total_out: number;
    total_transactions: number;
    last_transaction: string;
}

class StockService {
    private debug(message: string, ...args: any[]) {
        console.log(`StockService: ${message}`, ...args);
    }

    // Get all available items for stock operation
    async getAvailableItems(): Promise<AvailableItem[]> {
        try {
            this.debug("Fetching available items...");
            const response = await fetch(`${API_BASE_URL}/stock/available-items`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            this.debug("Available items received:", result.data);
            return result.data || [];
        } catch (error) {
            console.error("Error fetching available items:", error);
            return [];
        }
    }

    // Get item details for stock operation
    async getItemDetails(itemId: number): Promise<AvailableItem | null> {
        try {
            this.debug(`Fetching item details for ID: ${itemId}`);
            const response = await fetch(`${API_BASE_URL}/stock/item/${itemId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            this.debug("Item details received:", result.data);
            return result.data;
        } catch (error) {
            console.error("Error fetching item details:", error);
            return null;
        }
    }

    // Record stock in (barang masuk)
    async recordStockIn(operation: StockOperation): Promise<any> {
        try {
            this.debug("Recording stock in:", operation);

            const response = await fetch(`${API_BASE_URL}/stock/in`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(operation),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            this.debug("Stock in recorded successfully:", result);
            return result;
        } catch (error) {
            console.error("Error recording stock in:", error);
            throw error;
        }
    }

    // Record stock out (barang keluar)
    async recordStockOut(operation: StockOperation): Promise<any> {
        try {
            this.debug("Recording stock out:", operation);

            const response = await fetch(`${API_BASE_URL}/stock/out`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(operation),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            this.debug("Stock out recorded successfully:", result);
            return result;
        } catch (error) {
            console.error("Error recording stock out:", error);
            throw error;
        }
    }

    // Get stock tracking history
    async getStockHistory(
        itemId?: number,
        type?: 'in' | 'out',
        limit = 50,
        offset = 0
    ): Promise<StockHistory[]> {
        try {
            this.debug("Fetching stock history...");

            const params = new URLSearchParams();
            if (itemId) params.append('itemId', itemId.toString());
            if (type) params.append('type', type);
            params.append('limit', limit.toString());
            params.append('offset', offset.toString());

            const response = await fetch(
                `${API_BASE_URL}/stock/history?${params.toString()}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            this.debug("Stock history received:", result.data);
            return result.data || [];
        } catch (error) {
            console.error("Error fetching stock history:", error);
            return [];
        }
    }

    // Get stock summary
    async getStockSummary(): Promise<StockSummary[]> {
        try {
            this.debug("Fetching stock summary...");

            const response = await fetch(`${API_BASE_URL}/stock/summary`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            this.debug("Stock summary received:", result.data);
            return result.data || [];
        } catch (error) {
            console.error("Error fetching stock summary:", error);
            return [];
        }
    }
}

export const stockService = new StockService();
