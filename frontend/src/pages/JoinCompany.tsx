import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Mail, Globe, Users, Briefcase, FileText, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';

export default function JoinCompany() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    companyEmail: '',
    description: '',
    website: '',
    companySize: '',
    industry: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.companyEmail.trim()) {
      setError('Please fill in both Company Name and Company Email.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    // Simulate submission / store in local state
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen w-full bg-[#05030A] text-white flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-violet-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-pink-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="w-full max-w-[1400px] mx-auto px-6 md:px-12 py-6 flex items-center justify-between z-20">
        <Link to="/" className="flex items-center gap-3 text-white/80 hover:text-white transition-colors group">
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
            <ArrowLeft className="w-4 h-4 text-violet-400 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="text-xs font-mono uppercase tracking-widest font-semibold">Back to Home</span>
        </Link>

        <Link to="/" className="text-xl font-bold tracking-tighter text-white">
          NOIR <span className="text-violet-400 font-mono text-xs font-normal">ENTERPRISE</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-3xl mx-auto px-6 py-12 z-10 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden"
            >
              {/* Header Title */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-mono uppercase tracking-widest mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> Company Onboarding
                </div>
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-3">
                  Join as a Company
                </h1>
                <p className="text-stone-400 text-xs md:text-sm font-mono leading-relaxed">
                  Partner with NOIR to scale telemetry workflows, manage custom workspace clusters, and deploy enterprise reliability tools.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Name (Required) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-stone-300">
                      Company Name <span className="text-violet-400">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        name="companyName"
                        required
                        value={formData.companyName}
                        onChange={handleChange}
                        placeholder="e.g. Acme Corporation"
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Company Email (Required) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-stone-300">
                      Company Email <span className="text-violet-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        name="companyEmail"
                        required
                        value={formData.companyEmail}
                        onChange={handleChange}
                        placeholder="e.g. enterprise@acme.com"
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Website (Optional) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-stone-400">
                      Website <span className="text-white/30 text-[10px]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        placeholder="https://acme.com"
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Company Size (Optional) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-stone-400">
                      Company Size <span className="text-white/30 text-[10px]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        name="companySize"
                        value={formData.companySize}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#100C1F] text-white/60">Select company size</option>
                        <option value="1-10" className="bg-[#100C1F]">1 - 10 employees</option>
                        <option value="11-50" className="bg-[#100C1F]">11 - 50 employees</option>
                        <option value="51-200" className="bg-[#100C1F]">51 - 200 employees</option>
                        <option value="201-500" className="bg-[#100C1F]">201 - 500 employees</option>
                        <option value="500+" className="bg-[#100C1F]">500+ employees</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Industry (Optional) */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-stone-400">
                    Industry <span className="text-white/30 text-[10px]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#100C1F] text-white/60">Select industry</option>
                      <option value="Technology & Software" className="bg-[#100C1F]">Technology & Software</option>
                      <option value="Financial Services" className="bg-[#100C1F]">Financial Services & Fintech</option>
                      <option value="Healthcare & Biotech" className="bg-[#100C1F]">Healthcare & Life Sciences</option>
                      <option value="E-Commerce & Retail" className="bg-[#100C1F]">E-Commerce & Retail</option>
                      <option value="Telecommunications" className="bg-[#100C1F]">Telecommunications</option>
                      <option value="Media & Entertainment" className="bg-[#100C1F]">Media & Entertainment</option>
                      <option value="Cybersecurity" className="bg-[#100C1F]">Cybersecurity</option>
                      <option value="Other" className="bg-[#100C1F]">Other</option>
                    </select>
                  </div>
                </div>

                {/* Description (Optional) */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-stone-400">
                    Description <span className="text-white/30 text-[10px]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-white/40 absolute left-4 top-4" />
                    <textarea
                      name="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Tell us about your telemetry requirements or platform goals..."
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-full bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-stone-200 transition-colors shadow-lg shadow-violet-500/10 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Registering Company...
                    </span>
                  ) : (
                    'Submit Registration'
                  )}
                </motion.button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-white/5 border border-white/10 rounded-[2.5rem] p-12 backdrop-blur-xl text-center shadow-2xl flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Registration Submitted!</h2>
              <p className="text-stone-400 text-sm font-mono max-w-md mb-8 leading-relaxed">
                Thank you for registering <strong className="text-white">{formData.companyName}</strong>. Our enterprise team will review your details and reach out shortly to <span className="text-violet-300">{formData.companyEmail}</span>.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3.5 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-stone-200 transition-colors cursor-pointer"
              >
                Return to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer copyright */}
      <footer className="w-full max-w-[1400px] mx-auto px-6 py-6 text-center text-xs font-mono text-stone-600 z-10 border-t border-white/5">
        &copy; {new Date().getFullYear()} NOIR Enterprise Platform. All rights reserved.
      </footer>
    </div>
  );
}
