import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidthClass = 'max-w-lg' }: ModalProps) {
  // Prevent click inside modal content from closing it
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container / Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            onClick={handleContentClick}
            className={`relative w-full ${maxWidthClass} overflow-hidden rounded-[2rem] bg-stone-950/90 border border-white/10 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl z-10 my-8`}
          >
            {/* Top Glow Decor */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="relative text-stone-300">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
