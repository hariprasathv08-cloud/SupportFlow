import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Server, 
  Cpu, 
  Globe, 
  Database, 
  Laptop, 
  Network, 
  Lock, 
  Activity, 
  Compass
} from "lucide-react";

export default function ITOpsIllustration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pulseCount, setPulseCount] = useState(0);

  // Periodic network sweep signal
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseCount((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Particle System Effect (floating cyber-particles)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      fadeSpeed: number;
      color: string;
    }> = [];

    const createParticle = (yOffset = 0) => {
      const colors = [
        "rgba(59, 130, 246, ",  // primary blue
        "rgba(6, 182, 212, ",   // cyan / info
        "rgba(99, 102, 241, ",  // indigo
        "rgba(34, 197, 94, "    // success green (rare status indicator)
      ];
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: Math.random() * width,
        y: height - yOffset,
        size: Math.random() * 2.5 + 0.8,
        speedY: -(Math.random() * 0.6 + 0.2),
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        fadeSpeed: Math.random() * 0.005 + 0.002,
        color: colorBase
      };
    };

    // Pre-populate particles across the screen
    for (let i = 0; i < 40; i++) {
      particles.push(createParticle(Math.random() * height));
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw faint cyber grid background on canvas for perspective
      ctx.strokeStyle = "rgba(37, 99, 235, 0.04)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      
      // Draw grid lines
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX;

        // Boundaries check or fade out
        if (p.y < 0 || p.x < 0 || p.x > width) {
          particles[i] = createParticle(0);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity.toFixed(2)})`;
        // Soft glow for larger particles
        if (p.size > 2.0) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(59, 130, 246, 0.5)";
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }

      ctx.shadowBlur = 0; // Reset shadow
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#0B1120] overflow-hidden flex flex-col justify-between p-10 font-sans select-none border-r border-slate-800/30">
      
      {/* Interactive Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Decorative Cybernetic HUD top row */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
          <span className="text-[10px] tracking-[0.2em] font-bold text-slate-500 uppercase">
            System State: SECURE
          </span>
        </div>
        <div className="text-[10px] tracking-[0.1em] font-medium text-slate-500 text-right">
          INTELLIGENT SUBNET SCAN: <span className="text-blue-400 font-bold">ACTIVE</span>
        </div>
      </div>

      {/* Main Isometric Network Architecture / Ops Center Map */}
      <div className="flex-1 flex items-center justify-center relative py-6">
        
        {/* Absolute Background Glow behind Centerpiece */}
        <div className="absolute w-[350px] h-[350px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none animate-pulse" />

        {/* Outer HUD circular rings */}
        <div className="absolute w-80 h-80 rounded-full border border-blue-500/5 flex items-center justify-center animate-[spin_50s_linear_infinite]" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-slate-800/10 border-dashed animate-[spin_100s_linear_infinite]" />

        {/* Network Infrastructure Grid Visualizer */}
        <svg className="w-full max-w-lg h-80 z-10" viewBox="0 0 500 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Defs for gradients */}
          <defs>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#312E81" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.1" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Glowing Network Links (Animated Data Flows) */}
          <g opacity="0.6">
            {/* Core Router -> Firewalls */}
            <line x1="250" y1="160" x2="150" y2="110" stroke="url(#lineGrad)" strokeWidth="1.5" />
            <line x1="250" y1="160" x2="350" y2="110" stroke="url(#lineGrad)" strokeWidth="1.5" />
            
            {/* Firewalls -> Server Racks / Infrastructure */}
            <line x1="150" y1="110" x2="80" y2="170" stroke="#1e293b" strokeWidth="1.5" />
            <line x1="150" y1="110" x2="160" y2="210" stroke="#1e293b" strokeWidth="1.5" />
            <line x1="350" y1="110" x2="420" y2="170" stroke="#1e293b" strokeWidth="1.5" />
            <line x1="350" y1="110" x2="340" y2="210" stroke="#1e293b" strokeWidth="1.5" />

            {/* Core Router -> Endpoints (Desktop/Laptops) */}
            <line x1="250" y1="160" x2="250" y2="260" stroke="url(#lineGrad)" strokeWidth="1.5" />
            
            {/* Connecting Links with moving flow dashes */}
            <path d="M 250 160 L 150 110 L 80 170" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="10, 15" strokeDashoffset={-pulseCount * 12} />
            <path d="M 250 160 L 350 110 L 420 170" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="10, 15" strokeDashoffset={pulseCount * 12} />
            <path d="M 250 160 L 250 260" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="8, 12" strokeDashoffset={-pulseCount * 8} />
          </g>

          {/* Network Topology Nodes */}

          {/* 1. Core Cloud Infrastructure Node (Top Center) */}
          <g transform="translate(250, 60)" filter="url(#glow)">
            <circle cx="0" cy="0" r="26" fill="#0f172a" stroke="#2563EB" strokeWidth="2" />
            <circle cx="0" cy="0" r="32" fill="none" stroke="#2563EB" strokeWidth="1" strokeDasharray="4, 4" className="animate-[spin_20s_linear_infinite]" />
            <path d="M-10 -4 C-10 -10 -5 -12 0 -12 C4 -12 7 -10 8 -7 C11 -7 13 -4 13 -1 C13 3 10 6 5 6 L-8 6 C-11 6 -13 4 -13 1 C-13 -2 -11 -4 -10 -4 Z" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0, 2) scale(0.8)" />
          </g>

          {/* 2. Left Firewall/Gateway */}
          <g transform="translate(150, 110)">
            <circle cx="0" cy="0" r="18" fill="#111827" stroke="#334155" strokeWidth="1.5" />
            <path d="M-6 -6 H6 V6 H-6 Z M-6 -2 H6 M-6 2 H6 M-2 -6 V6 M2 -6 V6" stroke="#06b6d4" strokeWidth="1.2" />
          </g>

          {/* 3. Right Network Security Controller */}
          <g transform="translate(350, 110)">
            <circle cx="0" cy="0" r="18" fill="#111827" stroke="#334155" strokeWidth="1.5" />
            {/* Lock outline */}
            <path d="M-4 -1 V5 H4 V-1 Z M-2 -1 V-3 A2 2 0 0 1 2 -1 V-1" stroke="#f59e0b" strokeWidth="1.2" fill="none" />
          </g>

          {/* 4. Data Center / Server Racks (Left Side Stack) */}
          <g transform="translate(80, 170)">
            {/* Server Chassis 3D Iso representation */}
            <path d="M -22 -15 L 22 -30 L 22 15 L -22 30 Z" fill="#111827" stroke="#3b82f6" strokeWidth="1.5" />
            {/* Draw LED blinking rows */}
            <circle cx="-12" cy="-4" r="1.5" fill="#22c55e" className="animate-[pulse_1s_infinite_100ms]" />
            <circle cx="-6" cy="-6" r="1.5" fill="#22c55e" className="animate-[pulse_1s_infinite_400ms]" />
            <circle cx="0" cy="-8" r="1.5" fill="#3b82f6" className="animate-[pulse_1s_infinite_200ms]" />
            
            <circle cx="-12" cy="6" r="1.5" fill="#3b82f6" className="animate-[pulse_1.5s_infinite_600ms]" />
            <circle cx="-6" cy="4" r="1.5" fill="#ef4444" className="animate-[pulse_0.8s_infinite_100ms]" />
            <circle cx="0" cy="2" r="1.5" fill="#22c55e" className="animate-[pulse_1.2s_infinite_300ms]" />

            <circle cx="-12" cy="16" r="1.5" fill="#22c55e" className="animate-[pulse_1s_infinite_500ms]" />
            <circle cx="-6" cy="14" r="1.5" fill="#3b82f6" className="animate-[pulse_2s_infinite_150ms]" />
            <circle cx="0" cy="12" r="1.5" fill="#3b82f6" className="animate-[pulse_1s_infinite_700ms]" />

            {/* Server Rack visual labels */}
            <text x="5" y="10" fill="#64748b" fontSize="7" transform="rotate(-18)" fontWeight="bold">SRV-01</text>
          </g>

          {/* 5. Cloud Database Cluster (Right Side Stack) */}
          <g transform="translate(420, 170)">
            <path d="M -22 -30 L 22 -15 L 22 30 L -22 15 Z" fill="#111827" stroke="#06b6d4" strokeWidth="1.5" />
            {/* Horizontal partition slots on the database node */}
            <path d="M -16 -12 L 16 -2" stroke="#475569" strokeWidth="1.5" />
            <path d="M -16 0 L 16 10" stroke="#475569" strokeWidth="1.5" />
            <path d="M -16 12 L 16 22" stroke="#475569" strokeWidth="1.5" />
            {/* Flashing storage stack lights */}
            <circle cx="-10" cy="-6" r="2" fill="#06b6d4" className="animate-pulse" />
            <circle cx="-10" cy="6" r="2" fill="#3b82f6" className="animate-pulse" />
            <circle cx="-10" cy="18" r="2" fill="#22c55e" />

            <text x="-14" y="0" fill="#64748b" fontSize="7" transform="rotate(18)" fontWeight="bold">DATA-X</text>
          </g>

          {/* 6. Desktop / Endpoint Console (Bottom Center) */}
          <g transform="translate(250, 260)">
            <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#6366f1" strokeWidth="2" />
            <foreignObject x="-10" y="-10" width="20" height="20">
              <Laptop className="h-5 w-5 text-indigo-400" />
            </foreignObject>
            
            {/* Radial scan ring pulsing around endpoint */}
            <circle cx="0" cy="0" r="28" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.4" className="animate-[ping_3s_infinite]" />
          </g>

          {/* 7. Central IT Operations Hub Centerpiece (Cyber Security Shield) */}
          <g transform="translate(250, 160)" filter="url(#glow)">
            <circle cx="0" cy="0" r="26" fill="#111827" stroke="#3b82f6" strokeWidth="2.5" />
            
            {/* Concentric rotating tech circles */}
            <circle cx="0" cy="0" r="32" fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1.5" strokeDasharray="15, 30" className="animate-[spin_12s_linear_infinite]" />
            <circle cx="0" cy="0" r="38" fill="none" stroke="rgba(6, 182, 212, 0.15)" strokeWidth="1" strokeDasharray="30, 15" className="animate-[spin_24s_linear_infinite_reverse]" />

            {/* Central Shield Icon */}
            <path d="M-8 -10 L0 -14 L8 -10 V-2 C8 4 3 9 0 11 C-3 9 -8 4 -8 -2 Z" fill="#2563eb" fillOpacity="0.2" stroke="#60a5fa" strokeWidth="2" />
            <path d="M-3 -6 L-1 -4 L3 -8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>

          {/* Decorative scanner line moving across the grid */}
          <line x1="20" y1={80 + (pulseCount % 3) * 60} x2="480" y2={80 + (pulseCount % 3) * 60} stroke="rgba(37, 99, 235, 0.1)" strokeWidth="2" className="transition-all duration-1000" />
        </svg>

        {/* Small floating HUD stats boxes overlayed inside Left Split Panel */}
        <div className="absolute top-10 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 shadow-xl flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">AI Operations</div>
            <div className="text-xs font-extrabold text-slate-200">ACTIVE LOGIC</div>
          </div>
        </div>

        <div className="absolute bottom-10 right-4 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 shadow-xl flex items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Security Shield</div>
            <div className="text-xs font-extrabold text-slate-200">THREAT INTRUSION INDEX: 0.00%</div>
          </div>
        </div>

        <div className="absolute bottom-10 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 shadow-xl flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 animate-pulse">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Telemetry Sweep</div>
            <div className="text-xs font-extrabold text-slate-200">ACTIVE: 10.0.0.0/16</div>
          </div>
        </div>
      </div>

      {/* Futuristic footer row of the illustration side */}
      <div className="flex justify-between items-center z-10 text-[10px] text-slate-500 font-bold tracking-wide">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3 w-3 text-slate-500" />
          <span>SUBNET A: SWEEP COMPLETE</span>
        </div>
        <div className="flex items-center gap-3">
          <span>PACKET RATIO: 1.000 (SECURE)</span>
          <span>BUILD v2.9.4</span>
        </div>
      </div>
    </div>
  );
}
