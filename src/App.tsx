import { useState, useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import AppRouter from "./router/AppRouter";
import Favicon from "./components/ui/Favicon";
import SplashScreen from "./components/ui/SplashScreen";
import { APP_NAME } from "./config";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if splash has been shown in this session
    // To always show splash (for testing), add ?splash=true to URL
    const urlParams = new URLSearchParams(window.location.search);
    const forceShowSplash = urlParams.get('splash') === 'true';

    if (forceShowSplash) {
      // Force show splash screen
      sessionStorage.removeItem('splashShown');
      setShowSplash(true);
      setIsReady(false);
      return;
    }

    const splashShown = sessionStorage.getItem('splashShown');

    if (splashShown === 'true') {
      // Skip splash if already shown in this session
      setShowSplash(false);
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    // Dynamically update document title
    document.title = APP_NAME;
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setIsReady(true);
  };

  if (showSplash && !isReady) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <AuthProvider>
      <Favicon />
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
