import { ItemRequest, RequestPriority, RequestStatus } from "../types";
import { itemService } from "./itemService";
import { validateItemId } from "../utils/itemUtils";
import { authService } from "../utils/auth";
import { API_BASE_URL } from "../config";

// API base URL - use config for environment-specific URLs
const API_URL = API_BASE_URL;

class RequestService {
  async getAllRequests(): Promise<ItemRequest[]> {
    try {
      console.log("Fetching all requests from API...");
      console.log("API URL:", `${API_URL}/requests`);

      const response = await fetch(`${API_URL}/requests`);
      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const requests = await response.json();
      console.log(`Received ${requests.length} requests from API:`, requests);

      // Map the API response to our ItemRequest type
      const mappedRequests = this.mapApiRequestsToItemRequests(requests);
      console.log("Mapped requests:", mappedRequests);

      return mappedRequests;
    } catch (error) {
      console.error("Error fetching requests:", error);
      return [];
    }
  }

  async getUserRequests(userId: string): Promise<ItemRequest[]> {
    try {
      console.log(`Fetching requests for user ${userId} from API...`);
      const response = await fetch(`${API_URL}/requests/user/${userId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const requests = await response.json();
      console.log(
        `Received ${requests.length} requests for user ${userId} from API`
      );

      // Map the API response to our ItemRequest type
      return this.mapApiRequestsToItemRequests(requests);
    } catch (error) {
      console.error(`Error fetching requests for user ${userId}:`, error);
      return [];
    }
  }

  async getRequestById(id: string): Promise<ItemRequest | undefined> {
    try {
      console.log(`Fetching request ${id} from API...`);
      console.log(`API URL: ${API_URL}/requests/${id}`);

      // Add cache-busting parameter to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`${API_URL}/requests/${id}?_t=${cacheBuster}`);
      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Request not found");
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const request = await response.json();
      console.log(`Received request ${id} from API:`, request);

      // Map the API response to our ItemRequest type
      const mappedRequest = this.mapApiRequestToItemRequest(request);
      console.log(`Mapped request:`, mappedRequest);

      return mappedRequest;
    } catch (error) {
      console.error(`Error fetching request ${id}:`, error);
      throw error;
    }
  }

  async getRequestByName(name: string): Promise<ItemRequest | undefined> {
    try {
      console.log(`Finding request with name "${name}"...`);

      // Get all requests and find the one matching the name
      const allRequests = await this.getAllRequests();
      console.log("All requests:", allRequests);

      // First try to find an exact match
      let request = allRequests.find(
        (req) => req.itemName.toLowerCase() === name.toLowerCase()
      );

      // If no exact match, try a partial match
      if (!request) {
        console.log(
          `No exact match found for "${name}", trying partial match...`
        );
        request = allRequests.find((req) =>
          req.itemName.toLowerCase().includes(name.toLowerCase())
        );
      }

      // If still no match, try matching by ID (in case name is actually an ID)
      if (!request) {
        console.log(`No partial match found for "${name}", trying ID match...`);
        request = allRequests.find((req) => req.id === name);
      }

      if (!request) {
        console.log(
          `No match found for "${name}" in ${allRequests.length} requests`
        );
        throw new Error("Request not found");
      }

      console.log(`Found request with name "${name}":`, request);
      return request;
    } catch (error) {
      console.error(`Error finding request with name "${name}":`, error);
      throw error;
    }
  }

  // Helper method to map API response to our ItemRequest type
  private mapApiRequestsToItemRequests(apiRequests: any[]): ItemRequest[] {
    return apiRequests.map((request) =>
      this.mapApiRequestToItemRequest(request)
    );
  }

  private mapApiRequestToItemRequest(apiRequest: any): ItemRequest {
    console.log("Mapping API request to ItemRequest:", apiRequest);

    // Get the first item from the request items array
    const firstItem =
      apiRequest.items && apiRequest.items.length > 0
        ? apiRequest.items[0]
        : null;

    console.log("First item:", firstItem);

    // Get the current user
    const currentUser = authService.getUser();
    console.log("Current user:", currentUser);

    const mappedRequest = {
      id: apiRequest.id,
      userId: apiRequest.requester_id,
      itemId: firstItem ? firstItem.item_id.toString() : "",
      itemName: firstItem ? firstItem.name : apiRequest.project_name,
      quantity: firstItem ? firstItem.quantity : 1,
      priority: apiRequest.priority as RequestPriority,
      status: this.mapApiStatusToRequestStatus(apiRequest.status),
      description: apiRequest.reason || "",
      requestedDeliveryDate: apiRequest.due_date || "",
      createdAt: apiRequest.created_at || apiRequest.createdAt || apiRequest.createdDate || new Date().toISOString(),
      updatedAt: apiRequest.updated_at || apiRequest.updatedAt || apiRequest.updatedDate || new Date().toISOString(),
      // Additional fields from API
      projectName: apiRequest.project_name,
      // Use the requester_name from the API response, or the username from the current user
      requesterName:
        apiRequest.requester_name ||
        currentUser?.username ||
        `User ${apiRequest.requester_id}`,
      // Use the requester_email from the API response - no fallback to fake email
      requesterEmail:
        apiRequest.requester_email ||
        currentUser?.email ||
        "",
      items: apiRequest.items,
    };

    console.log("Mapped request:", mappedRequest);
    return mappedRequest;
  }

  // Map API status values to our RequestStatus type
  private mapApiStatusToRequestStatus(apiStatus: string): RequestStatus {
    const statusMap: Record<string, RequestStatus> = {
      pending: "pending",
      approved: "approved",
      denied: "rejected",
      fulfilled: "completed",
      out_of_stock: "rejected",
    };

    return statusMap[apiStatus] || "pending";
  }

  async createRequest(
    requestData: Omit<ItemRequest, "id" | "createdAt" | "updatedAt">
  ): Promise<ItemRequest> {
    try {
      console.log("Creating new request via API...");
      console.log("Request data:", requestData);

      // Validate the item ID using our utility function
      const itemIdValue = validateItemId(requestData.itemId);
      if (itemIdValue === null) {
        console.error("Invalid item ID:", requestData.itemId);
        throw new Error(`Invalid item ID: ${requestData.itemId}`);
      }

      // Ensure we have a valid requester_id (must exist in the users table)
      // Use a fallback ID if the provided one is invalid
      let requesterId = requestData.userId;

      // If the user ID doesn't look valid, use a known valid ID from the database
      if (
        !requesterId ||
        requesterId === "undefined" ||
        requesterId === "null"
      ) {
        console.warn("Invalid requester_id, using fallback ID:", requesterId);
        // Use a known valid user ID from the database (ID 1 is usually the admin)
        requesterId = "1";
      }

      console.log("Using requester_id:", requesterId);

      // Get the requester name from the request data or use a fallback
      const requesterName = requestData.requesterName || "Unknown User";
      console.log("Using requester name:", requesterName);

      // Transform the request data to match the API's expected format
      const apiRequestData = {
        project_name: requestData.projectName || requestData.itemName,
        requester_id: requesterId,
        // Pass the requester name to be stored in the database
        requester_name: requesterName,
        reason: requestData.description,
        priority: requestData.priority,
        due_date: requestData.requestedDeliveryDate,
        items: [
          {
            item_id: itemIdValue,
            quantity: requestData.quantity,
          },
        ],
      };

      // Log the item_id conversion for debugging
      console.log(
        "Original itemId:",
        requestData.itemId,
        "Type:",
        typeof requestData.itemId
      );
      console.log(
        "Converted item_id:",
        apiRequestData.items[0].item_id,
        "Type:",
        typeof apiRequestData.items[0].item_id
      );

      console.log("API request data:", apiRequestData);

      const response = await fetch(`${API_URL}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiRequestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage =
            errorData.message || `HTTP error! Status: ${response.status}`;
          console.error("Error response data:", errorData);
        } catch (e) {
          errorMessage = `HTTP error! Status: ${response.status}, Response: ${errorText}`;
          console.error("Error response (not JSON):", errorText);
        }
        throw new Error(errorMessage);
      }

      const createdRequest = await response.json();
      console.log("Created request:", createdRequest);

      // Map the API response to our ItemRequest type
      return this.mapApiRequestToItemRequest(createdRequest);
    } catch (error) {
      console.error("Error creating request:", error);
      throw error;
    }
  }

  async updateRequest(
    id: string,
    updates: Partial<ItemRequest>
  ): Promise<ItemRequest> {
    try {
      console.log(`Updating request ${id} via API...`);
      console.log("Updates:", updates);

      // If only updating status, we could use updateRequestStatus, 
      // but our new general PATCH /api/requests/:id also handles it.
      // However, the status update has special logic (stock deduction), 
      // so we should be careful. 
      // If status is present, let's use the dedicated status endpoint for safety 
      // unless we want to allow updating both at once.
      if (updates.status && Object.keys(updates).length === 1) {
        return this.updateRequestStatus(id, updates.status);
      }

      const response = await fetch(`${API_URL}/requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error updating request: ${errorText}`);
      }

      // Get the updated request
      return this.getRequestById(id) as Promise<ItemRequest>;
    } catch (error) {
      console.error(`Error updating request ${id}:`, error);
      throw error;
    }
  }

  async updateRequestStatus(
    id: string,
    status: RequestStatus
  ): Promise<ItemRequest> {
    try {
      console.log(`Updating request ${id} status to ${status} via API...`);

      // Map our status to the API's expected status
      const apiStatus = this.mapRequestStatusToApiStatus(status);

      const response = await fetch(`${API_URL}/requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: apiStatus }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage =
            errorData.message || `HTTP error! Status: ${response.status}`;
        } catch (e) {
          errorMessage = `HTTP error! Status: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Get the updated request
      return this.getRequestById(id) as Promise<ItemRequest>;
    } catch (error) {
      console.error(`Error updating request ${id} status:`, error);
      throw error;
    }
  }

  // Map our RequestStatus type to API status values
  private mapRequestStatusToApiStatus(status: RequestStatus): string {
    const statusMap: Record<RequestStatus, string> = {
      pending: "pending",
      approved: "approved",
      rejected: "denied",
      completed: "fulfilled",
    };

    return statusMap[status] || "pending";
  }

  async deleteRequest(id: string): Promise<boolean> {
    try {
      console.log(`Deleting request ${id} via API...`);

      const response = await fetch(`${API_URL}/requests/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Request not found");
        }
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Delete result:", result);
      return result.success;
    } catch (error) {
      console.error(`Error deleting request ${id}:`, error);
      throw error;
    }
  }

  async filterRequests(filters: {
    status?: RequestStatus;
    priority?: RequestPriority;
    startDate?: string;
    endDate?: string;
  }): Promise<ItemRequest[]> {
    try {
      console.log("Filtering requests...");
      console.log("Filters:", filters);

      // For now, we'll fetch all requests and filter them client-side
      // In a real implementation, we would add query parameters to the API call
      const allRequests = await this.getAllRequests();
      let filteredRequests = [...allRequests];

      if (filters.status) {
        filteredRequests = filteredRequests.filter(
          (req) => req.status === filters.status
        );
      }

      if (filters.priority) {
        filteredRequests = filteredRequests.filter(
          (req) => req.priority === filters.priority
        );
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        filteredRequests = filteredRequests.filter(
          (req) => new Date(req.createdAt) >= startDate
        );
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        filteredRequests = filteredRequests.filter(
          (req) => new Date(req.createdAt) <= endDate
        );
      }

      return filteredRequests;
    } catch (error) {
      console.error("Error filtering requests:", error);
      return [];
    }
  }

  /**
   * Get requests for a specific month and year
   */
  async getMonthlyRequests(year: number, month: number): Promise<ItemRequest[]> {
    try {
      console.log(`Fetching requests for ${month}/${year}...`);

      // Create start and end dates for the month
      const startDate = new Date(year, month - 1, 1); // month - 1 because Date months are 0-indexed
      const endDate = new Date(year, month, 0); // 0 gets the last day of the previous month
      endDate.setHours(23, 59, 59, 999); // Set to end of day

      console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const allRequests = await this.getAllRequests();
      const monthlyRequests = allRequests.filter((req) => {
        const requestDate = new Date(req.createdAt);
        return requestDate >= startDate && requestDate <= endDate;
      });

      console.log(`Found ${monthlyRequests.length} requests for ${month}/${year}`);
      return monthlyRequests;
    } catch (error) {
      console.error(`Error fetching monthly requests for ${month}/${year}:`, error);
      return [];
    }
  }

  /**
   * Get monthly report summary statistics
   */
  async getMonthlyReportSummary(year: number, month: number): Promise<{
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
  }> {
    try {
      const requests = await this.getMonthlyRequests(year, month);

      // Calculate statistics
      const totalRequests = requests.length;
      const pendingRequests = requests.filter(req => req.status === 'pending').length;
      const approvedRequests = requests.filter(req => req.status === 'approved').length;
      const rejectedRequests = requests.filter(req => req.status === 'rejected').length;
      const completedRequests = requests.filter(req => req.status === 'completed').length;

      const highPriorityRequests = requests.filter(req => req.priority === 'high').length;
      const mediumPriorityRequests = requests.filter(req => req.priority === 'medium').length;
      const lowPriorityRequests = requests.filter(req => req.priority === 'low').length;

      const totalItemsRequested = requests.reduce((sum, req) => sum + req.quantity, 0);

      // Most requested items
      const itemCounts: Record<string, number> = {};
      requests.forEach(req => {
        itemCounts[req.itemName] = (itemCounts[req.itemName] || 0) + req.quantity;
      });
      const mostRequestedItems = Object.entries(itemCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Top requesters
      const requesterCounts: Record<string, number> = {};
      requests.forEach(req => {
        const requesterName = req.requesterName || `User ${req.userId}`;
        requesterCounts[requesterName] = (requesterCounts[requesterName] || 0) + 1;
      });
      const topRequesters = Object.entries(requesterCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        completedRequests,
        highPriorityRequests,
        mediumPriorityRequests,
        lowPriorityRequests,
        totalItemsRequested,
        mostRequestedItems,
        topRequesters,
      };
    } catch (error) {
      console.error(`Error generating monthly report summary for ${month}/${year}:`, error);
      throw error;
    }
  }
}

export const requestService = new RequestService();
