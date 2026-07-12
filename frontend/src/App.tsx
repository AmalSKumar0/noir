import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { 
  Activity, ShieldCheck, Target, Search, Bell, Settings, 
  Terminal, BarChart2, Layout, Database, GitBranch, 
  ChevronRight, AlertTriangle, CheckCircle2, Plus, 
  MoreVertical, Cpu, Network, ArrowRight
} from 'lucide-react';

function Sidebar() {
  const navItems = [
    { icon: Layout, label: 'Overview', active: true },
    { icon: Terminal, label: 'Experiments', active: false },
    { icon: AlertTriangle, label: 'Anomalies', active: false },
    { icon: Network, label: 'Topology', active: false },
    { icon: Database, label: 'Data Sources', active: false },
    { icon: Settings, label: 'Settings', active: false },
  ];

  return (
    <motion.aside 
      initial={{ x: -250 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-64 bg-[#0a0a0a] border-r border-gray-800/80 flex flex-col h-screen fixed left-0 top-0 z-50"
    >
      <div className="px-8 py-8">
        <div className="text-xl font-bold tracking-[0.2em] flex items-baseline text-white uppercase">
          NOIR<span className="text-red-500 font-bold ml-0.5">_</span>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-1">
        {navItems.map((item, i) => (
          <motion.button
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-colors ${
              item.active 
                ? 'bg-red-500/10 text-red-500 font-semibold' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </motion.button>
        ))}
      </nav>

      <div className="p-6 border-t border-gray-800/80">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">System Online</span>
        </div>
      </div>
    </motion.aside>
  );
}

function Header() {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-20 border-b border-gray-800/80 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-40"
    >
      <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
        <span className="text-red-500">Workspace</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white">Production_Env</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search experiments..." 
            className="bg-[#0a0a0a] border border-gray-800/80 rounded-md py-2 pl-10 pr-4 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors w-64"
          />
        </div>
        <button className="relative text-gray-400 hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#050505]" />
        </button>
        <div className="w-8 h-8 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-mono text-white">
          OP
        </div>
      </div>
    </motion.header>
  );
}

function MetricCard({ title, value, icon: Icon, trend, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-[#0a0a0a] border border-gray-800/80 rounded-xl p-6 relative overflow-hidden group hover:border-gray-700 transition-colors"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full -z-10 group-hover:bg-red-500/10 transition-colors" />
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">{title}</h3>
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-medium tracking-tight text-white">{value}</span>
        {trend && (
          <span className={`text-[10px] font-mono ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

function ConsoleTerminal() {
  const [logs, setLogs] = useState<string[]>([
    '> initializing experiment NOIR-773',
    '> attaching to container runtime',
  ]);

  useEffect(() => {
    const sequence = [
      '> injecting network latency (500ms) to auth-service',
      '> monitoring request queue depth',
      '> WARN: queue depth exceeded threshold (p99 > 2s)',
      '> anomaly detected in dependent service: billing-api',
      '> generating regression test suite',
      '> experiment paused for operator review_'
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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
      className="col-span-1 lg:col-span-2 bg-[#080808] border border-gray-800/80 rounded-xl overflow-hidden flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/80 bg-[#0c0c0c]">
        <div className="flex items-center gap-3 text-[10px] font-mono font-semibold tracking-widest text-gray-400 uppercase">
          <Terminal className="w-3.5 h-3.5 text-red-500" />
          Active Experiment Console
        </div>
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>
      </div>
      <div className="flex-1 p-5 font-mono text-[11px] text-gray-400 space-y-2.5 leading-relaxed overflow-y-auto min-h-[240px]">
        <AnimatePresence>
          {logs.map((log, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex gap-3 ${log?.includes('WARN') || log?.includes('anomaly') ? 'text-red-400' : ''}`}
            >
              <span className="text-gray-600 font-bold opacity-50">{(new Date()).toISOString().split('T')[1].substring(0,8)}</span>
              {log}
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length < 8 && (
          <motion.div 
            animate={{ opacity: [1, 0] }} 
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="text-red-500 font-bold"
          >_</motion.div>
        )}
      </div>
    </motion.div>
  );
}

function AnomaliesList() {
  const anomalies = [
    { id: 'ANM-082', service: 'payment-gateway', severity: 'critical', time: '2m ago' },
    { id: 'ANM-081', service: 'user-session', severity: 'high', time: '14m ago' },
    { id: 'ANM-080', service: 'notification-worker', severity: 'medium', time: '1h ago' },
    { id: 'ANM-079', service: 'search-index', severity: 'low', time: '3h ago' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-[#0a0a0a] border border-gray-800/80 rounded-xl overflow-hidden flex flex-col h-full"
    >
      <div className="px-5 py-4 border-b border-gray-800/80 flex justify-between items-center bg-[#0c0c0c]">
        <h3 className="text-[10px] font-mono tracking-widest text-gray-400 uppercase font-semibold">Recent Anomalies</h3>
        <button className="text-gray-500 hover:text-white"><MoreVertical className="w-4 h-4" /></button>
      </div>
      <div className="divide-y divide-gray-800/50 flex-1 bg-[#050505]">
        {anomalies.map((anm, i) => (
          <motion.div 
            key={anm.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}
            className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${
                anm.severity === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                anm.severity === 'high' ? 'bg-orange-500' :
                anm.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div>
                <div className="text-sm text-gray-200 font-medium group-hover:text-red-400 transition-colors">{anm.service}</div>
                <div className="text-[10px] font-mono text-gray-500 mt-1">{anm.id}</div>
              </div>
            </div>
            <div className="text-[10px] font-mono text-gray-500">{anm.time}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SystemTopology() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-[#0a0a0a] border border-gray-800/80 rounded-xl overflow-hidden flex flex-col col-span-1 lg:col-span-3"
    >
      <div className="px-5 py-4 border-b border-gray-800/80 flex justify-between items-center bg-[#0c0c0c]">
        <h3 className="text-[10px] font-mono tracking-widest text-gray-400 uppercase font-semibold">Resource Utilization Map</h3>
        <div className="flex gap-4 text-[10px] font-mono text-gray-500">
          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> Stressed</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-700 rounded-sm"></div> Normal</span>
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 bg-[#050505]">
        {[...Array(16)].map((_, i) => (
          <motion.div 
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7 + i * 0.05 }}
            className={`h-24 rounded-lg border ${
              i === 3 || i === 7 ? 'border-red-500/50 bg-red-500/10' : 'border-gray-800/50 bg-[#0f0f0f]'
            } flex flex-col items-center justify-center gap-2 relative overflow-hidden`}
          >
            <Cpu className={`w-5 h-5 ${i === 3 || i === 7 ? 'text-red-500' : 'text-gray-600'}`} />
            <span className="text-[10px] font-mono text-gray-500">NODE-{100 + i}</span>
            {(i === 3 || i === 7) && (
              <motion.div 
                animate={{ opacity: [0.2, 0.5, 0.2] }} 
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-red-500/10"
              />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30 font-sans overflow-x-hidden flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
              <p className="text-sm text-gray-500 mt-1 font-mono">System-wide reliability overview</p>
            </div>
            <button className="bg-white text-black hover:bg-gray-200 text-xs font-mono font-bold py-2.5 px-4 rounded flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <Plus className="w-4 h-4" /> NEW EXPERIMENT
            </button>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <MetricCard title="Total Experiments" value="1,284" icon={Activity} trend={12.5} delay={0.1} />
            <MetricCard title="Anomalies Found" value="342" icon={Target} trend={-5.2} delay={0.2} />
            <MetricCard title="System Health" value="98.2%" icon={ShieldCheck} trend={0.8} delay={0.3} />
            <MetricCard title="MTTR (Mins)" value="14.5" icon={AlertTriangle} trend={-18.4} delay={0.4} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <ConsoleTerminal />
            <AnomaliesList />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <SystemTopology />
          </div>
        </main>
      </div>
    </div>
  );
}

function LandingNavbar() {
  return (
    <nav className="w-full px-8 py-10 flex items-center justify-between z-50 relative max-w-[90rem] mx-auto">
      <div className="text-lg font-bold tracking-[0.2em] flex items-baseline text-white uppercase">
        NOIR<span className="text-red-500 font-bold ml-0.5">_</span>
      </div>
      <div className="hidden md:flex gap-10 text-[9px] font-mono font-semibold tracking-widest text-gray-400 uppercase">
        <a href="#" className="text-white relative after:content-[''] after:absolute after:-bottom-3 after:left-0 after:w-full after:h-[1px] after:bg-red-500">OVERVIEW</a>
        <a href="#" className="hover:text-white transition-colors">CAPABILITIES</a>
        <a href="#" className="hover:text-white transition-colors">ARCHITECTURE</a>
        <a href="#" className="hover:text-white transition-colors">DOCS</a>
        <a href="#" className="hover:text-white transition-colors">ABOUT</a>
      </div>
      <div>
        <Link to="/login" className="bg-white text-black hover:bg-gray-200 text-[10px] font-mono tracking-widest font-bold py-3 px-6 rounded-sm transition-colors">
          SIGN IN
        </Link>
      </div>
    </nav>
  );
}

function LandingDemoLog() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const sequence = [
      '> scanning target environment',
      '> mapping microservice topology',
      '> injecting simulated latency (300ms)',
      '> observing system degradation...',
      '> WARN: cascading failure detected in cart-service',
      '> isolating root cause: connection pool exhaustion',
      '> generating self-healing patch',
      '> experiment complete. reliability +4.2%'
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < sequence.length) {
        setLogs(prev => [...prev, sequence[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1200);
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
            <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)] animate-pulse"></div>
            NOIR AUTO-DISCOVERY
          </div>
        </div>
        <div className="p-6 font-mono text-[11px] sm:text-xs text-gray-400 space-y-3.5 leading-relaxed min-h-[320px] flex flex-col justify-start">
          <AnimatePresence>
            {logs.map((log, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 ${log?.includes('WARN') || log?.includes('degradation') || log?.includes('failure') ? 'text-red-400' : ''} ${log?.includes('complete') ? 'text-green-400' : ''}`}
              >
                <span className="text-gray-600 font-bold opacity-50 hidden sm:inline">{(new Date()).toISOString().split('T')[1].substring(0,8)}</span>
                <span className="flex-1">{log}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length < 8 && (
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

function FallingAshes() {
  const [ashes, setAshes] = useState<Array<{ id: number; left: string; duration: string; delay: string; size: string; opacity: number }>>([]);

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

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30 font-sans overflow-x-hidden relative">
      <FallingAshes />
      <LandingNavbar />
      <main className="max-w-[90rem] mx-auto px-8 py-8 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        <div className="flex flex-col xl:max-w-xl lg:pl-16">
          <div className="flex flex-col">
            <h2 className="font-serif italic text-[2.5rem] lg:text-[3.5rem] text-gray-200 mb-[-1.5rem] lg:mb-[-2.25rem] ml-1 relative z-10">This is</h2>
            <div className="leading-[0.8] tracking-tighter font-black text-white">
              <div className="text-[8rem] sm:text-[10rem] lg:text-[14rem]">NO</div>
              <div className="text-[8rem] sm:text-[10rem] lg:text-[14rem] flex items-baseline">
                IR<span className="text-red-600 text-[5rem] sm:text-[7rem] lg:text-[10rem] ml-1">_</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-6 mt-2">
            <h3 className="text-[11px] sm:text-xs font-mono font-semibold tracking-[0.25em] text-gray-300 uppercase">
              Autonomous Reliability Engineer.
            </h3>
            <p className="text-gray-400 max-w-md text-sm sm:text-base leading-relaxed">
              NOIR discovers, reproduces, and explains intermittent software failures through intelligent experimentation.
            </p>
            
            <div className="flex gap-4 sm:gap-6 text-[10px] font-mono font-semibold tracking-widest text-gray-400 uppercase pt-2">
              <span>Discover<span className="text-red-500">.</span></span>
              <span className="text-gray-700">|</span>
              <span>Explain<span className="text-red-500">.</span></span>
              <span className="text-gray-700">|</span>
              <span>Improve<span className="text-red-500">.</span></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button className="border border-gray-700/80 hover:border-gray-400 text-white text-[10px] font-mono tracking-widest py-4 px-6 flex items-center justify-between gap-6 transition-colors">
              VIEW ARCHITECTURE <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <Link to="/login" className="bg-white text-black hover:bg-gray-200 text-[10px] font-mono tracking-widest font-bold py-4 px-6 flex items-center justify-between gap-6 transition-colors w-fit">
              EXPLORE NOIR <ArrowRight className="w-3.5 h-3.5 text-red-600" />
            </Link>
          </div>
        </div>
        <LandingDemoLog />
      </main>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30 font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <FallingAshes />
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/20 via-[#050505] to-[#050505] -z-10" />
      
      <div className="w-full max-w-md">
        <Link to="/" className="text-xl font-bold tracking-[0.2em] flex items-baseline text-white uppercase justify-center mb-12">
          NOIR<span className="text-red-500 font-bold ml-0.5">_</span>
        </Link>
        
        <div className="bg-[#0a0a0a] border border-gray-800/80 rounded-2xl p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-transparent rounded-t-2xl opacity-50" />
          
          <h2 className="text-2xl font-serif italic text-gray-200 mb-2">Welcome back</h2>
          <p className="text-[11px] font-mono text-gray-500 mb-8 uppercase tracking-widest">Operator Authorization Required</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">Operator ID / Email</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  placeholder="operator@noir.sys" 
                  className="w-full bg-[#050505] border border-gray-800/80 rounded-lg py-3 px-4 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-mono tracking-widest text-gray-400 uppercase flex justify-between">
                <span>Passphrase</span>
                <a href="#" className="text-red-500 hover:text-red-400 transition-colors">Reset?</a>
              </label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  placeholder="••••••••••••" 
                  className="w-full bg-[#050505] border border-gray-800/80 rounded-lg py-3 px-4 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-white text-black hover:bg-gray-200 text-[11px] font-mono tracking-widest font-bold py-3.5 px-6 mt-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              AUTHENTICATE <ArrowRight className="w-4 h-4 text-red-600" />
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-800/50 text-center text-[10px] font-mono text-gray-500">
            SECURE CONNECTION ESTABLISHED
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
