import React from "react";
import Logo from "../ui/Logo";
import { Link } from "react-router-dom";
import { Instagram, Linkedin, Github, Globe } from "lucide-react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content - Stacks on mobile, side by side on larger screens */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          {/* Logo and Brand - Centered on mobile */}
          <div className="flex items-center justify-center w-full md:w-auto mb-6 md:mb-0">
            <Logo size={24} className="rounded-full" />
            <span className="ml-2 text-lg font-bold text-gray-800">
              Gudang Mitra
            </span>
          </div>

          {/* Navigation Links - Wrapped in a container for better mobile layout */}
          <div className="w-full md:w-auto mb-6 md:mb-0">
            {/* On mobile: 2x2 grid, On desktop: horizontal row */}
            <div className="grid grid-cols-2 gap-4 md:flex md:space-x-6 justify-center">
              <Link
                to="/"
                className="text-center md:text-left text-gray-600 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/browse"
                className="text-center md:text-left text-gray-600 hover:text-blue-600 transition-colors"
              >
                Browse Items
              </Link>
              <Link
                to="/requests"
                className="text-center md:text-left text-gray-600 hover:text-blue-600 transition-colors"
              >
                Requests
              </Link>
              <Link
                to="/inventory"
                className="text-center md:text-left text-gray-600 hover:text-blue-600 transition-colors"
              >
                Inventory
              </Link>
            </div>
          </div>

          {/* Social Media Links - Centered on mobile */}
          <div className="flex justify-center space-x-5 mb-4 md:mb-0 w-full md:w-auto">
            <a
              href="https://jsnugroho.com"
              className="text-gray-500 hover:text-green-600 transition-colors"
              aria-label="Portfolio"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe size={20} />
            </a>
            <a
              href="https://instagram.com/j.s_nugroho"
              className="text-gray-500 hover:text-pink-600 transition-colors"
              aria-label="Instagram"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={20} />
            </a>
            <a
              href="#"
              className="text-gray-500 hover:text-blue-700 transition-colors"
              aria-label="LinkedIn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin size={20} />
            </a>
            <a
              href="https://github.com/jsnugroho"
              className="text-gray-500 hover:text-gray-800 transition-colors"
              aria-label="GitHub"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={20} />
            </a>
          </div>
        </div>

        {/* Copyright and Developer Info */}
        <div className="border-t border-gray-200 pt-4 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
          <p className="text-sm text-gray-500 mb-2 md:mb-0">
            &copy; {currentYear} Gudang Mitra.
          </p>
          <p className="text-sm text-gray-500">
            Developed by{" "}
            <a
              href="https://github.com/jsnugroho"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              jsnugroho
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
