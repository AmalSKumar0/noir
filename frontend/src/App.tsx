import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { ArrowRight, Terminal, Mail, CheckCircle2 } from 'lucide-react';

function FallingAshes() {
  const [ashes, setAshes] = useState([]);

  useEffect(() => {
    const newAshes = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${Math.random() * 15 + 10}s`, // 10-25s fall
      delay: `${Math.random() * -25}s`, // Negative delay so they are already falling
      size: `${Math.random() * 2 + 1}px`, // 1-3px
      opacity: Math.random() * 0.4 + 0.1, // 0.1 - 0.5
    }));
    setAshes(newAshes);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(360deg); }
        }
      `}</style>
      {ashes.map((ash) => (
        <div
          key={ash.id}
          className="absolute top-[-10px] bg-red-500 rounded-full blur-[0.5px]"
          style={{
            left: ash.left,
            width: ash.size,
            height: ash.size,
            opacity: ash.opacity,
            animation: `fall ${ash.duration} linear infinite`,
            animationDelay: ash.delay,
          }}
        />
      ))}
    </div>
  );
}

function BootSequenceLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const sequence = [
      '> initializing NOIR core kernel...',
      '> loading autonomous chaos models...',
      '> mapping root-cause analysis vectors...',
      '> securing neural telemetry links...',
      '> SYSTEM STATUS: PENDING DEPLOYMENT',
      '> awaiting operator authorization_',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < sequence.length) {
        setLogs(prev => [...prev, sequence[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mt-12 lg:mt-0 w-full max-w-2xl lg:ml-auto">
      {/* Strong, cloudy reddish aura */}
      <div className="absolute -inset-12 bg-red-600/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute inset-0 bg-red-500/15 blur-[80px] rounded-[40%] mix-blend-screen pointer-events-none" />
      <div className="absolute inset-8 bg-red-400/10 blur-[60px] rounded-[30%] mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '7s' }} />
      
      <div className="relative border border-gray-800/80 rounded-xl bg-[#080808]/80 overflow-hidden backdrop-blur-md shadow-[0_0_40px_rgba(220,38,38,0.1)]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/80 bg-[#0c0c0c]">
          <div className="flex items-center gap-3 text-[10px] font-mono font-semibold tracking-widest text-gray-400 uppercase">
            <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse"></div>
            SYSTEM BOOT SEQUENCE
          </div>
          <Terminal className="w-4 h-4 text-gray-600" />
        </div>
        <div className="p-6 font-mono text-[11px] sm:text-xs text-gray-400 space-y-3.5 leading-relaxed min-h-[280px] flex flex-col justify-start">
          <AnimatePresence>
            {logs.map((log, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 ${log?.includes('PENDING') ? 'text-yellow-400' : ''}`}
              >
                <span className="text-gray-600 font-bold opacity-50 hidden sm:inline">{(new Date()).toISOString().split('T')[1].substring(0,8)}</span>
                <span className="flex-1">{log}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length < 6 && (
            <motion.div 
              animate={{ opacity: [1, 0] }} 
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-red-500 font-bold mt-2"
            >_</motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      // Add your API call here
    }
  };

  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 border border-green-500/30 bg-green-500/5 rounded-lg p-5 flex items-center gap-4 max-w-md"
      >
        <CheckCircle2 className="w-6 h-6 text-green-500" />
        <div>
          <p className="text-sm text-gray-200 font-semibold">Comm Link Established.</p>
          <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-widest">You are on the list.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-md relative z-20">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@system.net" 
            className="w-full bg-[#0a0a0a]/80 backdrop-blur-sm border border-gray-700/80 rounded-sm py-4 pl-11 pr-4 text-[11px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>
        <button 
          type="submit" 
          className="bg-white text-black hover:bg-gray-200 text-[10px] font-mono tracking-widest font-bold py-4 px-6 rounded-sm flex items-center justify-center gap-3 transition-colors shrink-0"
        >
          REQUEST ACCESS <ArrowRight className="w-3.5 h-3.5 text-red-600" />
        </button>
      </div>
      <p className="text-[10px] font-mono text-gray-500 mt-4 uppercase tracking-widest">
        * Priority access granted to early registrants.
      </p>
    </form>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30 font-sans overflow-x-hidden relative flex flex-col">
      <FallingAshes />
      
      {/* Navbar Minimalist */}
      <nav className="w-full px-8 py-10 flex items-center justify-between z-50 relative max-w-[90rem] mx-auto">
        <div className="text-lg font-bold tracking-[0.2em] flex items-baseline text-white uppercase">
          NOIR<span className="text-red-500 font-bold ml-0.5">_</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono font-semibold tracking-widest text-gray-400 uppercase">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse" />
          SYSTEM STANDBY
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-[90rem] w-full mx-auto px-8 py-8 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        <div className="flex flex-col xl:max-w-xl lg:pl-16">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col"
          >
            <h2 className="font-serif italic text-[2.5rem] lg:text-[3.5rem] text-gray-400 mb-[-1.5rem] lg:mb-[-2.25rem] ml-1 relative z-10">Prepare for</h2>
            <div className="leading-[0.8] tracking-tighter font-black text-white">
              <div className="text-[8rem] sm:text-[10rem] lg:text-[14rem]">NO</div>
              <div className="text-[8rem] sm:text-[10rem] lg:text-[14rem] flex items-baseline">
                IR<span className="text-red-600 text-[5rem] sm:text-[7rem] lg:text-[10rem] ml-1">_</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="space-y-6 mt-6"
          >
            <h3 className="text-[11px] sm:text-xs font-mono font-semibold tracking-[0.25em] text-red-500 uppercase">
Coming soon            </h3>
            
            
            <div className="flex gap-4 sm:gap-6 text-[10px] font-mono font-semibold tracking-widest text-gray-500 uppercase pt-2">
              
              <span className="text-gray-800">|</span>
              <span>Q4 2024 Deployment</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <WaitlistForm />
          </motion.div>

        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          <BootSequenceLog />
        </motion.div>
      </main>
      
      {/* Footer */}
      <footer className="w-full px-8 py-6 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-gray-600 relative z-10 max-w-[90rem] mx-auto border-t border-gray-800/50">
        <div>© {new Date().getFullYear()} NOIR SYSTEMS. ALL RIGHTS RESERVED.</div>
        <div className="flex gap-6 mt-4 sm:mt-0 uppercase tracking-widest">
          <a href="#" className="hover:text-gray-300 transition-colors">Twitter (X)</a>
          <a href="#" className="hover:text-gray-300 transition-colors">GitHub</a>
        </div>
      </footer>
    </div>
  );
}