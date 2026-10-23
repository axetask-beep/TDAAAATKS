import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { Announcement } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { Megaphone, Search, X, Plus, Trash2, Sparkles, CalendarClock } from 'lucide-react';

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export const AnnouncementsView: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const { confirmProps, confirm } = useConfirm();
  const isAdmin = user?.role === 'admin';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const list = await api.getAnnouncements(search);
      setAnnouncements(list);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadAnnouncements(searchQuery), searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery, loadAnnouncements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Le titre et le contenu sont requis.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await api.createAnnouncement(title.trim(), content.trim());
      setTitle('');
      setContent('');
      setIsFormOpen(false);
      notify({ type: 'success', title: 'Annonce publiée', message: 'Tous les membres ont été notifiés.' });
      await loadAnnouncements(searchQuery);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la publication de l'annonce.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: Announcement) => {
    const ok = await confirm({
      title: "Supprimer l'annonce",
      message: `Supprimer définitivement « ${a.title} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setDeletingId(a.id);
      await api.deleteAnnouncement(a.id);
      setAnnouncements(prev => prev.filter(x => x.id !== a.id));
    } catch (err: any) {
      notify({ type: 'error', title: 'Erreur', message: err.message || 'Suppression impossible.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Espace Annonces</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            Annonces
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Toutes les communications officielles de l'équipe, conservées avec leur date de publication.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setIsFormOpen(v => !v); setError(''); }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouvelle annonce</span>
          </button>
        )}
      </div>

      {/* Create form — admin only, eye-catching gold/rose treatment to match the announcement design language */}
      {isAdmin && isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-[#0F172A] to-[#0F172A] shadow-lg shadow-amber-500/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Rédiger une annonce</h3>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Titre *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Nouvelle politique de congés..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Message *
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Détaillez votre annonce pour toute l'équipe..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-bold text-xs shadow-sm shadow-amber-500/25 transition-all disabled:opacity-60"
            >
              {submitting ? 'Publication...' : 'Publier pour tous'}
            </button>
          </div>
        </form>
      )}

      {/* Search by title */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher une annonce par son titre..."
          className="w-full pl-9 pr-9 py-2 rounded bg-[#0F172A] border border-[#1E293B] text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Chargement des annonces...</div>
        ) : announcements.length === 0 ? (
          <div className="p-10 text-center rounded-lg border border-dashed border-[#1E293B]">
            <Megaphone className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              {searchQuery ? `Aucune annonce ne correspond à « ${searchQuery} ».` : 'Aucune annonce pour le moment.'}
            </p>
          </div>
        ) : (
          announcements.map(a => {
            const isRecent = Date.now() - new Date(a.created_at).getTime() < RECENT_THRESHOLD_MS;
            return (
              <div
                key={a.id}
                className="relative overflow-hidden rounded-lg border-l-4 border-l-amber-400 border-y border-r border-[#1E293B] bg-gradient-to-br from-amber-500/[0.06] via-[#0F172A] to-[#0F172A] shadow-[0_0_25px_-8px_rgba(245,158,11,0.25)] p-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-rose-500/20 ring-2 ring-amber-400/40 flex items-center justify-center text-amber-400">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    {isRecent && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-[#0F172A] animate-pulse" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-100">{a.title}</h3>
                      {isRecent && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 whitespace-pre-wrap leading-relaxed">{a.content}</p>

                    <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[#1E293B]/70">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={a.author?.name} avatarUrl={a.author?.avatar_url || undefined} size="xs" />
                        <span className="text-[11px] text-slate-400 truncate">{a.author?.name || 'Administrateur'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <CalendarClock className="w-3 h-3" />
                        <span>{formatFullDate(a.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={deletingId === a.id}
                      title="Supprimer l'annonce"
                      className="p-1.5 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
