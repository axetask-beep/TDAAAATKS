import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Workspace, Project } from '../types';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentProject: Project | null;
  loading: boolean;
  selectedTaskId: string | null;
  isCreateTaskModalOpen: boolean;
  isCreateProjectModalOpen: boolean;
  isCreateWorkspaceModalOpen: boolean;
  taskVersion: number;
  projectVersion: number;
  setCurrentWorkspaceId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setIsCreateTaskModalOpen: (open: boolean) => void;
  setIsCreateProjectModalOpen: (open: boolean) => void;
  setIsCreateWorkspaceModalOpen: (open: boolean) => void;
  refreshWorkspaces: () => Promise<void>;
  bumpTaskVersion: () => void;
  bumpProjectVersion: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTaskId, setSelectedTaskIdState] = useState<string | null>(null);
  const [taskVersion, setTaskVersion] = useState(0);
  const [projectVersion, setProjectVersion] = useState(0);

  // Opening a task pushes a history entry so the browser/mobile "back"
  // gesture closes it and returns to whatever was behind it, instead of
  // navigating away from the app entirely (the drawer is UI state, not a
  // route, so without this the back button had nothing of ours to undo).
  const setSelectedTaskId = useCallback((id: string | null) => {
    if (id) {
      if (!selectedTaskId) {
        window.history.pushState({ axetaskTaskDrawer: true }, '');
      }
      setSelectedTaskIdState(id);
    } else {
      setSelectedTaskIdState(null);
      if (selectedTaskId && window.history.state?.axetaskTaskDrawer) {
        window.history.back();
      }
    }
  }, [selectedTaskId]);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedTaskIdState(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const bumpTaskVersion = useCallback(() => {
    setTaskVersion(v => v + 1);
  }, []);

  const bumpProjectVersion = useCallback(() => {
    setProjectVersion(v => v + 1);
  }, []);

  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const wsList = await api.getWorkspaces();
      setWorkspaces(wsList);

      // Keep current workspace if still accessible, otherwise default to first
      setCurrentWorkspace(prev => {
        if (prev) {
          const found = wsList.find(w => w.id === prev.id);
          if (found) return found;
        }
        return wsList.length > 0 ? wsList[0] : null;
      });
    } catch (err) {
      console.error('Error loading workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Any task or project mutation can move the count badges shown in the
  // navbar/sidebar workspace switcher, so refresh workspaces alongside the
  // task/project lists whenever something changes either.
  useEffect(() => {
    if (taskVersion > 0 || projectVersion > 0) {
      refreshWorkspaces();
    }
  }, [taskVersion, projectVersion]);

  const setCurrentWorkspaceId = (id: string | null) => {
    if (!id) {
      setCurrentWorkspace(null);
      setCurrentProject(null);
      return;
    }
    const found = workspaces.find(w => w.id === id);
    if (found) {
      setCurrentWorkspace(found);
      setCurrentProject(null);
    }
  };

  const setCurrentProjectId = async (id: string | null) => {
    if (!id) {
      setCurrentProject(null);
      return;
    }
    try {
      const prj = await api.getProject(id);
      setCurrentProject(prj);
      if (prj.workspace) {
        setCurrentWorkspace(prj.workspace);
      }
    } catch (err) {
      console.error('Error setting project:', err);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentProject,
        loading,
        selectedTaskId,
        isCreateTaskModalOpen,
        isCreateProjectModalOpen,
        isCreateWorkspaceModalOpen,
        taskVersion,
        projectVersion,
        setCurrentWorkspaceId,
        setCurrentProjectId,
        setSelectedTaskId,
        setIsCreateTaskModalOpen,
        setIsCreateProjectModalOpen,
        setIsCreateWorkspaceModalOpen,
        refreshWorkspaces,
        bumpTaskVersion,
        bumpProjectVersion,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
