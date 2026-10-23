import React from 'react';
import { User } from '../../types';

interface AvatarProps {
  user?: User | null;
  name?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTooltip?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  user,
  name: propName,
  avatarUrl: propUrl,
  size = 'md',
  className = '',
  showTooltip = false,
}) => {
  const name = propName || user?.name || 'Utilisateur';
  const avatarUrl = propUrl || user?.avatar_url;

  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs font-medium',
    lg: 'w-12 h-12 text-sm font-semibold',
    xl: 'w-16 h-16 text-base font-bold',
  };

  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded shrink-0 overflow-hidden bg-[#1E293B] border border-[#2563EB]/30 text-[#93C5FD] font-mono select-none ${sizeMap[size]} ${className}`}
      title={showTooltip ? name : undefined}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if image fails to load
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="font-bold">{getInitials(name)}</span>
      )}
    </div>
  );
};
