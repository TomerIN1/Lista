import React from 'react';
import { RecipeLabel } from '../types';

interface RecipeBadgeProps {
  label: RecipeLabel;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

const RecipeBadge: React.FC<RecipeBadgeProps> = ({ label, size = 'sm', onClick }) => {
  // Get recipe initials (first 2 characters)
  const initials = label.recipeName.substring(0, 2).toUpperCase();

  // Size classes
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs';

  return (
    <span
      onClick={onClick}
      title={label.recipeName}
      className={`inline-flex items-center font-bold rounded-full transition-all ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:scale-105' : ''
      }`}
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
        border: `1px solid ${label.color}40`
      }}
    >
      {initials}
    </span>
  );
};

export default RecipeBadge;
