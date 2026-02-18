import React, { useState } from 'react';
import { ItemRequest, RequestPriority, RequestStatus } from '../../types';
import RequestCard from './RequestCard';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Search, Filter, RefreshCw, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { downloadRequestsExcel } from '../../utils/excelTemplateGenerator';

interface RequestListProps {
  requests: ItemRequest[];
  isAdmin?: boolean;
  onStatusChange?: (id: string, status: RequestStatus) => void;
  onEdit?: (request: ItemRequest) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

const RequestList: React.FC<RequestListProps> = ({
  requests,
  isAdmin = false,
  onStatusChange,
  onEdit,
  onDelete,
  isLoading = false
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'completed', label: 'Completed' }
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' }
  ];

  const filteredRequests = requests.filter(request => {
    // Status filter
    if (statusFilter !== 'all' && request.status !== statusFilter) {
      return false;
    }

    // Priority filter
    if (priorityFilter !== 'all' && request.priority !== priorityFilter) {
      return false;
    }

    // Search term filter
    if (searchTerm && !request.itemName?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  const handleReset = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearchTerm('');
  };

  const handleExportToExcel = () => {
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `requests_export_${currentDate}.xlsx`;
    downloadRequestsExcel(filteredRequests, filename);
  };

  return (
    <div>
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by item name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="mb-0"
          />

          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            options={priorityOptions}
            className="mb-0"
          />
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            <Filter className="h-4 w-4 inline-block mr-1" />
            <span>{filteredRequests.length} requests found</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportToExcel}
              icon={<FileSpreadsheet className="h-4 w-4" />}
              disabled={filteredRequests.length === 0}
            >
              Export to Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No requests found</h3>
          <p className="mt-2 text-gray-600">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters to see more results.'
              : 'There are no requests to display.'}
          </p>
          {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleReset}
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(request => (
            <RequestCard
              key={request.id}
              request={request}
              isAdmin={isAdmin}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RequestList;