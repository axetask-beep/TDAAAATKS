import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Pause, Play, Square, X, Loader2, Download, RotateCcw, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { downsample, encodeWav, joinWavs, WAV_RATE } from '../../lib/wav';
import { MeetingContent, MeetingSummary } from '../../lib/meetingReport';
import { SummaryEditor } from './MeetingSummary';

// One piece every 75 s of audio: transcribed while the meeting goes on, and
// small enough for one request (Vercel caps at 4.5 Mo).
const SEGMENT_S = 75;

type Segment = { wav: Uint8Array; text?: string; status: 'pending' | 'done' | 'failed' };
type Phase = 'recording' | 'finishing' | 'review' | 'error';

const fmt = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const toDataUrl = (bytes: Uint8Array) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(new Error("Lecture de l'audio impossible."));
  r.readAsDataURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }));
});

export const MeetingRecorder: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('recording');
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [title, setTitle] = useState(`Réunion du ${new Date().toLocaleDateString('fr-FR')}`);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const micRef = useRef<HTMLDivElement>(null);
  const level = useRef(0);
  const pausedRef = useRef(false);
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; stop: () => void } | null>(null);
  const buffer = useRef<Float32Array[]>([]);
  const bufferLen = useRef(0);
  const totalSamples = useRef(0);
  const segments = useRef<Segment[]>([]);
  const queue = useRef(Promise.resolve());

  // Transcribe pieces one after the other (free AI tier = few requests per minute).
  const transcribe = (seg: Segment) => {
    queue.current = queue.current.then(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          seg.text = (await api.transcribeMeeting(await toDataUrl(seg.wav))).text;
          seg.status = 'done';
          return;
        } catch (err: any) {
          if (/GEMINI_API_KEY/.test(err.message)) { seg.status = 'failed'; setError(err.message); return; }
          await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
        }
      }
      seg.status = 'failed';
    });
  };

  const flush = () => {
    if (!bufferLen.current) return;
    const seg: Segment = { wav: encodeWav(buffer.current), status: 'pending' };
    buffer.current = [];
    bufferLen.current = 0;
    segments.current.push(seg);
    transcribe(seg);
  };

  // Start the microphone.
  useEffect(() => {
    let cancelled = false;
    let wakeLock: any;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
        if (cancelled) return stream.getTracks().forEach(t => t.stop());
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        // ponytail: ScriptProcessor is deprecated but works everywhere (Chrome, Electron, Firefox, Safari); AudioWorklet if it's ever removed.
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = e => {
          const input = e.inputBuffer.getChannelData(0);
          let peak = 0;
          for (let i = 0; i < input.length; i += 16) peak = Math.max(peak, Math.abs(input[i]));
          level.current = level.current * 0.7 + Math.min(1, peak * 2.5) * 0.3;
          if (pausedRef.current) return;
          const pcm = downsample(input, ctx.sampleRate);
          buffer.current.push(pcm);
          bufferLen.current += pcm.length;
          totalSamples.current += pcm.length;
          if (bufferLen.current >= SEGMENT_S * WAV_RATE) flush();
        };
        source.connect(proc);
        proc.connect(ctx.destination); // needed for it to run; it outputs silence
        audio.current = {
          ctx, stream,
          stop: () => { proc.disconnect(); source.disconnect(); stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); },
        };
        // Keep the screen (and so the recording) awake during the meeting.
        wakeLock = await (navigator as any).wakeLock?.request('screen').catch(() => null);
      } catch (err: any) {
        setError(err?.name === 'NotAllowedError'
          ? "Le micro est bloqué. Autorise-le dans les réglages du navigateur (icône à gauche de l'adresse), puis réessaie."
          : "Aucun micro n'est disponible sur cet appareil.");
        setPhase('error');
      }
    })();
    const tick = setInterval(() => setElapsed(totalSamples.current / WAV_RATE), 250);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => {
      cancelled = true;
      clearInterval(tick);
      window.removeEventListener('beforeunload', warn);
      audio.current?.stop();
      wakeLock?.release?.().catch(() => {});
    };
  }, []);

  // Backdrop: rings that pulse with the voice, around the mic.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'recording') return;
    const g = canvas.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, t = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const m = micRef.current?.getBoundingClientRect();
      const cx = m ? m.left + m.width / 2 : w / 2, cy = m ? m.top + m.height / 2 : h / 2, base = m ? m.width / 2 : 70;
      const lv = pausedRef.current ? 0 : level.current;
      t += pausedRef.current || still ? 0 : 0.004;
      // Expanding rings.
      for (let i = 0; i < 5; i++) {
        const p = (t + i / 5) % 1;
        const r = base * (1.1 + p * 3.2) + lv * 30;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.strokeStyle = `rgba(244, 63, 94, ${(1 - p) * (0.18 + lv * 0.5)})`;
        g.lineWidth = 1.5 + (1 - p) * 2;
        g.stroke();
      }
      // Voice halo.
      const halo = g.createRadialGradient(cx, cy, base * 0.8, cx, cy, base * (1.6 + lv * 1.4));
      halo.addColorStop(0, `rgba(244, 63, 94, ${0.25 + lv * 0.45})`);
      halo.addColorStop(1, 'rgba(37, 99, 235, 0)');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(cx, cy, base * (1.6 + lv * 1.4), 0, Math.PI * 2);
      g.fill();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const finish = async () => {
    setPhase('finishing');
    flush();
    audio.current?.stop();
    audio.current = null;
    setProgress('Transcription de la réunion…');
    await queue.current;
    const failed = segments.current.filter(s => s.status === 'failed').length;
    if (failed) {
      setError(error || `${failed} morceau(x) de l'audio n'ont pas pu être transcrits (réseau ou limite de l'IA).`);
      return setPhase('error');
    }
    const transcript = segments.current.map(s => s.text).filter(Boolean).join('\n');
    try {
      setProgress('Rédaction du compte rendu…');
      const { summary } = await api.summarizeMeeting(transcript);
      setSummary(summary);
      if (typeof summary.intitule === 'string' && summary.intitule.trim()) setTitle(summary.intitule.trim());
      setPhase('review');
    } catch (err: any) {
      setError(err.message);
      setPhase('error');
    }
  };

  const retry = () => {
    setError('');
    segments.current.filter(s => s.status === 'failed').forEach(s => { s.status = 'pending'; transcribe(s); });
    finish();
  };

  const downloadAudio = () => {
    const url = URL.createObjectURL(new Blob([joinWavs(segments.current.map(s => s.wav)) as BlobPart], { type: 'audio/wav' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const cancel = () => {
    if (segments.current.length || bufferLen.current) {
      if (!window.confirm("Abandonner l'enregistrement ? L'audio sera perdu.")) return;
    }
    onClose();
  };

  const save = async () => {
    if (!summary) return;
    setSaving(true);
    try {
      const content: MeetingContent = {
        summary,
        transcript: segments.current.map(s => s.text).filter(Boolean).join('\n'),
        duration_s: Math.round(totalSamples.current / WAV_RATE),
        recorded_at: new Date().toISOString(),
      };
      await api.uploadReport({ file_name: `${title}.html`, title, kind: 'reunion', content });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const btn = 'flex items-center justify-center rounded-full transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

  if (phase === 'review' && summary) {
    return createPortal(
      <div className="fixed inset-0 z-[120] bg-[#090D16] overflow-y-auto font-mono" role="dialog" aria-modal="true" aria-label="Compte rendu de la réunion">
        <div className="max-w-4xl mx-auto p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <h2 className="text-lg font-bold text-slate-100 uppercase">Compte rendu — à relire</h2>
            <div className="flex gap-2">
              <button onClick={cancel} className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white">Abandonner</button>
              <button onClick={save} disabled={saving || !title.trim()} className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-bold text-xs">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement…' : 'Valider et publier'}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Titre du rapport</span>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded bg-[#0F172A] border border-[#1E293B] text-sm text-slate-100 focus:border-[#2563EB] outline-none" />
          </label>
          <p className="text-[11px] text-slate-500">Rédigé par {user?.name} · durée {fmt(totalSamples.current / WAV_RATE)}. Corrige ce qu'il faut avant de publier : le rapport sera visible dans l'onglet Rapports.</p>
          <SummaryEditor value={summary} onChange={setSummary} />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#05070D] text-white font-mono select-none" role="dialog" aria-modal="true" aria-label="Enregistrement de la réunion">
      {/* Aurora backdrop */}
      <div aria-hidden className="absolute inset-0">
        <div className={`aurora-blob absolute -top-1/4 -left-1/4 w-[70vmax] h-[70vmax] rounded-full blur-3xl transition-opacity duration-700 ${paused ? 'opacity-10' : 'opacity-40'} bg-[radial-gradient(circle,#F43F5E_0%,transparent_60%)]`} />
        <div className={`aurora-blob-slow absolute -bottom-1/4 -right-1/4 w-[70vmax] h-[70vmax] rounded-full blur-3xl transition-opacity duration-700 ${paused ? 'opacity-20' : 'opacity-45'} bg-[radial-gradient(circle,#2563EB_0%,transparent_60%)]`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#05070D_85%)]" />
      </div>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 w-full h-full" />

      <div className="relative h-full flex flex-col items-center justify-between py-10 px-5">
        {/* Status */}
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur border border-white/10 text-xs font-bold uppercase tracking-[0.2em]">
          {phase === 'recording' && (
            <>
              <span className={`w-2.5 h-2.5 rounded-full ${paused ? 'bg-amber-400' : 'bg-rose-500 motion-safe:animate-pulse'}`} />
              {paused ? 'En pause' : 'Enregistrement en cours'}
            </>
          )}
          {phase === 'finishing' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress}</>}
          {phase === 'error' && <span className="text-rose-300">Problème</span>}
        </div>

        {/* Mic */}
        <div className="flex flex-col items-center gap-6 -mt-10">
          <div ref={micRef} className={`${btn} w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-b from-rose-500 to-rose-700 shadow-[0_0_80px_rgba(244,63,94,0.55)] ${paused || phase !== 'recording' ? 'grayscale opacity-70' : ''}`}>
            {phase === 'finishing' ? <Loader2 className="w-14 h-14 animate-spin" /> : <Mic className="w-14 h-14 sm:w-16 sm:h-16" strokeWidth={1.75} />}
          </div>
          <p className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight" aria-label={`Durée ${fmt(elapsed)}`}>{fmt(elapsed)}</p>
          {phase === 'recording' && <p className="text-xs text-slate-300/80 text-center max-w-xs">Parle normalement. Le compte rendu est rédigé à la fin, selon le modèle AXE DIGITAL.</p>}
          {phase === 'error' && <p className="text-sm text-rose-200 text-center max-w-md">{error}</p>}
        </div>

        {/* Controls */}
        {phase === 'recording' && (
          <div className="flex items-center gap-6">
            <button onClick={cancel} aria-label="Annuler l'enregistrement" title="Annuler" className={`${btn} w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10`}>
              <X className="w-6 h-6" />
            </button>
            <button onClick={finish} disabled={!audio.current && !elapsed} aria-label="Arrêter et rédiger le compte rendu" title="Arrêter" className={`${btn} w-20 h-20 bg-white text-rose-600 hover:bg-rose-50 shadow-xl`}>
              <Square className="w-8 h-8 fill-current" />
            </button>
            <button onClick={togglePause} aria-label={paused ? 'Reprendre' : 'Mettre en pause'} title={paused ? 'Reprendre' : 'Pause'} className={`${btn} w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10`}>
              {paused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </button>
          </div>
        )}
        {phase === 'error' && (
          <div className="flex flex-wrap justify-center gap-3">
            {segments.current.length > 0 && (
              <>
                <button onClick={retry} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-rose-600 font-bold text-sm"><RotateCcw className="w-4 h-4" /> Réessayer</button>
                <button onClick={downloadAudio} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm"><Download className="w-4 h-4" /> Télécharger l'audio</button>
              </>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-full text-sm text-slate-300 hover:text-white">Fermer</button>
          </div>
        )}
        {phase === 'finishing' && <div className="h-20" />}
      </div>
    </div>,
    document.body,
  );
};
