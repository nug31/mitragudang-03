import React, { useState, useEffect } from "react";
import MainLayout from "../components/layout/MainLayout";
import { Card, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import {
  User as UserIcon,
  Plus,
  Search,
  RefreshCw,
  UserPlus,
  Edit,
  Trash2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { User } from "../types";
import UserFormModal from "../components/users/UserFormModal";
import { userService } from "../services/userService";

const UsersPage: React.FC = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role === "manager") {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const users = await userService.getAllUsers();
      setUsers(users);
    } catch (err) {
      setError("Failed to load users. Please try again.");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setShowAddUserModal(true);
    setEditingUser(null);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowAddUserModal(true);
  };

  const handleSaveUser = async (userData: any) => {
    try {
      if (editingUser) {
        // Update existing user
        const response = await fetch(
          `${API_BASE_URL}/users/${editingUser.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update user");
        }

        const data = await response.json();

        // Update user in state
        setUsers(
          users.map((user) => (user.id === editingUser.id ? data.user : user))
        );
      } else {
        // Create new user
        const response = await fetch(`${API_BASE_URL}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        });

        if (!response.ok) {
          throw new Error("Failed to create user");
        }

        const data = await response.json();

        // Add new user to state
        setUsers([...users, data.user]);
      }

      // Close modal
      setShowAddUserModal(false);
      setEditingUser(null);
    } catch (err) {
      setError("Failed to save user. Please try again.");
      console.error("Error saving user:", err);
      throw err;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await userService.deleteUser(userId);
      // Remove user from state
      setUsers(users.filter((user) => user.id !== userId));
    } catch (err: any) {
      const errorMessage = err.message || "Failed to delete user. Please try again.";
      setError(errorMessage);
      console.error("Error deleting user:", err);
    }
  };

  const roleOptions = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "user", label: "User" },
  ];

  const filteredUsers = users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (
      searchTerm &&
      !user.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
  };

  if (!isAuthenticated || user?.role !== "manager") {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Alert variant="error" title="Access Denied">
            You do not have permission to access this page. Only managers can access user management.
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <div className="flex items-center">
          <UserIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        </div>
        <p className="mt-1 text-gray-600">
          Manage user accounts and permissions
        </p>
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

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-0"
            />
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={roleOptions}
              className="mb-0"
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleAddUser}
                icon={<UserPlus className="h-4 w-4" />}
              >
                Add User
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              <Search className="h-4 w-4 inline-block mr-1" />
              <span>{filteredUsers.length} users found</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto animate-pulse" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Loading users...
          </h3>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No users found
          </h3>
          <p className="mt-2 text-gray-600">
            Try adjusting your filters to see more results.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <li key={user.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <UserIcon className="h-10 w-10 rounded-full bg-gray-100 p-2 text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : user.role === "manager"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {user.role}
                      </span>
                      <div className="ml-4 flex-shrink-0 flex">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          icon={<Edit className="h-4 w-4" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          icon={<Trash2 className="h-4 w-4" />}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add/Edit User Modal */}
      <UserFormModal
        isOpen={showAddUserModal}
        user={editingUser}
        onClose={() => {
          setShowAddUserModal(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
      />
    </MainLayout>
  );
};

export default UsersPage;
