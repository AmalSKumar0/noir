import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import { Search, UserPlus, Shield, ShieldOff, Edit2, Trash2, Eye, Key, Github, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { checkAndRefreshToken } from '../utils/auth';
import { apiFetch, subscribeToThrottle, ThrottleInfo } from '../utils/api';

const fallbackUsers = [
  {
    "id": 1,
    "username": "noir",
    "first_name": "",
    "last_name": "",
    "email": "admin@noir.ai",
    "role": "developer",
    "social": [],
    "is_active": true,
    "date_joined": "2026-08-03T10:34:45.075186Z"
  },
  {
    "id": 2,
    "username": "AmalSKumar0",
    "first_name": "AMAL",
    "last_name": "S KUMAR",
    "email": "amalskumarofficialz@gmail.com",
    "role": "developer",
    "social": [
      {
        "provider": "google",
        "provider_id": ""
      },
      {
        "provider": "github",
        "provider_id": ""
      }
    ],
    "is_active": true,
    "date_joined": "2026-08-03T13:16:03.154094Z"
  },
  {
    "id": 3,
    "username": "amalskumarofficialz@gmail.com",
    "first_name": "Amal",
    "last_name": "S kumar",
    "email": "amalskumarofficialz@gmail.com",
    "role": "developer",
    "social": [],
    "is_active": true,
    "date_joined": "2026-08-03T13:16:45.960020Z"
  }
];

export default function AdminManageUsers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | 'delete'>('add');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  // Controlled form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [isActive, setIsActive] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(3);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const [throttle, setThrottle] = useState<ThrottleInfo>({
    isThrottled: false,
    secondsRemaining: 0
  });

  useEffect(() => {
    return subscribeToThrottle((info) => {
      setThrottle(info);
    });
  }, []);

  const fetchUsers = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await apiFetch(`${baseUrl}/api/user/all/?page=${page}&page_size=${pageSize}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
          setUsers(data.results);
          setTotalCount(data.count || data.results.length);
          setHasNext(!!data.next);
          setHasPrev(!!data.previous);
        } else if (Array.isArray(data)) {
          setUsers(data);
          setTotalCount(data.length);
          setHasNext(false);
          setHasPrev(false);
        } else {
          setUsers([]);
          setTotalCount(0);
          setHasNext(false);
          setHasPrev(false);
        }
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch users, using previous state or fallback');
        setUsers((prev) => prev.length > 0 ? prev : fallbackUsers);
        setTotalCount((prev) => prev > 0 ? prev : fallbackUsers.length);
        setHasNext(false);
        setHasPrev(false);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Error fetching users, using previous state or fallback:', err);
      setUsers((prev) => prev.length > 0 ? prev : fallbackUsers);
      setTotalCount((prev) => prev > 0 ? prev : fallbackUsers.length);
      setHasNext(false);
      setHasPrev(false);
      setCurrentPage(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!throttle.isThrottled) {
      fetchUsers(currentPage);
    }
  }, [throttle.isThrottled]);

  const getFullName = (user: any) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name} ${user.last_name}`.trim();
    }
    return user.username;
  };

  const renderAuthMethods = (user: any) => {
    const methods: React.ReactNode[] = [];
    let hasPassword = false;

    if (user.social && user.social.length > 0) {
      user.social.forEach((s: any) => {
        if (s.provider === 'github') {
          methods.push(
            <span key="github" title="GitHub OAuth" className="text-stone-400 hover:text-white transition-colors">
              <Github className="w-3.5 h-3.5 shrink-0" />
            </span>
          );
        } else if (s.provider === 'google') {
          methods.push(
            <span key="google" title="Google OAuth" className="text-stone-400 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </span>
          );
        } else if (s.provider === 'password') {
          hasPassword = true;
          methods.push(
            <span key="password" title="Password Auth" className="text-stone-400 hover:text-white transition-colors">
              <Key className="w-3.5 h-3.5 shrink-0" />
            </span>
          );
        }
      });
    }

    if (methods.length === 0 || (!hasPassword && (!user.social || user.social.length === 0))) {
      methods.push(
        <span key="password" title="Password Auth" className="text-stone-400 hover:text-white transition-colors">
          <Key className="w-3.5 h-3.5 shrink-0" />
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 w-fit">
        {methods}
      </div>
    );
  };

  const handleAdd = () => {
    setModalMode('add');
    setCurrentUser(null);
    setFullName('');
    setEmail('');
    setRole('developer');
    setIsActive(true);
    setActionError('');
    setIsModalOpen(true);
  };

  const handleEdit = (user: any) => {
    setModalMode('edit');
    setCurrentUser(user);
    setFullName(getFullName(user));
    setEmail(user.email || '');
    setRole(user.role || 'developer');
    setIsActive(user.is_active !== false);
    setActionError('');
    setIsModalOpen(true);
  };

  const handleView = async (user: any) => {
    setModalMode('view');
    setCurrentUser(user);
    setFullName(getFullName(user));
    setEmail(user.email || '');
    setRole(user.role || 'developer');
    setIsActive(user.is_active !== false);
    setActionError('');
    setIsModalOpen(true);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await apiFetch(`${baseUrl}/api/user/${user.id}/`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (response.ok) {
        const freshUser = await response.json();
        setCurrentUser(freshUser);
        setFullName(getFullName(freshUser));
        setEmail(freshUser.email || '');
        setRole(freshUser.role || 'developer');
        setIsActive(freshUser.is_active !== false);
      }
    } catch (err: any) {
      console.error('Error fetching user details:', err);
    }
  };

  const handleDelete = (user: any) => {
    setModalMode('delete');
    setCurrentUser(user);
    setActionError('');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentUser) return;
    setIsActionLoading(true);
    setActionError('');
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await apiFetch(`${baseUrl}/api/user/${currentUser.id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchUsers(currentPage);
      } else {
        const errData = await response.json().catch(() => ({}));
        setActionError(errData.detail || errData.error || 'Failed to delete user');
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred while deleting user');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') {
      setIsModalOpen(false);
      return;
    }
    
    setIsActionLoading(true);
    setActionError('');
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      
      const nameParts = fullName.trim().split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ');

      if (modalMode === 'edit') {
        const response = await apiFetch(`${baseUrl}/api/user/${currentUser.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            first_name,
            last_name,
            email,
            role,
            is_active: isActive
          })
        });
        if (response.ok) {
          setIsModalOpen(false);
          fetchUsers(currentPage);
        } else {
          const errData = await response.json().catch(() => ({}));
          setActionError(errData.detail || errData.error || 'Failed to update user');
        }
      } else if (modalMode === 'add') {
        const response = await apiFetch(`${baseUrl}/api/user/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            username: email.split('@')[0] || 'user',
            first_name,
            last_name,
            email,
            role,
            is_active: isActive
          })
        });
        if (response.ok) {
          setIsModalOpen(false);
          fetchUsers(1);
        } else {
          const errData = await response.json().catch(() => ({}));
          setActionError(errData.detail || errData.error || 'Failed to create user');
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <AdminLayout>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 md:mt-10 px-2 md:px-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">Manage Users</h1>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/50 focus:outline-none focus:border-violet-500 backdrop-blur-sm"
                />
              </div>
              <button 
                onClick={handleAdd}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-1 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-6 w-32" /></td>
                        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-6 w-48" /></td>
                        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-8 w-8 rounded-full" /></div></td>
                      </tr>
                    ))
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-white">{getFullName(user)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-white/70">
                          <div className="flex flex-col gap-1.5">
                            <span>{user.email}</span>
                            {renderAuthMethods(user)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            (user.role === 'Admin' || user.role === 'admin' || user.role === 'developer') ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 
                            'bg-white/10 text-white/80 border border-white/10'
                          }`}>
                            {(user.role === 'Admin' || user.role === 'admin' || user.role === 'developer') ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            user.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 
                            'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right flex items-center justify-end gap-2">
                          <button onClick={() => handleView(user)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEdit(user)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-blue-400" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(user)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-rose-400" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-white/5 gap-4">
                <div className="text-sm text-white/50">
                  Showing {users.length} users
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!hasPrev || isLoading}
                    onClick={() => fetchUsers(currentPage - 1)}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium text-white/75 bg-white/5 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => fetchUsers(p)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                          p === currentPage
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'text-white/50 hover:bg-white/10 hover:text-white border border-transparent'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={!hasNext || isLoading}
                    onClick={() => fetchUsers(currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium text-white/75 bg-white/5 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'add' ? 'Add New User' : 
          modalMode === 'edit' ? 'Edit User' : 
          modalMode === 'view' ? 'User Details' : 
          'Delete User'
        }
      >
        {modalMode === 'delete' ? (
          <div className="space-y-6">
            <p className="text-sm text-stone-300 leading-relaxed">
              Are you sure you want to delete user <span className="font-semibold text-white">{getFullName(currentUser)}</span> ({currentUser?.email || 'no email'})? This action cannot be undone.
            </p>
            {actionError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{actionError}</span>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                disabled={isActionLoading}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmDelete}
                disabled={isActionLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : 'Confirm Delete'}
              </button>
            </div>
          </div>
        ) : modalMode === 'view' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/5 border border-white/5 rounded-2xl p-5">
              <div>
                <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1">Username</span>
                <span className="text-sm text-white font-medium">{currentUser?.username || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1">Full Name</span>
                <span className="text-sm text-white font-medium">{fullName || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1">Email Address</span>
                <span className="text-sm text-white font-medium">{email || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1">Role</span>
                <span className="text-sm text-white font-medium capitalize">{role || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 
                  'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1">Date Joined</span>
                <span className="text-sm text-white font-medium">
                  {currentUser?.date_joined ? new Date(currentUser.date_joined).toLocaleString() : '-'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-stone-500 uppercase tracking-wider block mb-2">Connected Accounts</span>
              {currentUser && renderAuthMethods(currentUser)}
            </div>
            <div className="flex justify-end pt-6 border-t border-white/10">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-full transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {actionError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{actionError}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Full Name</label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 placeholder-white/30" 
                placeholder="e.g. John Doe"
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 placeholder-white/30" 
                placeholder="john@example.com"
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Role</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#100C1F] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 appearance-none"
                >
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                  <option value="company">Company</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Status</label>
                <select 
                  value={isActive ? 'Active' : 'Inactive'} 
                  onChange={(e) => setIsActive(e.target.value === 'Active')}
                  className="w-full bg-[#100C1F] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 appearance-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/10">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                disabled={isActionLoading}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isActionLoading}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : modalMode === 'add' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AdminLayout>
  );
}
