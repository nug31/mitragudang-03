import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', fullWidth = true, ...props }, ref) => {
    const width = fullWidth ? 'w-full' : '';

    return (
      <div className={`${width} mb-4`}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`
            px-4 py-3 border rounded-xl shadow-3d
            ${!className.includes('bg-') ? 'bg-white/90 backdrop-blur-sm' : ''}
            ${!className.includes('text-gray') && !className.includes('text-black') && !className.includes('text-white') && !className.includes('text-red') ? 'text-gray-900' : ''}
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:shadow-3d-hover
            hover:shadow-3d-hover transition-all duration-300
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
            ${width}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;