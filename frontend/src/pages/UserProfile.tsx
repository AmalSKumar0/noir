import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Building2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Trash2, 
  Calendar, 
  Sparkles, 
  Lock, 
  Globe, 
  Phone, 
  FileText,
  Briefcase
} from 'lucide-react';
import UserNavBar from '../components/UserNavBar';
import Footer from '../components/Footer';
import { checkAndRefreshToken } from '../utils/auth';
import { apiFetch } from '../utils/api';

interface CompanyProfileData {
  id?: number;
  company_name: string;
  logo: string;
  industry: string;
  company_size: string;
  website: string;
  tax_id: string;
  phone_number: string;
  status?: string;
}

interface UserProfileState {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  date_joined?: string;
  company_profile?: CompanyProfileData | null;
  company?: CompanyProfileData | null;
  social_accounts?: string[];
}

export default function UserProfile() {
  const [profile, setProfile] = useState<UserProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'security' | 'company' | 'danger'>('details');

  // Editable Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Company Edit States
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // UI Feedback States
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = await checkAndRefreshToken();
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const res = await apiFetch(`${baseUrl}/api/accounts/profile/`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data: UserProfileState = await res.json();
        setProfile(data);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setUsername(data.username || '');
        setEmail(data.email || '');

        if (data.company_profile) {
          setCompanyName(data.company_profile.company_name || '');
          setCompanyLogo(data.company_profile.logo || '');
          setCompanyIndustry(data.company_profile.industry || '');
          setCompanySize(data.company_profile.company_size || '');
          setCompanyWebsite(data.company_profile.website || '');
          setCompanyTaxId(data.company_profile.tax_id || '');
          setCompanyPhone(data.company_profile.phone_number || '');
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setErrorMessage('Failed to load user profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setErrorMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4000);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = await checkAndRefreshToken();
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const bodyPayload: any = {
        first_name: firstName,
        last_name: lastName,
        username,
        email,
      };

      if (profile?.role === 'company' && profile.company_profile) {
        bodyPayload.company_profile = {
          company_name: companyName,
          logo: companyLogo,
          industry: companyIndustry,
          company_size: companySize,
          website: companyWebsite,
          tax_id: companyTaxId,
          phone_number: companyPhone,
        };
      }

      const res = await apiFetch(`${baseUrl}/api/accounts/profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload)
      });

      const resData = await res.json();
      if (res.ok) {
        setProfile(resData);
        showToast('Profile updated successfully!');
      } else {
        showToast(resData.detail || 'Failed to update profile.', true);
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred while saving profile.', true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      showToast('Please enter a new password.', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', true);
      return;
    }

    setIsSaving(true);
    try {
      const token = await checkAndRefreshToken();
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const res = await apiFetch(`${baseUrl}/api/accounts/profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        })
      });

      const resData = await res.json();
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast('Password updated successfully!');
      } else {
        showToast(resData.detail || 'Failed to change password.', true);
      }
    } catch (err: any) {
      showToast(err.message || 'Error changing password.', true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivateAccount = async () => {
    setIsDeactivating(true);
    try {
      const token = await checkAndRefreshToken();
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const res = await apiFetch(`${baseUrl}/api/accounts/profile/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        window.location.href = '/logout';
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to deactivate account.', true);
      }
    } catch (err) {
      showToast('An error occurred during account deactivation.', true);
    } finally {
      setIsDeactivating(false);
      setShowDeleteModal(false);
    }
  };

  const getRoleBadge = (roleStr?: string) => {
    switch (roleStr) {
      case 'admin':
        return <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full uppercase tracking-wider">Super Admin</span>;
      case 'company':
        return <span className="px-3 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-semibold rounded-full uppercase tracking-wider">Company Admin</span>;
      default:
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full uppercase tracking-wider">Developer</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#03000A] text-white flex flex-col font-sans selection:bg-violet-600 selection:text-white relative overflow-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Floating User Navigation Bar */}
      <UserNavBar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pl-20 md:pl-28 py-10 z-10">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Account Profile</h1>
            </div>
            <p className="text-stone-400 text-sm">
              Manage your personal credentials, security settings, and organization preferences.
            </p>
          </div>
          {profile && getRoleBadge(profile.role)}
        </div>

        {/* Feedback Toasts */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3 text-sm backdrop-blur-md shadow-lg"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 text-sm backdrop-blur-md shadow-lg"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
            <span className="text-stone-400 text-sm font-medium">Loading profile data...</span>
          </div>
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Card - User Overview Avatar Pill */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0A0718]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Avatar Display */}
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 p-1 mb-4 shadow-xl">
                  <div className="w-full h-full rounded-full bg-[#0E0A1F] flex items-center justify-center text-2xl font-bold text-white uppercase tracking-wider">
                    {profile.first_name ? `${profile.first_name[0]}${profile.last_name[0] || ''}` : profile.username.substring(0, 2)}
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-0.5">
                  {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.username}
                </h2>
                <p className="text-violet-400 text-sm font-mono mb-4">@{profile.username}</p>

                <div className="w-full space-y-3 pt-4 border-t border-white/10 text-left text-xs text-stone-300">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-stone-500" /> Email
                    </span>
                    <span className="font-mono text-stone-200 truncate max-w-[170px]" title={profile.email}>{profile.email}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" /> Joined
                    </span>
                    <span className="text-stone-200">
                      {profile.date_joined ? new Date(profile.date_joined).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  {profile.company && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-stone-500" /> Organization
                      </span>
                      <span className="text-violet-300 font-semibold">{profile.company.company_name}</span>
                    </div>
                  )}

                  {profile.company_profile && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-stone-500" /> Managed Company
                      </span>
                      <span className="text-violet-300 font-semibold">{profile.company_profile.company_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Navigation Tabs */}
              <div className="bg-[#0A0718]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'details'
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                      : 'text-stone-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                  Personal Information
                </button>

                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'security'
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                      : 'text-stone-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Security & Password
                </button>

                {profile.role === 'company' && profile.company_profile && (
                  <button
                    onClick={() => setActiveTab('company')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === 'company'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                        : 'text-stone-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Company Settings
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('danger')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'danger'
                      ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30'
                      : 'text-stone-400 hover:text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  Account Management
                </button>
              </div>
            </div>

            {/* Right Card - Interactive Tab Content */}
            <div className="lg:col-span-8">
              <div className="bg-[#0A0718]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative">
                
                {/* TAB 1: Personal Details */}
                {activeTab === 'details' && (
                  <motion.form 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    onSubmit={handleSaveDetails}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-violet-400" />
                        Personal Information
                      </h3>
                      <p className="text-stone-400 text-xs">Update your username, name, and contact email address.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First Name"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last Name"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Email Address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save Changes
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* TAB 2: Security */}
                {activeTab === 'security' && (
                  <motion.form 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    onSubmit={handleSavePassword}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-violet-400" />
                        Security & Password
                      </h3>
                      <p className="text-stone-400 text-xs">Ensure your account is using a secure, strong password.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Current Password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">New Password</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            placeholder="New password"
                            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Confirm New Password</label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Confirm password"
                            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                        Update Password
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* TAB 3: Company Profile Settings */}
                {activeTab === 'company' && profile.role === 'company' && profile.company_profile && (
                  <motion.form 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    onSubmit={handleSaveDetails}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-violet-400" />
                        Company Organization Details
                      </h3>
                      <p className="text-stone-400 text-xs">Update your organization credentials visible to developer teams.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Company Name</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Industry</label>
                        <input
                          type="text"
                          value={companyIndustry}
                          onChange={(e) => setCompanyIndustry(e.target.value)}
                          placeholder="e.g. Software, Finance"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Website</label>
                        <input
                          type="url"
                          value={companyWebsite}
                          onChange={(e) => setCompanyWebsite(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Phone Number</label>
                        <input
                          type="text"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Tax ID / Reg Code</label>
                        <input
                          type="text"
                          value={companyTaxId}
                          onChange={(e) => setCompanyTaxId(e.target.value)}
                          placeholder="Tax ID Number"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Company Size</label>
                        <select
                          value={companySize}
                          onChange={(e) => setCompanySize(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#0E0A1F] border border-white/10 text-white focus:outline-none focus:border-violet-500 text-sm transition-all"
                        >
                          <option value="">Select Company Size</option>
                          <option value="1-10">1 - 10 employees</option>
                          <option value="11-50">11 - 50 employees</option>
                          <option value="51-200">51 - 200 employees</option>
                          <option value="201-500">201 - 500 employees</option>
                          <option value="500+">500+ employees</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">Company Logo URL / Base64</label>
                      <input
                        type="text"
                        value={companyLogo}
                        onChange={(e) => setCompanyLogo(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-stone-600 focus:outline-none focus:border-violet-500 text-sm transition-all font-mono"
                      />
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save Company Profile
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* TAB 4: Danger Zone */}
                {activeTab === 'danger' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-rose-400 mb-1 flex items-center gap-2">
                        <Trash2 className="w-5 h-5" />
                        Danger Zone
                      </h3>
                      <p className="text-stone-400 text-xs">Actions performed here cannot be easily undone.</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-4">
                      <div>
                        <h4 className="text-base font-semibold text-rose-300">Deactivate Account</h4>
                        <p className="text-xs text-stone-400 mt-1">
                          Deactivating your account will suspend your projects, remove active sessions, and invalidate CLI credentials.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Deactivate My Account
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        ) : null}

      </main>

      {/* Confirmation Modal for Deactivation */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#100C1F] border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-3 bg-rose-500/10 rounded-full border border-rose-500/20">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Deactivate Account?</h3>
              </div>

              <p className="text-stone-300 text-sm leading-relaxed">
                Are you sure you want to deactivate your account? You will be logged out immediately and lose CLI connectivity.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateAccount}
                  disabled={isDeactivating}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isDeactivating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Confirm Deactivate'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
