import React, { useState } from "react";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import {
    X,
    Upload,
    FileSpreadsheet,
    Check,
    AlertCircle,
    Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { downloadStockTemplate } from "../../utils/excelTemplateGenerator";
import { stockService, StockOperation } from "../../services/stockService";

interface ImportStockModalProps {
    type: "in" | "out";
    onClose: () => void;
    onSuccess: () => void;
}

const ImportStockModal: React.FC<ImportStockModalProps> = ({
    type,
    onClose,
    onSuccess,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [operationCount, setOperationCount] = useState(0);

    const title = type === "in" ? "Barang Masuk (Excel)" : "Barang Keluar (Excel)";
    const colorClass = type === "in" ? "text-green-600" : "text-red-600";
    const iconColor = type === "in" ? "bg-green-100" : "bg-red-100";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        setPreviewData([]);

        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            if (
                !selectedFile.name.endsWith(".xlsx") &&
                !selectedFile.name.endsWith(".xls")
            ) {
                setError("Please select an Excel file (.xlsx or .xls)");
                return;
            }

            setFile(selectedFile);
            parseExcel(selectedFile);
        }
    };

    const parseExcel = async (file: File) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                setError("The Excel file is empty");
                return;
            }

            // Validate required columns
            const requiredColumns = ["itemId", "quantity"];
            const firstRow = jsonData[0] as any;

            const missingColumns = requiredColumns.filter(
                (col) =>
                    !Object.keys(firstRow).some(
                        (key) => key.toLowerCase() === col.toLowerCase()
                    )
            );

            if (missingColumns.length > 0) {
                setError(`Missing required columns: ${missingColumns.join(", ")}`);
                return;
            }

            setPreviewData(jsonData.slice(0, 5));
        } catch (err) {
            console.error("Error parsing Excel file:", err);
            setError("Failed to parse Excel file. Please check the file format.");
        }
    };

    const handleImport = async () => {
        if (!file) return;

        try {
            setImporting(true);
            setError(null);

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const operations: StockOperation[] = jsonData.map((row: any) => {
                const normalizedRow: any = {};
                Object.keys(row).forEach((key) => {
                    normalizedRow[key.toLowerCase()] = row[key];
                });

                return {
                    itemId: parseInt(normalizedRow.itemid),
                    quantity: parseInt(normalizedRow.quantity),
                    notes: normalizedRow.notes || `Bulk ${type} via Excel`,
                };
            });

            const validOperations = operations.filter(
                (op) => !isNaN(op.itemId) && !isNaN(op.quantity) && op.quantity > 0
            );

            if (validOperations.length === 0) {
                setError("No valid operations found in the Excel file");
                setImporting(false);
                return;
            }

            // Perform bulk updates
            let successCount = 0;
            for (const op of validOperations) {
                try {
                    if (type === "in") {
                        await stockService.recordStockIn(op);
                    } else {
                        await stockService.recordStockOut(op);
                    }
                    successCount++;
                } catch (opErr) {
                    console.error(`Error processing itemId ${op.itemId}:`, opErr);
                }
            }

            if (successCount > 0) {
                setOperationCount(successCount);
                setImportSuccess(true);
                onSuccess();
                setTimeout(() => onClose(), 2000);
            } else {
                setError("Failed to process any stock operations. Please check item IDs and availability.");
            }
        } catch (err) {
            console.error("Error importing stock:", err);
            setError("Failed to import stock. Please try again.");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className={`text-xl font-semibold flex items-center ${colorClass}`}>
                            <FileSpreadsheet className="h-6 w-6 mr-2" />
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {importSuccess ? (
                        <div className="text-center py-8">
                            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${iconColor}`}>
                                <Check className={`h-8 w-8 ${colorClass}`} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Update Berhasil!
                            </h3>
                            <p className="text-gray-600">
                                Berhasil memproses {operationCount} data {type === "in" ? "masuk" : "keluar"}.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-gray-600 text-sm">
                                    Unggah file Excel (.xlsx atau .xls) untuk memperbarui stok secara massal.
                                    Kolom yang dibutuhkan: <strong>itemId</strong>, <strong>quantity</strong>.
                                    Kolom <strong>notes</strong> opsional.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadStockTemplate(type)}
                                    icon={<Download className="h-4 w-4" />}
                                    className="ml-4 whitespace-nowrap flex-shrink-0"
                                >
                                    Template
                                </Button>
                            </div>

                            {error && (
                                <Alert
                                    variant="error"
                                    title="Import Error"
                                    icon={<AlertCircle className="h-5 w-5" />}
                                    className="mb-4"
                                >
                                    {error}
                                </Alert>
                            )}

                            <div className="mb-6">
                                <div className="flex items-center justify-center w-full">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="w-8 h-8 mb-3 text-gray-500" />
                                            <p className="mb-2 text-sm text-gray-500">
                                                <span className="font-semibold">Klik untuk unggah</span> atau seret file
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Excel (.xlsx, .xls)
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".xlsx,.xls"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                </div>
                                {file && (
                                    <p className="mt-2 text-sm text-gray-600">
                                        File terpilih: <span className="font-medium">{file.name}</span>
                                    </p>
                                )}
                            </div>

                            {previewData.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                                        Pratinjau (5 baris pertama):
                                    </h3>
                                    <div className="overflow-x-auto border rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {Object.keys(previewData[0]).map((key) => (
                                                        <th
                                                            key={key}
                                                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                        >
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {previewData.map((row, index) => (
                                                    <tr key={index}>
                                                        {Object.values(row).map((value: any, i) => (
                                                            <td
                                                                key={i}
                                                                className="px-3 py-2 whitespace-nowrap text-sm text-gray-500"
                                                            >
                                                                {value?.toString() || ""}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end space-x-3">
                                <Button variant="outline" onClick={onClose}>
                                    Batal
                                </Button>
                                <Button
                                    variant={type === "in" ? "success" : "danger"}
                                    onClick={handleImport}
                                    disabled={!file || importing || previewData.length === 0}
                                    isLoading={importing}
                                >
                                    Proses {type === "in" ? "Masuk" : "Keluar"}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportStockModal;
