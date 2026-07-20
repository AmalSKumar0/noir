import { motion } from 'motion/react';

export default function CampaignBanner() {
  return (
    <section className="py-24 w-full overflow-hidden flex justify-center items-center bg-[#000000]">
      <div className="flex items-center justify-center whitespace-nowrap relative">
        {/* Decorative elements */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="absolute left-[-20%] top-1/2 -translate-y-1/2 flex items-center"
        >
           <div className="w-8 h-12 bg-[#7C3AED] rounded-l-full mr-2 opacity-60"></div>
           <div className="w-12 h-12 bg-[#7C3AED] rounded-r-lg opacity-60"></div>
        </motion.div>
        
        {/* Outlined Text */}
        <motion.span 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-7xl md:text-[9rem] font-bold tracking-tighter text-transparent mr-4 md:mr-8 relative z-10 uppercase" 
          style={{ WebkitTextStroke: '2px #7C3AED' }}
        >
          NOIR
        </motion.span>
        
        {/* Circle Image */}
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="w-32 h-32 md:w-64 md:h-64 rounded-full overflow-hidden shrink-0 mx-2 md:mx-4 shadow-[0_0_50px_rgba(124,58,237,0.35)] z-20 group border border-[#7C3AED]/30"
        >
          <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" alt="Cyber abstract" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        </motion.div>
        
        {/* Solid Text */}
        <motion.span 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-7xl md:text-[9rem] font-bold tracking-tighter text-white ml-4 md:ml-8 relative z-10 uppercase"
        >
          ENGINE
        </motion.span>
      </div>
    </section>
  );
}
