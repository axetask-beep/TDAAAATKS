import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';
import { 
  ArrowRight, 
  Lock, 
  Mail, 
  User, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  AlertCircle 
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, signup, error, clearError } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4 relative overflow-hidden font-mono selection:bg-[#2563EB]/30 selection:text-[#93C5FD]">
      <div className="w-full max-w-sm relative z-10 space-y-4">
        {/* Brand Logo & Presentation */}
        <div className="text-center space-y-1.5 flex flex-col items-center">
          <BrandLogo size="xl" className="justify-center" />
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Plateforme de productivité &amp; gestion multi-ventures pour équipes agiles.
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-5 rounded bg-[#0F172A] border border-[#1E293B] shadow-2xl shadow-black/80 space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#090D16] rounded border border-[#1E293B]">
            <button
              type="button"
              onClick={() => { setIsLogin(true); clearError(); }}
              className={`py-1.5 rounded text-xs font-bold transition-all ${
                isLogin
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); clearError(); }}
              className={`py-1.5 rounded text-xs font-bold transition-all ${
                !isLogin
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Alexandre Martin"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="votre.email@axetask.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-8 pr-9 py-2.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>{loading ? 'Connexion en cours...' : isLogin ? 'Se connecter' : 'Créer mon compte'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Feature Highlights Pills — stacked on mobile */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 font-medium px-2">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#3B82F6]" />
            Contrôle d'accès RBAC
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#3B82F6]" />
            PostgreSQL Cloud SQL
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#3B82F6]" />
            Gestion Admin
          </span>
        </div>
      </div>
    </div>
  );
};
