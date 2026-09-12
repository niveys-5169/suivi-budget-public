import React from 'react';
import * as Icons from 'lucide-react';
import { LucideProps } from 'lucide-react';

interface CategoryIconProps {
  icon: string;
  className?: string;
  color?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  className = '',
  color,
  size = 20,
}) => {
  if (!icon) return <div className={className}>📦</div>;

  const isSvg = icon.trim().startsWith('<svg');

  if (isSvg) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ color: color || 'currentColor' }}
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  }

  // Convert kebab-case or snake_case to PascalCase for Lucide
  const iconName = icon
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('') as keyof typeof Icons;

  const LucideIcon = Icons[iconName] as React.FC<LucideProps>;

  if (LucideIcon) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <LucideIcon size={size} color={color} />
      </div>
    );
  }

  return <div className={`flex items-center justify-center ${className}`}>{icon}</div>;
};
