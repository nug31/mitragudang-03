import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import MainLayout from "../components/layout/MainLayout";
import Button from "../components/ui/Button";
import Logo from "../components/ui/Logo";
import { Card, CardContent } from "../components/ui/Card";
import { CheckCircle, LogOut, Home, LogIn } from "lucide-react";

const LogoutPage: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    // Perform logout after a short delay for better UX
    const timer = setTimeout(() => {
      logout();
      setIsLoggingOut(false);
      setLoggedOut(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [logout]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  if (isLoggingOut) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <LogOut className="h-8 w-8 text-blue-600 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Logging you out...
                </h2>
                <p className="text-gray-600">
                  Please wait while we securely log you out.
                </p>
              </div>
              
              {/* Loading animation */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Successfully Logged Out
              </h2>
              <p className="text-gray-600 mb-4">
                {user?.username ? `Goodbye, ${user.username}! ` : ""}
                You have been securely logged out of your account.
              </p>
              <p className="text-sm text-gray-500">
                Thank you for using Gudang Mitra Item Request System.
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={handleGoHome}
                icon={<Home className="h-4 w-4" />}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Go to Homepage
              </Button>
              
              <Button
                variant="outline"
                fullWidth
                onClick={handleGoToLogin}
                icon={<LogIn className="h-4 w-4" />}
                className="border-gray-300 hover:bg-gray-50"
              >
                Login Again
              </Button>
            </div>

            {/* Additional info */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center mb-3">
                <Logo size={24} className="mr-2" />
                <span className="text-sm font-medium text-gray-700">
                  Gudang Mitra
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Your session has ended. All your data remains secure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default LogoutPage;
