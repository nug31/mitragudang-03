import React, { ReactNode } from "react";
import { LogIn, Globe, Instagram, Github } from "lucide-react";
import { APP_NAME } from "../../config";

interface AuthLayoutProps {
    children: ReactNode;
    title?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
    children,
    title = APP_NAME
}) => {
    return (
        <div className="min-h-screen bg-[#0a0f18] flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Immersive Animated Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[#0a0f18]"></div>

                {/* Animated Gradient Orbs */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-indigo-600/10 rounded-full blur-[100px] animate-float"></div>

                {/* Bubbles/Particles Effect */}
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute bg-white/5 rounded-full blur-sm animate-float pointer-events-none"
                        style={{
                            width: `${Math.random() * 40 + 10}px`,
                            height: `${Math.random() * 40 + 10}px`,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDuration: `${Math.random() * 10 + 10}s`,
                            animationDelay: `${Math.random() * 5}s`,
                            opacity: Math.random() * 0.3
                        }}
                    ></div>
                ))}
            </div>

            <div className="w-full max-w-[500px] flex flex-col items-center space-y-8 relative z-10 text-center">
                {/* Branding/Intro Section */}
                <div className="flex flex-col items-center space-y-6 text-white animate-fade-in-up w-full">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-500/40 animate-scale-in">
                            <LogIn className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
                            {title}
                        </h1>
                        <p className="text-gray-400 font-medium tracking-wide uppercase text-sm">Management System</p>
                    </div>
                </div>

                {/* Modern subtle divider/info (optional) */}
                <div className="hidden lg:block w-16 h-1 bg-blue-600/30 rounded-full"></div>


                {/* Login/Register Form Content */}
                <div className="w-full px-2">
                    {children}
                </div>

                {/* Centered Desktop Branding/Contact (Footer) */}
                <div className="flex flex-col items-center space-y-4 pt-8 animate-fade-in-up stagger-5 border-t border-white/5 w-full">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Developed By</p>
                    <div className="flex items-center space-x-6">
                        <a
                            href="https://jsnportofolio.netlify.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                            title="Portfolio"
                        >
                            <Globe className="w-5 h-5 text-gray-400 hover:text-blue-400" />
                        </a>
                        <a
                            href="https://instagram.com/j.s_nugroho"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                            title="Instagram"
                        >
                            <Instagram className="w-5 h-5 text-gray-400 hover:text-pink-500" />
                        </a>
                        <a
                            href="https://github.com/jsnugroho"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                            title="GitHub"
                        >
                            <Github className="w-5 h-5 text-gray-400 hover:text-white" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
