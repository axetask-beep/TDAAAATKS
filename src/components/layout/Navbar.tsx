import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';
import { BrandLogo } from '../common/BrandLogo';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { CommandPalette, PaletteView } from './CommandPalette';
import { api } from '../../lib/api';
import { User, Task } from '../../types';
import {
  ChevronDown,
  Plus,
  Search,
  Sparkles,
  Check,
  LogOut,
  User as UserIcon,
  Settings,
  Layers,
  Clock,
  FolderGit2,
  X,
  Menu
} from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
  onOpenTimeTracking: () => void;
  onOpenDashboard: () => void;
  onOpenWorkspaces: () => void;
  onOpenAnnouncements: () => void;
  onNavigate: (view: PaletteView) => void;
  onMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onOpenTimeTracking,
  onOpenDashboard,
  onOpenWorkspaces,
  onOpenAnnouncements,
  onNavigate,
  onMenuToggle,
}) => {
  const { user, logout } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspaceId,
    setIsCreateTaskModalOpen,
    setIsCreateWorkspaceModalOpen,
    setSelectedTaskId
  } = useWorkspace();

  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Command palette (Ctrl/⌘+K)
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const wsDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setIsWorkspaceDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="fixed top-0 w-full h-14 border-b border-[#1E293B] bg-[#0B1120]/95 backdrop-blur-md z-30 md:z-[60] px-4 lg:px-6 flex items-center justify-between gap-4">
      {/* Left: Brand + Workspace Switcher */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 shrink-0">
        {onMenuToggle && (
          <button 
            onClick={onMenuToggle}
            className="md:hidden p-1 -ml-1 text-slate-300 hover:text-white hover:bg-[#1E293B] rounded transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <button 
          onClick={onOpenDashboard}
          className="flex items-center gap-2.5 group text-left focus:outline-none hover:opacity-95 transition-opacity"
        >
          <BrandLogo size="xs" withText={true} />
        </button>

        <div className="h-4 w-px bg-[#1E293B] hidden md:block" />

        {/* Workspace Dropdown — desktop only; on mobile it lives in the
            sidebar instead, and this space is used by the search trigger. */}
        <div className="relative hidden md:block" ref={wsDropdownRef}>
          <button
            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 text-xs font-mono transition-colors"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: currentWorkspace?.color || '#2563EB' }}
            />
            <span className="font-medium max-w-[130px] md:max-w-[180px] truncate text-slate-100">
              {currentWorkspace?.name || 'Sélectionner un workspace'}
            </span>
            {currentWorkspace?.active_tasks_count !== undefined && (
              <span className="hidden md:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30">
                {currentWorkspace.active_tasks_count}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isWorkspaceDropdownOpen && (
            <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+0.375rem)] sm:mt-0 w-auto sm:w-72 rounded-lg bg-[#0F172A] border border-[#1E293B] shadow-2xl shadow-black/80 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100 font-mono">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-[#1E293B]">
                <span>Espaces de travail ({workspaces.length})</span>
                <button
                  onClick={() => {
                    setIsWorkspaceDropdownOpen(false);
                    onOpenWorkspaces();
                  }}
                  className="text-[#3B82F6] hover:underline normal-case font-mono text-[11px]"
                >
                  Gérer
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto py-1">
                {workspaces.map(ws => {
                  const isSelected = currentWorkspace?.id === ws.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setCurrentWorkspaceId(ws.id);
                        setIsWorkspaceDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between group hover:bg-[#1E293B] transition-colors ${
                        isSelected ? 'bg-[#2563EB]/15 text-[#60A5FA] font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: ws.color }}
                        />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {ws.active_tasks_count || 0} act.
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {user?.role === 'admin' && (
                <div className="border-t border-[#1E293B] mt-1 pt-1 px-2">
                  <button
                    onClick={() => {
                      setIsWorkspaceDropdownOpen(false);
                      setIsCreateWorkspaceModalOpen(true);
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-mono text-[#60A5FA] hover:bg-[#2563EB]/15 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nouvel espace</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Global Search trigger — fills the space freed up by moving
          the workspace switcher to the sidebar on mobile; the ⌘K hint is a
          keyboard-only affordance so it stays desktop-only. */}
      <div className="flex items-center flex-1 min-w-0 md:flex-none md:max-w-xs">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center justify-between gap-2 w-full px-2.5 py-1.5 md:px-3 md:py-1 rounded bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-slate-400 text-xs font-mono transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-slate-400 text-xs truncate">Rechercher ou agir…</span>
          </div>
          <kbd className="hidden md:inline-flex px-1.5 py-0.5 rounded bg-[#1E293B] text-[10px] text-slate-400 border border-[#334155] shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Add Task, User Switcher — shrink-0 so the search area
          (flex-1) is what gives up space when things are tight, never these
          action controls. The personal work timer's controls live on the
          task detail page now, not here. */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Notifications */}
        <NotificationsBell onOpenWorkspaces={onOpenWorkspaces} onOpenAnnouncements={onOpenAnnouncements} />

        {/* Quick New Task Button */}
        <button
          onClick={() => setIsCreateTaskModalOpen(true)}
          className="flex items-center gap-1 px-2 py-1 sm:px-3 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold font-mono text-xs shadow-sm shadow-blue-500/25 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">Tâche</span>
        </button>

        {/* User Profile & Demo Switcher Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center gap-2 p-1 rounded hover:bg-[#0F172A] border border-transparent hover:border-[#1E293B] transition-colors"
          >
            <Avatar user={user} size="sm" />
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight truncate max-w-[100px] font-mono">
                {user?.name || 'Mon compte'}
              </span>
              <span className="text-[10px] text-[#60A5FA] font-mono font-medium">
                {user?.role === 'admin' ? 'Super Admin' : 'Membre'}
              </span>
            </div>
            <ChevronDown className="hidden sm:block w-3 h-3 text-slate-400" />
          </button>

          {isUserDropdownOpen && (
            <div className="fixed left-4 right-4 top-16 sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+0.375rem)] sm:mt-0 w-auto sm:w-72 rounded-lg bg-[#0F172A] border border-[#1E293B] shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-100 font-mono">
              {/* User Header */}
              <div className="px-4 py-2.5 border-b border-[#1E293B]">
                <div className="flex items-center gap-3">
                  <Avatar user={user} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-100 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    <div className="mt-1">
                      <RoleBadge role={user?.role || 'member'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserDropdownOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full px-4 py-1.5 text-left text-xs text-slate-300 hover:bg-[#1E293B] flex items-center gap-2.5 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paramètres & Membres</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserDropdownOpen(false);
                    onOpenTimeTracking();
                  }}
                  className="w-full px-4 py-1.5 text-left text-xs text-slate-300 hover:bg-[#1E293B] flex items-center gap-2.5 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mon temps & Export CSV</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full px-4 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-950/20 flex items-center gap-2.5 transition-colors border-t border-[#1E293B] mt-1"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CommandPalette open={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={onNavigate} />

    </header>
  );
};
