import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { resizeImageToDataUrl } from '../../lib/image';
import { Layers, X, Plus } from 'lucide-react';

const PRESET_COLORS = [
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
];

export const CreateWorkspaceModal: React.FC = () => {
  const { notify } = useToast();
  const { 
    isCreateWorkspaceModalOpen, 
    setIsCreateWorkspaceModalOpen,
    setCurrentWorkspaceId,
    refreshWorkspaces 
  } = useWorkspace();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#F59E0B');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isCreateWorkspaceModalOpen) return null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setIsUploadingPhoto(true);
      setPhotoUrl(await resizeImageToDataUrl(file, 500, 0.85));
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi de la photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez renseigner le nom de l\'espace de travail.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const newWs = await api.createWorkspace({
        name: name.trim(),
        color,
        photo_url: photoUrl,
      });

      await refreshWorkspaces();
      setCurrentWorkspaceId(newWs.id);
      setIsCreateWorkspaceModalOpen(false);
      notify({
        type: 'success',
        title: 'Espace de travail créé',
        message: `L'espace « ${newWs.name} » est opérationnel.`,
      });
      setName('');
      setColor('#F59E0B');
      setPhotoUrl(undefined);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-mono">
      <div className="w-full max-w-md bg-[#0F172A] border border-[#1E293B] rounded shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#1E293B] bg-[#0B1120] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#60A5FA]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Nouvel Espace de Travail</h3>
              <p className="text-[10px] text-slate-400">Nouvelle venture, filiale ou pôle</p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateWorkspaceModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Nom de l'espace (Venture) *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: SaaS Analytics, E-commerce Studio..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Photo de l'espace
            </label>
            <label className="relative cursor-pointer group inline-block">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#090D16] border border-[#1E293B] flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <Layers className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[9px] font-bold text-white uppercase">
                  {isUploadingPhoto ? '...' : photoUrl ? 'Modifier' : 'Ajouter'}
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={isUploadingPhoto}
                className="hidden"
              />
            </label>
            <p className="text-[10px] text-slate-500 mt-1">Optionnel — modifiable plus tard dans les paramètres.</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Couleur d'identification
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded transition-transform ${color === c ? 'scale-110 ring-2 ring-[#2563EB] shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={() => setIsCreateWorkspaceModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all"
            >
              {submitting ? 'Création...' : 'Créer l\'espace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
