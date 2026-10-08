'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';

interface SoundContextType {
  enabled: boolean;
  toggleSound: () => void;
  playClick: () => void;
  playSuccess: () => void;
  playToggle: () => void;
  playWarn: () => void;
}

const SoundContext = createContext<SoundContextType>({
  enabled: true,
  toggleSound: () => {},
  playClick: () => {},
  playSuccess: () => {},
  playToggle: () => {},
  playWarn: () => {},
});

const STORAGE_KEY = 'xvip_sound_enabled';

// Web Audio API Synthesizer for tactile mechanical feedback
class TactileSoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /** Âm thanh công tắc cơ học (mechanical switch click) dứt khoát, nẩy và chân thực */
  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // 1. Transient click noise qua bộ lọc dải thông bandpass (tạo tiếng cạch kim loại)
    const bufferSize = ctx.sampleRate * 0.015; // 15ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.Q.setValueAtTime(3.0, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);

    // 2. Low-frequency "thud" (tiếng tiếp xúc đế phím)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.025);

    oscGain.gain.setValueAtTime(0.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.025);
  }

  /** Âm thanh thành công (chuông đôi tinh tế khi lưu đơn / lưu dữ liệu) */
  playSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const notes = [659.25, 880]; // E5 -> A5
    notes.forEach((freq, idx) => {
      const start = t + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  /** Âm thanh gạt công tắc bật/tắt (toggle) */
  playToggle() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.035);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  /** Âm thanh cảnh báo / xóa */
  playWarn() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  }
}

const engine = new TactileSoundEngine();

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved !== null ? saved === 'true' : true;
    setEnabled(initial);
    enabledRef.current = initial;
  }, []);

  const toggleSound = () => {
    setEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (next) {
        engine.playToggle();
      }
      return next;
    });
  };

  const playClick = () => {
    if (enabledRef.current) engine.playClick();
  };

  const playSuccess = () => {
    if (enabledRef.current) engine.playSuccess();
  };

  const playToggle = () => {
    if (enabledRef.current) engine.playToggle();
  };

  const playWarn = () => {
    if (enabledRef.current) engine.playWarn();
  };

  // Tự động lắng nghe sự kiện pointerdown trên mọi nút bấm để phát tiếng click cơ học 3D
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(
        'button, [role="button"], a.btn-3d, .btn-3d, .btn-3d-mini, .btn-3d-white, .btn-3d-blue, .btn-3d-green, .btn-3d-red, input[type="submit"], input[type="checkbox"], select'
      );

      if (interactive && !interactive.hasAttribute('data-no-sound')) {
        engine.playClick();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <SoundContext.Provider value={{ enabled, toggleSound, playClick, playSuccess, playToggle, playWarn }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}

/** Nút bật/tắt âm thanh 3D sang trọng đặt ở Header */
export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggleSound } = useSound();

  return (
    <button
      type="button"
      onClick={toggleSound}
      title={enabled ? 'Bấm để tắt âm thanh phím bấm (3D Audio)' : 'Bấm để bật âm thanh phím bấm cơ học (3D Audio)'}
      aria-label={enabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
      className={`group relative flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all active:translate-y-0.5 select-none ${
        enabled
          ? 'border-emerald-300 bg-gradient-to-b from-white to-emerald-50 text-emerald-800 shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_3px_0_#6ee7b7,0_6px_12px_rgba(16,185,129,0.15)] dark:border-emerald-700 dark:from-emerald-950/80 dark:to-emerald-900/60 dark:text-emerald-300 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_3px_0_#064e3b]'
          : 'border-slate-300 bg-gradient-to-b from-white to-slate-100 text-slate-500 shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_3px_0_#cbd5e1,0_6px_12px_rgba(0,0,0,0.05)] dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_3px_0_#1e293b]'
      } ${className ?? ''}`}
    >
      {enabled ? (
        <>
          <SpeakerHigh size={16} weight="fill" className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <span>Âm bấm: Bật</span>
        </>
      ) : (
        <>
          <SpeakerSlash size={16} weight="bold" className="text-slate-400" />
          <span>Âm bấm: Tắt</span>
        </>
      )}
    </button>
  );
}
