import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  Languages,
  Share2,
  Sparkles,
  Type,
  Check,
  QrCode,
  Sun,
  Moon,
  Columns2,
  Rows2,
} from 'lucide-react';
import type {
  SubtitleItem,
  WeddingContextData,
  SubtitleLayoutMode,
  SubtitleFontStyle,
} from '../types';

interface MobileViewProps {
  subtitles: SubtitleItem[];
  activePartial: SubtitleItem | null;
  wedding: WeddingContextData;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode?: () => void;
}

const PREFS_KEY = 'stones_wedding_guest_prefs';

function loadGuestPrefs(): { layoutMode: SubtitleLayoutMode; fontStyle: SubtitleFontStyle; fontSize: 'normal' | 'large' } {
  const fallback = { layoutMode: 'stacked' as const, fontStyle: 'serif' as const, fontSize: 'normal' as const };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      layoutMode: ['stacked', 'side-by-side', 'english'].includes(saved.layoutMode) ? saved.layoutMode : fallback.layoutMode,
      fontStyle: ['serif', 'sans'].includes(saved.fontStyle) ? saved.fontStyle : fallback.fontStyle,
      fontSize: ['normal', 'large'].includes(saved.fontSize) ? saved.fontSize : fallback.fontSize,
    };
  } catch {
    return fallback;
  }
}

export const MobileView: React.FC<MobileViewProps> = ({
  subtitles,
  activePartial,
  wedding,
  isDarkTheme = true,
  onToggleTheme,
  onOpenQrCode,
}) => {
  const [layoutMode, setLayoutModeState] = useState<SubtitleLayoutMode>(() => loadGuestPrefs().layoutMode);
  const [fontStyle, setFontStyleState] = useState<SubtitleFontStyle>(() => loadGuestPrefs().fontStyle);
  const [fontSize, setFontSizeState] = useState<'normal' | 'large'>(() => loadGuestPrefs().fontSize);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  // Remember the guest's reading preferences across reloads (e.g. reopening the
  // page later in the reception) without touching the shared theme storage key.
  const setLayoutMode = (mode: SubtitleLayoutMode) => {
    setLayoutModeState(mode);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layoutMode: mode, fontStyle, fontSize }));
    } catch {
      // Private browsing or storage disabled — preference just won't persist.
    }
  };
  const setFontStyle = (style: SubtitleFontStyle) => {
    setFontStyleState(style);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layoutMode, fontStyle: style, fontSize }));
    } catch {
      // Private browsing or storage disabled — preference just won't persist.
    }
  };
  const setFontSize = (size: 'normal' | 'large') => {
    setFontSizeState(size);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layoutMode, fontStyle, fontSize: size }));
    } catch {
      // Private browsing or storage disabled — preference just won't persist.
    }
  };

  // Keep the guest's screen awake while this view is open — ceremonies and
  // speeches run long, and a locked screen would stop subtitles being read.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        // The browser also releases the lock on its own (e.g. tab backgrounded);
        // clear our reference so handleVisibility knows to re-acquire it.
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Denied or unsupported in this context (e.g. low battery) — subtitles still work.
      }
    };

    requestLock();

    // The OS releases the lock whenever the tab is backgrounded, so re-acquire
    // it when the guest switches back.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) requestLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      sentinel?.release().catch(() => {});
    };
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);

  const isNearBottom = () => {
    const el = bottomRef.current;
    return !!el && el.getBoundingClientRect().bottom - window.innerHeight < 64;
  };

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [subtitles, activePartial, autoScroll]);

  // Stop following the live feed once the guest scrolls up to reread, and resume
  // when they come back to the bottom. Pausing is driven by user gestures (not
  // scroll events) so our own smooth-scroll animation can't trip it.
  useEffect(() => {
    const isVisible = () => !!bottomRef.current?.offsetParent;
    const pauseIfAway = () => {
      if (!isVisible()) return;
      requestAnimationFrame(() => {
        if (!isNearBottom()) setAutoScroll(false);
      });
    };
    const resumeIfAtBottom = () => {
      if (isVisible() && isNearBottom()) setAutoScroll(true);
    };
    window.addEventListener('wheel', pauseIfAway, { passive: true });
    window.addEventListener('touchmove', pauseIfAway, { passive: true });
    window.addEventListener('scroll', resumeIfAtBottom, { passive: true });
    return () => {
      window.removeEventListener('wheel', pauseIfAway);
      window.removeEventListener('touchmove', pauseIfAway);
      window.removeEventListener('scroll', resumeIfAtBottom);
    };
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${wedding.bride_name} & ${wedding.groom_name}’s Wedding Subtitles`,
          text: `Live English speech translation for ${wedding.bride_name} & ${wedding.groom_name}’s wedding at Stones of the Yarra Valley`,
          url,
        });
      } catch {
        // User dismissed
      }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const fontClass = fontStyle === 'serif' ? 'font-serif' : 'font-sans';
  const zhSize = fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg';
  const enSize = fontSize === 'large' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl';

  // 40px+ touch targets; :active (not :hover) so taps don't leave sticky hover states
  const ctrlBase =
    'h-10 min-w-10 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg border text-[11px] font-sans uppercase tracking-wider font-semibold transition-colors active:scale-95';
  const ctrlIdle = isDarkTheme
    ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)] text-stone-300 active:text-[#DFCA9B]'
    : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-700 active:text-stone-900';
  const ctrlActive = isDarkTheme
    ? 'bg-[#C2A265] text-[#141311] border-[#C2A265]'
    : 'bg-[#1C1A17] text-[#FAF8F5] border-[#1C1A17]';
  const segBtn = (active: boolean) =>
    `h-10 min-w-10 px-2.5 rounded-md items-center justify-center gap-1.5 text-[11px] font-sans uppercase tracking-wider font-semibold transition-colors ${
      active ? ctrlActive : isDarkTheme ? 'text-stone-400' : 'text-stone-500'
    }`;

  return (
    <div className="max-w-2xl mx-auto min-h-[calc(100dvh-4rem)] flex flex-col justify-between p-4 sm:p-6 pb-20">
      {/* Wedding Program Header Banner */}
      <div
        className={`text-center py-4 sm:py-6 border-b mb-4 transition-colors ${
          isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
        }`}
      >
        <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-[#C2A265] mb-1 font-medium">
          Stones of the Yarra Valley • The Stable
        </p>
        <h2
          className={`font-serif text-2xl sm:text-3xl font-normal tracking-wide transition-colors ${
            isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
          }`}
        >
          {wedding.bride_name} &amp; {wedding.groom_name}
        </h2>
        <p
          className={`font-serif italic text-xs mt-1 transition-colors ${
            isDarkTheme ? 'text-stone-400' : 'text-stone-500'
          }`}
        >
          Live Simultaneous Ceremony &amp; Reception Interpretation
        </p>

        {/* Invite other guests */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={handleShare} className={`${ctrlBase} ${ctrlIdle}`}>
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Link copied' : 'Share link'}</span>
          </button>
          {onOpenQrCode && (
            <button onClick={onOpenQrCode} className={`${ctrlBase} ${ctrlIdle}`}>
              <QrCode className="w-4 h-4" />
              <span>QR code</span>
            </button>
          )}
        </div>
      </div>

      {/* Sticky reading controls (top-16 = header height) */}
      <div
        className={`sticky top-16 z-20 backdrop-blur-md p-1.5 rounded-xl border shadow-sm mb-5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 transition-colors ${
          isDarkTheme
            ? 'bg-[#1B1A18]/92 border-[rgba(194,162,101,0.25)] text-stone-200'
            : 'bg-[#FAF8F5]/95 border-[#DFD7CB] text-stone-800'
        }`}
      >
        <div className="flex items-center gap-2 pl-1.5">
          <div className="w-2 h-2 rounded-full bg-[#C2A265] animate-ping" />
          <span
            className={`text-[11px] font-sans uppercase tracking-widest font-semibold ${
              isDarkTheme ? 'text-[#DFCA9B]' : 'text-stone-800'
            }`}
          >
            Live
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Layout: Stacked / Split (sm+ only; identical to Stacked on phones) / English only */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              isDarkTheme ? 'bg-[#141312]/80 border-[rgba(194,162,101,0.2)]' : 'bg-stone-200/60 border-stone-300'
            }`}
            role="group"
            aria-label="Subtitle layout"
          >
            <button
              onClick={() => setLayoutMode('stacked')}
              className={`inline-flex ${segBtn(layoutMode === 'stacked')}`}
              aria-label="Chinese and English"
              title="Chinese and English"
            >
              <Rows2 className="w-4 h-4" />
              <span className="hidden sm:inline">Stacked</span>
            </button>
            <button
              onClick={() => setLayoutMode('side-by-side')}
              className={`hidden sm:inline-flex ${segBtn(layoutMode === 'side-by-side')}`}
              aria-label="Side by side"
              title="Side by side"
            >
              <Columns2 className="w-4 h-4" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setLayoutMode('english')}
              className={`inline-flex ${segBtn(layoutMode === 'english')}`}
              aria-label="English only"
              title="English only"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">EN</span>
            </button>
          </div>

          <button
            onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
            className={`${ctrlBase} ${ctrlIdle}`}
            aria-label={fontStyle === 'serif' ? 'Switch to sans-serif font' : 'Switch to serif font'}
          >
            {fontStyle === 'serif' ? 'Serif' : 'Sans'}
          </button>

          <button
            onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
            className={`${ctrlBase} ${fontSize === 'large' ? ctrlActive : ctrlIdle}`}
            aria-label="Toggle larger text"
            aria-pressed={fontSize === 'large'}
          >
            <Type className="w-4 h-4" />
          </button>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`${ctrlBase} ${ctrlIdle}`}
              aria-label={isDarkTheme ? 'Switch to daylight theme' : 'Switch to candlelight theme'}
            >
              {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Subtitle Feed */}
      <div className="flex-1 space-y-4">
        {subtitles.length === 0 && !activePartial ? (
          <div className="py-20 text-center space-y-4">
            <div
              className={`inline-flex p-3.5 rounded-full border transition-colors ${
                isDarkTheme
                  ? 'bg-[#1B1A18] border-[rgba(194,162,101,0.25)] text-[#DFCA9B]'
                  : 'bg-[#F5EFEB] border-[#DFD7CB] text-[#C2A265]'
              }`}
            >
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3
              className={`text-xl font-serif transition-colors ${
                isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
              }`}
            >
              Welcome to the Celebration
            </h3>
            <p
              className={`font-serif italic text-sm max-w-xs mx-auto leading-relaxed transition-colors ${
                isDarkTheme ? 'text-stone-400' : 'text-stone-500'
              }`}
            >
              Live English subtitles will stream to your screen automatically when speech begins.
            </p>
          </div>
        ) : (
          <>
            {subtitles.map((item) => (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-xl border shadow-xs transition-all ${
                  isDarkTheme
                    ? 'bg-[#1B1A18] border-[rgba(194,162,101,0.22)] hover:border-[#C2A265]/50'
                    : 'bg-[#FAF8F5] border-[#DFD7CB] hover:border-[#C2A265]/40'
                }`}
              >
                <div className="flex justify-between items-center text-[11px] text-stone-400 font-mono tracking-wider mb-2.5">
                  <span className="font-semibold text-stone-500">#{item.id}</span>
                  <span>{item.timestamp}</span>
                </div>

                {layoutMode === 'side-by-side' ? (
                  /* ================= SIDE-BY-SIDE SPLIT CARD ================= */
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
                    {/* Left: Chinese Transcript */}
                    <div className="sm:col-span-5 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase border ${
                            isDarkTheme
                              ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                              : 'bg-stone-200 border-stone-300 text-stone-700'
                          }`}
                        >
                          ZH
                        </span>
                        <span className="text-[11px] font-sans uppercase tracking-widest text-stone-400">
                          Mandarin
                        </span>
                      </div>
                      <p
                        className={`font-sans leading-relaxed transition-colors ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                        } ${zhSize}`}
                      >
                        {item.chinese || '—'}
                      </p>
                    </div>

                    {/* Right: English Translation */}
                    <div
                      className={`sm:col-span-7 space-y-1 sm:border-l sm:pl-4 transition-colors ${
                        isDarkTheme ? 'sm:border-[rgba(194,162,101,0.2)]' : 'sm:border-[#DFD7CB]'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                          EN
                        </span>
                        <span className="text-[11px] font-sans uppercase tracking-widest text-[#C2A265]">
                          English
                        </span>
                      </div>
                      <p
                        className={`${fontClass} font-medium leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.18)]'
                            : 'text-[#1C1A17]'
                        } ${enSize}`}
                      >
                        {item.english}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ================= STACKED / ENGLISH ONLY CARD ================= */
                  <div className="space-y-2">
                    {layoutMode !== 'english' && item.chinese && (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase border ${
                              isDarkTheme
                                ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                                : 'bg-stone-200 border-stone-300 text-stone-700'
                            }`}
                          >
                            ZH
                          </span>
                          <span className="text-[11px] font-sans uppercase tracking-widest text-stone-400">
                            Spoken Mandarin
                          </span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed transition-colors ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                          } ${zhSize}`}
                        >
                          {item.chinese}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      {layoutMode !== 'english' && (
                        <div className="flex items-center space-x-1.5 pt-1">
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                            EN
                          </span>
                          <span className="text-[11px] font-sans uppercase tracking-widest text-[#C2A265]">
                            English Interpretation
                          </span>
                        </div>
                      )}
                      <p
                        className={`${fontClass} font-medium leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.18)]'
                            : 'text-[#1C1A17]'
                        } ${enSize}`}
                      >
                        {item.english}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live Interpreting Bubble */}
            {activePartial && (
              <div
                className={`p-4 sm:p-5 rounded-xl border-2 shadow-lg transition-all animate-subtle-pulse ${
                  isDarkTheme
                    ? 'bg-[#22201D] border-[#C2A265] shadow-[#C2A265]/10'
                    : 'bg-[#FFFDF9] border-[#C2A265]'
                }`}
              >
                <div className="flex justify-between items-center text-[11px] text-[#C2A265] font-sans tracking-widest uppercase font-bold mb-2.5">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#C2A265] animate-ping" />
                    <span>Live Translation...</span>
                  </span>
                  <span className="font-mono text-stone-400 font-normal">{activePartial.timestamp}</span>
                </div>

                {layoutMode === 'side-by-side' ? (
                  /* Live Side-by-Side */
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
                    <div className="sm:col-span-5 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase border ${
                            isDarkTheme
                              ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                              : 'bg-stone-200 border-stone-300 text-stone-700'
                          }`}
                        >
                          ZH
                        </span>
                        <span className="text-[11px] font-sans uppercase tracking-widest text-stone-400">
                          Mandarin
                        </span>
                      </div>
                      <p
                        className={`font-sans leading-relaxed transition-colors ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                        } ${zhSize}`}
                      >
                        {activePartial.chinese || 'Listening...'}
                      </p>
                    </div>

                    <div
                      className={`sm:col-span-7 space-y-1 sm:border-l sm:pl-4 transition-colors ${
                        isDarkTheme ? 'sm:border-[rgba(194,162,101,0.2)]' : 'sm:border-[#DFD7CB]'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                          EN
                        </span>
                        <span className="text-[11px] font-sans uppercase tracking-widest text-[#C2A265]">
                          English
                        </span>
                      </div>
                      <p
                        className={`${fontClass} font-semibold leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.22)]'
                            : 'text-[#1C1A17]'
                        } ${enSize}`}
                      >
                        <span>{activePartial.english}</span>
                        <span className="inline-block w-1.5 h-4 ml-1.5 bg-[#C2A265] animate-pulse align-middle" />
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Live Stacked / English */
                  <div className="space-y-2">
                    {layoutMode !== 'english' && activePartial.chinese && (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase border ${
                              isDarkTheme
                                ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                                : 'bg-stone-200 border-stone-300 text-stone-700'
                            }`}
                          >
                            ZH
                          </span>
                          <span className="text-[11px] font-sans uppercase tracking-widest text-stone-400">
                            Spoken Mandarin
                          </span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed transition-colors ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                          } ${zhSize}`}
                        >
                          {activePartial.chinese}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      {layoutMode !== 'english' && (
                        <div className="flex items-center space-x-1.5 pt-1">
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                            EN
                          </span>
                          <span className="text-[11px] font-sans uppercase tracking-widest text-[#C2A265]">
                            English Interpretation
                          </span>
                        </div>
                      )}
                      <p
                        className={`${fontClass} font-semibold leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.22)]'
                            : 'text-[#1C1A17]'
                        } ${enSize}`}
                      >
                        <span>{activePartial.english}</span>
                        <span className="inline-block w-1.5 h-4 ml-1.5 bg-[#C2A265] animate-pulse align-middle" />
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} className="scroll-mb-6" />
      </div>

      {/* Program Footer */}
      <div
        className={`pt-8 pb-4 text-center border-t mt-8 space-y-1 transition-colors ${
          isDarkTheme ? 'border-[rgba(194,162,101,0.2)] text-stone-400' : 'border-[#DFD7CB] text-stone-500'
        }`}
      >
        <p className="font-serif italic text-xs">
          Stones of the Yarra Valley • The Stable
        </p>
        <p
          className={`font-sans text-[11px] uppercase tracking-widest ${
            isDarkTheme ? 'text-stone-500' : 'text-stone-400'
          }`}
        >
          Wishing Joy &amp; Xinrong a lifetime of happiness
        </p>
      </div>

      {/* Floating Auto-Scroll Toggle Button */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-30 h-12 px-5 rounded-full shadow-xl flex items-center gap-2 text-xs font-sans uppercase tracking-widest font-semibold transition-all active:scale-95 ${
            isDarkTheme
              ? 'bg-[#C2A265] text-[#141311]'
              : 'bg-[#1C1A17] text-[#FAF8F5]'
          }`}
        >
          <ArrowDown className="w-4 h-4" />
          <span>Latest</span>
        </button>
      )}
    </div>
  );
};

