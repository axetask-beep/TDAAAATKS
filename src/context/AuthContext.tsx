import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api';
import { disablePush } from '../lib/push';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (name: string, email?: string, avatar_url?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const checkAuth = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      setError(null);
    } catch {
      setUser(null);
      removeStoredToken();
      // Do not surface an error on initial landing if no valid session
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleAuthExpired = () => {
      setUser(null);
      setError('Votre session a expiré. Veuillez vous reconnecter.');
    };

    window.addEventListener('auth_expired', handleAuthExpired);
    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      clearError();
      const res = await api.login(email.trim(), password);
      setStoredToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      const msg = err.message || 'Identifiants invalides ou erreur de connexion.';
      setError(msg);
      throw err;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      clearError();
      const res = await api.signup(name.trim(), email.trim(), password);
      setStoredToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      const msg = err.message || 'Erreur lors de la création du compte.';
      setError(msg);
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    return signup(name, email, password);
  };

  const logout = () => {
    // Stop pushing this user's notifications to a device they've left.
    disablePush().finally(removeStoredToken);
    setUser(null);
    clearError();
  };

  const updateProfile = async (name: string, email?: string, avatar_url?: string) => {
    const res = await api.updateProfile(name, email, avatar_url);
    setUser(res.user);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        clearError,
        login,
        signup,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
