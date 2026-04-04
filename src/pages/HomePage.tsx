import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { ItemRequest } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { requestService } from "../services/requestService";
import { dashboardService, DashboardStats as DashboardStatsType, UserDashboardStats as UserDashboardStatsType } from "../services/dashboardService";
import MainLayout from "../components/layout/MainLayout";
import RequestList from "../components/requests/RequestList";
import DashboardStats from "../components/dashboard/DashboardStats";
import UserDashboardStats from "../components/dashboard/UserDashboardStats";
import TopRequestedItems from "../components/dashboard/TopRequestedItems";
import UserTopRequestedItems from "../components/dashboard/UserTopRequestedItems";
import RecentActivity from "../components/dashboard/RecentActivity";
import UserRecentActivity from "../components/dashboard/UserRecentActivity";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Logo from "../components/ui/Logo";
import { PlusCircle, ArrowRight, AlertCircle, TrendingUp, Activity, Package, ClipboardList, Users } from "lucide-react";

const HomePage: React.FC = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsType | null>(null);
  const [userDashboardStats, setUserDashboardStats] = useState<UserDashboardStatsType | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      setDashboardLoading(true);

      const fetchRequests = async () => {
        try {
          let requestData;
          if (isAdmin) {
            requestData = await requestService.getAllRequests();
          } else if (user) {
            requestData = await requestService.getUserRequests(user.id);
          }
          setRequests(requestData || []);
        } catch (error) {
          console.error("Error fetching requests:", error);
        } finally {
          setLoading(false);
        }
      };

      const fetchDashboardStats = async () => {
        if (isAdmin) {
          try {
            const stats = await dashboardService.getDashboardStats();
            setDashboardStats(stats);
          } catch (error) {
            console.error("Error fetching dashboard stats:", error);
          } finally {
            setDashboardLoading(false);
          }
        } else if (user) {
          // Fetch user-specific dashboard stats for regular users
          try {
            const userStats = await dashboardService.getUserDashboardStats(user.id);
            setUserDashboardStats(userStats);
          } catch (error) {
            console.error("Error fetching user dashboard stats:", error);
          } finally {
            setDashboardLoading(false);
          }
        } else {
          setDashboardLoading(false);
        }
      };

      fetchRequests();
      fetchDashboardStats();
    } else {
      setLoading(false);
      setDashboardLoading(false);
    }
  }, [isAuthenticated, isAdmin, user]);

  const handleStatusChange = async (
    id: string,
    status: "approved" | "rejected" | "completed" | "pending"
  ) => {
    try {
      const updatedRequest = await requestService.updateRequestStatus(
        id,
        status
      );
      setRequests((prev) =>
        prev.map((req) => (req.id === id ? updatedRequest : req))
      );
    } catch (error) {
      console.error("Error updating request status:", error);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmMessage = isAdmin
      ? "Are you sure you want to delete this request? This action cannot be undone."
      : "Are you sure you want to cancel this request?";

    if (window.confirm(confirmMessage)) {
      try {
        await requestService.deleteRequest(id);
        setRequests((prev) => prev.filter((req) => req.id !== id));
      } catch (error) {
        console.error("Error deleting request:", error);
      }
    }
  };

  // Calculate stats for admin dashboard
  const pendingRequests = requests.filter(
    (req) => req.status === "pending"
  ).length;
  const approvedRequests = requests.filter(
    (req) => req.status === "approved"
  ).length;
  const completedRequests = requests.filter(
    (req) => req.status === "completed"
  ).length;

  // Redirect to login page for non-authenticated users
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <div className="relative">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
            Welcome{user ? ", " + user.username : ""}!
          </h1>
          <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full blur-sm opacity-50 animate-pulse"></div>
        </div>
        <p className="mt-2 text-lg text-gray-600 font-medium">
          You are logged in as {isAdmin ? "an administrator" : "a regular user"}.
        </p>
      </div>

      {/* Authenticated user content */}
          {isAdmin && dashboardStats && (
            <>
              {/* Main Dashboard Statistics */}
              <DashboardStats
                stats={dashboardStats}
                isLoading={dashboardLoading}
              />

              {/* Dashboard Widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <TopRequestedItems
                  items={dashboardStats.topRequestedItems}
                  isLoading={dashboardLoading}
                />
                <RecentActivity
                  activities={dashboardStats.recentActivity}
                  isLoading={dashboardLoading}
                />
              </div>

              {/* Quick Actions */}
              <div className={`mb-6 grid grid-cols-1 ${user?.role === "manager" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Manage Inventory
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Add, edit, or remove items from inventory
                        </p>
                        <Button variant="primary" href="/inventory" size="sm">
                          Go to Inventory
                        </Button>
                      </div>
                      <Package className="h-12 w-12 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          View All Requests
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Review and manage all user requests
                        </p>
                        <Button variant="primary" href="/requests" size="sm">
                          View Requests
                        </Button>
                      </div>
                      <ClipboardList className="h-12 w-12 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                {/* Only show User Management for managers */}
                {user?.role === "manager" && (
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            User Management
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Manage user accounts and permissions
                          </p>
                          <Button variant="primary" href="/users" size="sm">
                            Manage Users
                          </Button>
                        </div>
                        <Users className="h-12 w-12 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          {/* User Dashboard for Regular Users */}
          {!isAdmin && userDashboardStats && (
            <>
              {/* User Dashboard Statistics */}
              <UserDashboardStats
                stats={userDashboardStats}
                isLoading={dashboardLoading}
              />

              {/* User Dashboard Widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <UserTopRequestedItems
                  items={userDashboardStats.myTopRequestedItems}
                  isLoading={dashboardLoading}
                />
                <UserRecentActivity
                  activities={userDashboardStats.myRecentActivity}
                  isLoading={dashboardLoading}
                />
              </div>

              {/* Quick Actions for Users */}
              <div className="mb-6 grid grid-cols-1 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Browse Items
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Explore available items to request
                        </p>
                        <Button variant="primary" href="/browse" size="sm">
                          Browse Items
                        </Button>
                      </div>
                      <Package className="h-12 w-12 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <ClipboardList className="h-6 w-6 mr-2 text-primary-600" />
              {isAdmin ? "Recent Requests" : "Your Requests"}
            </h2>
            {isAdmin && (
              <Button variant="outline" href="/requests" className="shadow-3d">
                View All Requests
              </Button>
            )}
          </div>

          <RequestList
            requests={isAdmin ? requests.slice(0, 5) : requests}
            isAdmin={isAdmin}
            onStatusChange={isAdmin ? handleStatusChange : undefined}
            onDelete={handleDelete}
            isLoading={loading}
          />

          {!isAdmin && requests.length > 0 && (
            <div className="mt-6 text-right">
              <Button
                variant="outline"
                href="/requests"
                icon={<ArrowRight className="h-4 w-4 ml-1" />}
                className="inline-flex items-center"
              >
                View All Requests
              </Button>
            </div>
          )}
    </MainLayout>
  );
};

export default HomePage;

// Components that need to be defined for the HomePage component

const FileText = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
};

const Clock = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
};

const BarChart = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
};

const ThumbsUp = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
};

const CheckCircle = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
};
