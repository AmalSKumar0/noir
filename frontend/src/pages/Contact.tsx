import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';

// Floating leaf/petal particles matching the screenshot
const PARTICLES = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  size: Math.random() * 12 + 6,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: Math.random() * 12 + 10,
  delay: Math.random() * 5,
  rotation: Math.random() * 360,
}));

export default function Contact() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    projectDescription: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 700);
  };

  return (
    <main className="w-full flex flex-col min-h-screen bg-[#07060B] text-white font-sans relative overflow-hidden select-none">
      {/* Floating Petal/Leaf Background Animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {PARTICLES.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}vw`,
              y: `${particle.y}vh`,
              opacity: 0.1,
              rotate: particle.rotation,
            }}
            animate={{
              y: [`${particle.y}vh`, `${(particle.y + 30) % 100}vh`, `${particle.y}vh`],
              x: [`${particle.x}vw`, `${(particle.x + 10) % 100}vw`, `${particle.x}vw`],
              rotate: [particle.rotation, particle.rotation + 180, particle.rotation + 360],
              opacity: [0.1, 0.25, 0.1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: particle.delay,
            }}
            className="absolute text-violet-400/20"
          >
            {/* SVG Petal Shape */}
            <svg
              width={particle.size}
              height={particle.size * 1.5}
              viewBox="0 0 24 36"
              fill="currentColor"
            >
              <path d="M12 0C12 0 24 12 24 24C24 30.6274 18.6274 36 12 36C5.37258 36 0 30.6274 0 24C0 12 12 0 12 0Z" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* Header Navbar */}
      <div className="z-30 w-full">
        <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      </div>

      {/* Main Contact Container */}
      <div className="z-10 flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-16 pt-28 pb-16 flex flex-col justify-between">
        {/* Top Header Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 md:mb-16"
        >
          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold tracking-tight text-white leading-none">
            Contact me
          </h1>
        </motion.div>

        {/* Content Split: Left (Info) & Right (Form) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          
          {/* LEFT COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-6 flex flex-col justify-between h-full space-y-12"
          >
            <div>
              {/* Location & Year Header */}
              <div className="mb-10">
                <span className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-stone-400 block mb-1">
                  LOCATION & YEAR
                </span>
                <p className="text-xs sm:text-sm font-mono text-violet-300/80">
                  Kerala, India &copy; 2026
                </p>
              </div>

              {/* Main Contact Information */}
              <div className="space-y-3">
                <a
                  href="mailto:amalskumardev@gmail.com"
                  className="block text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-white hover:text-stone-300 transition-colors tracking-tight break-all"
                >
                  amalskumardev@gmail.com
                </a>
                <a
                  href="tel:+918590774603"
                  className="block text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-[#C084FC] hover:text-purple-300 transition-colors tracking-tight"
                >
                  +91 85907 74603
                </a>
              </div>
            </div>

            {/* Bottom Left Sub-Footer Info */}
            <div className="pt-12 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
              <div className="text-xs font-mono text-stone-500 space-y-1">
                <p>Kerala, India / 2026</p>
                <p>Say hello : Work with us</p>
              </div>

              <div className="flex items-center gap-6 text-xs font-mono text-stone-300">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  LinkedIn
                </a>
                <a
                  href="mailto:amalskumardev@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  Email
                </a>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: Minimal Underline Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-6"
          >
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.form
                  key="contact-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-10"
                >
                  {/* First Name & Last Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-6">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-mono uppercase tracking-[0.25em] text-stone-400">
                        FIRST NAME
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="First Name"
                        className="w-full bg-transparent border-b border-white/20 pb-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-violet-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-[10px] font-mono uppercase tracking-[0.25em] text-stone-400">
                        LAST NAME
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="Last Name"
                        className="w-full bg-transparent border-b border-white/20 pb-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-violet-400 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Email Address (Required) */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-mono uppercase tracking-[0.25em] text-stone-400">
                      EMAIL ADDRESS (REQUIRED)
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                      className="w-full bg-transparent border-b border-white/20 pb-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-violet-400 transition-colors"
                    />
                  </div>

                  {/* Project Description */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-mono uppercase tracking-[0.25em] text-stone-400">
                      PROJECT DESCRIPTION
                    </label>
                    <textarea
                      name="projectDescription"
                      rows={3}
                      value={formData.projectDescription}
                      onChange={handleChange}
                      placeholder="Tell me about your project details, goals, timeline..."
                      className="w-full bg-transparent border-b border-white/20 pb-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-violet-400 transition-colors resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm flex items-center gap-2 hover:bg-stone-200 transition-colors cursor-pointer disabled:opacity-50 shadow-lg"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Submit <Send className="w-4 h-4 rotate-45" />
                        </span>
                      )}
                    </motion.button>
                  </div>
                </motion.form>
              ) : (
                <motion.div
                  key="success-message"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="py-12 border-t border-white/10 flex flex-col items-start space-y-4"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-3xl font-bold text-white">Thank you!</h3>
                  <p className="text-stone-400 text-sm font-mono leading-relaxed max-w-md">
                    Your message has been received. I'll get back to you at <span className="text-violet-300">{formData.email}</span> as soon as possible.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({ firstName: '', lastName: '', email: '', projectDescription: '' });
                    }}
                    className="mt-4 px-6 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
                  >
                    Send Another Message
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
