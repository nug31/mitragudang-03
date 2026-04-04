import React from "react";
import { Link } from "react-router-dom";
import { ItemRequest, RequestStatus } from "../../types";
import { Card, CardContent } from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { Clock, Calendar, ExternalLink, Edit, Trash2 } from "lucide-react";

interface RequestCardProps {
  request: ItemRequest;
  onStatusChange?: (id: string, status: RequestStatus) => void;
  onEdit?: (request: ItemRequest) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onStatusChange,
  onEdit,
  onDelete,
  isAdmin = false,
}) => {
  const {
    id,
    itemName,
    quantity,
    unit,
    priority,
    status,
    description,
    requestedDeliveryDate,
    createdAt,
  } = request;

  const requesterName = (request as any).requester_name ||
    (request as any).requesterName ||
    null;

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
      month: "short",
      day: "numeric",
      timeZone: "Asia/Jakarta"
    });

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta"
    });

    return `${dateStr}, ${timeStr}`;
  };

  // Format date only (for Delivery date)
  const formatDateOnly = (dateString: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Jakarta"
    });
  };

  const canEditOrDelete = status === "pending";

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
          <div>
            <div className="flex items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {itemName}
              </h3>
              <Badge variant={getStatusVariant(status)} className="ml-2">
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
            {requesterName && (
              <div className="flex items-center mt-1 text-sm text-blue-600 font-medium">
                <span>👤 {requesterName}</span>
              </div>
            )}
            <div className="flex items-center mt-1 text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              <span>Created: {formatDateWithTime(createdAt)}</span>
              <Calendar className="h-4 w-4 ml-4 mr-1" />
              <span>Delivery: {formatDateOnly(requestedDeliveryDate)}</span>
            </div>
          </div>
          <div className="mt-3 md:mt-0 flex items-center">
            <Badge variant={getPriorityVariant(priority)}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
            </Badge>
            <span className="ml-3 text-gray-700 bg-gray-100 px-2 py-1 rounded text-sm">
              Qty: {quantity} {unit || 'pcs'}
            </span>
          </div>
        </div>

        {description && (
          <div className="mb-4 text-gray-700 text-sm border-l-4 border-gray-200 pl-3 py-1 bg-gray-50">
            {description.length > 150
              ? `${description.substring(0, 150)}...`
              : description}
          </div>
        )}

        <div className="border-t border-gray-200 pt-4 mt-2">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              {canEditOrDelete && !isAdmin && (
                <>
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit className="h-4 w-4" />}
                      onClick={() => onEdit(request)}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => onDelete(id)}
                    >
                      Cancel
                    </Button>
                  )}
                </>
              )}

              {/* Admin delete button - show for any status */}
              {isAdmin && onDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => onDelete(id)}
                >
                  Delete
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                icon={<ExternalLink className="h-4 w-4" />}
                to={`/requests/${id}`}
                as={Link}
              >
                View Details
              </Button>
            </div>

            {isAdmin && status === "pending" && onStatusChange && (
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => onStatusChange(id, "approved")}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onStatusChange(id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RequestCard;
