import React, { useState } from "react";
import { Item, ItemCategory } from "../../types";
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
import { downloadInventoryTemplate } from "../../utils/excelTemplateGenerator";

interface ImportItemsModalProps {
  onClose: () => void;
  onImport: (items: Omit<Item, "id" | "status">[]) => void;
}

const ImportItemsModal: React.FC<ImportItemsModalProps> = ({
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setPreviewData([]);

    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Check if file is Excel
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

      // Get first sheet
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError("The Excel file is empty");
        return;
      }

      // Validate required columns
      const requiredColumns = ["name", "description", "category", "quantity"];
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

      // Show preview (first 5 rows)
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

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Map Excel data to Item format
      const items = jsonData.map((row: any) => {
        // Normalize column names (case insensitive)
        const normalizedRow: any = {};
        Object.keys(row).forEach((key) => {
          const lowerKey = key.toLowerCase();
          normalizedRow[lowerKey] = row[key];
        });

        // Normalize category value
        let category = (normalizedRow.category || "other").toLowerCase();

        // Handle special case for "office supplies" which might be entered in different formats
        if (
          category === "office supplies" ||
          category === "office-supplies" ||
          category === "officesupplies" ||
          category === "office_supplies"
        ) {
          category = "office-supplies";
        }

        // Ensure category is one of the valid ItemCategory values
        if (
          ![
            "electronics",
            "office-supplies",
            "furniture",
            "software",
            "other",
          ].includes(category)
        ) {
          category = "other";
        }

        return {
          name: normalizedRow.name || "",
          description: normalizedRow.description || "",
          category: category as ItemCategory,
          quantity: parseInt(normalizedRow.quantity) || 0,
          minQuantity:
            parseInt(
              normalizedRow.minquantity || normalizedRow.min_quantity || "0"
            ) || 0,
          location: normalizedRow.location || "",
          unit: normalizedRow.unit || "pcs",
          lastRestocked: new Date().toISOString(),
        };
      });

      // Filter out invalid items
      const validItems = items.filter((item) => item.name && item.description);

      if (validItems.length === 0) {
        setError("No valid items found in the Excel file");
        setImporting(false);
        return;
      }

      // Log the items for debugging
      console.log(
        "Importing items with categories:",
        validItems.map((item) => ({
          name: item.name,
          category: item.category,
        }))
      );

      // Call the import function
      onImport(validItems);
      setImportSuccess(true);

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error importing items:", err);
      setError("Failed to import items. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <FileSpreadsheet className="h-6 w-6 text-blue-600 mr-2" />
              Import Items from Excel
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
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Import Successful!
              </h3>
              <p className="text-gray-600">
                Your items have been imported successfully.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-4">
                <p className="text-gray-600">
                  Upload an Excel file (.xlsx or .xls) with your inventory
                  items. The file should have columns for name, description,
                  category, and quantity.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadInventoryTemplate}
                  icon={<Download className="h-4 w-4" />}
                  className="ml-4 whitespace-nowrap flex-shrink-0"
                >
                  Download Template
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
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        Excel files only (.xlsx, .xls)
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
                    Selected file:{" "}
                    <span className="font-medium">{file.name}</span>
                  </p>
                )}
              </div>

              {previewData.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Preview (first 5 rows):
                  </h3>
                  <div className="overflow-x-auto">
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
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!file || importing || previewData.length === 0}
                  loading={importing}
                >
                  Import Items
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportItemsModal;
