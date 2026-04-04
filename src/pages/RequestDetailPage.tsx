import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ItemRequest, RequestStatus, User as UserType } from "../types";
import { requestService } from "../services/requestService";
import { userService } from "../services/userService";
import { useAuth } from "../contexts/AuthContext";
import MainLayout from "../components/layout/MainLayout";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import {
  Clock,
  Calendar,
  Package,
  User,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader,
  Mail,
} from "lucide-react";

const RequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { /* isAuthenticated, */ isAdmin } = useAuth();
  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [requester, setRequester] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedRequesterName, setEditedRequesterName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Request ID is missing");
      setLoading(false);
      return;
    }

    const fetchRequestDetails = async () => {
      setLoading(true);
      try {
        // Decode the URL-encoded ID
        const decodedId = decodeURIComponent(id);
        console.log("Fetching request details for ID:", decodedId);

        let requestData;

        // Primary approach: Get by ID
        try {
          requestData = await requestService.getRequestById(decodedId);
          console.log("Successfully fetched request by ID:", requestData);
        } catch (idError) {
          console.log("Failed to fetch request by ID, trying as name:", idError);

          // Secondary approach: Try as name (backward compatibility)
          try {
            requestData = await requestService.getRequestByName(decodedId);
            console.log("Successfully fetched request by name:", requestData);
          } catch (nameError) {
            console.error("Failed to find request by ID or Name:", nameError);
            throw new Error("Request not found");
          }
        }

        if (requestData) {
          setRequest(requestData);

          // Fetch the requester information
          try {
            const userData = await userService.getUserById(requestData.userId);
            if (userData) {
              setRequester(userData);
            }
          } catch (userErr) {
            console.error("Error fetching requester details:", userErr);
          }
        } else {
          throw new Error("Request not found");
        }
      } catch (err) {
        console.error("Error fetching request details:", err);
        setError("Request not found or failed to load request details");
      } finally {
        setLoading(false);
      }
    };

    fetchRequestDetails();
  }, [id]);

  const handleStatusChange = async (status: RequestStatus) => {
    if (!request) return;

    setActionLoading(true);
    try {
      // In the new structure, we use fulfilled for stock deduction in index.js, 
      // and approved in railway-server.cjs. 
      // For consistency with RequestService, we use the method that handles status.
      const updatedRequest = await requestService.updateRequestStatus(
        request.id,
        status
      );
      if (updatedRequest) {
        setRequest(updatedRequest);
      } else {
        setError("Failed to update request status");
      }
    } catch (err) {
      console.error("Error updating request status:", err);
      setError("Failed to update request status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveItems = async () => {
    if (!request) return;
    
    setActionLoading(true);
    try {
      console.log("Saving adjusted items:", editedItems);
      
      const updatedRequest = await requestService.updateRequest(request.id, {
        items: editedItems.map(item => ({
          item_id: item.item_id || item.itemId,
          quantity: item.quantity
        }))
      });
      
      if (updatedRequest) {
        setRequest(updatedRequest);
        setIsEditing(false);
        // Refresh local data
        window.location.reload(); 
      }
    } catch (err) {
      console.error("Error updating request items:", err);
      setError("Failed to save changes: " + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], quantity: newQty };
    setEditedItems(newItems);
  };

  const startEditing = () => {
    if (request && request.items) {
      setEditedItems([...request.items]);
      setIsEditing(true);
    }
  };

  const startEditingDetails = () => {
    if (request) {
      const currentName = (request as any).requester_name ||
        (request as any).requesterName ||
        requester?.username || "";
      const currentDesc = (request as any).reason || request.description || "";
      setEditedRequesterName(currentName);
      setEditedDescription(currentDesc);
      setIsEditingDetails(true);
    }
  };

  const handleSaveDetails = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await requestService.updateRequest(request.id, {
        reason: editedDescription,
      } as any);
      // update local state
      setRequest({ ...request, reason: editedDescription, description: editedDescription } as any);
      setIsEditingDetails(false);
    } catch (err) {
      setError("Failed to save details: " + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusVariant = (status: RequestStatus) => {
    switch (status) {
      case "approved":
        return "success";
      case "pending":
        return "warning";
      case "rejected":
        return "danger";
      case "completed":
        return "secondary";
      default:
        return "default";
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "primary";
      default:
        return "default";
    }
  };

  // Format date with time (for Created date)
  const formatDateWithTime = (dateString: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";

    const dateStr = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Jakarta"
    });

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta"
    });

    return `${dateStr} at ${timeStr} WIB`;
  };

  // Format date only (for Delivery date)
  const formatDateOnly = (dateString: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Jakarta"
    });
  };

  // Comment out the authentication check for now to allow viewing request details without being logged in
  /*
  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Alert variant="info" title="Authentication Required">
            You need to be logged in to view request details.
          </Alert>
        </div>
      </MainLayout>
    );
  }
  */

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/requests")}
            icon={<ArrowLeft className="h-4 w-4 mr-1" />}
          >
            Back to Requests
          </Button>
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

        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <Loader className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600">Loading request details...</p>
          </div>
        ) : request ? (
          <Card>
            <CardHeader className="border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Package className="mr-2 h-6 w-6 text-blue-600" />
                    {request.project_name || request.projectName || `Request for ${request.itemName}` || 'Request Details'}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    <span className="font-medium">Request ID:</span>{" "}
                    {request.id}
                  </p>
                </div>
                <Badge
                  variant={getStatusVariant(request.status)}
                  className="mt-2 md:mt-0 text-base px-3 py-1"
                >
                  {request.status.charAt(0).toUpperCase() +
                    request.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Request Details
                  </h2>

                  <div className="space-y-4">
                    {/* Display items from the new database structure */}
                    {request.items && request.items.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-500">Items Requested</p>
                        <div className="space-y-2">
                          {(isEditing ? editedItems : request.items).map((item: any, index: number) => (
                            <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-600">{item.description}</p>
                                <p className="text-xs text-gray-500">Category: {item.category}</p>
                              </div>
                              <div className="text-right">
                                {isEditing ? (
                                  <div className="flex items-center">
                                    <span className="mr-2 text-sm">Qty:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      className="w-20 p-1 border border-gray-300 rounded text-right"
                                      value={item.quantity}
                                      onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                    />
                                  </div>
                                ) : (
                                  <p className="font-medium">Qty: {item.quantity}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Fallback for old structure or if no items
                      <>
                        <div>
                          <p className="text-sm text-gray-500">Item</p>
                          <p className="font-medium">{request.itemName || request.project_name || 'Unknown Item'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Quantity</p>
                          <p className="font-medium">
                            {request.quantity || 'Not specified'} {request.unit || 'pcs'}
                          </p>
                        </div>
                      </>
                    )}

                    <div>
                      <p className="text-sm text-gray-500">Priority</p>
                      <Badge variant={getPriorityVariant(request.priority)}>
                        {request.priority.charAt(0).toUpperCase() +
                          request.priority.slice(1)}
                      </Badge>
                    </div>

                    {/* Description - editable by admin */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-gray-500">Description</p>
                        {isAdmin && !isEditingDetails && (
                          <button
                            onClick={startEditingDetails}
                            className="text-xs text-blue-500 hover:text-blue-700 underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {isEditingDetails ? (
                        <>
                          <textarea
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows={3}
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            placeholder="Enter description..."
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setIsEditingDetails(false)}
                              className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveDetails}
                              disabled={actionLoading}
                              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {actionLoading ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="font-medium">
                          {(request as any).reason || request.description || <span className="text-gray-400 italic">No description</span>}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Requested By</p>
                      </div>
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-blue-600 mr-2" />
                        <div>
                          <p className="font-medium">
                            {(request as any).requester_name ||
                              requester?.username ||
                              (request as any).requesterName ||
                              "Unknown User"}
                          </p>
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-3 w-3 mr-1" />
                            <span>
                              {requester?.email ||
                                (request as any).requesterEmail ||
                                "No email available"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Timeline
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-start">
                      <Clock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">Created</p>
                        <p className="text-sm text-gray-600">
                          {formatDateWithTime(request.created_at || request.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Calendar className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">Requested Delivery Date</p>
                        <p className="text-sm text-gray-600">
                          {formatDateOnly(
                            request.due_date || request.requestedDeliveryDate || request.created_at || request.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                    {(request.updated_at || request.updatedAt) &&
                      (request.updated_at || request.updatedAt) !== (request.created_at || request.createdAt) && (
                        <div className="flex items-start">
                          <Clock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                          <div>
                            <p className="font-medium">Last Updated</p>
                            <p className="text-sm text-gray-600">
                              {formatDateWithTime(request.updated_at || request.updatedAt)}
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </CardContent>

            {isAdmin && request.status === "pending" && (
              <CardFooter className="bg-gray-50 border-t border-gray-200 p-4">
                <div className="flex justify-end gap-3 flex-wrap">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        disabled={actionLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSaveItems}
                        isLoading={actionLoading}
                        disabled={actionLoading}
                        icon={<CheckCircle className="h-4 w-4 mr-1" />}
                      >
                        Save Quantities
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={startEditing}
                        disabled={actionLoading}
                      >
                        Edit Request
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleStatusChange("rejected")}
                        disabled={actionLoading}
                        icon={<XCircle className="h-4 w-4 mr-1" />}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => handleStatusChange("approved")}
                        disabled={actionLoading}
                        icon={<CheckCircle className="h-4 w-4 mr-1" />}
                      >
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              </CardFooter>
            )}
          </Card>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <Alert variant="warning" title="Request Not Found">
              The requested item could not be found.
            </Alert>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default RequestDetailPage;
