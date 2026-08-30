import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import { 
  Search, 
  Building2, 
  Check, 
  X, 
  Eye, 
  Trash2, 
  Globe, 
  Phone, 
  FileText, 
  Briefcase, 
  Users, 
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { checkAndRefreshToken } from '../utils/auth';
import { apiFetch } from '../utils/api';

export default function AdminManageCompanies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'delete'>('view');
  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const fetchCompanies = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await apiFetch(`${baseUrl}/api/accounts/admin/companies/?page=${page}&page_size=${pageSize}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
          setCompanies(data.results);
          setTotalCount(data.count || data.results.length);
          setHasNext(!!data.next);
          setHasPrev(!!data.previous);
        } else if (Array.isArray(data)) {
          setCompanies(data);
          setTotalCount(data.length);
          setHasNext(false);
          setHasPrev(false);
        }
        setCurrentPage(page);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies(currentPage);
  }, []);

  const handleUpdateStatus = async (companyId: number, status: 'approved' | 'rejected') => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await apiFetch(`${baseUrl}/api/accounts/admin/companies/${companyId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        fetchCompanies(currentPage);
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.detail || err.error || 'Failed to update company status');
      }
    } catch (err: any) {
      console.error('Error updating company status:', err);
    }
  };

  const handleView = (company: any) => {
    setModalMode('view');
    setCurrentCompany(company);
    setActionError('');
    setIsModalOpen(true);
  };

  const handleDelete = (company: any) => {
    setModalMode('delete');
    setCurrentCompany(company);
    setActionError('');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentCompany) return;
    setIsActionLoading(true);
    setActionError('');
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await apiFetch(`${baseUrl}/api/accounts/admin/companies/${currentCompany.id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchCompanies(currentPage);
      } else {
        const errData = await response.json().catch(() => ({}));
        setActionError(errData.detail || errData.error || 'Failed to delete company');
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred while deleting company');
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch = 
      c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 md:mt-10 px-2 md:px-6"
      >
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-violet-400" />
              Company Management
            </h1>
            <p className="text-stone-400 text-xs font-mono mt-1">
              Review, approve, or reject enterprise workspace applications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-full text-xs font-mono">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-full capitalize transition-all cursor-pointer ${
                    statusFilter === st 
                      ? 'bg-violet-600 text-white font-semibold shadow-md' 
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/50 focus:outline-none focus:border-violet-500 backdrop-blur-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-1 backdrop-blur-md shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Admin Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Industry & Size</th>
                  <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-40" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-48" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 rounded-full ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-stone-400 font-mono text-sm">
                      No company registrations found.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company) => (
                    <tr key={company.id} className="hover:bg-white/5 transition-colors">
                      {/* Logo + Company Name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {company.logo ? (
                            <img 
                              src={company.logo} 
                              alt={company.company_name} 
                              className="w-9 h-9 rounded-xl object-cover border border-white/10 bg-black/40"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                              <Building2 className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white text-sm">{company.company_name}</div>
                            {company.website && (
                              <a
                                href={company.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-stone-400 hover:text-violet-300 font-mono flex items-center gap-1 transition-colors"
                              >
                                <Globe className="w-3 h-3" />
                                <span>{company.website.replace(/^https?:\/\//, '')}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Admin Contact */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-stone-200">
                          {company.user_first_name} {company.user_last_name}
                        </div>
                        <div className="text-xs text-stone-400 font-mono">{company.user_email}</div>
                      </td>

                      {/* Industry & Size */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-stone-300 font-medium">{company.industry || 'N/A'}</div>
                        <div className="text-[11px] text-stone-500 font-mono">{company.company_size || 'N/A'}</div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider font-semibold border ${
                          company.status === 'approved' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : company.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        }`}>
                          {company.status === 'approved' && <ShieldCheck className="w-3.5 h-3.5" />}
                          {company.status === 'rejected' && <ShieldAlert className="w-3.5 h-3.5" />}
                          {company.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                          <span>{company.status || 'pending'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right flex items-center justify-end gap-2">
                        {/* Accept / Approve */}
                        <button
                          onClick={() => handleUpdateStatus(company.id, 'approved')}
                          disabled={company.status === 'approved'}
                          className={`p-2 rounded-full transition-all cursor-pointer ${
                            company.status === 'approved' 
                              ? 'opacity-40 cursor-not-allowed text-stone-500' 
                              : 'bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white shadow-md'
                          }`}
                          title="Approve Company"
                        >
                          <Check className="w-4 h-4" />
                        </button>

                        {/* Reject */}
                        <button
                          onClick={() => handleUpdateStatus(company.id, 'rejected')}
                          disabled={company.status === 'rejected'}
                          className={`p-2 rounded-full transition-all cursor-pointer ${
                            company.status === 'rejected' 
                              ? 'opacity-40 cursor-not-allowed text-stone-500' 
                              : 'bg-amber-600/20 hover:bg-amber-600 border border-amber-500/40 text-amber-400 hover:text-white shadow-md'
                          }`}
                          title="Reject Company"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        {/* View */}
                        <button
                          onClick={() => handleView(company)}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors text-stone-400 hover:text-white cursor-pointer"
                          title="View Profile Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(company)}
                          className="p-2 hover:bg-rose-500/20 rounded-full transition-colors text-stone-400 hover:text-rose-400 cursor-pointer"
                          title="Delete Company"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-white/5 gap-4">
              <div className="text-xs font-mono text-stone-400">
                Showing {filteredCompanies.length} registered companies
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={!hasPrev || isLoading}
                  onClick={() => fetchCompanies(currentPage - 1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/75 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={!hasNext || isLoading}
                  onClick={() => fetchCompanies(currentPage + 1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/75 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modal View / Delete */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'view' ? 'Company Details' : 'Delete Company Workspace'}
      >
        {modalMode === 'delete' ? (
          <div className="space-y-6">
            <p className="text-sm text-stone-300 leading-relaxed font-mono">
              Are you sure you want to delete <span className="font-semibold text-white">{currentCompany?.company_name}</span> and its administrator account ({currentCompany?.user_email})? This action cannot be undone.
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
                className="px-5 py-2.5 rounded-full text-xs font-mono text-stone-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isActionLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2"
              >
                {isActionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              {currentCompany?.logo ? (
                <img src={currentCompany.logo} alt={currentCompany.company_name} className="w-14 h-14 rounded-2xl object-cover border border-white/10" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Building2 className="w-7 h-7" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">{currentCompany?.company_name}</h3>
                <span className="text-xs font-mono text-stone-400">Registered {currentCompany?.created_at ? new Date(currentCompany.created_at).toLocaleDateString() : ''}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-900/60 border border-white/5 rounded-2xl p-5 font-mono text-xs">
              <div>
                <span className="text-stone-500 block mb-1">Admin Email</span>
                <span className="text-white font-medium">{currentCompany?.user_email}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Admin Name</span>
                <span className="text-white font-medium">{currentCompany?.user_first_name} {currentCompany?.user_last_name}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Industry</span>
                <span className="text-white font-medium">{currentCompany?.industry || 'N/A'}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Company Size</span>
                <span className="text-white font-medium">{currentCompany?.company_size || 'N/A'}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Website</span>
                <span className="text-violet-300 font-medium">{currentCompany?.website || 'N/A'}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Tax / Reg ID</span>
                <span className="text-white font-medium">{currentCompany?.tax_id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Phone Number</span>
                <span className="text-white font-medium">{currentCompany?.phone_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-stone-500 block mb-1">Application Status</span>
                <span className="text-white font-semibold uppercase">{currentCompany?.status || 'pending'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(currentCompany.id, 'approved');
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white rounded-full text-xs font-mono tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Application</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(currentCompany.id, 'rejected');
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-400 hover:text-white rounded-full text-xs font-mono tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-mono rounded-full transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
