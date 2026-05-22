import React, { useState, useEffect } from 'react';
import { ArrowRight, Fingerprint, ShieldAlert, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import eclipseLogo from './assets/images/eclipse_logo_1779198030363.png';

export default function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'scan' | 'credentials' | '2fa' | 'success'>('scan');
  const [pin, setPin] = useState('');

  const handleStart = () => setStep('credentials');

  const handlePinClick = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 6) {
        setTimeout(() => {
          setStep('success');
          setTimeout(onLogin, 1500);
        }, 500);
      }
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('2fa');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#000000] text-[#f1f3f5] overflow-hidden selection:bg-[#5db5d9]/30">
      {/* Background World */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0B0F14_0%,_#000000_100%)]" />
        {/* Radar grid */}
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 100, repeat: Infinity, ease: "linear" }} className="absolute w-[200vw] h-[200vw] rounded-full border border-[#5db5d9]/10 shadow-[inset_0_0_100px_#5db5d910]" />
        <div className="absolute w-[150vw] h-[150vw] rounded-full border border-[#5db5d9]/10" />
        <div className="absolute w-[100vw] h-[100vw] rounded-full border border-[#5db5d9]/10" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(93,181,217,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(93,181,217,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        {/* Crosshairs */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#5db5d9]/20" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#5db5d9]/20" />
      </div>

      {/* Decorative HUD corners */}
      <div className="fixed top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#5db5d9]/50" />
      <div className="fixed top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#5db5d9]/50" />
      <div className="fixed bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#5db5d9]/50" />
      <div className="fixed bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#5db5d9]/50" />

      {/* Header HUD */}
      <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10 w-full px-8">
        <div className="flex justify-between w-full max-w-4xl font-mono text-[0.6rem] text-[#5db5d9] uppercase tracking-widest opacity-80">
          <span>СИСТЕМА ECLIPSE</span>
          <span>АВТОРИЗАЦИЯ ЗАЩИЩЕНА</span>
        </div>
        <div className="w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#5db5d9]/50 to-transparent mt-2 relative">
           <div className="absolute top-0 left-1/4 w-12 h-px bg-[#f1f3f5] animate-[ping_4s_ease-in-out_infinite]" />
        </div>
      </motion.div>

      {/* Main Terminal Box */}
      <div className="relative z-10 w-full max-w-[420px]">
        
        {/* Cinematic Glitch/Scan intro for brand */}
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }} className="flex flex-col items-center mb-8 relative">
          <div className="w-20 h-20 relative mb-6 ec-avatar-glow flex items-center justify-center rounded-lg border border-[#5db5d9]/30 bg-[#000] overflow-hidden">
            <div className="absolute inset-0 bg-[#5db5d9]/20 animate-pulse" />
            <img src={eclipseLogo} alt="Логотип ОС Eclipse" className="w-full h-full object-cover mix-blend-screen relative z-10 p-1" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-3xl font-black tracking-[0.2em] uppercase bg-gradient-to-r from-[#f1f3f5] via-[#5db5d9] to-[#f1f3f5] bg-clip-text text-transparent">ECLIPSE</h1>
          <p className="text-[0.6rem] text-[#a380eb] font-mono mt-2 tracking-[0.3em]">ПРОТОКОЛ_ШЛЮЗА_V1.0</p>
        </motion.div>

        {/* Panel Container (Clip Path cut corners) */}
        <motion.div 
          layout
          className="bg-[#07090D]/80 backdrop-blur-md relative transform transition-all duration-700"
          style={{
            clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)"
          }}
        >
          {/* Borders mimicking frame */}
          <div className="absolute inset-0 border border-[#5db5d9]/30 pointer-events-none" style={{ clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)" }} />
          <div className="absolute top-0 left-0 w-20 h-1 bg-[#5db5d9] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-20 h-1 bg-[#a380eb] pointer-events-none" />

          <div className="p-8 min-h-[300px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {step === 'scan' && (
                 <motion.div key="scan" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center justify-center py-8">
                   <motion.div 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-28 h-28 border border-[#5db5d9]/20 rounded-full flex items-center justify-center mb-8 relative group cursor-pointer shadow-[0_0_30px_rgba(93,181,217,0.1)]" 
                      onClick={handleStart}
                   >
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#5db5d9] border-r-[#a380eb]/50 animate-spin" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-2 rounded-full border border-[#18202A] border-b-[#5db5d9]/50 animate-[spin_4s_linear_infinite_reverse]" />
                      <Fingerprint className="w-12 h-12 text-[#323640] group-hover:text-[#f1f3f5] transition-colors relative z-10 drop-shadow-[0_0_8px_rgba(93,181,217,0.8)]" />
                      <div className="absolute inset-0 rounded-full bg-[#5db5d9]/5 group-hover:bg-[#5db5d9]/10 transition-colors" />
                   </motion.div>
                   <div className="text-[#88909c] font-mono text-xs tracking-[0.3em] text-center uppercase animate-pulse">РАСПОЗНАВАНИЕ БИОМЕТРИИ</div>
                 </motion.div>
              )}

              {step === 'credentials' && (
                <motion.form key="credentials" onSubmit={handleLoginSubmit} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-[#18202A] pb-4">
                    <div className="w-6 h-6 bg-amber-500/10 flex items-center justify-center rounded">
                       <Lock size={12} className="text-amber-500" />
                    </div>
                    <span className="text-[#88909c] text-xs font-mono tracking-widest">АУТЕНТИФИКАЦИЯ</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="group">
                      <label className="flex items-center gap-2 text-[0.6rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase mb-2">
                         <span className="w-1.5 h-1.5 bg-[#5db5d9] block rounded-sm opacity-50 group-hover:opacity-100" />
                         Личность оператора
                      </label>
                      <input 
                        type="text" 
                        defaultValue="Павел"
                        className="w-full bg-[#030406] border border-[#18202A] px-4 py-3.5 text-[#f1f3f5] placeholder:text-[#323640] focus:outline-none focus:border-[#5db5d9] focus:bg-[#07090D] transition-all font-mono text-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                      />
                    </div>
                    <div className="group">
                      <label className="flex items-center gap-2 text-[0.6rem] font-bold tracking-[0.2em] text-[#5b6371] uppercase mb-2">
                         <span className="w-1.5 h-1.5 bg-[#a380eb] block rounded-sm opacity-50 group-hover:opacity-100" />
                         Секретный код
                      </label>
                      <input 
                        type="password" 
                        defaultValue="••••••••"
                        className="w-full bg-[#030406] border border-[#18202A] px-4 py-3.5 text-[#5db5d9] placeholder:text-[#323640] focus:outline-none focus:border-[#a380eb] focus:bg-[#07090D] transition-all font-mono tracking-[0.3em] shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                      />
                    </div>
                  </div>
                  
                  <button type="submit" className="w-full mt-8 relative group overflow-hidden rounded border border-[#18202A] bg-[#000] hover:border-[#5db5d9] transition-all duration-300 shadow-[inset_0_0_20px_rgba(0,0,0,1)] hover:shadow-[0_0_30px_rgba(93,181,217,0.4)]">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden">
                       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#5db5d9]/60 via-[#0B0F14] to-[#000]" />
                       <div className="absolute w-[200%] h-[100%] top-0 left-[-50%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[translate-x-[200%]_1.5s_ease-in-out_infinite]" />
                    </div>
                    <div className="relative py-4 flex justify-center items-center gap-3 text-xs font-mono tracking-[0.2em] text-[#5db5d9] group-hover:text-[#fff] font-bold uppercase transition-all z-10 group-hover:tracking-[0.3em] duration-500">
                      АВТОРИЗАЦИЯ <ArrowRight size={16} className="group-hover:translate-x-3 group-hover:scale-125 transition-all duration-500 filter group-hover:drop-shadow-[0_0_8px_#fff]" />
                    </div>
                  </button>
                </motion.form>
              )}

              {step === '2fa' && (
                <motion.div key="2fa" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full">
                  <div className="flex flex-col items-center mb-6">
                    <ShieldAlert size={28} className="text-[#a380eb] mb-4 animate-[pulse_2s_ease-in-out_infinite]" />
                    <div className="text-[#f1f3f5] text-xs font-mono tracking-[0.2em] uppercase text-center">ПРОВЕРКА 2FA</div>
                  </div>

                  <div className="flex justify-center gap-3 mb-8 perspective-[800px]">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: pin.length === i ? -4 : 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                        key={i} 
                        className={`w-12 h-16 bg-[#030406]/50 backdrop-blur-sm border flex items-center justify-center text-2xl font-mono transition-all duration-300 rounded-md ${
                          pin.length > i 
                            ? 'border-[#5db5d9] text-[#f1f3f5] shadow-[0_0_15px_rgba(93,181,217,0.4)]' 
                            : 'border-[#18202A] text-[#323640] shadow-inner-[0_0_10px_rgba(0,0,0,0.5)]'
                        }`}
                      >
                        {pin[i] ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-[#5db5d9]" /> : ''}
                        {pin.length === i && <span className="w-6 h-[2px] bg-[#5db5d9] absolute bottom-3 shadow-[0_0_8px_#5db5d9] animate-pulse" />}
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, i) => (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        key={num}
                        onClick={() => handlePinClick(num.toString())}
                        whileHover={{ scale: 1.05, backgroundColor: 'rgba(93,181,217,0.1)' }}
                        whileTap={{ scale: 0.95 }}
                        className="h-14 bg-[#0B0F14]/80 backdrop-blur-md rounded-md border border-[#18202A] text-[#88909c] hover:text-[#5db5d9] hover:border-[#5db5d9]/50 font-mono text-xl transition-all flex items-center justify-center relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-[#5db5d9]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        {num}
                      </motion.button>
                    ))}
                    <motion.button
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                      onClick={() => setStep('credentials')}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      className="h-14 bg-[#000000]/80 rounded-md border border-transparent text-[#5b6371] hover:text-[#f1f3f5] font-mono text-xs transition-all flex justify-center items-center uppercase tracking-widest"
                    >
                      ОТМЕНА
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.65 }}
                      onClick={() => handlePinClick('0')}
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(93,181,217,0.1)' }} whileTap={{ scale: 0.95 }}
                      className="h-14 bg-[#0B0F14]/80 backdrop-blur-md rounded-md border border-[#18202A] text-[#88909c] hover:text-[#5db5d9] hover:border-[#5db5d9]/50 font-mono text-xl transition-all flex items-center justify-center relative overflow-hidden group"
                    >
                      0
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}
                      onClick={() => setPin(prev => prev.slice(0, -1))}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      className="h-14 bg-[#000000]/80 rounded-md border border-transparent text-[#5b6371] hover:text-[#f1f3f5] font-mono text-sm transition-all flex justify-center items-center"
                    >
                      ⌫
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 w-full">
                   <div className="w-16 h-16 bg-[#32b270]/20 rounded-full flex items-center justify-center mb-6 relative">
                      <div className="absolute inset-0 rounded-full border-2 border-[#32b270] animate-[ping_1.5s_ease-out_infinite]" />
                      <Unlock className="text-[#32b270] w-8 h-8 relative z-10" />
                   </div>
                   <div className="text-[#32b270] font-mono text-sm tracking-[0.2em] font-bold uppercase drop-shadow-[0_0_8px_rgba(50,178,112,0.8)] text-center w-full">
                      ДОСТУП РАЗРЕШЁН
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer HUD */}
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-8 flex justify-between items-center text-[0.55rem] font-mono text-[#5b6371] uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            ЗАЩИЩЕННАЯ СВЯЗЬ АКТИВНА
          </div>
          <div>ВЕРСИЯ 1.0.0.99</div>
        </motion.div>
      </div>
    </div>
  );
}

