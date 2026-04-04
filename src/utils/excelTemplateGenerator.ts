import * as XLSX from "xlsx";
import { ItemRequest } from "../types";

/**
 * Generates an Excel template file for importing inventory items
 * @returns Blob of the Excel file
 */
export const generateInventoryTemplate = (): Blob => {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Sample data with column headers and example rows
  const data = [
    {
      name: "Laptop Dell XPS 13",
      description: "High-performance laptop with 16GB RAM and 512GB SSD",
      category: "electronics",
      quantity: 10,
      minQuantity: 2,
      location: "Main Storage",
    },
    {
      name: "Office Chair",
      description: "Ergonomic office chair with adjustable height",
      category: "furniture",
      quantity: 5,
      minQuantity: 1,
      location: "Office Room",
    },
    {
      name: "Stapler",
      description: "Standard desktop stapler with 20-sheet capacity",
      category: "office-supplies",
      quantity: 15,
      minQuantity: 3,
      location: "Supply Closet",
    },
  ];

  // Create a worksheet from the data
  const ws = XLSX.utils.json_to_sheet(data);

  // Add column width information
  const colWidths = [
    { wch: 20 }, // name
    { wch: 40 }, // description
    { wch: 15 }, // category
    { wch: 10 }, // quantity
    { wch: 12 }, // minQuantity
    { wch: 15 }, // location
  ];

  ws["!cols"] = colWidths;

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, "Inventory Template");

  // Generate Excel file as a blob
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

/**
 * Triggers a download of the inventory template Excel file
 */
export const downloadInventoryTemplate = (): void => {
  const blob = generateInventoryTemplate();
  const url = URL.createObjectURL(blob);

  // Create a temporary link element and trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory_template.xlsx";
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generates an Excel template file for bulk stock operations (In/Out)
 * @param type 'in' or 'out'
 * @returns Blob of the Excel file
 */
export const generateStockTemplate = (type: 'in' | 'out'): Blob => {
  const wb = XLSX.utils.book_new();

  // Header row and sample data
  const data = [
    {
      itemId: 1,
      name: "Sample Item (For Reference Only)",
      quantity: 10,
      notes: "Initial stock"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(data);

  // Add column widths
  ws["!cols"] = [
    { wch: 10 }, // itemId
    { wch: 30 }, // name
    { wch: 10 }, // quantity
    { wch: 30 }, // notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Stock ${type.toUpperCase()} Template`);

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

/**
 * Triggers a download of the stock template Excel file
 * @param type 'in' or 'out'
 */
export const downloadStockTemplate = (type: 'in' | 'out'): void => {
  const blob = generateStockTemplate(type);
  const url = URL.createObjectURL(blob);
  const filename = type === 'in' ? 'barang_masuk_template.xlsx' : 'barang_keluar_template.xlsx';

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports requests data to Excel file
 * @param requests Array of ItemRequest objects
 * @param filename Optional filename for the export
 * @returns Blob of the Excel file
 */
export const exportRequestsToExcel = (
  requests: ItemRequest[],
  filename: string = "requests_export.xlsx"
): Blob => {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Format the requests data for Excel - sesuai format di gambar
  const excelData = requests.map((request, index) => {
    const req = request as any;

    // Ambil stok dari items jika tersedia (untuk request dengan multi-item)
    const firstItem = req.items && req.items.length > 0 ? req.items[0] : null;
    const stockBefore = firstItem?.stock_before ?? req.stock_before ?? "";
    const stockAfter  = firstItem?.stock_after  ?? req.stock_after  ?? "";

    // Requester name: prioritize requester_name from API response
    const requesterName =
      req.requester_name ||
      request.requesterName ||
      `User ${request.userId}`;

    return {
      "No.": index + 1,
      "ID": request.id,
      "Item Name": request.itemName || req.project_name || "-",
      "Quantity": request.quantity,
      "Stock Sebelum": stockBefore,
      "Stock Sesudah": stockAfter,
      "Priority":
        request.priority.charAt(0).toUpperCase() + request.priority.slice(1),
      "Status":
        request.status.charAt(0).toUpperCase() + request.status.slice(1),
      "Requester": requesterName,
      "Email": request.requesterEmail || req.requester_email || "",
      "Project": request.projectName || req.project_name || "",
      "Description": req.reason || request.description || "",
      "Requested Delivery": request.requestedDeliveryDate
        ? new Date(request.requestedDeliveryDate).toLocaleDateString()
        : "",
      "Created Date": request.createdAt
        ? new Date(request.createdAt).toLocaleString('id-ID')
        : "",
      "Updated Date": request.updatedAt
        ? new Date(request.updatedAt).toLocaleString('id-ID')
        : "",
    };
  });

  // Create a worksheet from the data
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths sesuai konten
  ws["!cols"] = [
    { wch: 5 },  // No.
    { wch: 36 }, // ID
    { wch: 28 }, // Item Name
    { wch: 10 }, // Quantity
    { wch: 14 }, // Stock Sebelum
    { wch: 13 }, // Stock Sesudah
    { wch: 10 }, // Priority
    { wch: 12 }, // Status
    { wch: 22 }, // Requester
    { wch: 30 }, // Email
    { wch: 22 }, // Project
    { wch: 40 }, // Description
    { wch: 15 }, // Requested Delivery
    { wch: 20 }, // Created Date
    { wch: 20 }, // Updated Date
  ];

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, "Requests");

  // Generate Excel file as a blob
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

/**
 * Triggers a download of the requests Excel file
 * @param requests Array of ItemRequest objects
 * @param filename Optional filename for the export
 */
export const downloadRequestsExcel = (
  requests: ItemRequest[],
  filename: string = "requests_export.xlsx"
): void => {
  const blob = exportRequestsToExcel(requests, filename);
  const url = URL.createObjectURL(blob);

  // Create a temporary link element and trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports monthly report data to Excel file with summary and detailed sheets
 * @param requests Array of ItemRequest objects for the month
 * @param summary Monthly report summary statistics
 * @param year Year of the report
 * @param month Month of the report
 * @param filename Optional filename for the export
 * @returns Blob of the Excel file
 */
export const exportMonthlyReportToExcel = (
  requests: ItemRequest[],
  summary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    completedRequests: number;
    highPriorityRequests: number;
    mediumPriorityRequests: number;
    lowPriorityRequests: number;
    totalItemsRequested: number;
    mostRequestedItems: Array<{ name: string; count: number }>;
    topRequesters: Array<{ name: string; count: number }>;
  },
  year: number,
  month: number,
  filename?: string
): Blob => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  // Create summary sheet
  const summaryData = [
    { "Metric": "Period", "Value": `${monthName} ${year}` },
    { "Metric": "", "Value": "" },
    { "Metric": "REQUEST STATISTICS", "Value": "" },
    { "Metric": "Total Requests", "Value": summary.totalRequests },
    { "Metric": "Pending Requests", "Value": summary.pendingRequests },
    { "Metric": "Approved Requests", "Value": summary.approvedRequests },
    { "Metric": "Rejected Requests", "Value": summary.rejectedRequests },
    { "Metric": "Completed Requests", "Value": summary.completedRequests },
    { "Metric": "", "Value": "" },
    { "Metric": "PRIORITY BREAKDOWN", "Value": "" },
    { "Metric": "High Priority", "Value": summary.highPriorityRequests },
    { "Metric": "Medium Priority", "Value": summary.mediumPriorityRequests },
    { "Metric": "Low Priority", "Value": summary.lowPriorityRequests },
    { "Metric": "", "Value": "" },
    { "Metric": "ITEM STATISTICS", "Value": "" },
    { "Metric": "Total Items Requested", "Value": summary.totalItemsRequested },
  ];

  // Add most requested items
  if (summary.mostRequestedItems.length > 0) {
    summaryData.push({ "Metric": "", "Value": "" });
    summaryData.push({ "Metric": "MOST REQUESTED ITEMS", "Value": "" });
    summary.mostRequestedItems.forEach((item, index) => {
      summaryData.push({ "Metric": `${index + 1}. ${item.name}`, "Value": item.count });
    });
  }

  // Add top requesters
  if (summary.topRequesters.length > 0) {
    summaryData.push({ "Metric": "", "Value": "" });
    summaryData.push({ "Metric": "TOP REQUESTERS", "Value": "" });
    summary.topRequesters.forEach((requester, index) => {
      summaryData.push({ "Metric": `${index + 1}. ${requester.name}`, "Value": requester.count });
    });
  }

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs["!cols"] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // Create detailed requests sheet
  const detailData = requests.map((request, index) => {
    const req = request as any;
    const firstItem = req.items && req.items.length > 0 ? req.items[0] : null;
    const stockBefore = firstItem?.stock_before ?? req.stock_before ?? "";
    const stockAfter  = firstItem?.stock_after  ?? req.stock_after  ?? "";
    const requesterName = req.requester_name || request.requesterName || `User ${request.userId}`;
    return {
      "No.": index + 1,
      "ID": request.id,
      "Item Name": request.itemName || req.project_name || "-",
      "Quantity": request.quantity,
      "Stock Sebelum": stockBefore,
      "Stock Sesudah": stockAfter,
      "Priority": request.priority.charAt(0).toUpperCase() + request.priority.slice(1),
      "Status": request.status.charAt(0).toUpperCase() + request.status.slice(1),
      "Requester": requesterName,
      "Email": request.requesterEmail || req.requester_email || "",
      "Project": request.projectName || req.project_name || "",
      "Description": req.reason || request.description || "",
      "Requested Delivery": request.requestedDeliveryDate
        ? new Date(request.requestedDeliveryDate).toLocaleDateString()
        : "",
      "Created Date": request.createdAt
        ? new Date(request.createdAt).toLocaleString('id-ID')
        : "",
      "Updated Date": request.updatedAt
        ? new Date(request.updatedAt).toLocaleString('id-ID')
        : "",
    };
  });

  const detailWs = XLSX.utils.json_to_sheet(detailData);
  detailWs["!cols"] = [
    { wch: 5 },  // No.
    { wch: 36 }, // ID
    { wch: 28 }, // Item Name
    { wch: 10 }, // Quantity
    { wch: 14 }, // Stock Sebelum
    { wch: 13 }, // Stock Sesudah
    { wch: 10 }, // Priority
    { wch: 12 }, // Status
    { wch: 22 }, // Requester
    { wch: 30 }, // Email
    { wch: 22 }, // Project
    { wch: 40 }, // Description
    { wch: 15 }, // Requested Delivery
    { wch: 20 }, // Created Date
    { wch: 20 }, // Updated Date
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, "Detailed Requests");

  // Generate Excel file as a blob
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

/**
 * Triggers a download of the monthly report Excel file
 * @param requests Array of ItemRequest objects for the month
 * @param summary Monthly report summary statistics
 * @param year Year of the report
 * @param month Month of the report
 * @param filename Optional filename for the export
 */
export const downloadMonthlyReportExcel = (
  requests: ItemRequest[],
  summary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    completedRequests: number;
    highPriorityRequests: number;
    mediumPriorityRequests: number;
    lowPriorityRequests: number;
    totalItemsRequested: number;
    mostRequestedItems: Array<{ name: string; count: number }>;
    topRequesters: Array<{ name: string; count: number }>;
  },
  year: number,
  month: number,
  filename?: string
): void => {
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const defaultFilename = `monthly_report_${monthName.toLowerCase()}_${year}.xlsx`;
  const finalFilename = filename || defaultFilename;

  const blob = exportMonthlyReportToExcel(requests, summary, year, month, finalFilename);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
