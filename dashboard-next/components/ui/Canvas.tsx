'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
}

export default function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;

    let pts: Particle[] = [];
    let raf: number;

    function spawn() {
      cv!.width  = window.innerWidth;
      cv!.height = window.innerHeight;
      const n = Math.max(35, Math.floor(cv!.width * cv!.height / 22_000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * cv!.width,
        y: Math.random() * cv!.height,
        vx: (Math.random() - .5) * .22,
        vy: (Math.random() - .5) * .22,
        r:  Math.random() * 1.2 + .4,
      }));
    }

    function draw() {
      cx!.clearRect(0, 0, cv!.width, cv!.height);
      cx!.strokeStyle = '#00d4ff';
      cx!.lineWidth   = .5;

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            cx!.globalAlpha = (1 - d / 120) * .15;
            cx!.beginPath();
            cx!.moveTo(pts[i].x, pts[i].y);
            cx!.lineTo(pts[j].x, pts[j].y);
            cx!.stroke();
          }
        }
      }

      cx!.fillStyle = '#00d4ff';
      for (const p of pts) {
        cx!.globalAlpha = .38;
        cx!.beginPath();
        cx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        cx!.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > cv!.width)  p.vx *= -1;
        if (p.y < 0 || p.y > cv!.height) p.vy *= -1;
      }

      cx!.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    spawn();
    draw();
    window.addEventListener('resize', spawn);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', spawn);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}
