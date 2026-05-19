import React, { useState, useEffect } from 'react';
import { ShieldAlert, Terminal, Cpu, RefreshCw, ArrowLeft } from 'lucide-react';
import eclipseLogo from './assets/images/eclipse_logo_1779198030363.png';

interface ErrorScreenProps {
  code?: number;
  message?: string;
  onRecover?: () => void;
}

export default function ErrorScreen({ code = 500, message = "CRITICAL SYSTEM FAILURE", onRecover }: ErrorScreenProps) {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#030406] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-[#f1f3f5] selection:bg-red-500/30">
      
      {/* Background Glitch Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen" style={{
        backgroundImage: 'linear-gradient(rgba(255,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '16px 16px'
      }} />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#030406_100%)] pointer-events-none" />

      {glitch && (
        <div className="absolute inset-0 bg-red-500/10 mix-blend-overlay z-50 pointer-events-none" />
      )}

      {/* Main Error Container */}
      <div className={`relative z-10 w-full max-w-2xl border border-red-500/30 bg-[#0B0F14]/80 backdrop-blur-xl p-8 rounded-lg shadow-[0_0_50px_rgba(255,0,0,0.15)] ${glitch ? 'translate-x-1' : ''}`}>
        
        {/* Header Ribbon */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0" />
        <div className="absolute top-1 left-4 right-4 h-px bg-red-500/30" />

        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-[#030406] border border-red-500/50 flex items-center justify-center relative overflow-hidden shadow-[inset_0_0_20px_rgba(255,0,0,0.2)]">
               <ShieldAlert className="text-red-500 w-8 h-8 relative z-10 animate-pulse" />
               <div className="absolute inset-0 bg-red-500/10 animate-ping" />
            </div>
            <div>
              <h1 className="text-5xl font-black text-red-500 tracking-[0.1em] font-mono leading-none drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">{code}</h1>
              <div className="text-[0.65rem] font-mono tracking-[0.3em] uppercase text-red-400/70 mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 inline-block shadow-[0_0_5px_red] animate-pulse" />
                SYSTEM_HALTED
              </div>
            </div>
          </div>

          <div className="w-12 h-12 rounded bg-red-500/5 border border-red-500/20 flex items-center justify-center mix-blend-screen opacity-50">
             <img src={eclipseLogo} alt="Eclipse OS" className="w-8 h-8 grayscale" />
          </div>
        </div>

        <div className="border-l-2 border-red-500/50 pl-6 py-2 mb-8 bg-gradient-to-r from-red-500/5 to-transparent">
          <h2 className="text-xl font-bold tracking-widest uppercase text-[#f1f3f5] mb-2">{message}</h2>
          <p className="text-sm text-[#88909c] font-mono leading-relaxed">
            Fatal exception caught in module [ui_renderer_core]. <br/>
            Memory dump saved to 0x000F8A. <br />
            Please reboot the interface or contact sector administration.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {onRecover && (
            <button 
              onClick={onRecover}
              className="flex-1 h-12 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-3 transition-all hover:shadow-[0_0_20px_rgba(255,0,0,0.2)]"
            >
              <RefreshCw size={16} /> REBOOT SYSTEM
            </button>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 h-12 bg-[#030406] hover:bg-[#11161D] border border-[#222B36] hover:border-[#5b6371] text-[#88909c] hover:text-[#f1f3f5] font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-3 transition-all"
          >
            <Terminal size={16} /> FORCE RESTART
          </button>
        </div>
      </div>

      <div className="mt-12 text-center opacity-30 text-[0.55rem] font-mono tracking-[0.3em] text-[#5b6371] uppercase flex flex-col gap-2">
        <Cpu className="w-4 h-4 mx-auto" />
        ECLIPSE_OS KERNEL PANIC // ID_809_SYS_ECLIPSE
      </div>
    </div>
  );
}
