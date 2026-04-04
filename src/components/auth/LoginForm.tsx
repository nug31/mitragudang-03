import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
// Card imports removed as they were replaced by custom glassmorphism
import Input from "../ui/Input";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SuccessOverlay from "./SuccessOverlay";

const LoginForm: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'success'>('loading');

  // 3D Tilt Effect State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 20, y: y * -20 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // If already authenticated, redirect to home page
  React.useEffect(() => {
    if (isAuthenticated && !showOverlay) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate, showOverlay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setShowOverlay(true);
    setAuthStatus('loading');
    const startTime = Date.now();

    try {
      await login(email, password);

      // Ensure "Authenticating" is visible for at least 2 seconds
      const duration = Date.now() - startTime;
      const minLoading = 2000;
      const remaining = Math.max(0, minLoading - duration);

      setTimeout(() => {
        setAuthStatus('success');
        // Wait for success animation to play
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 2000);
      }, remaining);

    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      setShowOverlay(false); // Hide overlay on error so user can correct
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
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group"
          style={{ transform: "translateZ(20px)" }}
        >
          {/* Subtle Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

          <div className="relative z-10 space-y-8">
            <div className="text-center space-y-2 animate-fade-in-up stagger-1">
              <h2 className="text-3xl font-black text-white tracking-tight">
                Welcome Back
              </h2>
              <p className="text-gray-400 font-medium">
                Enter your credentials to continue
              </p>
            </div>

            {error && (
              <div className="animate-scale-in">
                <Alert
                  variant="error"
                  title="Authentication Error"
                  onDismiss={() => setError(null)}
                >
                  {error}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="animate-fade-in-up stagger-2">
                <label className="block text-sm font-bold text-gray-300 mb-2 ml-1">Email Address</label>
                <div className="relative group/input">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="bg-black/20 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all rounded-xl h-12"
                  />
                </div>
              </div>

              <div className="animate-fade-in-up stagger-3">
                <div className="flex justify-between mb-2 ml-1">
                  <label className="block text-sm font-bold text-gray-300">Password</label>
                  <a href="#" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Forgot?</a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all rounded-xl h-12"
                />
              </div>

              <div className="flex items-center animate-fade-in-up stagger-4 py-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 bg-white/5 border-white/10 rounded text-blue-600 focus:ring-blue-500/50"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-400">
                  Keep me signed in
                </label>
              </div>

              <div className="animate-fade-in-up stagger-5 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={loading}
                  icon={<LogIn className="h-5 w-5" />}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] active:scale-95 transition-all group/btn"
                >
                  <span className="group-hover:translate-x-1 transition-transform">Sign in to Platform</span>
                </Button>
              </div>
            </form>

            <div className="text-center animate-fade-in-up stagger-5 mt-6">
              <p className="text-gray-500 text-sm">
                New to the system?{" "}
                <a
                  href="/register"
                  className="font-bold text-white hover:text-blue-400 transition-colors underline decoration-blue-500/30 underline-offset-4"
                >
                  Create free account
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
      <SuccessOverlay isVisible={showOverlay} status={authStatus} message="Welcome Back!" />
    </div>
  );
};

export default LoginForm;
