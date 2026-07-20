import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'motion/react';
import { useRef, MouseEvent, useState } from 'react';
import BackgroundBoids from './BackgroundBoids';

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity1 = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Mouse interactivity for layout elements
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 20; 
    const y = (e.clientY - top - height / 2) / 20;
    mouseX.set(x);
    mouseY.set(y);

    // Track coordinates for the Canvas Aurora effect
    mouseRef.current = {
      x: e.clientX - left,
      y: e.clientY - top
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current = { x: -1000, y: -1000 };
  };

  return (
    <section 
      ref={containerRef} 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden text-white pt-28 pb-16 md:py-0"
      style={{
        background: 'radial-gradient(circle at 85% 75%, rgba(124, 58, 237, 0.22) 0%, rgba(99, 102, 241, 0.08) 35%, rgba(3, 2, 14, 1) 100%)'
      }}
    >
      {/* Interactive Canvas (Subtle floating cosmic stars/particles) */}
      <BackgroundBoids mouseRef={mouseRef} />

      {/* Content Container matching screenshot layout */}
      <div className="relative z-20 w-full max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 items-center h-full min-h-[90vh] md:min-h-[85vh]">
        
        {/* Left Side: Large Headline & Description */}
        <motion.div 
          style={{ y: y1, opacity: opacity1 }}
          className="flex flex-col items-start text-left z-20 w-full mt-32 lg:mt-0 lg:col-span-7 xl:col-span-7"
        >
          <motion.h1 
            initial={{ y: 25, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5rem] tracking-tighter leading-[1.1] mb-8 text-white font-sans font-light max-w-2xl"
          >
            The autonomous <br />
            <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.15)]">reliability engineer</span> <br />
            for modern applications.
          </motion.h1>
          
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="text-stone-400 text-sm md:text-base lg:text-lg max-w-xl leading-relaxed font-sans font-light tracking-wide"
          >
            Noir is an AI-assisted reliability engineering platform that automates fault injection, monitors application behavior, and generates actionable insights to identify reliability issues before deployment.
          </motion.p>
        </motion.div>

        {/* Right Side: Concentric Waves & Button */}
        <div className="relative flex justify-center items-center z-10 pointer-events-none scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 origin-center pb-24 lg:pb-0 w-full lg:col-span-5 xl:col-span-5">
          
          {/* Central Bright Ambient Purple Glow */}
          <div className="absolute w-[350px] h-[350px] rounded-full bg-violet-600/15 blur-[100px] pointer-events-none"></div>

          {/* Radiating stadium-pill waves centered around the button */}
          <div className="absolute flex items-center justify-center pointer-events-none z-10">
            {[
              { w: 'w-[230px]', h: 'h-[90px]', bg: 'bg-violet-400/20' },
              { w: 'w-[280px]', h: 'h-[120px]', bg: 'bg-violet-400/15' },
              { w: 'w-[340px]', h: 'h-[160px]', bg: 'bg-violet-400/12' },
              { w: 'w-[410px]', h: 'h-[210px]', bg: 'bg-violet-400/10' },
              { w: 'w-[490px]', h: 'h-[270px]', bg: 'bg-violet-400/[0.08]' },
              { w: 'w-[580px]', h: 'h-[340px]', bg: 'bg-violet-400/[0.06]' },
              { w: 'w-[680px]', h: 'h-[420px]', bg: 'bg-violet-400/[0.04]' },
              { w: 'w-[790px]', h: 'h-[510px]', bg: 'bg-violet-400/[0.03]' },
              { w: 'w-[910px]', h: 'h-[610px]', bg: 'bg-violet-400/[0.02]' },
              { w: 'w-[1040px]', h: 'h-[720px]', bg: 'bg-violet-400/[0.01]' },
            ].map((ring, idx) => (
              <motion.div
                key={idx}
                initial="idle"
                animate={isHovered ? "hover" : "idle"}
                variants={{
                  idle: {
                    scale: 1,
                    opacity: 1,
                    transition: {
                      duration: 0.8,
                      ease: "easeOut",
                    }
                  },
                  hover: {
                    scale: [1, 1.15, 1],
                    opacity: [1, 0.6, 1],
                    transition: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: idx * 0.08,
                    }
                  }
                }}
                className="absolute flex items-center justify-center"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.02, 1],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: idx * 0.4,
                  }}
                  className={`rounded-[999px] ${ring.bg} ${ring.w} ${ring.h}`}
                />
              </motion.div>
            ))}
          </div>

          {/* White Pill button exactly like the screenshot */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative z-30 pointer-events-auto"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <motion.button
              whileHover={{ 
                scale: 1.05, 
                boxShadow: "0 0 50px rgba(167, 139, 250, 0.5)",
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="px-11 py-5 rounded-full bg-white text-black font-semibold text-xs md:text-sm uppercase tracking-[0.2em] shadow-[0_15px_45px_rgba(139,92,246,0.25)] border border-white select-none cursor-pointer transform-gpu"
            >
             GET STARTED
            </motion.button>
          </motion.div>
        </div>
      </div>

    </section>
  );
}

