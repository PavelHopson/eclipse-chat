import React, { useState } from 'react';
import { Settings, Info, Pin, CheckSquare, Search, ShieldAlert, Bell, Cpu, Grid, LayoutList, Plus, Sparkles, Activity, Map as MapIcon, Command, Terminal, Radio, Menu, X, Monitor, Moon, Sun, Eclipse, Zap, AlertOctagon, Flame, Paperclip, Mic, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import eclipseLogo from './assets/images/eclipse_logo_1779198030363.png';
import avatarPavel from './assets/images/avatar_pavel_1779198047226.png';
import agentSmoke from './assets/images/agent_smoke_1779198065620.png';
import bgEclipseForge from './assets/images/bg_eclipse_forge_1779198416344.png';
import bgCosmos from './assets/images/bg_eclipse_forge_1779198416344.png'; // Will reuse for now
import { useTheme } from './ThemeContext';

const CyberEmojiFire = () => (
  <div className="relative flex items-center justify-center w-6 h-6 group cursor-pointer" title="ОГОНЬ">
    <div className="absolute inset-0 bg-[#ff3300] blur-[8px] opacity-40 group-hover:opacity-80 group-hover:scale-150 transition-all duration-300 pointer-events-none" />
    <Flame 
      size={20} 
      className="text-[#ffaa00] fill-[#ffaa00]/20 drop-shadow-[0_0_5px_#ff9900] group-hover:scale-110 group-hover:text-[#ff3300] group-hover:fill-[#ff3300]/40 transition-all z-10 duration-300" 
    />
  </div>
);

const CyberEmojiVerified = () => (
  <div className="relative flex items-center justify-center w-6 h-6 group cursor-pointer" title="ПОДТВЕРЖДЕНО">
    <div className="absolute inset-0 bg-[#32b270] blur-[8px] opacity-40 group-hover:opacity-80 transition-all duration-300 pointer-events-none" />
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#32b270] drop-shadow-[0_0_5px_#32b270] group-hover:scale-110 group-hover:text-[#4ade80] transition-all z-10 duration-300" fill="currentColor">
      <path d="M11.99 2L3.5 5.5v5.5c0 5.08 3.59 9.81 8.49 11 4.9-1.19 8.49-5.92 8.49-11V5.5L11.99 2zm-1.9 14.8l-4.1-4.1 1.4-1.4 2.7 2.7 5.7-5.7 1.4 1.4-7.1 7.1z" />
      <path fill="rgba(50, 178, 112, 0.2)" d="M12 4.2L4.5 7v4c0 4.1 2.8 7.9 7.5 9 4.7-1.1 7.5-4.9 7.5-9V7L12 4.2z" />
    </svg>
  </div>
);

const CyberEmojiCool = () => (
  <div className="relative flex items-center justify-center w-4 h-4 group cursor-pointer hover:scale-125 transition-transform duration-300" title="МОЛНИЯ">
    <div className="absolute inset-0 bg-[#00ffff] blur-[6px] opacity-50 group-hover:opacity-100 group-hover:scale-150 transition-all pointer-events-none" />
    <Zap size={16} className="text-[#00ffff] fill-[#00ffff] drop-shadow-[0_0_5px_#00ffff] z-10 relative" />
  </div>
);

const CyberEmojiHeart = () => (
  <div className="relative flex items-center justify-center w-4 h-4 group cursor-pointer hover:scale-125 transition-transform duration-300" title="СВЯЗЬ">
    <div className="absolute inset-0 bg-[#a380eb] blur-[6px] opacity-50 group-hover:opacity-100 transition-all pointer-events-none" />
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#a380eb] fill-[#a380eb] drop-shadow-[0_0_6px_#a380eb] z-10 relative group-hover:animate-[pulse_1s_ease-in-out_infinite]" fill="currentColor">
       <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  </div>
);

const CyberStickerAlert = () => (
  <div className="relative flex items-center justify-center w-[18px] h-[18px] group cursor-pointer hover:scale-110 transition-transform duration-300" title="ВНИМАНИЕ">
    <div className="absolute inset-0 bg-[#ef4444] blur-[8px] opacity-50 group-hover:opacity-100 group-hover:animate-ping transition-all pointer-events-none" />
    <AlertOctagon size={18} className="text-[#ef4444] fill-[#ef4444]/20 drop-shadow-[0_0_5px_#ef4444] z-10 relative" />
  </div>
);

export default function ChatShell({ onLogout, onSimulateCrash }: { onLogout: () => void, onSimulateCrash: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="ec-shell bg-[#000000] text-[#f1f3f5] overflow-hidden selection:bg-[#5db5d9]/30">
      
      {/* 4.2 Top Bar */}
      <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ gridArea: 'top' }} className="relative z-40 flex items-center justify-between px-4 bg-[#0B0F14]/80 backdrop-blur-xl border-b border-[#18202A] h-[60px] ec-telemetry-edge shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Animated scanning line in header */}
        <div className="absolute bottom-0 left-0 h-[1px] w-32 bg-gradient-to-r from-transparent via-[#5db5d9]/80 to-transparent animate-[translate-x-[200vw]_4s_linear_infinite]" />
        
        <div className="flex items-center h-full">
          <button 
            className="lg:hidden w-8 h-8 flex items-center justify-center text-[#5db5d9] bg-[#030406] border border-[#18202A] rounded-sm hover:bg-[#11161D] mr-4"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileMembersOpen(false); }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          
          <div className="flex items-center gap-3 font-black text-[#f1f3f5] tracking-[0.2em] text-[0.85rem] relative min-w-max mr-6 pr-6 border-r border-[#18202A]">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-full overflow-hidden bg-[#000]">
              <div className="absolute inset-0 border border-[#f97316]/50 rounded-full animate-pulse" />
              <img src={eclipseLogo} alt="Логотип ECLIPSE" className="w-[80%] h-[80%] object-contain mix-blend-screen relative z-10" referrerPolicy="no-referrer" />
            </div>
            <span className="mt-px">ECLIPSE_<span className="text-[#a380eb]">CHAT</span></span>
          </div>
          
          <div className="hidden lg:flex items-center gap-2 relative">
            <button className="flex items-center gap-3 px-3 py-1.5 rounded-sm bg-[#030406]/50 hover:bg-[#11161D] border border-transparent hover:border-[#18202A] transition-all group">
              <span className="w-5 h-5 rounded overflow-hidden flex items-center justify-center bg-[#11161D] border border-[#f97316]/30 group-hover:border-[#f97316]">
                <div className="w-2.5 h-2.5 bg-[#f97316] rounded-sm shadow-[0_0_8px_#f97316]" />
              </span>
              <span className="text-[#f1f3f5] text-[0.8rem] font-bold tracking-widest whitespace-nowrap">Eclipse Forge</span>
              <span className="text-[#5b6371] group-hover:text-[#5db5d9] text-[0.6rem] ml-1">▼</span>
            </button>
          </div>
        </div>

        {/* Central Breadcrumb and Telemetry */}
        <div className="hidden xl:flex items-center justify-center absolute left-1/2 -translate-x-1/2 gap-6">
           <div className="text-[0.6rem] font-mono uppercase tracking-[0.15em] flex items-center text-[#5b6371]">
             <span>УЗЕЛ // </span>
             <span className="text-[#f1f3f5] mx-2 font-bold tracking-widest">ECLIPSE FORGE</span>
             <span className="mx-1 opacity-40">/</span>
             <span className="text-[#a380eb] ml-2 tracking-widest">#МУЗЫКА</span>
           </div>

           <div className="flex items-center gap-3 text-[0.55rem] font-mono tracking-widest text-[#5b6371]">
             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#32b270]/20 bg-[#32b270]/5 text-[#32b270]">
                <span className="w-1.5 h-1.5 bg-[#32b270] rounded-[1px] animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_4px_#32b270]" /> 
                СЕТЬ: СТАБИЛЬНА
             </div>
             <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#18202A] bg-[#030406]">ПАМ: 21%</div>
             <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#18202A] bg-[#030406]">ЦП: 26%</div>
           </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4 ml-auto h-full">
          <div className="flex items-center gap-1 h-6">
            <button className="w-8 h-8 rounded-sm hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#5db5d9] hidden md:flex justify-center items-center transition-all group">
              <Search size={16} className="group-hover:drop-shadow-[0_0_8px_rgba(93,181,217,0.8)] transition-all" />
            </button>
            <button className="w-8 h-8 rounded-sm hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#f1f3f5] hidden md:flex justify-center items-center transition-all group">
              <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">?</div>
            </button>
            <button className="w-8 h-8 rounded-sm hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#32b270] flex justify-center items-center transition-all relative group">
              <ShieldAlert size={16} className="group-hover:drop-shadow-[0_0_8px_rgba(50,178,112,0.8)] transition-all" />
            </button>
            <button className="w-8 h-8 rounded-sm hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#5db5d9] hidden md:flex justify-center items-center transition-all group">
              <Monitor size={16} className="group-hover:drop-shadow-[0_0_8px_rgba(93,181,217,0.8)] transition-all" />
            </button>
            <button className="w-8 h-8 rounded-sm hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#ef4444] hidden md:flex justify-center items-center transition-all group">
              <AlertOctagon size={16} className="group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-all" />
            </button>
            <button className="hidden md:flex w-8 h-8 rounded-sm hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#a380eb] justify-center items-center transition-all relative group">
              <Bell size={16} className="group-hover:drop-shadow-[0_0_8px_rgba(163,128,235,0.8)] transition-all" />
            </button>
          </div>
          
          <div className="hidden md:flex items-center text-[#a380eb] font-mono text-[0.8rem] px-3 font-bold border-x border-[#18202A] h-8 gap-2">
            <span className="text-[#f1f3f5]">11:15</span>
            <span className="text-[0.6rem] text-[#5b6371] font-normal">47</span>
          </div>

          <div className="hidden md:flex items-center gap-2 px-2 h-8 rounded-full border border-[#18202A] bg-[#030406]">
             <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-orange-500 to-purple-500 border-2 border-[#000]" />
             <span className="text-[0.6rem] font-bold tracking-widest text-[#5b6371] px-1 uppercase">VOID</span>
          </div>

          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 pl-2 pr-4 py-1 rounded-sm bg-[#0a0204] border border-[#ff3333]/20 cursor-pointer group h-9 ml-2 overflow-hidden relative shadow-[inset_0_0_10px_rgba(255,51,51,0.05),0_0_10px_rgba(255,51,51,0.1)] hover:shadow-[0_0_20px_rgba(255,51,51,0.3)] hover:border-[#ff3333]/60 transition-all"
            onClick={onLogout}
          >
            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-[#ff3333]/20 to-transparent pointer-events-none" />
            <div className="w-[28px] h-[28px] rounded-full overflow-hidden border border-[#5db5d9]/20 group-hover:border-[#ff3333] transition-all relative z-10 filter group-hover:grayscale">
               <img src={avatarPavel} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-[#0a0204] bg-green-500 group-hover:bg-[#ff3333] transition-colors" />
            </div>
            <span className="hidden sm:block text-[0.8rem] font-bold tracking-wide text-[#f1f3f5] mr-2 group-hover:text-[#ff3333] transition-colors z-10">Павел</span>
            <span className="text-[0.6rem] font-bold tracking-[0.1em] text-[#5b6371] group-hover:text-[#fff] transition-colors ml-4 uppercase flex items-center gap-1.5 opacity-60 group-hover:opacity-100 z-10">
               ВЫХОД
               <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#5b6371] group-hover:fill-[#ff3333] transition-colors group-hover:translate-x-1 duration-300">
                 <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
               </svg>
            </span>
          </motion.div>
        </div>
      </motion.header>

      {/* Settings Modal Setup */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-[#000]/80 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0B0F14] border border-[#18202A] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-4 border-b border-[#18202A] flex justify-between items-center bg-[#030406]">
                   <h2 className="text-[#f1f3f5] font-bold tracking-widest uppercase text-sm flex items-center gap-2"><Settings size={16} className="text-[#5db5d9]"/> СИСТЕМНЫЕ НАСТРОЙКИ</h2>
                   <button onClick={() => setShowSettings(false)} className="text-[#5b6371] hover:text-[#f1f3f5]"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-6">
                   
                   <div>
                     <h3 className="text-xs font-mono text-[#88909c] mb-3 uppercase tracking-widest">Тема интерфейса</h3>
                     <div className="grid grid-cols-3 gap-3">
                       <button onClick={() => setTheme('dark')} className={`flex flex-col items-center gap-2 p-3 rounded border ${theme === 'dark' ? 'border-[#5db5d9] bg-[#5db5d9]/10' : 'border-[#18202A] bg-[#07090D] hover:border-[#5db5d9]/50'} transition-all`}>
                          <Moon size={20} className={theme === 'dark' ? 'text-[#5db5d9]' : 'text-[#88909c]'} />
                          <span className="text-[0.65rem] font-bold tracking-widest uppercase">Кибер Тёмная</span>
                       </button>
                       <button onClick={() => setTheme('light')} className={`flex flex-col items-center gap-2 p-3 rounded border ${theme === 'light' ? 'border-[#5db5d9] bg-[#5db5d9]/10' : 'border-[#18202A] bg-[#07090D] hover:border-[#5db5d9]/50'} transition-all`}>
                          <Sun size={20} className={theme === 'light' ? 'text-[#5db5d9]' : 'text-[#88909c]'} />
                          <span className="text-[0.65rem] font-bold tracking-widest uppercase">Светлый Поток</span>
                       </button>
                       <button onClick={() => setTheme('eclipse')} className={`flex flex-col items-center gap-2 p-3 rounded border justify-between overflow-hidden ${theme === 'eclipse' ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'border-[#18202A] bg-[#07090D] hover:border-orange-500/50'} relative transition-all`}>
                          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent pointer-events-none opacity-50" />
                          <Eclipse size={20} className={theme === 'eclipse' ? 'text-orange-500' : 'text-orange-500/70'} />
                          <span className="text-[0.65rem] font-bold tracking-widest uppercase z-10">Космос</span>
                       </button>
                     </div>
                   </div>

                   <div>
                     <h3 className="text-xs font-mono text-[#88909c] mb-3 uppercase tracking-widest">Дополнительные действия</h3>
                     <button onClick={onSimulateCrash} className="w-full h-10 border border-red-500/30 bg-red-500/5 hover:bg-red-500/20 text-red-500 rounded flex items-center justify-center gap-2 font-mono text-xs tracking-widest uppercase transition-colors">
                        <ShieldAlert size={14} /> Симулировать сбой ядра
                     </button>
                   </div>

                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {(mobileMenuOpen || mobileMembersOpen) && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden absolute inset-0 bg-[#000]/60 backdrop-blur-sm z-20"
            onClick={() => { setMobileMenuOpen(false); setMobileMembersOpen(false); }}
          />
        )}
      </AnimatePresence>

      {/* 4.2 Rail (Leftmost) */}
      <aside style={{ gridArea: 'rail' }} className={`bg-[#030406]/95 border-r border-[#18202A] flex flex-col items-center gap-2 pt-4 pb-4 z-30 relative backdrop-blur-md transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} absolute lg:relative h-full w-[68px]`}>
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#5db5d9]/5 via-[#5db5d9]/10 to-transparent pointer-events-none" />
        
        <button className="w-[42px] h-[42px] rounded-lg border border-[#5db5d9]/30 bg-[#0B0F14] text-[#5db5d9] flex justify-center items-center hover:bg-[#5db5d9]/10 shadow-[0_0_15px_rgba(93,181,217,0.15)] transition-all mb-1 cursor-pointer"><Command size={18} /></button>
        <button className="w-[42px] h-[42px] rounded-lg border border-transparent text-[#5b6371] hover:text-[#f1f3f5] hover:bg-[#0B0F14] hover:border-[#18202A] flex justify-center items-center transition-all cursor-pointer"><Search size={18} /></button>
        
        <div className="w-4 h-[2px] bg-[#18202A] my-1 rounded-full relative" />
        
        <button className="w-[42px] h-[42px] rounded-lg border border-transparent text-[#88909c] hover:text-[#f1f3f5] hover:bg-[#0B0F14] hover:border-[#18202A] flex justify-center items-center transition-all cursor-pointer font-bold text-xs uppercase tracking-widest">SP</button>
        
        <button className="w-[42px] h-[42px] rounded-lg border border-[#5db5d9]/50 bg-[#5db5d9]/10 text-[#5db5d9] flex justify-center items-center transition-all cursor-pointer font-bold text-xs uppercase tracking-widest relative group shadow-[0_0_10px_rgba(93,181,217,0.1)]">
          EF
          <span className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#5db5d9] rounded shadow-[0_0_8px_#5db5d9]" />
        </button>
        
        <button className="w-[42px] h-[42px] rounded-lg border border-transparent text-[#88909c] hover:text-[#f1f3f5] hover:bg-[#0B0F14] hover:border-[#18202A] flex justify-center items-center transition-all cursor-pointer font-bold text-xs uppercase tracking-widest">T</button>
        
        <div className="mt-auto flex flex-col gap-3 pb-2 items-center w-full relative z-10">
          <div className="w-6 h-[2px] bg-gradient-to-r from-transparent via-[#18202A] to-transparent mx-auto rounded-full" />
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-[42px] h-[42px] rounded-[16px] border border-transparent bg-gradient-to-tr from-[#3b82f6] to-[#a380eb] p-[1px] cursor-pointer shadow-[0_0_20px_rgba(163,128,235,0.3)] hover:shadow-[0_0_30px_rgba(163,128,235,0.6)] relative group overflow-hidden"
            title="СОЗДАТЬ СЕРВЕР"
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:250%_250%] opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            <div className="flex w-full h-full items-center justify-center bg-[#0B0F14] rounded-[15px] group-hover:bg-transparent transition-colors duration-300 relative z-10">
               <Plus size={20} className="text-[#a380eb] group-hover:text-[#fff] group-hover:scale-125 group-hover:rotate-180 transition-all duration-500" />
            </div>
          </motion.button>
        </div>
      </aside>

      {/* 4.2 Sidebar (Channels/Tabs) */}
      <aside style={{ gridArea: 'channels' }} className={`bg-[#07090D]/95 border-r border-[#18202A] flex flex-col z-20 relative backdrop-blur-md transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-[68px] sm:translate-x-[68px]' : '-translate-x-[150%]'} absolute lg:relative h-full w-[260px]`}>
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#5db5d9]/[0.02] rounded-full blur-[40px] pointer-events-none" />
        
        <div className="px-5 py-5 border-b border-[#18202A] relative overflow-hidden">
          <div className="text-[0.95rem] font-bold text-[#f1f3f5] tracking-widest uppercase flex items-center justify-between">
            ECLIPSE FORGE
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-1.5 py-[2px] text-[0.45rem] font-bold tracking-[0.15em] uppercase rounded-sm border border-orange-500/20 bg-orange-500/10 text-orange-400">
              OWNER
            </span>
            <button className="text-[#5b6371] hover:text-[#f1f3f5] ml-auto"><Info size={12} /></button>
          </div>
          <div className="text-[0.55rem] text-[#5b6371] font-mono mt-2 opacity-80 uppercase tracking-widest flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-[#5b6371] rotate-45 block" />
             ID_XOERQR_SYS_ECLIPS
          </div>
        </div>

        {/* HUD Tabs */}
        <div className="flex px-2 pt-2 bg-[#030406]/50 border-b border-[#18202A]">
          <button className="flex-1 pb-2.5 text-[0.6rem] font-bold tracking-[0.15em] uppercase text-[#a380eb] border-b-2 border-[#a380eb] flex justify-center items-center gap-1.5 bg-gradient-to-t from-[#a380eb]/10 to-transparent transition-all">
            <LayoutList size={11} /> КАНАЛЫ
          </button>
          <button className="flex-1 pb-2.5 text-[0.6rem] font-bold tracking-[0.15em] uppercase text-[#5b6371] hover:text-[#f1f3f5] border-b-2 border-transparent hover:border-[#222B36] transition-all flex justify-center items-center gap-1.5">
            <CheckSquare size={11} /> ЗАДАЧИ
          </button>
          <button className="flex-1 pb-2.5 text-[0.6rem] font-bold tracking-[0.15em] uppercase text-[#5b6371] hover:text-[#f1f3f5] border-b-2 border-transparent hover:border-[#222B36] transition-all flex justify-center items-center gap-1.5">
            <Grid size={11} /> ДАННЫЕ
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-[2px] protocol-scrollbar relative text-[0.82rem]">
          
          <div className="flex justify-between items-center px-1 mt-2 mb-3 text-[0.55rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase">
            <div className="flex items-center gap-2 opacity-80">
               <span className="w-[3px] h-[3px] bg-[#5db5d9] rotate-45 block shadow-[0_0_4px_#5db5d9]" />
               ПОТОКИ ДАННЫХ
            </div>
            <span className="text-[0.6rem] font-mono">4</span>
            <button className="text-[#323640] hover:text-[#5db5d9] transition-colors ml-auto"><Plus size={10} /></button>
          </div>
          
          <ChannelButton icon="📌" name="Задачи" badge="5" />
          <ChannelButton icon="⭐" name="Эксперимент" badge="6" />
          <ChannelButton icon={<Activity size={13} />} name="ЧАТИК" badge="1" />
          
          {/* Active Channel Музыка */}
          <button className="flex items-center gap-3 px-3 py-2 rounded-sm mb-0.5 text-left relative bg-gradient-to-r from-[#a380eb]/10 to-transparent border border-[#a380eb]/30 text-[#f1f3f5] group mt-1 cursor-pointer transition-all hover:bg-gradient-to-r hover:from-[#a380eb]/20 hover:to-[#a380eb]/5">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#a380eb] shadow-[0_0_8px_#a380eb]" />
            <div className="w-5 flex justify-center text-[#a380eb] drop-shadow-[0_0_4px_rgba(163,128,235,0.8)]">🎵</div>
            <span className="font-bold tracking-wide flex-1">Музыка</span>
          </button>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#18202A] to-transparent my-4" />

          <div className="flex justify-between items-center px-1 mb-3 mt-2 text-[0.55rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase">
            <div className="flex items-center gap-2 opacity-80">
               <span className="w-[3px] h-[3px] bg-[#32b270] rotate-45 block shadow-[0_0_4px_#32b270]" />
               ВЕЩАНИЕ
            </div>
            <span className="text-[0.6rem] font-mono">1</span>
            <button className="text-[#323640] hover:text-[#32b270] transition-colors ml-auto"><Plus size={10} /></button>
          </div>
          <ChannelButton icon="🌍" name="Новости" />

          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#18202A] to-transparent my-4" />

          <div className="flex justify-between items-center px-1 mb-3 mt-2 text-[0.55rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase">
            <div className="flex items-center gap-2 opacity-80">
               <span className="w-[3px] h-[3px] bg-[#f97316] rotate-45 block shadow-[0_0_4px_#f97316]" />
               ГОЛОСОВЫЕ СВЯЗИ
            </div>
            <span className="text-[0.6rem] font-mono">2</span>
            <button className="text-[#323640] hover:text-[#f97316] transition-colors ml-auto"><Plus size={10} /></button>
          </div>
          <ChannelButton icon="💬" name="Обсуждение" />
          <ChannelButton icon="🎮" name="Играем" />
        </div>

        <div className="p-4 bg-[#030406] relative z-20">
           <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-[#2191b2] to-[#a380eb] border-none transition-all duration-300 rounded-[2px] h-[40px] shadow-[0_0_15px_rgba(33,145,178,0.5)] hover:shadow-[0_0_20px_rgba(163,128,235,0.6)]"
           >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[0%] transition-transform duration-500 ease-in-out" />
            <div className="relative flex justify-center items-center gap-3 text-[0.7rem] font-bold tracking-[0.1em] text-[#fff] uppercase transition-colors h-full">
              <Plus size={16} className="text-[#fff] group-hover:scale-125 transition-all duration-300" /> СОЗДАТЬ КОМНАТУ
            </div>
          </motion.button>
        </div>
      </aside>

      {/* 4.2 Chat Area */}
      <section style={{ 
        gridArea: 'chat',
        backgroundImage: `url(${bgEclipseForge})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }} className="flex flex-col relative min-w-0 z-0 overflow-hidden bg-[#07090D]">
        
        {/* Semi-transparent overlay to ensure readability */}
        <div className="absolute inset-0 bg-[#07090D]/80 backdrop-blur-[2px] z-0 pointer-events-none transition-colors duration-500" />

        {/* Deep background tech grid */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 transition-opacity duration-1000" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}>
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_10%,_#07090D_90%)]" />
        </div>
        
        {/* Chat Header Hover */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="h-[60px] px-4 md:px-6 flex items-center gap-3 md:gap-4 border-b border-[#18202A] bg-[#07090D] backdrop-blur-xl relative z-10 shrink-0">
          <div className="text-[1.2rem] text-[#a380eb] mr-1 hidden sm:block">🎵</div>
          <span className="text-[1.1rem] font-bold text-[#f1f3f5] tracking-wide">Музыка</span>
          
          <div className="h-4 w-px bg-[#222B36] mx-2 hidden sm:block" />
            <span className="text-[0.7rem] font-medium text-[#5b6371] truncate max-w-[300px] hover:text-[#f1f3f5] transition-colors cursor-pointer hidden sm:block">
              Сохраняем музыку
            </span>
          
          <div className="flex items-center gap-3 ml-auto">
             <button className="w-8 h-8 rounded-sm hover:bg-[#11161D] flex items-center justify-center text-[#5b6371] hover:text-[#f1f3f5] transition-all"><Info size={18} /></button>
             <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-sm hover:bg-[#11161D] flex items-center justify-center text-[#5b6371] hover:text-[#f1f3f5] transition-all"><Settings size={18} /></button>
          </div>
        </motion.div>

        {/* Message List Layer */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 flex flex-col gap-6 relative z-10 protocol-scrollbar">
          
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="text-center my-2 flex items-center justify-center">
             <div className="h-px bg-gradient-to-r from-transparent via-[#18202A] to-transparent flex-1 max-w-[150px]" />
             <span className="text-[0.6rem] font-bold tracking-[0.1em] text-[#a380eb] px-4 uppercase">
               ЗАПИСЬ_ЖУРНАЛА_20_МАЯ_2026 // СИНХР_ВРЕМЕНИ
             </span>
             <div className="h-px bg-gradient-to-r from-[#18202A] via-[#18202A] to-transparent flex-1 max-w-[150px]" />
          </motion.div>

          {/* AI Message */}
          <motion.article initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="relative grid grid-cols-[48px_1fr] gap-5 group">
            <div className="absolute -left-8 top-0 bottom-0 w-px bg-[#18202A] group-hover:bg-[#a380eb]/20 transition-colors pointer-events-none" />
            
            <div className="relative">
              <div className="w-12 h-12 rounded-lg bg-[#07090D] border border-[#a380eb]/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(163,128,235,0.1),0_0_10px_rgba(163,128,235,0.1)] ec-avatar-glow z-10 relative overflow-hidden group-hover:shadow-[inset_0_0_20px_rgba(163,128,235,0.2),0_0_15px_rgba(163,128,235,0.3)] transition-all">
                 <img src={agentSmoke} alt="Smoke AI" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                 <div className="absolute -top-1 -right-1 w-2 h-2 rounded bg-[#a380eb] border border-[#07090D] animate-pulse" />
              </div>
            </div>
            
            <div className="bg-[#0B0F14]/40 border border-[#18202A]/50 rounded-lg p-5 hover:border-[#a380eb]/40 transition-all backdrop-blur-xl relative overflow-hidden group/card hover:bg-[#0B0F14]/80 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#a380eb]/5 blur-2xl rounded-full opacity-30 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex items-center gap-3 mb-3 border-b border-[#18202A]/50 pb-3">
                <span className="font-bold text-[#f1f3f5] text-[0.95rem] tracking-wide">Smoke</span>
                <span className="px-1.5 py-0.5 text-[0.5rem] tracking-[0.1em] uppercase rounded-sm border border-[#a380eb]/40 bg-[#a380eb]/10 text-[#d1bcf5] font-bold flex items-center gap-1.5">
                  <Cpu size={10} /> AI_AGENT
                </span>
                <span className="text-[0.6rem] text-[#5b6371] font-mono uppercase tracking-widest ml-auto opacity-70">Время: 13:21</span>
              </div>
              
              <div className="text-[#a1a9b8] text-[0.9rem] leading-[1.6] font-sans -tracking-[0.01em]">
                Павел хочет обсудить план разработки <span className="text-[#f1f3f5] font-medium tracking-wide">Next Generation Operational Platform</span>, 
                подчёркивая, что это не копия Discord, Slack или Telegram, а платформа для 
                коммуникации, выполнения задач, использования AI и управления рабочими потоками в парадигме кибер-пространства.
              </div>
              
              {/* Video Player Mock */}
              <div className="mt-4 p-1.5 bg-[#030406]/80 backdrop-blur-md border border-[#18202A] rounded-lg min-w-[320px] max-w-[480px] hover:border-[#a380eb]/40 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(163,128,235,0.15)] group/video cursor-pointer relative overflow-hidden">
                <div className="aspect-video bg-[#000] rounded border border-[#18202A] relative overflow-hidden flex items-center justify-center group/vidbox">
                   {/* Fake video background effect */}
                   <div className="absolute inset-0 bg-[#a380eb]/5 group-hover/video:bg-[#a380eb]/10 transition-colors" />
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_50%,_#000_100%)]" />
                   <motion.div 
                     animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }} 
                     transition={{ duration: 4, repeat: Infinity }}
                     className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(163,128,235,0.05)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%]" 
                   />
                   
                   {/* Play Button */}
                   <motion.div 
                     whileHover={{ scale: 1.1 }}
                     whileTap={{ scale: 0.9 }}
                     className="w-14 h-14 rounded-full bg-[#0B0F14]/90 backdrop-blur border border-[#a380eb]/50 flex items-center justify-center z-10 text-[#a380eb] shadow-[0_0_20px_rgba(163,128,235,0.3)] group-hover/vidbox:border-[#a380eb] group-hover/vidbox:bg-[#a380eb]/20 group-hover/vidbox:text-[#fff] transition-all"
                   >
                     <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-[#a380eb]/30 scale-0 group-hover/vidbox:scale-150 transition-transform duration-500" />
                     <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#a380eb]/30 scale-0 group-hover/vidbox:scale-150 transition-transform duration-500" />
                     <span className="ml-1 opacity-90 group-hover/vidbox:opacity-100">▶</span>
                   </motion.div>

                   {/* Video overlay UI */}
                   <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#000] to-transparent flex flex-col gap-2 translate-y-2 group-hover/video:translate-y-0 opacity-0 group-hover/video:opacity-100 transition-all">
                      <div className="flex items-center justify-between text-[0.6rem] font-mono text-[#f1f3f5] uppercase tracking-widest drop-shadow-md">
                        <span>СИМУЛЯЦИЯ_ЯДРА.mp4</span>
                        <span className="text-[#a380eb]">01:42 :: 1A</span>
                      </div>
                      <div className="h-1 bg-[#18202A] rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 bottom-0 w-[35%] bg-gradient-to-r from-[#5db5d9] to-[#a380eb] rounded-full" />
                        <div className="absolute top-1/2 -translate-y-1/2 left-[35%] w-2 h-2 rounded-full bg-[#f1f3f5] shadow-[0_0_5px_#fff]" />
                      </div>
                   </div>
                </div>
              </div>
              
              {/* Context Action Bar */}
              <div className="mt-4 pt-3 border-t border-[#18202A]/30 flex items-center justify-between opacity-0 group-hover/card:opacity-100 transition-all translate-y-2 group-hover/card:translate-y-0 duration-300">
                 <div className="flex gap-2">
                   <button className="text-[0.55rem] font-bold font-mono tracking-[0.2em] text-[#5b6371] border border-[#222B36] bg-[#07090D] px-2.5 py-1.5 rounded-sm hover:text-[#5db5d9] hover:border-[#5db5d9]/30 transition-all cursor-pointer">РАЗБОР_ДЕЙСТВИЯ</button>
                   <button className="text-[0.55rem] font-bold font-mono tracking-[0.2em] text-[#5b6371] border border-[#222B36] bg-[#07090D] px-2.5 py-1.5 rounded-sm hover:text-[#5db5d9] hover:border-[#5db5d9]/30 transition-all cursor-pointer">КОПИРОВАТЬ</button>
                 </div>
                 <div className="flex gap-2 items-center">
                    <CyberEmojiFire />
                    <CyberEmojiVerified />
                 </div>
              </div>
            </div>
          </motion.article>

          {/* User Message */}
          <motion.article initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="relative grid grid-cols-[48px_1fr] gap-5 group">
            <div className="absolute -left-8 top-0 bottom-0 w-px bg-[#18202A] group-hover:bg-[#5db5d9]/20 transition-colors pointer-events-none" />
            
            <div className="w-12 h-12 rounded-lg bg-[#07090D] border border-[#5db5d9]/30 flex items-center justify-center text-white font-bold text-[1.1rem] shadow-[inset_0_0_15px_rgba(93,181,217,0.1)] relative z-10 overflow-hidden group-hover:shadow-[inset_0_0_20px_rgba(93,181,217,0.2),0_0_15px_rgba(93,181,217,0.3)] transition-all">
               <img src={avatarPavel} alt="Pavel" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               <div className="absolute -top-1 -right-1 w-2 h-2 rounded bg-green-500 border border-[#07090D]" />
            </div>
            
            <div className="bg-transparent group/content">
              <div className="flex items-center gap-3 mb-2 px-1">
                <span className="font-bold text-[#f1f3f5] text-[0.95rem] tracking-wide">Павел</span>
                <span className="px-1.5 py-0.5 text-[0.5rem] tracking-[0.1em] uppercase rounded-sm border border-[#5db5d9]/30 text-[#5db5d9] font-bold">
                  OPR
                </span>
                <span className="text-[0.6rem] text-[#5b6371] font-mono uppercase tracking-widest ml-auto opacity-70">Время: 15:45</span>
              </div>
              
              <div className="text-[#a1a9b8] text-[0.9rem] leading-[1.6]">
                {/* Enhanced Audio/Media Card */}
                <div className="p-1 bg-[#0B0F14]/60 backdrop-blur-md border border-[#18202A] rounded-lg min-w-[320px] max-w-[480px] hover:border-[#5db5d9]/40 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(93,181,217,0.15)] group/media cursor-pointer relative overflow-hidden mt-1 transform origin-left">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-[#5db5d9]/[0.03] blur-[40px] rounded-full pointer-events-none group-hover/media:bg-[#5db5d9]/10 transition-colors" />
                  
                  <div className="bg-[#030406]/80 rounded-md p-3 relative z-10 border border-[#18202A] group-hover/media:border-[#222B36] transition-colors">
                    <div className="flex items-center gap-4">
                      
                      {/* Play Button - Futuristic */}
                      <div className="relative">
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-14 h-14 rounded-full bg-[#07090D] border-2 border-[#5db5d9]/30 text-[#5db5d9] flex justify-center items-center shrink-0 group-hover/media:bg-[#5db5d9]/10 group-hover/media:border-[#5db5d9] transition-all relative shadow-[0_0_15px_rgba(93,181,217,0.1)] z-10"
                        >
                          <span className="ml-1 text-sm font-bold opacity-90 group-hover/media:opacity-100">▶</span>
                        </motion.button>
                        {/* Spinning border effect */}
                        <motion.div 
                          animate={{ rotate: 360 }} 
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-[-4px] rounded-full border border-dashed border-[#5db5d9]/20 group-hover/media:border-[#5db5d9]/60 pointer-events-none" 
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-2 border-b border-[#18202A]/80 pb-1.5 w-full">
                          <div className="text-[0.65rem] font-bold tracking-[0.15em] text-[#f1f3f5] truncate font-mono uppercase group-hover/media:text-[#5db5d9] transition-colors">
                            Bury_The_Light.wav
                          </div>
                          <span className="text-[0.55rem] text-[#5db5d9] bg-[#5db5d9]/10 px-1.5 py-0.5 rounded border border-[#5db5d9]/20 font-mono tracking-widest hidden sm:block">HQ_CODEC</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           {/* Abstract waveform */}
                           <div className="flex-1 flex items-end gap-[3px] h-6 opacity-50 group-hover/media:opacity-100 transition-opacity overflow-hidden">
                             {Array.from({length: 40}).map((_, i) => (
                               <motion.div 
                                 initial={{ height: "15%" }}
                                 animate={{ height: `${Math.max(15, Math.sin(i*0.5)*50 + Math.random()*20 + 30)}%` }}
                                 transition={{ duration: 0.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: i * 0.04 }}
                                 key={i} 
                                 className="w-[2px] bg-gradient-to-t from-[#256c9a] to-[#5db5d9] rounded-[1px] relative" 
                               >
                                 {i === 15 && <span className="absolute top-0 w-full h-[200%] bg-white blur-[2px] opacity-50" />}
                               </motion.div>
                             ))}
                           </div>
                           <div className="text-[0.55rem] text-[#5b6371] group-hover/media:text-[#88909c] transition-colors font-mono tracking-widest bg-[#0B0F14] px-1.5 py-0.5 rounded border border-[#18202A]">17.8M</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reactions */}
                <div className="flex gap-2 items-center opacity-0 group-hover/content:opacity-100 transition-all translate-y-1 group-hover/content:translate-y-0 mt-2 ml-1 duration-300">
                  <div className="bg-[#0B0F14]/80 border border-[#18202A] px-2 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm cursor-pointer hover:border-[#5db5d9]/50 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    <CyberEmojiCool />
                    <span className="text-[0.6rem] font-mono text-[#5db5d9] font-bold">1</span>
                  </div>
                  <div className="bg-[#0B0F14]/80 border border-[#18202A] px-2 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm cursor-pointer hover:border-[#a380eb]/50 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    <CyberEmojiHeart />
                    <span className="text-[0.6rem] font-mono text-[#a380eb] font-bold">3</span>
                  </div>
                </div>

              </div>
            </div>
          </motion.article>
          
          <div className="h-12" /> {/* Bottom spacer for composer */}
        </div>

        {/* 4.2 Composer Container */}
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="absolute bottom-0 left-0 right-0 p-4 md:p-8 pt-16 bg-gradient-to-t from-[#030406] via-[#030406]/90 to-transparent z-20 pointer-events-none">
          <div className="max-w-5xl mx-auto flex flex-col bg-[#07090D]/95 backdrop-blur-xl border border-[#18202A] rounded-lg focus-within:border-[#5db5d9]/50 transition-all shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative group overflow-hidden pointer-events-auto hover:shadow-[0_15px_60px_rgba(0,0,0,0.9)]">
            
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#5db5d9]/30 to-transparent" />
            
            <div className="flex items-center px-4 py-3 gap-2 bg-[#07090D]/80">
               <span className="hidden sm:flex text-[0.55rem] font-bold tracking-[0.1em] text-[#32b270] px-3 py-1 rounded-sm bg-[#32b270]/5 items-center gap-2 border border-[#32b270]/20">
                 <Terminal size={10} /> 
                 &gt;_ ЗАЩИЩЕННЫЙ КАНАЛ
               </span>
               <span className="text-[0.6rem] font-medium text-[#5b6371] uppercase tracking-[0.15em] ml-2 opacity-70">Ожидание сигнала •••</span>
            </div>

            <div className="flex items-end p-2 px-4 gap-2 relative bg-[#07090D]/80 pb-3">
               <motion.button 
                 whileHover={{ scale: 1.1 }}
                 whileTap={{ scale: 0.9 }}
                 className="hidden sm:flex w-10 h-10 rounded-md shrink-0 items-center justify-center text-[#5b6371] hover:text-[#f1f3f5] hover:bg-[#18202A] transition-all cursor-pointer m-1 duration-300"
               >
                 <Paperclip size={18} />
               </motion.button>
               <motion.button 
                 whileHover={{ scale: 1.1 }}
                 whileTap={{ scale: 0.9 }}
                 className="hidden sm:flex w-10 h-10 rounded-md shrink-0 items-center justify-center text-[#5b6371] hover:text-[#f1f3f5] hover:bg-[#18202A] transition-all cursor-pointer m-1 duration-300"
               >
                 <Mic size={18} />
               </motion.button>
               
               <textarea 
                 rows={1}
                 placeholder="Передача сигнала в #Музыка..." 
                 className="flex-1 bg-transparent border-0 outline-none text-[#f1f3f5] text-[0.95rem] py-3 placeholder:text-[#323640] placeholder:font-mono placeholder:tracking-widest placeholder:text-[0.8rem] font-sans resize-none px-2 sm:px-0"
               />
               
               <motion.button 
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
                 className="relative group/send h-[42px] px-6 rounded-[2px] bg-[#f1f3f5] text-[#000] hover:bg-[#fff] transition-all m-1 cursor-pointer shrink-0 overflow-hidden"
               >
                  <div className="relative flex justify-center items-center gap-2 font-black text-[0.7rem] tracking-[0.15em] uppercase">
                     ПЕРЕДАТЬ 
                     <Send size={14} className="ml-1" />
                  </div>
               </motion.button>
            </div>
            
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#0B0F14] border-t border-[#18202A]/50 text-[0.55rem] font-mono text-[#5b6371] tracking-[0.05em] uppercase">
               <div className="flex items-center gap-3 sm:gap-4 opacity-70">
                  <span className="hidden sm:inline">Enter — отправить</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden md:inline">Shift+Enter — новая строка</span>
                  <span className="hidden md:inline">·</span>
                  <span className="hidden lg:inline">drop файлы</span>
                  <span className="hidden lg:inline">·</span>
                  <span className="hidden lg:inline">@ участник</span>
                  <span className="hidden lg:inline">·</span>
                  <span className="hidden lg:inline">: emoji</span>
                  <span className="hidden lg:inline">·</span>
                  <span className="hidden xl:inline">/task задача</span>
               </div>
               <div className="flex items-center gap-2 shrink-0 font-bold tracking-[0.2em] text-[#32b270]"><span className="w-1.5 h-1.5 bg-[#32b270] rounded-sm inline-block shadow-[0_0_5px_#32b270] animate-pulse" /> ШИФРОВАНИЕ</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 4.2 Members Post (Right Rail) */}
      <aside style={{ gridArea: 'members' }} className={`bg-[#07090D] border-l border-[#18202A] flex flex-col z-20 ec-glass-panel relative backdrop-blur-md transition-transform duration-300 lg:translate-x-0 ${mobileMembersOpen ? 'translate-x-0' : 'translate-x-full'} absolute right-0 lg:relative h-full w-[260px]`}>
        
        <div className="p-4 border-b border-[#18202A] flex items-center gap-2">
           <div className="flex-1 bg-[#030406] border border-[#18202A] rounded-sm flex items-center px-2 h-[34px] focus-within:border-[#5db5d9]/50 transition-colors">
              <Search size={14} className="text-[#5b6371]" />
              <input type="text" placeholder="ПОИСК ..." className="bg-transparent border-0 outline-none text-[0.7rem] text-[#f1f3f5] w-full ml-2 placeholder:text-[#5b6371] placeholder:tracking-widest" />
           </div>
           <div className="flex gap-1 h-[34px] shrink-0">
             <button className="w-[34px] h-full bg-[#0B0F14] border border-[#18202A] rounded-sm flex items-center justify-center text-[#5db5d9] transition-colors"><Grid size={16} /></button>
             <button className="w-[34px] h-full bg-[#0B0F14] border border-[#18202A] rounded-sm flex items-center justify-center text-[#5b6371] hover:text-[#5db5d9] transition-colors"><LayoutList size={16} /></button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 relative z-10 protocol-scrollbar">
          
          <div className="text-[0.6rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase mb-4 opacity-80 pl-1">
             ОСНОВАТЕЛЬ — 1
          </div>
          
          <div className="flex items-center gap-3 py-2 px-1 -mx-1 rounded-md hover:bg-[#11161D] border border-transparent cursor-pointer transition-all group">
            <div className="relative">
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <img src={avatarPavel} alt="Pavel" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#07090D]" />
            </div>
             <div className="flex flex-col">
               <span className="text-[0.8rem] text-[#f97316] font-bold tracking-wide">Павел</span>
               <span className="text-[0.55rem] text-[#5b6371] uppercase tracking-wider font-medium">В сети</span>
             </div>
          </div>

          <div className="text-[0.6rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase mb-4 mt-8 opacity-80 pl-1">
             В СЕТИ — 0
          </div>

          <div className="text-[0.6rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase mb-4 mt-6 opacity-80 pl-1">
             ВНЕ СЕТИ — 3
          </div>
          
          {['Повелитель', 'BigYtka', 'Reptail'].map((name, i) => (
             <div key={i} className="flex items-center gap-3 py-2 px-1 -mx-1 rounded-md hover:bg-[#11161D] cursor-pointer transition-all group opacity-50 hover:opacity-100 border border-transparent">
               <div className="w-8 h-8 rounded-full bg-[#18202A] flex justify-center items-center text-[#88909c] text-[0.85rem] font-bold leading-none font-sans overflow-hidden">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=transparent`} alt={name} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
               </div>
               <span className="text-[0.8rem] text-[#88909c] group-hover:text-[#c1c8d4] font-medium tracking-wide">{name}</span>
            </div>
          ))}
          
        </div>
      </aside>
    </div>
  );
}

function ChannelButton({ icon, name, badge, mt }: { icon: React.ReactNode | string, name: string, badge?: string, mt?: boolean }) {
  return (
    <button className={`flex items-center gap-3 px-3 py-2 ${mt ? 'mt-1' : 'mb-0.5'} rounded-sm border border-transparent text-[0.82rem] text-[#88909c] hover:bg-[#11161D] hover:border-[#18202A] hover:text-[#f1f3f5] text-left group transition-all cursor-pointer`}>
      <div className="w-5 flex justify-center text-[10px] sm:text-xs opacity-60 group-hover:opacity-100 group-hover:text-[#5db5d9] transition-colors">{icon}</div>
      <span className="font-medium tracking-wide flex-1">{name}</span>
      {badge && <span className="text-[0.55rem] text-[#323640] bg-[#030406] border border-[#18202A] group-hover:border-[#323640] group-hover:text-[#88909c] px-[5px] py-[1px] rounded-[2px] font-mono font-bold transition-colors tracking-widest">{badge}</span>}
    </button>
  );
}