import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ToastProvider } from './context/ToastContext';
import { AuthView } from './components/auth/AuthView';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalDashboard } from './components/dashboard/GlobalDashboard';
import { WorkspacesList } from './components/workspaces/WorkspacesList';
import { WorkspaceView } from './components/workspaces/WorkspaceView';
import { ProjectView } from './components/projects/ProjectView';
import { TimeTrackingView } from './components/time/TimeTrackingView';
import { MessagesView } from './components/messages/MessagesView';
import { AnnouncementsView } from './components/announcements/AnnouncementsView';
import { ActivityLogView } from './components/activity/ActivityLogView';
import { SettingsView } from './components/settings/SettingsView';
import { TaskDetailDrawer } from './components/tasks/TaskDetailDrawer';
import { CreateTaskModal } from './components/modals/CreateTaskModal';
import { CreateProjectModal } from './components/modals/CreateProjectModal';
import { CreateWorkspaceModal } from './components/modals/CreateWorkspaceModal';
import { BrandLogo } from './components/common/BrandLogo';
import { CommandCenter } from './components/command/CommandCenter';
import { ProgressView } from './components/progress/ProgressView';

type NavigationTab =
  | 'command'
  | 'analytics'
  | 'progress'
  | 'dashboard'
  | 'workspaces'
  | 'workspace_detail'
  | 'project_detail'
  | 'time_tracking'
  | 'messages'
  | 'announcements'
  | 'activity'
  | 'settings';

function MainAppLayout() {
  const { user, loading } = useAuth();
  const { currentWorkspace, currentProject, setCurrentProjectId } = useWorkspace();
  const [currentView, setCurrentView] = useState<NavigationTab>('command');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingTimePassed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Auto route if project is selected
  useEffect(() => {
    if (currentProject && currentView === 'workspaces') {
      setCurrentView('project_detail');
    }
  }, [currentProject?.id]);

  if (loading || !minLoadingTimePassed) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center font-mono">
        <img 
          src="/axetask.png" 
          alt="AxeTask Logo" 
          className="w-48 h-48 sm:w-64 sm:h-64 object-contain animate-pulse" 
        />
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  // Centre de contrôle + Analyses: global admins only; everyone else lands on "Mes tâches".
  const isAdminOnlyView = currentView === 'command' || currentView === 'analytics';
  const view: NavigationTab = isAdminOnlyView && user.role !== 'admin' ? 'dashboard' : currentView;

  return (
    <div className="bg-[#090D16] text-slate-100 selection:bg-[#2563EB]/30 selection:text-[#93C5FD] font-mono">
      {/* Navbar — truly fixed, always at top */}
      <Navbar
        onOpenSettings={() => setCurrentView('settings')}
        onOpenTimeTracking={() => setCurrentView('time_tracking')}
        onOpenDashboard={() => setCurrentView('dashboard')}
        onOpenWorkspaces={() => setCurrentView('workspaces')}
        onOpenAnnouncements={() => setCurrentView('announcements')}
        onNavigate={(view) => setCurrentView(view)}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Sidebar — fixed, never scrolls */}
      <Sidebar
        currentView={view}
        onNavigate={(view) => {
          setCurrentView(view);
          setIsMobileMenuOpen(false);
        }}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main content — body is the scroll container (fixes fixed positioning on mobile) */}
      <main className="min-h-screen bg-[#090D16] pt-14 md:pl-60 relative">
        {(view === 'command' || view === 'analytics') && (
          <CommandCenter
            tab={view === 'command' ? 'pilotage' : 'analyses'}
            onTabChange={(t) => setCurrentView(t === 'pilotage' ? 'command' : 'analytics')}
            onOpenProject={(projectId) => {
              setCurrentProjectId(projectId);
              setCurrentView('project_detail');
            }}
          />
        )}

        {view === 'progress' && <ProgressView />}

        {view === 'dashboard' && <GlobalDashboard />}

        {view === 'workspaces' && (
          <WorkspacesList
            onSelectWorkspace={(wsId) => {
              setCurrentView('workspace_detail');
            }}
          />
        )}

        {view === 'workspace_detail' && (
          <WorkspaceView
            onSelectProject={(prjId) => {
              setCurrentProjectId(prjId);
              setCurrentView('project_detail');
            }}
            onOpenSettings={() => setCurrentView('settings')}
            onBackToWorkspaces={() => setCurrentView('workspaces')}
          />
        )}

        {view === 'project_detail' && (
          <ProjectView
            onBackToWorkspace={() => setCurrentView('workspace_detail')}
          />
        )}

        {view === 'time_tracking' && <TimeTrackingView />}

        {view === 'messages' && <MessagesView />}

        {view === 'announcements' && <AnnouncementsView />}

        {view === 'activity' && user?.role === 'admin' && <ActivityLogView />}

        {view === 'settings' && <SettingsView />}
      </main>

      {/* Modals & Overlays */}
      <TaskDetailDrawer />
      <CreateTaskModal />
      <CreateProjectModal />
      <CreateWorkspaceModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <MainAppLayout />
        </WorkspaceProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

