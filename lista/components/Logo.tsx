import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <svg 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" /> {/* Indigo 500 */}
          <stop offset="1" stopColor="#8B5CF6" /> {/* Violet 500 */}
        </linearGradient>
      </defs>
      
      {/* Background Container (Squircle) */}
      <rect x="32" y="32" width="448" height="448" rx="128" fill="url(#logo-gradient)" />
      
      {/* White Content */}
      <g transform="translate(106, 106) scale(0.6)">
        {/* Top Line */}
        <rect x="0" y="40" width="300" height="60" rx="30" fill="white" fillOpacity="0.95" />
        {/* Middle Line */}
        <rect x="0" y="170" width="300" height="60" rx="30" fill="white" fillOpacity="0.8" />
        {/* Bottom Line (Short) */}
        <rect x="0" y="300" width="180" height="60" rx="30" fill="white" fillOpacity="0.6" />
        
        {/* Checkmark Circle Accent */}
        <circle cx="260" cy="330" r="60" fill="white" />
        <path 
          d="M235 330 L252 347 L285 313" 
          stroke="#6366F1" 
          strokeWidth="16" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </g>
    </svg>
  );
};

export default Logo;