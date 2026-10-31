import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="w-full pt-24 overflow-hidden flex flex-col items-center bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white transition-colors duration-200">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full relative min-h-[500px] md:min-h-[700px] flex flex-col justify-between items-center bg-gradient-to-t from-slate-200/90 via-slate-100/90 to-white dark:from-black dark:via-stone-950/80 dark:to-stone-900/40 border-t border-slate-200 dark:border-stone-900 px-6 md:px-12 py-24 transition-colors duration-200" 
        style={{ borderTopLeftRadius: '50% 12%', borderTopRightRadius: '50% 12%' }}
      >
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" style={{ borderTopLeftRadius: '50% 12%', borderTopRightRadius: '50% 12%' }}>
           {/* Ambient Glows */}
           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 dark:bg-violet-600/15 blur-[120px] rounded-full"></div>
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-900/5 dark:bg-violet-900/10 blur-[80px] rounded-full"></div>
        </div>

        <div className="z-10 flex flex-col items-center text-center mt-12 md:mt-24 w-full">
           <h2 className="text-6xl sm:text-8xl md:text-9xl lg:text-[12rem] font-medium tracking-tighter text-slate-950 dark:text-white mb-6 leading-none">
              NOIR
           </h2>
           <p className="text-slate-600 dark:text-stone-400 text-sm md:text-base lg:text-lg font-mono max-w-xl mx-auto">
              The new Marketplace for all your apps. Innovate, collaborate and shape tomorrow.
           </p>
           
           <Link to="/register">
             <motion.button
               whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(30, 58, 138, 0.25)" }}
               whileTap={{ scale: 0.95 }}
               className="mt-12 px-8 py-4 rounded-full bg-transparent text-blue-900 border-2 border-blue-900 hover:bg-blue-900/5 hover:text-blue-950 hover:border-blue-950 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-400/10 font-semibold uppercase tracking-widest text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer backdrop-blur-[2px]"
             >
               Get Started <ArrowUpRight className="w-4 h-4" />
             </motion.button>
           </Link>
        </div>

        <div className="z-10 w-full max-w-[1400px] mt-32 grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 border-t border-slate-300 dark:border-white/10 pt-12">
            <div className="flex flex-col gap-4 col-span-1 md:col-span-2">
                <span className="text-xl font-medium tracking-tight text-slate-950 dark:text-white mb-2">NOIR</span>
                <p className="text-slate-600 dark:text-stone-400 text-xs md:text-sm font-mono max-w-xs leading-relaxed">
                   A premium ecosystem for developers and creators. Build, ship, and scale your ideas.
                </p>
            </div>
            <div className="flex flex-col gap-4">
                <span className="text-xs font-semibold tracking-widest uppercase text-slate-700 dark:text-stone-300 mb-2">Platform</span>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Marketplace</a>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Creators</a>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Developers</a>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Pricing</a>
            </div>
            <div className="flex flex-col gap-4">
                <span className="text-xs font-semibold tracking-widest uppercase text-slate-700 dark:text-stone-300 mb-2">Company</span>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">About Us</a>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Careers</a>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Privacy Policy</a>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors text-sm font-mono">Terms of Service</a>
            </div>
        </div>

        <div className="z-10 w-full max-w-[1400px] flex flex-col md:flex-row justify-between items-center mt-16 text-slate-600 dark:text-stone-500 text-xs font-mono border-t border-slate-200 dark:border-white/5 pt-8">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
              <span>&copy; {new Date().getFullYear()} NOIR. All rights reserved.</span>
              <span className="hidden md:block text-slate-400 dark:text-stone-700">|</span>
              <span>
                Developed by <a href="https://amalskumar.dev" target="_blank" rel="noopener noreferrer" className="text-slate-800 hover:text-violet-600 dark:text-stone-300 dark:hover:text-white transition-colors hover:underline">Amal S Kumar</a>
              </span>
            </div>
            <div className="flex gap-6 mt-4 md:mt-0">
               <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors">Twitter</a>
               <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors">GitHub</a>
               <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-stone-500 dark:hover:text-white transition-colors">Discord</a>
            </div>
        </div>
      </motion.div>
    </footer>
  );
}
