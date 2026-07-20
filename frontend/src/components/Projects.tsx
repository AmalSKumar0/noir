import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Projects() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <section className="px-6 md:px-12 py-16 w-full max-w-[1400px] mx-auto text-white">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="inline-block px-5 py-2 rounded-full border border-stone-800 bg-stone-950 text-stone-400 text-sm font-mono tracking-wider uppercase mb-10 shadow-sm"
      >
        // Simulation Protocols
      </motion.div>
      
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="text-4xl md:text-5xl font-medium tracking-tight mb-16 max-w-4xl leading-[1.15] text-white"
      >
        We orchestrate automated testing vectors, chaos sequences, and failure routines to validate <span className="bg-[#7C3AED] px-4 py-1.5 rounded-[1.5rem] inline-block -my-1 shadow-[0_4px_15px_rgba(124,58,237,0.3)] text-white">system integrity</span>
      </motion.h2>

      <motion.div 
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Card 1 */}
        <motion.div variants={item} className="bg-stone-950/80 rounded-[2.5rem] p-8 flex shadow-lg border border-stone-850 h-[400px] col-span-1 md:col-span-2 lg:col-span-1 relative overflow-hidden group cursor-pointer">
          <div className="flex flex-col justify-between w-full sm:w-[55%] lg:w-[60%] z-10 pr-4">
            <div>
              <h3 className="text-3xl font-semibold mb-4 leading-tight group-hover:text-violet-400 transition-colors text-white">Network Latency<br/>Injection</h3>
              <p className="text-stone-400 text-sm leading-relaxed max-w-[210px] font-mono">Deploy high network packet loss, routing jitter, and cross-region latency loops instantly.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-stone-400 group-hover:text-white transition-colors text-xs uppercase tracking-wider">Execute Protocol</span>
              <button className="w-10 h-10 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center group-hover:bg-violet-600 transition-colors shadow-sm">
                <ArrowUpRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          {/* Image */}
          <div className="absolute right-6 top-6 bottom-6 w-[40%] rounded-[2rem] overflow-hidden shadow-md">
            <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80" alt="Server rack" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-75" />
          </div>
        </motion.div>
        
        {/* Card 2 */}
        <motion.div variants={item} className="bg-gradient-to-br from-violet-950 via-[#6D28D9] to-[#7C3AED] rounded-[2.5rem] p-8 flex flex-col justify-between h-[400px] relative overflow-hidden shadow-lg border border-violet-900/30 group cursor-pointer">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 w-fit px-5 py-2.5 rounded-full text-sm font-mono uppercase tracking-wider text-white shadow-sm z-10 relative">
            CPU Spikes & MemLeaks
          </div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4 blur-xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="flex items-center justify-between z-10">
            <span className="font-mono text-white text-xs uppercase tracking-wider">Execute Protocol</span>
            <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-stone-100 transition-colors shadow-sm">
              <ArrowUpRight className="w-4 h-4 text-stone-900" />
            </button>
          </div>
        </motion.div>

        {/* Card 3 */}
        <motion.div variants={item} className="bg-gradient-to-br from-stone-950 via-stone-900 to-[#7C3AED]/40 rounded-[2.5rem] p-8 flex flex-col justify-between h-[400px] relative overflow-hidden shadow-lg border border-stone-850 group cursor-pointer">
          <div className="bg-black/40 backdrop-blur-md border border-white/5 w-fit px-5 py-2.5 rounded-full text-sm font-mono uppercase tracking-wider text-white shadow-sm z-10 relative">
            Container Eviction
          </div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full translate-x-1/4 translate-y-1/4 blur-xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-violet-600/20 rounded-full translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="flex items-center justify-between z-10">
            <span className="font-mono text-stone-300 group-hover:text-white transition-colors text-xs uppercase tracking-wider">Execute Protocol</span>
            <button className="w-10 h-10 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center group-hover:bg-violet-600 transition-colors shadow-sm">
              <ArrowUpRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
