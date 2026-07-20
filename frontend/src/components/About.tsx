import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function About() {
  return (
    <section className="px-6 md:px-12 py-24 w-full max-w-[1400px] mx-auto flex flex-col md:flex-row gap-12 md:gap-24 items-start">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="md:w-1/3 pt-2"
      >
        <p className="text-stone-400 font-medium font-mono text-xs uppercase tracking-[0.15em] leading-relaxed max-w-sm">
          NOIR is an advanced autonomous simulation platform designed to stress-test microservices, inject precise failures, and assess software structural integrity under extreme chaos conditions.
        </p>
      </motion.div>
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="md:w-2/3"
      >
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-10 max-w-2xl leading-[1.1] text-white">
          We ensure your distributed systems maintain absolute resilience.
        </h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <button className="bg-[#7C3AED] hover:bg-[#6D28D9] transition-all duration-300 text-white px-8 py-3 rounded-full font-medium shadow-[0_4px_20px_rgba(124,58,237,0.25)] hover:shadow-[0_4px_25px_rgba(124,58,237,0.4)]">
            Explore Architecture
          </button>
          <button className="flex items-center gap-2 font-medium text-stone-300 hover:text-white transition-colors group">
            Analyze Scenarios <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </motion.div>
    </section>
  );
}
