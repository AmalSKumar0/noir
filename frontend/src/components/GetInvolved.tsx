import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const faq = [
  { 
    title: "01. Install our unified telemetry client", 
    content: "Initialize the NOIR daemon with a single-line shell command. Our lightweight telemetry client runs natively with minimal footprint and starts monitoring system metrics instantly." 
  },
  { 
    title: "02. Define custom chaos & fault specs", 
    content: "Write declarative testing workflows in simple YAML format. Control scheduling, configure target parameters (e.g. pods, nodes, databases), and specify error blast-radii." 
  },
  { 
    title: "03. Inject failures in sandbox or staging", 
    content: "Trigger automated drills safely. We offer native cloud integrations to mock container crashes, disk corruption, DNS failures, and third-party API timeout responses." 
  },
  { 
    title: "04. Auto-generate resilience diagnostics", 
    content: "Review real-time dashboards detailing latency response distributions, downstream degradation cascades, and auto-generated mitigation proposals." 
  }
];

export default function GetInvolved() {
  const [openIndex, setOpenIndex] = useState(1);

  return (
    <section className="px-6 md:px-12 py-24 w-full max-w-[1400px] mx-auto flex flex-col md:flex-row gap-12 md:gap-16 text-white">
      <motion.div 
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="md:w-1/3 flex flex-col justify-between"
      >
        <div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight flex items-center gap-4 text-white">
            Get Started <ArrowUpRight className="w-8 h-8 md:w-10 md:h-10 text-violet-500" />
          </h2>
          <p className="text-stone-400 text-sm leading-relaxed mt-6 max-w-[280px] font-mono">
            Integrate fault injection pipelines into your continuous delivery workflows in 4 simple steps.
          </p>
        </div>
      </motion.div>

      <div className="md:w-2/3 flex flex-col gap-4">
        {faq.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`rounded-3xl p-6 md:p-8 transition-all duration-350 cursor-pointer border ${
                isOpen 
                  ? 'bg-gradient-to-r from-violet-950/40 to-stone-900/60 border-violet-500/30' 
                  : 'bg-stone-950/60 hover:bg-stone-900/40 border-stone-900 hover:border-stone-800'
              }`}
              onClick={() => setOpenIndex(isOpen ? -1 : idx)}
            >
              <div className="flex items-center justify-between">
                <h3 className={`text-lg md:text-xl font-medium transition-colors ${isOpen ? 'text-white font-semibold' : 'text-stone-300'}`}>{item.title}</h3>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 ${
                  isOpen ? 'bg-violet-600 border-violet-500 text-white' : 'bg-stone-900 border-stone-800 text-stone-400'
                }`}>
                   {isOpen ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                </div>
              </div>
              
              <AnimatePresence>
                {isOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 20 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="text-stone-300 text-sm leading-relaxed max-w-2xl pr-8 md:pr-12 font-mono">
                      {item.content}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </section>
  );
}
