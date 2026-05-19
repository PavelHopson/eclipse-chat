import React, { useState } from 'react';
import { Settings, Info, Pin, CheckSquare, Search, ShieldAlert, Bell, Cpu, Grid, LayoutList, Plus, Sparkles, Activity, Map as MapIcon, Command, Terminal, Radio, Menu, X, Monitor, Moon, Sun, Eclipse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import eclipseLogo from './assets/images/eclipse_logo_1779198030363.png';
import avatarPavel from './assets/images/avatar_pavel_1779198047226.png';
import agentSmoke from './assets/images/agent_smoke_1779198065620.png';
import bgEclipseForge from './assets/images/bg_eclipse_forge_1779198416344.png';
import bgCosmos from './assets/images/bg_eclipse_forge_1779198416344.png'; // Will reuse for now
import emojiFire from './assets/images/emoji_fire_1779198437845.png';
import emojiHeart from './assets/images/emoji_heart_1779198453628.png';
import emojiCool from './assets/images/emoji_cool_1779198470151.png';
import stickerVerified from './assets/images/sticker_verified_1779198308499.png';
import stickerAlert from './assets/images/sticker_alert_1779198327536.png';
import { useTheme } from './ThemeContext';

export default function ChatShell({ onLogout, onSimulateCrash }: { onLogout: () => void, onSimulateCrash: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="ec-shell bg-[#000000] text-[#f1f3f5] overflow-hidden selection:bg-[#5db5d9]/30">
      
      {/* 4.2 Top Bar */}
      <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ gridArea: 'top' }} className="relative z-40 flex items-center justify-between px-4 bg-[#0B0F14]/80 backdrop-blur-xl border-b border-[#5db5d9]/10 ec-telemetry-edge shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Animated scanning line in header */}
        <div className="absolute bottom-0 left-0 h-[1px] w-32 bg-gradient-to-r from-transparent via-[#5db5d9]/80 to-transparent animate-[translate-x-[200vw]_4s_linear_infinite]" />
        
        <div className="flex items-center gap-4">
          <button 
            className="lg:hidden w-8 h-8 flex items-center justify-center text-[#5db5d9] bg-[#030406] border border-[#18202A] rounded-sm hover:bg-[#11161D]"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileMembersOpen(false); }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          
          <div className="flex items-center gap-3 font-black text-[#f1f3f5] tracking-[0.2em] uppercase text-[0.8rem] relative">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-sm overflow-hidden border border-[#5db5d9]/40 bg-[#000]">
              <div className="absolute inset-0 bg-[#5db5d9]/20 animate-pulse" />
              <img src={eclipseLogo} alt="Логотип ОС Eclipse" className="w-full h-full object-cover mix-blend-screen relative z-10 p-0.5" referrerPolicy="no-referrer" />
            </div>
            <span className="bg-gradient-to-r from-[#f1f3f5] via-[#5db5d9] to-[#f1f3f5] bg-clip-text text-transparent mt-px">ECLIPSE_OS</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-2 text-[#5b6371] text-[0.6rem] font-mono uppercase tracking-[0.15em] border-l border-[#18202A] pl-6 h-6">
            <span className="hover:text-[#5db5d9] cursor-pointer transition-colors">УЗЕЛ СЕРВЕРА //</span>
            <span className="text-[#f1f3f5]">Eclipse Forge</span>
            <span className="mx-1 opacity-40">/</span>
            <span className="text-[#5db5d9] flex items-center gap-1.5"><Sparkles size={10} className="animate-pulse" /> Эксперимент</span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {/* Telemetry data */}
          <div className="hidden xl:flex items-center gap-5 text-[0.55rem] font-mono text-[#5b6371] mr-2">
             <div className="flex items-center gap-1.5 text-[#32b270] drop-shadow-[0_0_4px_#32b270]"><span className="w-1.5 h-1.5 bg-[#32b270] rounded-[1px] animate-[pulse_2s_ease-in-out_infinite]" /> СЕТЬ: СТАБИЛЬНА</div>
             <div className="flex items-center gap-1">ПАМ: 12%</div>
             <div className="flex items-center gap-1">ЦП: 04%</div>
          </div>
          
          <div className="flex items-center gap-1 h-6 pr-4 md:pr-6 border-r border-[#18202A]">
            <button className="w-8 h-8 rounded border border-transparent hover:border-[#5db5d9]/30 hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#5db5d9] hidden md:flex justify-center items-center transition-all"><Search size={14} /></button>
            <button className="w-8 h-8 rounded border border-transparent hover:border-[#5db5d9]/30 hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#5db5d9] flex justify-center items-center transition-all relative">
              <ShieldAlert size={14} />
            </button>
            <button 
              className="lg:hidden w-8 h-8 rounded border border-transparent hover:border-[#5db5d9]/30 hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#5db5d9] flex justify-center items-center transition-all relative"
              onClick={() => { setMobileMembersOpen(!mobileMembersOpen); setMobileMenuOpen(false); }}
            >
              <MapIcon size={14} />
            </button>
            <button className="hidden md:flex w-8 h-8 rounded border border-transparent hover:border-[#5db5d9]/30 hover:bg-[#5db5d9]/5 text-[#5b6371] hover:text-[#5db5d9] justify-center items-center transition-all relative group">
              <Bell size={14} />
              <span className="absolute top-[6px] right-[8px] w-1.5 h-1.5 bg-[#a380eb] rounded-full group-hover:animate-ping" />
              <span className="absolute top-[6px] right-[8px] w-1.5 h-1.5 bg-[#a380eb] rounded-full" />
            </button>
          </div>

          <div 
            className="flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-sm bg-[#030406] border border-[#18202A] cursor-pointer hover:border-[#5db5d9]/40 transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] group h-8 mt-px"
            onClick={onLogout}
            title="ВЫХОД ИЗ СИСТЕМЫ"
          >
            <div className="w-[20px] h-[20px] rounded-sm bg-[#5db5d9]/10 flex items-center justify-center border border-[#5db5d9]/20 overflow-hidden group-hover:border-[#5db5d9] transition-all">
               <img src={avatarPavel} alt="Avatar" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" referrerPolicy="no-referrer" />
            </div>
            <span className="text-[0.65rem] font-bold tracking-[0.15em] uppercase text-[#88909c] group-hover:text-[#f1f3f5] transition-colors mt-[1px]">Павел</span>
          </div>
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
        
        <div className="mt-auto flex flex-col gap-3">
          <div className="w-4 h-[2px] bg-[#18202A] mx-auto rounded-full" />
          <button className="w-[42px] h-[42px] rounded-lg border border-[#18202A] border-dashed text-[#5b6371] hover:text-[#5db5d9] hover:border-[#5db5d9]/50 hover:bg-[#0B0F14] flex justify-center items-center transition-all cursor-pointer"><Plus size={18} /></button>
        </div>
      </aside>

      {/* 4.2 Sidebar (Channels/Tabs) */}
      <aside style={{ gridArea: 'channels' }} className={`bg-[#07090D]/95 border-r border-[#18202A] flex flex-col z-20 relative backdrop-blur-md transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-[68px] sm:translate-x-[68px]' : '-translate-x-[150%]'} absolute lg:relative h-full w-[260px]`}>
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#5db5d9]/[0.02] rounded-full blur-[40px] pointer-events-none" />
        
        <div className="px-5 py-5 border-b border-[#18202A] relative overflow-hidden">
          <div className="text-[0.95rem] font-bold text-[#f1f3f5] tracking-widest uppercase flex items-center justify-between">
            Eclipse Forge
            <span className="inline-flex items-center gap-1.5 px-1.5 py-[2px] text-[0.45rem] font-bold tracking-[0.15em] uppercase rounded-sm border border-orange-500/20 bg-orange-500/10 text-orange-400">
              <ShieldAlert size={8} /> OWNER
            </span>
          </div>
          <div className="text-[0.55rem] text-[#5b6371] font-mono mt-1.5 opacity-80 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#5b6371] rotate-45 block" />
            ID_809_SYS_ECLIPSE
          </div>
        </div>

        {/* HUD Tabs */}
        <div className="flex px-2 pt-2 bg-[#030406]/50 border-b border-[#18202A]">
          <button className="flex-1 pb-2.5 text-[0.6rem] font-bold tracking-[0.15em] uppercase text-[#5db5d9] border-b-2 border-[#5db5d9] flex justify-center items-center gap-1.5 bg-gradient-to-t from-[#5db5d9]/10 to-transparent transition-all">
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
               ПОТОКИ_ДАННЫХ
            </div>
            <button className="text-[#323640] hover:text-[#5db5d9] transition-colors"><Plus size={10} /></button>
          </div>
          
          <ChannelButton icon="📌" name="Задачи" badge="05" />
          
          {/* Active Channel */}
          <button className="flex items-center gap-3 px-3 py-2 rounded-sm mb-0.5 text-left relative bg-gradient-to-r from-[#5db5d9]/10 to-transparent border border-[#5db5d9]/30 text-[#f1f3f5] group mt-1 cursor-pointer transition-all hover:bg-gradient-to-r hover:from-[#5db5d9]/20 hover:to-[#5db5d9]/5">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#5db5d9] shadow-[0_0_8px_#5db5d9]" />
            <div className="w-5 flex justify-center text-[#5db5d9] drop-shadow-[0_0_4px_rgba(93,181,217,0.8)]"><Sparkles size={13} className="animate-pulse" /></div>
            <span className="font-bold tracking-wide flex-1">Эксперимент</span>
            <span className="text-[0.55rem] text-[#07090D] bg-[#5db5d9] px-1.5 py-[1px] rounded-[2px] font-mono font-bold">06</span>
          </button>

          <ChannelButton icon={<Activity size={13} />} name="ЧАТИК" badge="01" mt />
          <ChannelButton icon={<Terminal size={13} />} name="Логи Системы" />

          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#18202A] to-transparent my-4" />

          <div className="flex justify-between items-center px-1 mb-3 text-[0.55rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase">
            <div className="flex items-center gap-2 opacity-80">
               <span className="w-[3px] h-[3px] bg-[#a380eb] rotate-45 block shadow-[0_0_4px_#a380eb]" />
               ГОЛОСОВЫЕ_СВЯЗИ
            </div>
          </div>
          
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-[#88909c] hover:bg-[#11161D] hover:text-[#f1f3f5] transition-all text-left group border border-transparent hover:border-[#18202A] relative cursor-pointer">
             <div className="w-5 flex justify-center text-[#5b6371] group-hover:text-[#f1f3f5]"><Radio size={13} /></div>
             <span className="font-medium tracking-wide">Обсуждение</span>
             <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
               <span className="absolute w-2 h-2 rounded-full bg-[#5db5d9] animate-ping opacity-75" />
               <span className="relative w-1.5 h-1.5 rounded-full bg-[#5db5d9]" />
             </span>
          </button>
        </div>

        <div className="p-4 border-t border-[#18202A] bg-[#030406] relative">
           <button className="w-full relative group overflow-hidden bg-[#11161D] border border-[#222B36] hover:border-[#5db5d9]/60 transition-all duration-300 rounded-sm h-[38px]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#5db5d9]/0 via-[#5db5d9]/10 to-[#5db5d9]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
            <div className="relative flex justify-center items-center gap-2 text-[0.6rem] font-bold font-mono tracking-widest text-[#88909c] group-hover:text-[#5db5d9] uppercase transition-colors h-full">
              <Plus size={12} className="opacity-70" /> СОЗДАТЬ КОМНАТУ
            </div>
          </button>
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
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50 transition-opacity duration-1000" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}>
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_20%,_#07090D_100%)]" />
        </div>
        
        {/* Chat Header Hover */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="h-[60px] px-4 md:px-8 flex items-center gap-3 md:gap-4 border-b border-[#18202A] bg-[#0B0F14]/70 backdrop-blur-xl relative z-10 shrink-0">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5db5d9]/30 to-transparent" />
          
          <Sparkles className="text-[#5db5d9] hidden sm:block" size={18} />
          <span className="text-lg md:text-[1.1rem] font-black text-[#f1f3f5] tracking-widest uppercase">ЭКСПЕРИМЕНТ</span>
          
          <div className="h-4 w-px bg-[#222B36] mx-1 hidden sm:block" />
          <span className="hidden md:inline-block text-[0.65rem] font-mono tracking-[0.15em] uppercase text-[#5b6371] truncate max-w-[300px]">
            Тестируем новые возможности // CORE_SYS
          </span>
          
          <div className="flex items-center gap-2.5 ml-auto">
             <div className="hidden sm:flex items-center h-[26px] px-3 gap-2 rounded-sm bg-[#030406] border border-[#18202A] hover:border-[#a380eb]/40 hover:bg-[#a380eb]/5 cursor-pointer transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(163,128,235,0.15)]">
               <Pin size={11} className="text-[#a380eb]" />
               <span className="text-[0.55rem] font-mono font-bold tracking-widest text-[#a380eb]">01</span>
             </div>
             <div className="hidden sm:flex items-center h-[26px] px-3 gap-2 rounded-sm bg-[#030406] border border-[#18202A] hover:border-[#32b270]/40 hover:bg-[#32b270]/5 cursor-pointer transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(50,178,112,0.15)] mr-2">
               <CheckSquare size={11} className="text-[#32b270]" />
               <span className="text-[0.55rem] font-mono font-bold tracking-widest text-[#32b270]">05</span>
             </div>
             <div className="hidden sm:block w-px h-5 bg-[#18202A] mx-1" />
             <button className="w-8 h-8 rounded-sm border border-transparent hover:border-[#18202A] hover:bg-[#0B0F14] hidden sm:flex items-center justify-center text-[#5b6371] hover:text-[#5db5d9] transition-all"><Info size={16} /></button>
             <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-sm border border-transparent hover:border-[#18202A] hover:bg-[#0B0F14] flex items-center justify-center text-[#5b6371] hover:text-[#5db5d9] transition-all"><Settings size={16} /></button>
          </div>
        </motion.div>

        {/* Message List Layer */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 flex flex-col gap-8 relative z-10 protocol-scrollbar">
          
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="text-center my-2 select-none">
             <span className="text-[0.55rem] font-mono tracking-[0.2em] uppercase text-[#323640] border-t border-b border-[#18202A]/50 px-8 py-1.5 bg-[#0B0F14]/30 backdrop-blur">
               ЗАПИСЬ_ЖУРНАЛА_17_МАЯ_2026 // СИНХР_ВРЕМЕНИ
             </span>
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
            
            <div className="bg-[#0B0F14]/40 border border-[#18202A] rounded-lg p-5 hover:border-[#a380eb]/30 transition-all backdrop-blur-sm relative overflow-hidden group/card hover:bg-[#0B0F14]/60">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#a380eb]/5 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
              
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
              
              {/* Context Action Bar */}
              <div className="mt-4 pt-3 border-t border-[#18202A]/30 flex items-center justify-between opacity-0 group-hover/card:opacity-100 transition-all translate-y-2 group-hover/card:translate-y-0 duration-300">
                 <div className="flex gap-2">
                   <button className="text-[0.55rem] font-bold font-mono tracking-[0.2em] text-[#5b6371] border border-[#222B36] bg-[#07090D] px-2.5 py-1.5 rounded-sm hover:text-[#5db5d9] hover:border-[#5db5d9]/30 transition-all cursor-pointer">РАЗБОР_ДЕЙСТВИЯ</button>
                   <button className="text-[0.55rem] font-bold font-mono tracking-[0.2em] text-[#5b6371] border border-[#222B36] bg-[#07090D] px-2.5 py-1.5 rounded-sm hover:text-[#5db5d9] hover:border-[#5db5d9]/30 transition-all cursor-pointer">КОПИРОВАТЬ</button>
                 </div>
                 <div className="flex gap-2 items-center">
                    <img src={emojiFire} className="w-5 h-5 hover:scale-125 transition-transform cursor-pointer drop-shadow-[0_0_8px_rgba(163,128,235,0.4)] filter-none" alt="Fire" />
                    <img src={stickerVerified} className="w-6 h-6 hover:scale-125 transition-transform cursor-pointer drop-shadow-[0_0_8px_rgba(50,178,112,0.4)] filter-none" alt="Verified" />
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
                {/* Audio/Media Card */}
                <div className="p-4 bg-[#0B0F14]/60 backdrop-blur-md border border-[#18202A] rounded-lg min-w-[320px] max-w-[480px] hover:border-[#5db5d9]/30 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] group/media cursor-pointer relative overflow-hidden mt-1 hover:scale-[1.01] duration-300 transform origin-left">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#5db5d9]/5 blur-[30px] rounded-full pointer-events-none group-hover/media:bg-[#5db5d9]/10 transition-colors" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <button className="w-12 h-12 rounded-lg bg-[#030406] border border-[#5db5d9]/30 text-[#5db5d9] flex justify-center items-center shrink-0 group-hover/media:bg-[#5db5d9]/10 group-hover/media:border-[#5db5d9]/50 transition-all relative">
                      <div className="absolute inset-[3px] border border-[#5db5d9] rounded-md animate-[ping_2s_ease-out_infinite] opacity-10 group-hover/media:opacity-30" />
                      <span className="ml-[2px] text-xs">▶</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.7rem] font-bold tracking-[0.1em] text-[#f1f3f5] truncate font-mono mb-2 border-b border-[#18202A]/50 pb-1 w-fit pr-4 group-hover/media:border-[#5db5d9]/30 transition-colors">
                        Bury_The_Light_Showdown.wav
                      </div>
                      <div className="flex items-center gap-4">
                         {/* Abstract waveform */}
                         <div className="flex-1 flex items-end gap-[2px] h-5 opacity-60 group-hover/media:opacity-100 transition-opacity overflow-hidden">
                           {Array.from({length: 45}).map((_, i) => (
                             <motion.div 
                               initial={{ height: "15%" }}
                               animate={{ height: `${Math.max(15, Math.sin(i*0.4)*40 + Math.random()*20 + 30)}%` }}
                               transition={{ duration: 0.5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: i * 0.05 }}
                               key={i} 
                               className="w-[2px] bg-gradient-to-t from-[#256c9a] to-[#5db5d9] rounded-t-[1px]" 
                             />
                           ))}
                         </div>
                         <div className="text-[0.55rem] text-[#5b6371] group-hover/media:text-[#88909c] transition-colors font-mono tracking-widest bg-[#030406] px-1.5 py-[2px] rounded border border-[#18202A] group-hover/media:border-[#222B36]">17.8 MB</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reactions */}
                <div className="flex gap-2 items-center opacity-0 group-hover/content:opacity-100 transition-all translate-y-1 group-hover/content:translate-y-0 mt-2 ml-1 duration-300">
                  <div className="bg-[#0B0F14]/80 border border-[#18202A] px-2 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm cursor-pointer hover:border-[#5db5d9]/50 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    <img src={emojiCool} className="w-4 h-4 filter-none" alt="Cool" />
                    <span className="text-[0.6rem] font-mono text-[#5db5d9] font-bold">1</span>
                  </div>
                  <div className="bg-[#0B0F14]/80 border border-[#18202A] px-2 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm cursor-pointer hover:border-[#a380eb]/50 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    <img src={emojiHeart} className="w-4 h-4 filter-none" alt="Heart" />
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
          <div className="max-w-5xl mx-auto flex flex-col bg-[#0B0F14]/90 backdrop-blur-xl border border-[#18202A] rounded-lg focus-within:border-[#5db5d9]/50 transition-all shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative group overflow-hidden pointer-events-auto hover:shadow-[0_15px_60px_rgba(0,0,0,0.9)]">
            
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#5db5d9]/30 to-transparent" />
            
            <div className="flex items-center px-4 py-2 gap-2 border-b border-[#18202A]/50 bg-[#07090D]/50">
               <span className="hidden sm:flex text-[0.55rem] font-mono tracking-[0.2em] text-[#5db5d9] border border-[#5db5d9]/30 px-2 py-[2px] rounded-sm bg-[#5db5d9]/10 items-center gap-1.5">
                 <Terminal size={10} /> 
                 ЗАЩИЩЁННЫЙ_КАНАЛ
               </span>
               <span className="text-[0.55rem] font-mono text-[#5b6371] uppercase tracking-[0.2em] ml-2 animate-pulse opacity-70">Ожидание сигнала...</span>
            </div>

            <div className="flex items-end p-2 gap-2">
               <button className="hidden sm:flex w-10 h-10 rounded-md shrink-0 items-center justify-center text-[#5b6371] hover:text-[#5db5d9] hover:bg-[#11161D] border border-transparent hover:border-[#18202A] transition-all cursor-pointer m-1 hover:rotate-90 duration-300"><Plus size={18} /></button>
               <textarea 
                 rows={1}
                 placeholder="ВВОД СООБЩЕНИЯ..." 
                 className="flex-1 bg-transparent border-0 outline-none text-[#f1f3f5] text-[0.95rem] py-3 placeholder:text-[#323640] placeholder:font-mono placeholder:tracking-widest placeholder:text-xs font-sans resize-none px-2 sm:px-0"
               />
               <button className="h-[38px] px-4 md:px-6 rounded-md bg-[#11161D] text-[#88909c] border border-[#222B36] hover:border-[#5db5d9]/50 hover:bg-[#5db5d9]/10 hover:text-[#5db5d9] flex justify-center items-center gap-2 font-mono text-[0.65rem] font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] m-1 cursor-pointer shrink-0">
                  <span className="hidden sm:inline">ПЕРЕДАТЬ</span> <Sparkles size={12} className="opacity-70" />
               </button>
            </div>
            
            <div className="flex items-center justify-between px-4 py-[6px] bg-[#030406] border-t border-[#18202A]/50 text-[0.55rem] font-mono text-[#5b6371] uppercase tracking-[0.15em]">
               <div className="flex items-center gap-3 sm:gap-5 opacity-70 overflow-hidden whitespace-nowrap">
                  <span className="hidden sm:inline">ENTER ОТПРАВИТЬ</span>
                  <span className="hidden md:inline">SHIFT+ENTER ПЕРЕНОС</span>
                  <span className="hidden lg:inline">/CMD ДЕЙСТВИЕ</span>
                  
                  <div className="w-px h-3 bg-[#222B36] mx-2 hidden sm:block" />
                  
                  {/* Quick Sticker/Emoji Board */}
                  <div className="flex items-center gap-2.5">
                     <img src={emojiFire} className="w-[18px] h-[18px] opacity-80 hover:opacity-100 hover:scale-110 cursor-pointer transition-all drop-shadow-[0_0_4px_rgba(163,128,235,0.3)] filter-none" alt="Add Fire" title="Reaction: Fire" />
                     <img src={emojiCool} className="w-[18px] h-[18px] opacity-80 hover:opacity-100 hover:scale-110 cursor-pointer transition-all drop-shadow-[0_0_4px_rgba(93,181,217,0.3)] filter-none" alt="Add Cool" title="Reaction: Cool" />
                     <img src={stickerAlert} className="w-[18px] h-[18px] opacity-80 hover:opacity-100 hover:scale-110 cursor-pointer transition-all drop-shadow-[0_0_4px_rgba(255,100,50,0.3)] filter-none" alt="Add Alert" title="Sticker: Alert" />
                  </div>
               </div>
               <div className="flex items-center gap-1.5 shrink-0"><span className="w-1.5 h-1.5 bg-[#a380eb] rounded-sm inline-block shadow-[0_0_5px_#a380eb]" /> ШИФРОВАНИЕ</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 4.2 Members Post (Right Rail) */}
      <aside style={{ gridArea: 'members' }} className={`bg-[#0B0F14]/95 border-l border-[#18202A] flex flex-col z-20 ec-glass-panel relative backdrop-blur-md transition-transform duration-300 lg:translate-x-0 ${mobileMembersOpen ? 'translate-x-0' : 'translate-x-full'} absolute right-0 lg:relative h-full w-[250px]`}>
         <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.02]" style={{
           backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
           backgroundSize: '24px 24px'
         }} />
         <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#5db5d9]/20 via-transparent to-transparent pointer-events-none" />
        
        <header className="flex items-center justify-between p-5 border-b border-[#18202A] bg-[#030406]/50 relative z-10">
          <div className="flex items-center gap-2.5 text-[0.65rem] font-bold tracking-[0.2em] uppercase text-[#88909c]">
            <MapIcon size={14} className="text-[#a380eb]" /> ТАКТИЧЕСКИЙ ВИД
          </div>
          <div className="text-[0.6rem] text-[#a380eb] font-mono font-bold bg-[#a380eb]/10 px-1.5 py-0.5 rounded-sm border border-[#a380eb]/30">1/10</div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 relative z-10 protocol-scrollbar">
          
          <div className="flex justify-between items-center mb-4">
             <div className="text-[0.55rem] font-mono font-bold tracking-[0.2em] text-[#32b270] uppercase flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-sm bg-[#32b270] animate-pulse shadow-[0_0_8px_#32b270]" /> 
               СВЯЗАННЫЕ_УЗЛЫ
             </div>
             <div className="h-px flex-1 bg-gradient-to-r from-[#32b270]/20 to-transparent ml-3" />
          </div>
          
          <div className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-[#11161D] border border-transparent hover:border-[#18202A] cursor-pointer transition-all group">
            <div className="relative">
              <div className="w-9 h-9 rounded-md border border-[#5db5d9]/40 bg-[#030406] flex justify-center items-center text-[#5db5d9] text-[0.85rem] font-bold leading-none shadow-[inset_0_0_10px_rgba(93,181,217,0.1),0_0_15px_rgba(93,181,217,0.1)] relative z-10 font-sans overflow-hidden">
                <img src={avatarPavel} alt="Pavel" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-[#5db5d9] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-[#5db5d9] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
             <span className="text-[0.85rem] text-[#f1f3f5] font-bold tracking-wide">Павел</span>
             <span className="ml-auto text-[0.45rem] font-mono font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm border border-[#5db5d9]/40 bg-[#5db5d9]/10 text-[#5db5d9]">OPR</span>
          </div>

          <div className="flex justify-between items-center mb-4 mt-8">
             <div className="text-[0.55rem] font-mono font-bold tracking-[0.2em] text-[#323640] uppercase flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-sm bg-[#323640]" /> 
               СПЯЩИЙ_РЕЖИМ
             </div>
             <div className="h-px flex-1 bg-[#18202A] ml-3" />
          </div>
          
          {['Повелитель', 'BigYtka', 'Reptail'].map((name, i) => (
             <div key={i} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-[#11161D] cursor-pointer transition-all group opacity-50 hover:opacity-100 border border-transparent hover:border-[#18202A]">
               <div className="w-9 h-9 rounded-md border border-[#18202A] bg-[#030406] flex justify-center items-center text-[#88909c] text-[0.85rem] font-bold leading-none font-sans">
                 {name[0]}
               </div>
               <span className="text-[0.85rem] text-[#88909c] group-hover:text-[#c1c8d4] font-medium tracking-wide">{name}</span>
               <span className="ml-auto text-[0.45rem] font-mono font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm border border-[#18202A] bg-[#07090D] text-[#5b6371]">MEM</span>
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