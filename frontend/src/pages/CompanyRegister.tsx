import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Building2, 
  User, 
  Globe, 
  Phone, 
  FileText, 
  Briefcase, 
  Users, 
  AlertCircle, 
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { setAuthTokens } from '../utils/auth';
import AuthLayout from '../components/AuthLayout';

export default function CompanyRegister() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Stage 1: Admin Account
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Stage 2: Company Details
  const [companyName, setCompanyName] = useState('');
  const [logo, setLogo] = useState('');
  const [industry, setIndustry] = useState('Technology & SaaS');
  const [companySize, setCompanySize] = useState('11-50 employees');
  const [website, setWebsite] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size validation (max 1MB raw file)
    if (file.size > 1 * 1024 * 1024) {
      setError('Logo image file must be smaller than 1MB. Please select a smaller image.');
      e.target.value = '';
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Auto-scale logo to max 400x400 to optimize payload size
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setLogo(compressedDataUrl);
        } else {
          setLogo(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };


  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) {
      setError('Company name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/accounts/register/company/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          company_name: companyName,
          logo,
          industry,

          company_size: companySize,
          website,
          tax_id: taxId,
          phone_number: phoneNumber,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Registration failed');
      }

      const data = await response.json();

      if (data.access) {
        setAuthTokens(data.access, data.refresh);
        if (data.user) {
          localStorage.setItem('user_role', data.user.role || 'company');
          localStorage.setItem('user', JSON.stringify(data.user));
          if (data.user.company_profile) {
            localStorage.setItem('company_profile', JSON.stringify(data.user.company_profile));
          }
        }
      }

      navigate('/company/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={
        <>
          Company <br />
          <span className="font-medium text-violet-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.25)]">Registration.</span>
        </>
      }
      description="Create a company workspace for your organization to monitor telemetry, configure custom SLA controls, and collaborate with your engineering team seamlessly."
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-white/[0.04] backdrop-blur-3xl border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.6)] flex flex-col gap-6"
      >
        {/* Step Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {currentStep === 1 ? 'Admin Account' : 'Company Profile'}
              </h2>
            </div>
            <span className="text-stone-400 text-xs font-mono mt-1">
              {currentStep === 1 ? 'Enter the detail of company admin' : 'Enter the details of the company'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs text-stone-400 self-start">
            <span className={currentStep === 1 ? 'text-violet-400 font-bold' : ''}>1</span>
            <span>/</span>
            <span className={currentStep === 2 ? 'text-violet-400 font-bold' : ''}>2</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          
          {/* STEP 1 */}
          {currentStep === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleNext}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 px-4 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                  />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 px-4 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                <input
                  type="email"
                  placeholder="Work Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-stone-400 text-xs font-mono">
                  Already registered?{' '}
                  <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold underline transition-colors">
                    Sign in
                  </Link>
                </span>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.form>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRegister}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 bg-stone-900/60 p-2.5 rounded-2xl border border-white/10">
                {logo ? (
                  <img src={logo} alt="Company Logo Preview" className="w-10 h-10 rounded-xl object-cover border border-white/20" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-mono">
                    Logo
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-stone-400">Company Logo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="text-[11px] text-stone-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-mono file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="Company Legal Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                />
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all font-mono appearance-none"
                  >
                    <option value="Technology & SaaS">Technology & SaaS</option>
                    <option value="FinTech & Banking">FinTech & Banking</option>
                    <option value="Healthcare & Bio">Healthcare & Bio</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Other">Other Enterprise</option>
                  </select>
                </div>

                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
                  <select
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all font-mono appearance-none"
                  >
                    <option value="1-10 employees">1-10 employees</option>
                    <option value="11-50 employees">11-50 employees</option>
                    <option value="51-200 employees">51-200 employees</option>
                    <option value="201-1000 employees">201-1000 employees</option>
                    <option value="1000+ employees">1000+ Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                <input
                  type="url"
                  placeholder="Website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Tax ID"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-stone-900/80 border border-white/10 rounded-full py-2.5 pl-10 pr-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-stone-400 hover:text-white text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-4">
                  <span className="text-stone-400 text-xs font-mono hidden sm:inline">
                    Already registered?{' '}
                    <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold underline transition-colors">
                      Sign in
                    </Link>
                  </span>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs font-mono tracking-wider transition-all disabled:opacity-70 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Registering...</span>
                      </>
                    ) : (
                      <>
                        <span>Register</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.form>
          )}

        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}
