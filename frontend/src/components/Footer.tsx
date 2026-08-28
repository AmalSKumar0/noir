import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="w-full pt-24 overflow-hidden flex flex-col items-center bg-[#000000] text-white">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full relative min-h-[500px] md:min-h-[700px] flex flex-col justify-between items-center bg-gradient-to-t from-black via-stone-950/80 to-stone-900/40 border-t border-stone-900 px-6 md:px-12 py-24" 
        style={{ borderTopLeftRadius: '50% 12%', borderTopRightRadius: '50% 12%' }}
      >
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" style={{ borderTopLeftRadius: '50% 12%', borderTopRightRadius: '50% 12%' }}>
           {/* Ambient Glows */}
           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/15 blur-[120px] rounded-full"></div>
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-900/10 blur-[80px] rounded-full"></div>
        </div>

        <div className="z-10 flex flex-col items-center text-center mt-12 md:mt-24 w-full">
           <h2 className="text-6xl sm:text-8xl md:text-9xl lg:text-[12rem] font-medium tracking-tighter text-white mb-6 leading-none">
              NOIR
           </h2>
           <p className="text-stone-400 text-sm md:text-base lg:text-lg font-mono max-w-xl mx-auto">
              The new Marketplace for all your apps. Innovate, collaborate and shape tomorrow.
           </p>
           
           <Link to="/register">
             <motion.button
               whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(124,58,237,0.3)" }}
               whileTap={{ scale: 0.95 }}
               className="mt-12 px-8 py-4 rounded-full bg-white text-black font-semibold uppercase tracking-widest text-xs md:text-sm flex items-center gap-2 hover:bg-stone-200 transition-colors shadow-[0_15px_45px_rgba(139,92,246,0.15)] cursor-pointer"
             >
               Get Started <ArrowUpRight className="w-4 h-4" />
             </motion.button>
           </Link>
        </div>

        <div className="z-10 w-full max-w-[1400px] mt-32 grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 border-t border-white/10 pt-12">
            <div className="flex flex-col gap-4 col-span-1 md:col-span-2">
                <span className="text-xl font-medium tracking-tight text-white mb-2">NOIR</span>
                <p className="text-stone-400 text-xs md:text-sm font-mono max-w-xs leading-relaxed">
                   A premium ecosystem for developers and creators. Build, ship, and scale your ideas.
                </p>
            </div>
            <div className="flex flex-col gap-4">
                <span className="text-xs font-semibold tracking-widest uppercase text-stone-300 mb-2">Platform</span>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Marketplace</a>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Creators</a>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Developers</a>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Pricing</a>
            </div>
            <div className="flex flex-col gap-4">
                <span className="text-xs font-semibold tracking-widest uppercase text-stone-300 mb-2">Company</span>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">About Us</a>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Careers</a>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Privacy Policy</a>
                <a href="#" className="text-stone-500 hover:text-white transition-colors text-sm font-mono">Terms of Service</a>
            </div>
        </div>

        <div className="z-10 w-full max-w-[1400px] flex flex-col md:flex-row justify-between items-center mt-16 text-stone-500 text-xs font-mono border-t border-white/5 pt-8">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
              <span>&copy; {new Date().getFullYear()} NOIR. All rights reserved.</span>
              <span className="hidden md:block text-stone-700">|</span>
              <span>
                Developed by <a href="https://amalskumar.dev" target="_blank" rel="noopener noreferrer" className="text-stone-300 hover:text-white transition-colors hover:underline">Amal S Kumar</a>
              </span>
            </div>
            <div className="flex gap-6 mt-4 md:mt-0">
               <a href="#" className="hover:text-white transition-colors">Twitter</a>
               <a href="#" className="hover:text-white transition-colors">GitHub</a>
               <a href="#" className="hover:text-white transition-colors">Discord</a>
            </div>
        </div>
      </motion.div>
    </footer>
  );
}
