import React, { useState, useEffect, useRef, useCallback } from 'react';
import { visiblePoll } from '../../lib/visiblePoll';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { playNotificationSound } from '../../lib/sound';
import { enablePush } from '../../lib/push';
import { AppNotification } from '../../types';
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  X,
  UserPlus,
  CalendarClock,
  AlarmClockOff,
  Briefcase,
  RefreshCw,
  MessageSquare,
  UserMinus,
  ShieldCheck,
  PartyPopper,
  BookOpen,
  Megaphone,
  Award,
} from 'lucide-react';

const TYPE_META: Record<AppNotification['type'], { icon: React.ReactNode; color: string }> = {
  task_assigned: { icon: <UserPlus className="w-3.5 h-3.5" />, color: 'text-[#60A5FA]' },
  task_status_changed: { icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-indigo-400' },
  task_comment: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-[#EC4899]' },
  task_due_today: { icon: <CalendarClock className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  task_overdue: { icon: <AlarmClockOff className="w-3.5 h-3.5" />, color: 'text-rose-400' },
  workspace_added: { icon: <Briefcase className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
  workspace_removed: { icon: <UserMinus className="w-3.5 h-3.5" />, color: 'text-rose-400' },
  workspace_role_changed: { icon: <ShieldCheck className="w-3.5 h-3.5" />, color: 'text-[#60A5FA]' },
  project_completed: { icon: <PartyPopper className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
  project_playbook_reminder: { icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  announcement: { icon: <Megaphone className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  kudos: { icon: <Award className="w-3.5 h-3.5" />, color: 'text-violet-400' },
};

const ANNOUNCED_IDS_KEY = 'axetask_announced_notification_ids';

function loadAnnouncedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ANNOUNCED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveAnnouncedIds(ids: Set<string>) {
  try {
    localStorage.setItem(ANNOUNCED_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // storage full/unavailable — dedup just won't survive a reload this time
  }
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days} j`;
}

interface NotificationsBellProps {
  onOpenWorkspaces: () => void;
  onOpenAnnouncements: () => void;
}

export const NotificationsBell: React.FC<NotificationsBellProps> = ({ onOpenWorkspaces, onOpenAnnouncements }) => {
  const { setSelectedTaskId, setCurrentWorkspaceId, workspaces } = useWorkspace();
  const { notify } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  // Lets the command palette open the alert center.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('axetask:open-notifications', open);
    return () => window.removeEventListener('axetask:open-notifications', open);
  }, []);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Re-shown on every login (state, not storage) until notifications are allowed.
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'granted'));
  const [permissionBannerHidden, setPermissionBannerHidden] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Persisted to localStorage (not just a component ref) so an id, once
  // announced, never sounds/pops again even across a page reload, a closed
  // tab reopened later, or a fresh mount — "only once, ever" per notification,
  // not "only once per browser session".
  const announcedIdsRef = useRef<Set<string>>(loadAnnouncedIds());
  const isFirstPollRef = useRef(true);

  // Polls the full list (not just the count) so a new arrival can be
  // announced with its actual title/body, both as a device-level
  // Notification (when permission is granted) and as a sound — this is what
  // makes a new notification actually "signal on the device", not just move
  // a badge the user has to notice on their own.
  const pollNotifications = useCallback(async () => {
    try {
      const list = await api.getNotifications();
      const unread = list.filter(n => !n.is_read);

      // Skip announcing on the very first poll of this mount — otherwise
      // every login/reload would re-announce whatever was already unread.
      if (!isFirstPollRef.current) {
        const newOnes = unread.filter(n => !announcedIdsRef.current.has(n.id));
        if (newOnes.length > 0) {
          playNotificationSound();

          const canUseDeviceNotification = 'Notification' in window && Notification.permission === 'granted';
          if (canUseDeviceNotification) {
            // Same `tag` as the Web Push one, so a notification already
            // shown by the service worker is replaced, not duplicated.
            // registration.showNotification because `new Notification()`
            // throws on Android Chrome.
            navigator.serviceWorker?.getRegistration().then(reg => {
              newOnes.slice(0, 3).forEach(n => {
                const opts = { body: n.message || undefined, icon: '/icon-192.png', tag: n.id, renotify: true, vibrate: [200, 100, 200] } as NotificationOptions;
                if (reg) reg.showNotification(n.title, opts);
                else new Notification(n.title, opts).onclick = () => window.focus();
              });
            }).catch(() => {});
          } else {
            // No device-notification permission — fall back to the in-app
            // toast so something still visibly signals the arrival. Sound
            // already played above, so don't double it.
            notify({
              type: 'info',
              title: newOnes.length > 1 ? `${newOnes.length} nouvelles notifications` : newOnes[0].title,
              message: newOnes.length === 1 ? (newOnes[0].message || undefined) : undefined,
              sound: false,
            });
          }
        }
      }
      isFirstPollRef.current = false;

      // Mark everything currently fetched as announced (read or not), so
      // none of it can trigger a sound/popup again later. Ids that have
      // aged out of the list (server caps it at 50) are naturally dropped
      // here too, keeping this from growing unbounded.
      announcedIdsRef.current = new Set(list.map(n => n.id));
      saveAnnouncedIds(announcedIdsRef.current);

      setNotifications(list);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to poll notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    enablePush();
    // Browsers only allow the permission prompt from a user gesture, so ask
    // on the first interaction instead of waiting for a click on the bell.
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    const ask = () => {
      Notification.requestPermission().then(p => { setPermission(p); if (p === 'granted') enablePush(); }).catch(() => {});
    };
    document.addEventListener('pointerdown', ask, { once: true });
    return () => document.removeEventListener('pointerdown', ask);
  }, []);

  useEffect(() => {
    return visiblePoll(pollNotifications, 20000);
  }, [pollNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      pollNotifications();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(p => { setPermission(p); if (p === 'granted') enablePush(); }).catch(() => {});
      }
    }
  };

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(p => { setPermission(p); if (p === 'granted') enablePush(); }).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      announcedIdsRef.current = new Set();
      saveAnnouncedIds(announcedIdsRef.current);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelect = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await api.markNotificationRead(n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }

    setIsOpen(false);

    if (n.task_id) {
      setSelectedTaskId(n.task_id);
    } else if (n.workspace_id) {
      const stillMember = workspaces.some(w => w.id === n.workspace_id);
      if (stillMember) setCurrentWorkspaceId(n.workspace_id);
      onOpenWorkspaces();
    } else if (n.type === 'announcement') {
      onOpenAnnouncements();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {permission !== 'granted' && !permissionBannerHidden && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-md p-3 rounded-lg bg-[#0F172A] border border-[#2563EB]/50 shadow-2xl shadow-black/60 font-mono flex items-start gap-3">
          <BellRing className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-100">Notifications désactivées sur cet appareil</p>
            {permission === 'denied' ? (
              <p className="text-[11px] text-slate-400 mt-1">Elles sont bloquées par le navigateur : clique sur le cadenas à gauche de l'adresse, puis Notifications → Autoriser, et recharge la page.</p>
            ) : (
              <button onClick={requestNotificationPermission} className="mt-2 px-3 py-1 rounded text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                Activer les notifications
              </button>
            )}
          </div>
          <button onClick={() => setPermissionBannerHidden(true)} className="p-1 rounded text-slate-500 hover:text-slate-200" title="Plus tard">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <button
        onClick={toggleOpen}
        className="relative p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#1E293B] transition-colors"
        title="Notifications"
      >
        {unreadCount > 0 ? <BellRing className="w-4 h-4 text-[#60A5FA]" /> : <Bell className="w-4 h-4" />}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+0.375rem)] sm:mt-0 w-auto sm:w-96 rounded-lg bg-[#0F172A] border border-[#1E293B] shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-1 duration-100 font-mono overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-[#1E293B] flex items-center justify-between bg-[#0B1120]">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={handleMarkAllRead}
                    title="Tout marquer comme lu"
                    className="flex items-center gap-1 text-[10px] text-[#60A5FA] hover:text-[#93C5FD] font-semibold"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tout lire</span>
                  </button>
                  <button
                    onClick={handleClearAll}
                    title="Tout effacer"
                    className="text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#1E293B]">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Chargement...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_META[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => handleSelect(n)}
                    className={`w-full text-left p-3 flex items-start gap-2.5 hover:bg-[#1E293B]/60 transition-colors group ${
                      !n.is_read ? 'bg-[#2563EB]/5' : ''
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0" />}
                        <p className={`text-xs break-words ${!n.is_read ? 'font-bold text-slate-100' : 'font-medium text-slate-300'}`}>
                          {n.title}
                        </p>
                      </div>
                      {n.message && (
                        <p className="text-[11px] text-slate-400 mt-0.5 break-words">{n.message}</p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, n.id)}
                      className="p-1 rounded text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Supprimer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
