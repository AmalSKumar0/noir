import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'compact' | 'segmented';
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({
  variant = 'icon',
  className = '',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme, isDark } = useTheme();

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-full bg-slate-200/80 dark:bg-zinc-800/80 border border-slate-300/80 dark:border-zinc-700/60 shadow-inner backdrop-blur-md transition-colors ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`relative flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer ${
            !isDark
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
          aria-pressed={!isDark}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`relative flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer ${
            isDark
              ? 'bg-zinc-900 text-white shadow-sm font-semibold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
          aria-pressed={isDark}
        >
          <Moon className="w-3.5 h-3.5 text-violet-400" />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 cursor-pointer shadow-sm ${
          isDark
            ? 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white hover:border-zinc-600'
            : 'bg-white border-slate-300/90 text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400'
        } ${className}`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ y: -8, opacity: 0, rotate: -45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 8, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.18 }}
            className="flex items-center"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-violet-600" />
            )}
          </motion.div>
        </AnimatePresence>
        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </motion.button>
    );
  }

  const isCompact = variant === 'compact';
  const sizeClasses = isCompact ? 'w-8 h-8' : 'w-9 h-9';
  const iconSize = isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className={`relative ${sizeClasses} rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border ${
        isDark
          ? 'bg-zinc-900/90 border-zinc-700/80 text-amber-400 hover:bg-zinc-800 hover:border-amber-400/50 hover:text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
          : 'bg-white border-slate-300 text-violet-600 hover:bg-slate-50 hover:border-violet-400 hover:text-violet-700 shadow-sm'
      } ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ scale: 0.5, opacity: 0, rotate: -60 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 60 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <Sun className={iconSize} strokeWidth={2} />
          ) : (
            <Moon className={iconSize} strokeWidth={2} />
          )}
        </motion.div>
      </AnimatePresence>
      {showLabel && (
        <span className="sr-only">{isDark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
      )}
    </motion.button>
  );
}
