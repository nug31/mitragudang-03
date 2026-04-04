import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SuccessOverlay from "./SuccessOverlay";

const RegisterForm: React.FC = () => {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'success'>('loading');

  // 3D Tilt Effect State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 15, y: y * -15 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // If already authenticated, redirect to home page
  useEffect(() => {
    if (isAuthenticated && !showOverlay) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate, showOverlay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setShowOverlay(true);
    setAuthStatus('loading');
    const startTime = Date.now();

    try {
      await register(username, email, password);

      // Ensure "Authenticating" is visible for at least 2 seconds
      const duration = Date.now() - startTime;
      const minLoading = 2000;
      const remaining = Math.max(0, minLoading - duration);

      setTimeout(() => {
        setAuthStatus('success');
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 2000);
      }, remaining);

    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      setShowOverlay(false);
    }
  };

  return (
    <div
      className="mx-auto max-w-md w-full perspective-lg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="transition-transform duration-200 ease-out will-change-transform"
        style={{
          transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 lg:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group"
          style={{ transform: "translateZ(20px)" }}
        >
          {/* Subtle Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

          <div className="relative z-10 space-y-6">
            <div className="text-center space-y-1 animate-fade-in-up stagger-1">
              <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                Create Account
              </h2>
              <p className="text-gray-400 text-sm font-medium">
                Join our professional inventory system
              </p>
            </div>

            {error && (
              <div className="animate-scale-in">
                <Alert
                  variant="error"
                  title="Registration Error"
                  onDismiss={() => setError(null)}
                >
                  {error}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="animate-fade-in-up stagger-2">
                <label className="block text-xs font-bold text-gray-300 mb-1.5 ml-1 uppercase tracking-wider">Full Name</label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Joko Setyo"
                  className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all rounded-xl h-11"
                />
              </div>

              <div className="animate-fade-in-up stagger-3">
                <label className="block text-xs font-bold text-gray-300 mb-1.5 ml-1 uppercase tracking-wider">Email Address</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all rounded-xl h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="animate-fade-in-up stagger-4">
                  <label className="block text-xs font-bold text-gray-300 mb-1.5 ml-1 uppercase tracking-wider">Password</label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all rounded-xl h-11 text-sm"
                  />
                </div>
                <div className="animate-fade-in-up stagger-4">
                  <label className="block text-xs font-bold text-gray-300 mb-1.5 ml-1 uppercase tracking-wider">Confirm</label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all rounded-xl h-11 text-sm"
                  />
                </div>
              </div>

              <div className="animate-fade-in-up stagger-5 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={loading}
                  icon={<UserPlus className="h-5 w-5" />}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] active:scale-95 transition-all group/btn"
                >
                  <span className="group-hover:translate-x-1 transition-transform">Get Started Today</span>
                </Button>
              </div>
            </form>

            <div className="text-center animate-fade-in-up stagger-5 mt-6 border-t border-white/5 pt-6">
              <p className="text-gray-500 text-sm font-medium">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="font-bold text-white hover:text-blue-400 transition-colors underline decoration-blue-500/30 underline-offset-4"
                >
                  Sign in here
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
      <SuccessOverlay isVisible={showOverlay} status={authStatus} message="Registration Success!" />
    </div>
  );
};

export default RegisterForm;
