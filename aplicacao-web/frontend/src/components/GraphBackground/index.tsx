'use client';

import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

const accent = 'rgb(254, 190, 0)';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  highlight: boolean;
};

export default function GraphBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let animationFrame: number;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createNodes() {
      const count = Math.max(8, Math.round((width * height) / 30000));
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: 10 + Math.random() * 24,
        highlight: i % 6 === 0,
      }));
    }

    function step() {
      ctx!.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const maxDist = 260;
          if (dist < maxDist) {
            ctx!.strokeStyle = `rgba(18, 24, 43, ${0.12 * (1 - dist / maxDist)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      for (const node of nodes) {
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx!.fillStyle = node.highlight ? 'rgba(254, 190, 0, 0.35)' : 'rgba(18, 24, 43, 0.08)';
        ctx!.fill();
        ctx!.lineWidth = 1.5;
        ctx!.strokeStyle = node.highlight ? accent : 'rgba(18, 24, 43, 0.18)';
        ctx!.stroke();
      }

      if (!prefersReducedMotion) {
        animationFrame = requestAnimationFrame(step);
      }
    }

    resize();
    createNodes();
    step();

    function handleResize() {
      resize();
      createNodes();
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}