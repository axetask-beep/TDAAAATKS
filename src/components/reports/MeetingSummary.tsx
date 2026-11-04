import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, FileDown, Printer, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { HEADER, SECTIONS, NOT_DISCUSSED, MeetingContent, MeetingSummary, Row, summaryHtml } from '../../lib/meetingReport';

const field = 'w-full px-2 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-100 focus:border-[#2563EB] outline-none';

// Edits a meeting summary section by section (same layout as the AXE DIGITAL template).
export const SummaryEditor: React.FC<{ value: MeetingSummary; onChange: (v: MeetingSummary) => void }> = ({ value, onChange }) => {
  const set = (key: string, v: MeetingSummary[string]) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-2">
        {HEADER.map(h => (
          <label key={h.key} className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">{h.label}</span>
            <input value={String(value[h.key] || '')} onChange={e => set(h.key, e.target.value)} className={field} />
          </label>
        ))}
      </div>
      {SECTIONS.map(sec => (
        <section key={sec.key} className="p-3 rounded-lg bg-[#0F172A] border border-[#1E293B] space-y-2">
          <h3 className="text-xs font-bold text-[#60A5FA] uppercase tracking-wide">{sec.label}</h3>
          {sec.type === 'text' && (
            <textarea rows={3} value={String(value[sec.key] || '')} placeholder={NOT_DISCUSSED} onChange={e => set(sec.key, e.target.value)} className={field} />
          )}
          {sec.type === 'list' && (
            <textarea
              rows={3}
              value={((value[sec.key] as string[]) || []).join('\n')}
              placeholder={`${NOT_DISCUSSED} (un élément par ligne)`}
              onChange={e => set(sec.key, e.target.value.split('\n'))}
              className={field}
            />
          )}
          {sec.type === 'table' && (() => {
            const rows = (value[sec.key] as Row[]) || [];
            const setRows = (r: Row[]) => set(sec.key, r);
            return (
              <div className="space-y-1.5 overflow-x-auto">
                {rows.length === 0 && <p className="text-[11px] text-slate-500">{NOT_DISCUSSED}</p>}
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-1.5 min-w-[560px]">
                    {sec.cols.map(col => (
                      <input
                        key={col.key}
                        aria-label={col.label}
                        placeholder={col.label}
                        value={row[col.key] || ''}
                        onChange={e => setRows(rows.map((r, j) => (j === i ? { ...r, [col.key]: e.target.value } : r)))}
                        className={field}
                      />
                    ))}
                    <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Supprimer la ligne" className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setRows([...rows, {}])} className="flex items-center gap-1 text-[11px] text-[#60A5FA] hover:text-white"><Plus className="w-3 h-3" /> Ajouter une ligne</button>
              </div>
            );
          })()}
        </section>
      ))}
    </div>
  );
};

// Reads a published meeting summary, with Word / PDF export.
export const SummaryModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const [data, setData] = useState<{ title: string; content: MeetingContent; author: string; date: string } | null>(null);
  const [error, setError] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    api.getReportFile(id)
      .then(r => setData({ title: r.title || r.file_name, content: r.content, author: r.author_name || '', date: r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '' }))
      .catch(err => setError(err.message));
  }, [id]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const html = data ? summaryHtml(data.content, { title: data.title, author: data.author, date: data.date }) : '';

  const exportWord = () => {
    // Word opens an HTML file saved as .doc, keeping tables and colours.
    const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data!.title.replace(/[\\/:*?"<>|]+/g, '_')}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const exportPdf = () => {
    // The browser's print dialog has "Save as PDF".
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(frame);
    frame.contentDocument!.open();
    frame.contentDocument!.write(html);
    frame.contentDocument!.close();
    setTimeout(() => { frame.contentWindow!.print(); setTimeout(() => frame.remove(), 1000); }, 200);
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 font-mono" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={data?.title || 'Compte rendu'} className="bg-[#0F172A] border border-[#1E293B] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b border-[#1E293B]">
          <h2 className="flex-1 text-sm font-bold text-slate-100 truncate">{data?.title || 'Compte rendu'}</h2>
          {data && (
            <>
              <button onClick={exportWord} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#1E293B] text-xs text-slate-200 hover:border-[#2563EB]"><FileDown className="w-3.5 h-3.5" /> Word</button>
              <button onClick={exportPdf} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#1E293B] text-xs text-slate-200 hover:border-[#2563EB]"><Printer className="w-3.5 h-3.5" /> PDF</button>
            </>
          )}
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-3 space-y-3">
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {!data && !error && <p className="text-xs text-slate-500">Chargement…</p>}
          {data && (
            <>
              <iframe title="Compte rendu" srcDoc={html} className="w-full h-[60vh] rounded bg-white" />
              {data.content.transcript && (
                <div>
                  <button onClick={() => setShowTranscript(s => !s)} className="flex items-center gap-1 text-xs text-[#60A5FA]">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTranscript ? 'rotate-180' : ''}`} /> Transcription complète
                  </button>
                  {showTranscript && <pre className="mt-2 p-3 rounded bg-[#090D16] text-[11px] text-slate-300 whitespace-pre-wrap">{data.content.transcript}</pre>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
