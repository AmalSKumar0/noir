import React, { useRef, useEffect, MouseEvent } from 'react';

interface Boid {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

export default function BackgroundBoids({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number, y: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Boid[] = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const chars = [
        '✦', '✧', '★', '☆', '•', '°', '.', '*', '+', 'o', 'x', '⎔', '◆', '●', '✧', '✦', '•'
      ];
      // Target around 130 boids for nice density without lagging
      const count = Math.min(130, Math.floor(canvas.width / 12));

      for (let i = 0; i < count; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.0 + 0.5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        const size = Math.random() * 5 + 4;
        
        const colors = [
          'rgba(255, 255, 255, 0.85)',
          'rgba(167, 139, 250, 0.8)',
          'rgba(139, 92, 246, 0.75)',
          'rgba(196, 181, 253, 0.8)',
          'rgba(99, 102, 241, 0.7)',
          'rgba(14, 165, 233, 0.65)'
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          char,
          x,
          y,
          vx,
          vy,
          size,
          color,
          opacity: Math.random() * 0.5 + 0.3
        });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;

      particles.forEach((p) => {
        let avgVx = 0;
        let avgVy = 0;
        let avgX = 0;
        let avgY = 0;
        let closeDx = 0;
        let closeDy = 0;
        let neighborsCount = 0;
        
        const perceptionRadius = 90;
        const separationRadius = 22;

        particles.forEach((other) => {
          if (p === other) return;
          
          const dx = other.x - p.x;
          const dy = other.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < perceptionRadius) {
            avgVx += other.vx;
            avgVy += other.vy;
            avgX += other.x;
            avgY += other.y;
            neighborsCount++;
            
            if (dist < separationRadius) {
              closeDx += p.x - other.x;
              closeDy += p.y - other.y;
            }
          }
        });

        let steerX = 0;
        let steerY = 0;

        if (neighborsCount > 0) {
          avgVx /= neighborsCount;
          avgVy /= neighborsCount;
          avgX /= neighborsCount;
          avgY /= neighborsCount;

          const alignX = avgVx - p.vx;
          const alignY = avgVy - p.vy;

          const cohesionX = (avgX - p.x) * 0.005;
          const cohesionY = (avgY - p.y) * 0.005;

          steerX += alignX * 0.01 + cohesionX * 0.005;
          steerY += alignY * 0.01 + cohesionY * 0.005;
        }

        steerX += closeDx * 0.01;
        steerY += closeDy * 0.01;

        const time = Date.now() * 0.001;
        steerX += Math.sin(time + p.x * 0.01) * 0.005;
        steerY += Math.cos(time + p.y * 0.01) * 0.005;

        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < 200) {
          const force = (200 - mDist) / 200;
          steerX += (mdx / (mDist || 1)) * force * 0.05;
          steerY += (mdy / (mDist || 1)) * force * 0.05;
        }

        p.vx += steerX * 0.5;
        p.vy += steerY * 0.5;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpeed = 0.4;
        const minSpeed = 0.1;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        } else if (speed < minSpeed) {
          p.vx = (p.vx / (speed || 1)) * minSpeed;
          p.vy = (p.vy / (speed || 1)) * minSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        const margin = 15;
        if (p.x < -margin) p.x = canvas.width + margin;
        if (p.x > canvas.width + margin) p.x = -margin;
        if (p.y < -margin) p.y = canvas.height + margin;
        if (p.y > canvas.height + margin) p.y = -margin;

        ctx.save();
        ctx.font = `${p.size}px monospace`;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;

        ctx.translate(p.x, p.y);
        const flightAngle = Math.atan2(p.vy, p.vx);
        ctx.rotate(flightAngle + Math.PI / 2);
        
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full z-0 pointer-events-none opacity-90"
      style={{ background: 'transparent' }}
    />
  );
}
