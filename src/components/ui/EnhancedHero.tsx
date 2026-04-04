import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package, Users, TrendingUp, Shield, Zap, Globe } from "lucide-react";
import Button from "./Button";
import { Card, CardContent } from "./Card";

const EnhancedHero: React.FC = () => {
  const features = [
    {
      icon: Package,
      title: "Smart Inventory",
      description: "Advanced inventory management with real-time tracking",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Seamless collaboration across your organization",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: TrendingUp,
      title: "Analytics & Insights",
      description: "Powerful analytics to optimize your operations",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level security for your sensitive data",
      color: "from-red-500 to-orange-500",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Optimized performance for maximum productivity",
      color: "from-yellow-500 to-amber-500",
    },
    {
      icon: Globe,
      title: "Global Access",
      description: "Access your data from anywhere in the world",
      color: "from-indigo-500 to-purple-500",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0 bg-gradient-mesh opacity-30 animate-gradient"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-red-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-green-400/20 to-blue-400/20 rounded-full blur-3xl animate-pulse-slow"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                Gudang Mitra
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Experience the future of inventory management with our cutting-edge 3D interface and intelligent automation
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              as={Link}
              to="/login"
              variant="primary"
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-neon text-lg px-8 py-4"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              as={Link}
              to="/browse"
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm text-lg px-8 py-4"
            >
              Explore Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              variant="glass"
              hover={true}
              className="group cursor-pointer"
            >
              <CardContent className="p-6 text-center">
                <div className={`inline-flex p-4 rounded-full bg-gradient-to-r ${feature.color} mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-300 text-sm group-hover:text-gray-200 transition-colors duration-300">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              10K+
            </div>
            <div className="text-gray-300">Items Managed</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              500+
            </div>
            <div className="text-gray-300">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text text-transparent">
              99.9%
            </div>
            <div className="text-gray-300">Uptime</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedHero;
