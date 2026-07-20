import { motion } from 'motion/react';
import { useEffect } from 'react';

export default function Loader({ onComplete }: { onComplete?: () => void; key?: string }) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 2200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center pointer-events-none"
    >
      <div className="flex flex-col text-white font-bold leading-[0.8] tracking-tighter" style={{ fontSize: '96px' }}>
        <div className="relative">
          <motion.div 
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "circOut" }}
            className="absolute -top-6 left-0 w-16 h-[8px] bg-violet-600"
          />
          <div className="overflow-hidden">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} // smooth ease-out
            >
              NO
            </motion.div>
          </div>
        </div>
        <div className="flex items-end">
          <div className="overflow-hidden">
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              IR
            </motion.div>
          </div>
          <motion.div 
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 1.1, ease: "circOut" }}
            className="w-16 h-[8px] bg-violet-600 ml-3 mb-2"
          />
        </div>
      </div>
    </motion.div>
  );
}
