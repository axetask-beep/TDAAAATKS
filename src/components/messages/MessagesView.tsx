import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';
import { api } from '../../lib/api';
import { Conversation, ConversationParticipant, Message, User } from '../../types';
import { Send, Search, MessageSquarePlus, ArrowLeft, MessagesSquare, Reply, X, Check, CheckCheck } from 'lucide-react';

const POLL_INTERVAL_MS = 4000;
const ONLINE_WINDOW_MS = 90_000;

function otherParticipant(conversation: Conversation, currentUserId: string): ConversationParticipant | undefined {
  return conversation.participants.find(p => p.id !== currentUserId) || conversation.participants[0];
}

function isOnline(p?: ConversationParticipant): boolean {
  if (!p?.last_seen_at) return false;
  return Date.now() - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export const MessagesView: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  activeConversationIdRef.current = activeConversationId;

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await api.getMessages(conversationId);
      if (activeConversationIdRef.current === conversationId) {
        setMessages(data);
      }
      await api.markConversationRead(conversationId);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    setReplyingTo(null);
    if (!activeConversationId) return;
    loadMessages(activeConversationId);
    const interval = setInterval(() => loadMessages(activeConversationId, true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openNewChat = async () => {
    setIsNewChatOpen(true);
    try {
      const users = await api.getUsers();
      setAllUsers(users.filter(u => u.id !== user?.id));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const startConversation = async (targetUser: User) => {
    try {
      const conv = await api.startConversation(targetUser.id);
      setIsNewChatOpen(false);
      setNewChatSearch('');
      await loadConversations();
      setActiveConversationId(conv.id);
      setShowMobileThread(true);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content || !activeConversationId || sending) return;

    setSending(true);
    setMessageInput('');
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);
    try {
      const sent = await api.sendMessage(activeConversationId, content, replyToId);
      setMessages(prev => [...prev, sent]);
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  const filteredNewChatUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(newChatSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex font-mono overflow-hidden">
      {/* Conversation List */}
      <div className={`w-full sm:w-80 shrink-0 border-r border-[#1E293B] bg-[#0B1120] flex-col ${showMobileThread ? 'hidden sm:flex' : 'flex'}`}>
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
          <h2 className="text-sm font-bold text-slate-100">Messages</h2>
          <button
            onClick={openNewChat}
            title="Nouvelle conversation"
            className="p-1.5 rounded text-[#60A5FA] hover:bg-[#2563EB]/15 transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations && (
            <div className="text-center py-8 text-xs text-slate-500">Chargement...</div>
          )}

          {!loadingConversations && conversations.length === 0 && (
            <div className="text-center py-10 px-4 text-xs text-slate-500">
              <MessagesSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              Aucune conversation. Démarrez-en une avec un membre de votre équipe.
            </div>
          )}

          {conversations.map(conv => {
            const other = user ? otherParticipant(conv, user.id) : undefined;
            const isActive = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversationId(conv.id);
                  setShowMobileThread(true);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors border-l-2 ${
                  isActive
                    ? 'bg-[#2563EB]/10 border-[#2563EB]'
                    : 'border-transparent hover:bg-[#0F172A]'
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar user={other} size="md" />
                  {isOnline(other) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B1120]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-bold text-slate-100' : 'font-semibold text-slate-300'}`}>
                      {other?.name || 'Utilisateur'}
                    </p>
                    {conv.last_message && (
                      <span className="text-[10px] text-slate-500 shrink-0">{formatTime(conv.last_message.created_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-[11px] truncate ${conv.unread_count > 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                      {conv.last_message?.content || 'Nouvelle conversation'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className={`flex-1 flex-col bg-[#090D16] min-w-0 ${showMobileThread ? 'flex' : 'hidden sm:flex'}`}>
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div>
              <MessagesSquare className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-xs text-slate-500">Sélectionnez une conversation ou démarrez-en une nouvelle.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[#1E293B] bg-[#0B1120]">
              <button
                onClick={() => setShowMobileThread(false)}
                className="sm:hidden p-1 -ml-1 text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="relative shrink-0">
                <Avatar user={user ? otherParticipant(activeConversation, user.id) : undefined} size="sm" />
                {user && isOnline(otherParticipant(activeConversation, user.id)) && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-[#0B1120]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-100 truncate">
                  {user ? otherParticipant(activeConversation, user.id)?.name : ''}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {user && isOnline(otherParticipant(activeConversation, user.id))
                    ? 'En ligne'
                    : (user ? otherParticipant(activeConversation, user.id)?.email : '')}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingMessages && (
                <div className="text-center py-6 text-xs text-slate-500">Chargement des messages...</div>
              )}

              {!loadingMessages && messages.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">
                  Aucun message pour l'instant. Dites bonjour !
                </div>
              )}

              {(() => {
                const other = user ? otherParticipant(activeConversation, user.id) : undefined;
                const lastMineIndex = [...messages].map(m => m.sender_id === user?.id).lastIndexOf(true);
                return messages.map((msg, idx) => {
                  const isMine = msg.sender_id === user?.id;
                  const isSeen = isMine && idx === lastMineIndex && !!other?.last_read_at && new Date(other.last_read_at) >= new Date(msg.created_at);
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        title="Répondre"
                        className={`self-center p-1 rounded text-slate-500 hover:text-[#60A5FA] opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'order-first mr-1' : 'ml-1'}`}
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                      <div className="max-w-[75%] sm:max-w-[60%]">
                        <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
                          isMine
                            ? 'bg-[#2563EB] text-white rounded-br-sm'
                            : 'bg-[#1E293B] text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.reply_to && (
                            <div className={`mb-1.5 pl-2 border-l-2 text-[10px] truncate ${isMine ? 'border-blue-200/50 text-blue-100/80' : 'border-slate-500 text-slate-400'}`}>
                              <span className="font-bold">{msg.reply_to.sender_name || 'Message'}</span>
                              <span className="ml-1">{msg.reply_to.content}</span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-100/70' : 'text-slate-500'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                        {isMine && idx === lastMineIndex && (
                          <p className="flex items-center justify-end gap-1 text-[10px] text-slate-500 mt-0.5 pr-1">
                            {isSeen ? <><CheckCheck className="w-3 h-3 text-[#60A5FA]" /> Vu</> : <><Check className="w-3 h-3" /> Envoyé</>}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-[#1E293B] bg-[#0B1120]">
              {replyingTo && (
                <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
                  <div className="flex-1 min-w-0 pl-2 border-l-2 border-[#2563EB] text-[11px] text-slate-400 truncate">
                    <span className="font-bold text-[#60A5FA]">Réponse à {replyingTo.sender?.name || ''}</span>
                    <span className="ml-1">{replyingTo.content}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-0.5 text-slate-500 hover:text-slate-200 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Écrivez un message..."
                  className="flex-1 px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="p-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {isNewChatOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-start justify-center pt-20 p-4">
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg w-full max-w-sm overflow-hidden shadow-2xl font-mono">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1E293B] bg-[#0B1120]">
              <Search className="w-4 h-4 text-[#3B82F6]" />
              <input
                autoFocus
                value={newChatSearch}
                onChange={e => setNewChatSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Fermer
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {filteredNewChatUsers.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">Aucun membre trouvé.</div>
              )}
              {filteredNewChatUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => startConversation(u)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded hover:bg-[#1E293B] transition-colors text-left"
                >
                  <Avatar user={u} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{u.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
