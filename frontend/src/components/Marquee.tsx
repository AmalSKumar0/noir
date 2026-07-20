import { Activity } from 'lucide-react';

export default function Marquee() {
  const repeatCount = 10;
  
  return (
    <div className="w-full bg-stone-950/40 py-3.5 overflow-hidden flex border-y border-stone-800">
      <div className="flex animate-marquee min-w-max">
        {[...Array(repeatCount)].map((_, i) => (
          <div key={i} className="flex items-center px-6">
            <span className="text-xs font-mono font-medium tracking-[0.2em] uppercase mr-6 text-violet-500/90">
              [ NOIR SIMULATION ENGINE: ACTIVE ]
            </span>
            <Activity className="w-4 h-4 text-violet-500 animate-pulse" />
            <span className="text-xs font-mono font-medium tracking-[0.2em] uppercase mx-6 text-stone-500">
              FAULT INJECTION ROUTINES RUNNING
            </span>
            <span className="text-stone-700 font-mono text-xs">//</span>
          </div>
        ))}
      </div>
      <div className="flex animate-marquee min-w-max" aria-hidden="true">
        {[...Array(repeatCount)].map((_, i) => (
          <div key={`dup-${i}`} className="flex items-center px-6">
            <span className="text-xs font-mono font-medium tracking-[0.2em] uppercase mr-6 text-violet-500/90">
              [ NOIR SIMULATION ENGINE: ACTIVE ]
            </span>
            <Activity className="w-4 h-4 text-violet-500 animate-pulse" />
            <span className="text-xs font-mono font-medium tracking-[0.2em] uppercase mx-6 text-stone-500">
              FAULT INJECTION ROUTINES RUNNING
            </span>
            <span className="text-stone-700 font-mono text-xs">//</span>
          </div>
        ))}
      </div>
    </div>
  );
}
