import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { playNotificationSound } from '../../lib/sound';
import { Project } from '../../types';
import {
  LayoutDashboard,
  Layers,
  Clock,
  Settings,
  Plus,
  FolderGit2,
  ChevronRight,
  Briefcase,
  ChevronDown,
  Users,
  Sparkles,
  Kanban,
  MessageSquare,
  Megaphone,
  ScrollText,
  Radar,
  BarChart3,
  Trophy
} from 'lucide-react';

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all ${
      active
        ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
        : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

type SidebarView = 'command' | 'analytics' | 'progress' | 'dashboard' | 'workspaces' | 'workspace_detail' | 'project_detail' | 'time_tracking' | 'messages' | 'announcements' | 'activity' | 'settings';

interface SidebarProps {
  currentView: SidebarView;
  onNavigate: (view: SidebarView) => void;
  isOpen: boolean;
  onClose: () => void;
}

const UNREAD_POLL_INTERVAL_MS = 15000;

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose }) => {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === 'admin';
  const {
    workspaces,
    currentWorkspace,
    currentProject,
    setCurrentProjectId,
    setCurrentWorkspaceId,
    setIsCreateProjectModalOpen,
    setIsCreateWorkspaceModalOpen,
    setIsCreateTaskModalOpen,
    taskVersion,
    projectVersion
  } = useWorkspace();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [isMobileWsExpanded, setIsMobileWsExpanded] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // null until the first poll resolves, so opening the app with existing
  // unread messages doesn't itself trigger the arrival sound.
  const prevUnreadMessagesRef = useRef<number | null>(null);

  useEffect(() => {
    const loadUnread = () => {
      api.getConversations()
        .then(convs => {
          const total = convs.reduce((sum, c) => sum + c.unread_count, 0);
          if (prevUnreadMessagesRef.current !== null && total > prevUnreadMessagesRef.current) {
            playNotificationSound();
          }
          prevUnreadMessagesRef.current = total;
          setUnreadMessages(total);
        })
        .catch(() => {});
    };
    loadUnread();
    const interval = setInterval(loadUnread, UNREAD_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      setLoadingProjects(true);
      api.getWorkspaceProjects(currentWorkspace.id)
        .then(setProjects)
        .catch(console.error)
        .finally(() => setLoadingProjects(false));
    } else {
      setProjects([]);
    }
  }, [currentWorkspace?.id, taskVersion, projectVersion]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/*
        Sidebar:
        - Mobile: fixed, starts at top-14 (below navbar h-14), height = 100vh - 3.5rem
        - Desktop: sticky, top-14, height = 100vh - 3.5rem
        This ensures the footer button is ALWAYS visible without scrolling.
      */}
      <aside
        className={`
          fixed left-0 z-50
          top-0 h-[100dvh]
          md:top-14 md:h-[calc(100dvh-3.5rem)]
          w-60
          border-r border-[#1E293B] bg-[#0B1120]
          flex flex-col shrink-0 overflow-hidden
          select-none font-mono
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Workspace Switcher — mobile only; on desktop this lives in the
            Navbar instead, since there's room for it there. */}
        <div className="p-2 pb-0 shrink-0 md:hidden">
          <button
            onClick={() => setIsMobileWsExpanded(!isMobileWsExpanded)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 text-xs font-mono transition-colors"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: currentWorkspace?.color || '#2563EB' }}
            />
            <span className="flex-1 min-w-0 truncate text-left font-medium text-slate-100">
              {currentWorkspace?.name || 'Sélectionner un espace'}
            </span>
            <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${isMobileWsExpanded ? 'rotate-180' : ''}`} />
          </button>

          {isMobileWsExpanded && (
            <div className="mt-1 rounded-lg bg-[#0F172A] border border-[#1E293B] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="max-h-48 overflow-y-auto py-1">
                {workspaces.map(ws => {
                  const isSelected = currentWorkspace?.id === ws.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setCurrentWorkspaceId(ws.id);
                        setIsMobileWsExpanded(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                        isSelected ? 'bg-[#2563EB]/15 text-[#60A5FA] font-semibold' : 'text-slate-300 hover:bg-[#1E293B]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ws.color }} />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {isSelected && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {isGlobalAdmin && (
                <button
                  onClick={() => {
                    setIsMobileWsExpanded(false);
                    setIsCreateWorkspaceModalOpen(true);
                  }}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 border-t border-[#1E293B] text-xs font-mono text-[#60A5FA] hover:bg-[#2563EB]/15 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouvel espace</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Top Core Navigation Links — fixed height */}
        <div className="p-2 space-y-0.5 shrink-0">
          {isGlobalAdmin && <NavItem active={currentView === 'command'} onClick={() => onNavigate('command')} icon={<Radar className="w-3.5 h-3.5 text-[#3B82F6]" />} label="Centre de contrôle" />}
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
              currentView === 'dashboard'
                ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
                : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Mes Tâches</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('workspaces')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
              currentView === 'workspaces'
                ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
                : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Tous les Espaces</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#0F172A] text-slate-400 border border-[#1E293B]">
              {workspaces.length}
            </span>
          </button>

          {isGlobalAdmin && <NavItem active={currentView === 'analytics'} onClick={() => onNavigate('analytics')} icon={<BarChart3 className="w-3.5 h-3.5 text-violet-400" />} label="Analyses" />}
          <NavItem active={currentView === 'progress'} onClick={() => onNavigate('progress')} icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />} label="Missions & progression" />

          <button
            onClick={() => onNavigate('time_tracking')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
              currentView === 'time_tracking'
                ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
                : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mon Temps</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('messages')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
              currentView === 'messages'
                ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
                : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-[#3B82F6]" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>
              <span>Messages</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('announcements')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
              currentView === 'announcements'
                ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
                : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-3.5 h-3.5 text-amber-400" />
              <span>Annonces</span>
            </div>
          </button>

          {isGlobalAdmin && (
            <button
              onClick={() => onNavigate('activity')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
                currentView === 'activity'
                  ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40 shadow-sm'
                  : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <ScrollText className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Historique</span>
              </div>
            </button>
          )}
        </div>

        <div className="h-px bg-[#1E293B] mx-2 shrink-0" />

        {/* Scrollable middle section: workspace projects */}
        <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-2">
          {currentWorkspace ? (
            <div>
              <div className="flex items-center justify-between px-1.5 mb-1">
                <button
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${isProjectsExpanded ? '' : '-rotate-90'}`} />
                  <span className="truncate max-w-[120px]">{currentWorkspace.name}</span>
                </button>

                {currentWorkspace.my_role === 'admin' && (
                  <button
                    onClick={() => setIsCreateProjectModalOpen(true)}
                    title="Nouveau projet"
                    className="p-1 rounded text-slate-400 hover:text-[#3B82F6] hover:bg-[#2563EB]/10 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isProjectsExpanded && (
                <div className="space-y-0.5 pl-1">
                  <button
                    onClick={() => onNavigate('workspace_detail')}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                      currentView === 'workspace_detail'
                        ? 'bg-[#1E293B] text-[#60A5FA] font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>Vue d'ensemble</span>
                    </div>
                  </button>

                  {projects.map(prj => {
                    const isSelected = currentView === 'project_detail' && currentProject?.id === prj.id;
                    return (
                      <button
                        key={prj.id}
                        onClick={() => {
                          setCurrentProjectId(prj.id);
                          onNavigate('project_detail');
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors group ${
                          isSelected
                            ? 'bg-[#2563EB]/20 text-[#93C5FD] font-bold border-l-2 border-[#2563EB] pl-1.5'
                            : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Kanban className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#3B82F6]' : 'text-slate-400 group-hover:text-slate-300'}`} />
                          <span className="truncate">{prj.name}</span>
                        </div>
                        {prj.active_tasks_count !== undefined && prj.active_tasks_count > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#0F172A] text-slate-400 border border-[#1E293B]">
                            {prj.active_tasks_count}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {projects.length === 0 && !loadingProjects && (
                    <div className="px-2 py-3 text-[10px] text-slate-500 italic text-center">
                      Aucun projet.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              Aucun espace sélectionné.
            </div>
          )}
        </div>

        {/* Bottom Footer — shrink-0 so it's always pinned at the bottom, never hidden */}
        <div className="shrink-0 p-2 border-t border-[#1E293B] bg-[#090D16]">
          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-xs font-mono transition-all ${
              currentView === 'settings'
                ? 'bg-[#2563EB]/15 text-[#60A5FA] font-bold border border-[#2563EB]/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Paramètres &amp; Équipe</span>
          </button>
        </div>
      </aside>
    </>
  );
};
