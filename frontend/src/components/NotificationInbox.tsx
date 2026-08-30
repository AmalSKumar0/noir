import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  X, 
  ExternalLink, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserX, 
  Inbox,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: 'company_invite' | 'company_accept' | 'company_reject' | 'company_cancel' | 'company_remove' | 'system';
  is_read: boolean;
  link: string;
  created_at: string;
  sender_name?: string;
}

interface NotificationInboxProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationInbox({ isOpen, onClose, onUnreadCountChange }: NotificationInboxProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const res = await apiFetch(`${baseUrl}/api/accounts/notifications/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
        if (onUnreadCountChange) onUnreadCountChange(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: number, link?: string) => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      await apiFetch(`${baseUrl}/api/accounts/notifications/${id}/read/`, {
        method: 'POST',
        headers
      });

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (onUnreadCountChange) onUnreadCountChange(Math.max(0, unreadCount - 1));

      if (link) {
        onClose();
        navigate(link);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      await apiFetch(`${baseUrl}/api/accounts/notifications/read-all/`, {
        method: 'POST',
        headers
      });

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      await apiFetch(`${baseUrl}/api/accounts/notifications/${id}/`, {
        method: 'DELETE',
        headers
      });

      const deletedItem = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deletedItem && !deletedItem.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        if (onUnreadCountChange) onUnreadCountChange(Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'company_invite':
        return <UserPlus className="w-4 h-4 text-violet-400" />;
      case 'company_accept':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'company_reject':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'company_cancel':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'company_remove':
        return <UserX className="w-4 h-4 text-rose-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSecs < 60) return 'Just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed left-20 top-6 bottom-6 w-96 max-w-[calc(100vw-6rem)] bg-[#0C081A]/95 border border-white/10 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl z-[101] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 relative">
                  <Inbox className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-[#0C081A]" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-mono">
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">Noir Enterprise Messaging</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={fetchNotifications}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  title="Refresh notifications"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Quick Action */}
            <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    filter === 'all'
                      ? 'bg-white text-black font-bold'
                      : 'bg-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    filter === 'unread'
                      ? 'bg-white text-black font-bold'
                      : 'bg-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {isLoading && notifications.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-white/40">
                  Loading notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-16 text-center">
                  <Inbox className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-xs font-semibold text-white/60">No notifications found</p>
                  <p className="text-[10px] font-mono text-white/30 mt-1">
                    {filter === 'unread' ? 'All caught up! No unread messages.' : 'Your inbox is clear.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <motion.div
                    layout
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id, n.link)}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative group ${
                      !n.is_read
                        ? 'bg-gradient-to-r from-violet-950/30 to-purple-950/20 border-violet-500/30 shadow-md'
                        : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    {!n.is_read && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    )}

                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10 mt-0.5 flex-shrink-0">
                        {getNotificationIcon(n.notification_type)}
                      </div>

                      <div className="flex-1 pr-4">
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {n.title}
                        </h4>
                        <p className="text-[11px] text-white/60 font-light mt-1 leading-relaxed">
                          {n.message}
                        </p>

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5">
                          <span className="text-[9px] font-mono text-white/30">
                            {formatRelativeTime(n.created_at)}
                          </span>

                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {n.link && (
                              <span className="text-[9px] font-mono text-violet-400 flex items-center gap-0.5">
                                <span>View</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                            <button
                              onClick={(e) => handleDelete(n.id, e)}
                              className="p-1 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
