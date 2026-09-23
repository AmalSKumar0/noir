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
  ArrowLeft,
  CheckCircle2,
  XCircle,
  UploadCloud,
  FileCheck,
  X,
  ShieldCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { setAuthTokens, getRoleHomePath } from '../utils/auth';
import { 
  validateEmail, 
  validatePassword, 
  validateConfirmPassword, 
  validateTaxId, 
  validateCompanyName, 
  validateCertificateFile, 
  validatePhone, 
  validateUrl 
} from '../utils/validation';
import AuthLayout from '../components/AuthLayout';

export default function CompanyRegister() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Stage 1: Admin Account
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Touched states for live validation
  const [touchedStep1, setTouchedStep1] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Stage 2: Company Details & Verification
  const [companyName, setCompanyName] = useState('');
  const [logo, setLogo] = useState('');
  const [industry, setIndustry] = useState('Technology & SaaS');
  const [companySize, setCompanySize] = useState('11-50 employees');
  const [website, setWebsite] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Ownership Certificate State
  const [ownershipCertificate, setOwnershipCertificate] = useState('');
  const [certificateFileName, setCertificateFileName] = useState('');
  const [certificateFileSize, setCertificateFileSize] = useState('');
  const [certificateError, setCertificateError] = useState('');

  const [touchedStep2, setTouchedStep2] = useState({
    companyName: false,
    taxId: false,
    website: false,
    phoneNumber: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Validations for Stage 1
  const firstNameVal = { isValid: firstName.trim().length >= 2, error: 'First name must be at least 2 characters' };
  const lastNameVal = { isValid: lastName.trim().length >= 2, error: 'Last name must be at least 2 characters' };
  const emailVal = validateEmail(email);
  const passwordVal = validatePassword(password);
  const confirmVal = validateConfirmPassword(password, confirmPassword);

  const isStep1Valid = firstNameVal.isValid && lastNameVal.isValid && emailVal.isValid && passwordVal.isValid && confirmVal.isValid;

  // Validations for Stage 2
  const companyNameVal = validateCompanyName(companyName);
  const taxIdVal = validateTaxId(taxId);
  const websiteVal = validateUrl(website);
  const phoneVal = validatePhone(phoneNumber);

  const isStep2Valid = companyNameVal.isValid && taxIdVal.isValid && websiteVal.isValid && phoneVal.isValid;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setError('Logo image file must be smaller than 1MB.');
      e.target.value = '';
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
          setLogo(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          setLogo(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const val = validateCertificateFile(file);
    if (!val.isValid) {
      setCertificateError(val.error || 'Invalid file');
      e.target.value = '';
      return;
    }

    setCertificateError('');
    setCertificateFileName(file.name);
    setCertificateFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (event) => {
      setOwnershipCertificate(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCertificate = () => {
    setOwnershipCertificate('');
    setCertificateFileName('');
    setCertificateFileSize('');
    setCertificateError('');
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedStep1({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!isStep1Valid) {
      setError(
        (!firstNameVal.isValid && firstNameVal.error) ||
        (!lastNameVal.isValid && lastNameVal.error) ||
        emailVal.error ||
        passwordVal.error ||
        confirmVal.error ||
        'Please resolve errors in the highlighted fields'
      );
      return;
    }

    setError('');
    setCurrentStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedStep2({
      companyName: true,
      taxId: true,
      website: true,
      phoneNumber: true,
    });

    if (!isStep2Valid) {
      setError(companyNameVal.error || taxIdVal.error || websiteVal.error || phoneVal.error || 'Please resolve the highlighted errors');
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
          ownership_certificate: ownershipCertificate,
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

      const homePath = getRoleHomePath(data.user?.role || 'company', data.user);
      navigate(homePath);

    } catch (err: any) {
      setError(err.message || 'An error occurred during company registration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={
        <>
          Empower your enterprise with <br />
          <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.15)]">autonomous resilience.</span>
        </>
      }
      description="Connect your developers, monitor system cascades, and automate fault detection with the industry standard chaos engineering platform."
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="relative w-full max-w-[500px] p-6 md:p-10 rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col"
      >
        <div className="flex flex-col mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-violet-400" />
              Company Verification
            </span>
            <span className="text-xs font-mono text-stone-500">Step {currentStep} of 2</span>
          </div>

          <h2 className="text-xl font-medium tracking-tight text-white mb-1">
            {currentStep === 1 ? 'Admin Account' : 'Company Identification'}
          </h2>
          <p className="text-stone-400 text-xs font-mono tracking-wide">
            {currentStep === 1 ? 'Set up the primary administrative credentials' : 'Legal identity and business verification documents'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-800/80 h-1 rounded-full mb-6 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
            initial={{ width: '50%' }}
            animate={{ width: currentStep === 1 ? '50%' : '100%' }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          
          {/* STEP 1: ADMIN CREDENTIALS */}
          {currentStep === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleNext}
              className="flex flex-col gap-3.5"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setTouchedStep1((prev) => ({ ...prev, firstName: true }));
                      }}
                      onBlur={() => setTouchedStep1((prev) => ({ ...prev, firstName: true }))}
                      required
                      className={`w-full bg-stone-900/80 border rounded-full py-2.5 px-4 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                        touchedStep1.firstName && firstName
                          ? firstNameVal.isValid
                            ? 'border-emerald-500/50 bg-emerald-950/10'
                            : 'border-red-500/50 bg-red-950/10'
                          : 'border-white/10 focus:border-violet-500/50'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setTouchedStep1((prev) => ({ ...prev, lastName: true }));
                      }}
                      onBlur={() => setTouchedStep1((prev) => ({ ...prev, lastName: true }))}
                      required
                      className={`w-full bg-stone-900/80 border rounded-full py-2.5 px-4 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                        touchedStep1.lastName && lastName
                          ? lastNameVal.isValid
                            ? 'border-emerald-500/50 bg-emerald-950/10'
                            : 'border-red-500/50 bg-red-950/10'
                          : 'border-white/10 focus:border-violet-500/50'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* WORK EMAIL */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="email"
                    placeholder="Work Email (e.g. alex@company.com)"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setTouchedStep1((prev) => ({ ...prev, email: true }));
                    }}
                    onBlur={() => setTouchedStep1((prev) => ({ ...prev, email: true }))}
                    required
                    className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-9 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                      touchedStep1.email && email
                        ? emailVal.isValid
                          ? 'border-emerald-500/50 bg-emerald-950/10'
                          : 'border-red-500/50 bg-red-950/10'
                        : 'border-white/10 focus:border-violet-500/50'
                    }`}
                  />
                  {touchedStep1.email && email && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {emailVal.isValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {touchedStep1.email && !emailVal.isValid && email && (
                  <span className="text-[10px] font-mono text-red-400 pl-3">{emailVal.error}</span>
                )}
              </div>

              {/* PASSWORD */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password (min 8 chars)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setTouchedStep1((prev) => ({ ...prev, password: true }));
                    }}
                    onBlur={() => setTouchedStep1((prev) => ({ ...prev, password: true }))}
                    required
                    className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-16 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                      touchedStep1.password && password
                        ? passwordVal.isValid
                          ? 'border-emerald-500/50 bg-emerald-950/10'
                          : 'border-red-500/50 bg-red-950/10'
                        : 'border-white/10 focus:border-violet-500/50'
                    }`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {touchedStep1.password && password && (
                      passwordVal.isValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-stone-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {touchedStep1.password && password && (
                  <div className="px-3 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-stone-400">
                      Strength:{' '}
                      <span className={passwordVal.strength === 'strong' ? 'text-emerald-400' : passwordVal.strength === 'medium' ? 'text-amber-400' : 'text-red-400'}>
                        {passwordVal.strength.toUpperCase()}
                      </span>
                    </span>
                    <span className={passwordVal.hasMinLength ? 'text-emerald-400' : 'text-stone-500'}>
                      {password.length}/8+ chars
                    </span>
                  </div>
                )}
                {touchedStep1.password && !passwordVal.isValid && password && (
                  <span className="text-[10px] font-mono text-red-400 pl-3">{passwordVal.error}</span>
                )}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setTouchedStep1((prev) => ({ ...prev, confirmPassword: true }));
                    }}
                    onBlur={() => setTouchedStep1((prev) => ({ ...prev, confirmPassword: true }))}
                    required
                    className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-16 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                      touchedStep1.confirmPassword && confirmPassword
                        ? confirmVal.isValid
                          ? 'border-emerald-500/50 bg-emerald-950/10'
                          : 'border-red-500/50 bg-red-950/10'
                        : 'border-white/10 focus:border-violet-500/50'
                    }`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {touchedStep1.confirmPassword && confirmPassword && (
                      confirmVal.isValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-stone-500 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {touchedStep1.confirmPassword && confirmPassword && (
                  <span className={`text-[10px] font-mono pl-3 ${confirmVal.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {confirmVal.isValid ? '✓ Passwords match' : confirmVal.error}
                  </span>
                )}
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
                  className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-violet-600/20"
                >
                  <span>Next: Company Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.form>
          )}

          {/* STEP 2: COMPANY DETAILS & IDENTIFICATION */}
          {currentStep === 2 && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRegister}
              className="flex flex-col gap-3.5"
            >
              {/* LOGO UPLOAD */}
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

              {/* COMPANY NAME */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Company Legal Name *"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setTouchedStep2((prev) => ({ ...prev, companyName: true }));
                    }}
                    onBlur={() => setTouchedStep2((prev) => ({ ...prev, companyName: true }))}
                    required
                    className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-9 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                      touchedStep2.companyName && companyName
                        ? companyNameVal.isValid
                          ? 'border-emerald-500/50 bg-emerald-950/10'
                          : 'border-red-500/50 bg-red-950/10'
                        : 'border-white/10 focus:border-violet-500/50'
                    }`}
                  />
                  {touchedStep2.companyName && companyName && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {companyNameVal.isValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {touchedStep2.companyName && !companyNameVal.isValid && companyName && (
                  <span className="text-[10px] font-mono text-red-400 pl-3">{companyNameVal.error}</span>
                )}
              </div>

              {/* TAX ID / BUSINESS IDENTIFICATION (REQUIRED) */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Tax ID / Registration No. (e.g. EIN, GST, VAT, CIN) *"
                    value={taxId}
                    onChange={(e) => {
                      setTaxId(e.target.value);
                      setTouchedStep2((prev) => ({ ...prev, taxId: true }));
                    }}
                    onBlur={() => setTouchedStep2((prev) => ({ ...prev, taxId: true }))}
                    required
                    className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-9 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                      touchedStep2.taxId && taxId
                        ? taxIdVal.isValid
                          ? 'border-emerald-500/50 bg-emerald-950/10'
                          : 'border-red-500/50 bg-red-950/10'
                        : 'border-white/10 focus:border-violet-500/50'
                    }`}
                  />
                  {touchedStep2.taxId && taxId && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {taxIdVal.isValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {touchedStep2.taxId && !taxIdVal.isValid && taxId ? (
                  <span className="text-[10px] font-mono text-red-400 pl-3">{taxIdVal.error}</span>
                ) : (
                  <span className="text-[10px] font-mono text-stone-500 pl-3">Official corporate identification used for verification</span>
                )}
              </div>

              {/* OWNERSHIP / INCORPORATION CERTIFICATE UPLOAD */}
              <div className="bg-stone-900/60 p-3 rounded-2xl border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-stone-300 flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-violet-400" />
                    <span>Business Ownership / Incorporation Certificate</span>
                  </label>
                  <span className="text-[10px] font-mono text-stone-500">PDF, PNG, JPG (max 5MB)</span>
                </div>

                {ownershipCertificate ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-violet-950/30 border border-violet-500/30 text-xs font-mono">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-white truncate max-w-[200px]">{certificateFileName || 'certificate.pdf'}</span>
                      <span className="text-stone-400 text-[10px]">{certificateFileSize}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCertificate}
                      className="p-1 rounded-lg hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
                      title="Remove Certificate"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={handleCertificateUpload}
                      className="text-[11px] text-stone-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-mono file:bg-violet-600/30 file:border file:border-violet-500/40 file:text-violet-300 hover:file:bg-violet-600/50 cursor-pointer w-full"
                    />
                  </div>
                )}
                {certificateError && (
                  <span className="text-[10px] font-mono text-red-400">{certificateError}</span>
                )}
              </div>

              {/* INDUSTRY & COMPANY SIZE */}
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
                    <option value="Cloud Infrastructure">Cloud Infrastructure</option>
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

              {/* WEBSITE & PHONE */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                    <input
                      type="url"
                      placeholder="Website (https://...)"
                      value={website}
                      onChange={(e) => {
                        setWebsite(e.target.value);
                        setTouchedStep2((prev) => ({ ...prev, website: true }));
                      }}
                      className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-3 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                        touchedStep2.website && website && !websiteVal.isValid
                          ? 'border-red-500/50 bg-red-950/10'
                          : 'border-white/10 focus:border-violet-500/50'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                    <input
                      type="tel"
                      placeholder="Phone (+1...)"
                      value={phoneNumber}
                      onChange={(e) => {
                        setPhoneNumber(e.target.value);
                        setTouchedStep2((prev) => ({ ...prev, phoneNumber: true }));
                      }}
                      className={`w-full bg-stone-900/80 border rounded-full py-2.5 pl-10 pr-3 text-xs text-white placeholder-stone-500 focus:outline-none transition-all font-mono ${
                        touchedStep2.phoneNumber && phoneNumber && !phoneVal.isValid
                          ? 'border-red-500/50 bg-red-950/10'
                          : 'border-white/10 focus:border-violet-500/50'
                      }`}
                    />
                  </div>
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
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs font-mono tracking-wider transition-all disabled:opacity-70 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-violet-600/25"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration</span>
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
