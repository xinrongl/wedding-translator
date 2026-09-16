import React, { useState, useEffect, useRef } from 'react';
import {
  Languages,
  Sparkles,
  Volume2,
  Moon,
  Sun,
  QrCode,
  Columns2,
  Rows2,
  Type,
  ArrowDown,
  Maximize2,
  Minimize2,
  Play,
  Pause,
} from 'lucide-react';
import type {
  SubtitleItem,
  WeddingContextData,
  SubtitleLayoutMode,
  SubtitleFontStyle,
} from '../types';

interface ProjectorViewProps {
  subtitles: SubtitleItem[];
  activePartial: SubtitleItem | null;
  wedding: WeddingContextData;
  isSessionActive: boolean;
  audioLevel: number;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode?: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  subtitles,
  activePartial,
  wedding,
  isSessionActive,
  audioLevel,
  isDarkTheme = true,
  onToggleTheme,
  onOpenQrCode,
}) => {
  // Default to side-by-side as requested for high-information, parallel bilingual readability
  const [layoutMode, setLayoutMode] = useState<SubtitleLayoutMode>('side-by-side');
  const [fontStyle, setFontStyle] = useState<SubtitleFontStyle>('serif');
  const [fontSizeLevel, setFontSizeLevel] = useState<'md' | 'lg' | 'xl'>('lg');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll whenever new subtitles or active speech stream arrives
  useEffect(() => {
    if (autoScroll && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [subtitles, activePartial, autoScroll]);

  // Detect manual scroll by the user or AV technician
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fullscreen support via button or 'F' keyboard shortcut
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (e.key.toLowerCase() === 'f' && !['input', 'textarea'].includes(activeTag)) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const fontSizes = {
    md: {
      englishStacked: fontStyle === 'serif' ? 'text-xl md:text-2xl lg:text-3xl leading-[1.35]' : 'text-lg md:text-xl lg:text-2xl leading-[1.35] tracking-tight font-medium',
      chineseStacked: 'text-base md:text-lg lg:text-xl leading-relaxed',
      englishSplit: fontStyle === 'serif' ? 'text-lg md:text-xl lg:text-2xl leading-[1.35]' : 'text-base md:text-lg lg:text-xl leading-[1.35] tracking-tight font-medium',
      chineseSplit: 'text-sm md:text-base lg:text-lg leading-relaxed',
    },
    lg: {
      englishStacked: fontStyle === 'serif' ? 'text-2xl md:text-3xl lg:text-4xl leading-[1.3]' : 'text-xl md:text-2xl lg:text-3xl leading-[1.3] tracking-tight font-medium',
      chineseStacked: 'text-lg md:text-xl lg:text-2xl leading-relaxed',
      englishSplit: fontStyle === 'serif' ? 'text-xl md:text-2xl lg:text-3xl leading-[1.3]' : 'text-lg md:text-xl lg:text-2xl leading-[1.3] tracking-tight font-medium',
      chineseSplit: 'text-base md:text-lg lg:text-xl leading-relaxed',
    },
    xl: {
      englishStacked: fontStyle === 'serif' ? 'text-3xl md:text-4xl lg:text-5xl leading-[1.25]' : 'text-2xl md:text-3xl lg:text-4xl leading-[1.25] tracking-tight font-medium',
      chineseStacked: 'text-xl md:text-2xl lg:text-3xl leading-relaxed',
      englishSplit: fontStyle === 'serif' ? 'text-2xl md:text-3xl lg:text-4xl leading-[1.25]' : 'text-xl md:text-2xl lg:text-3xl leading-[1.25] tracking-tight font-medium',
      chineseSplit: 'text-lg md:text-xl lg:text-2xl leading-relaxed',
    },
  }[fontSizeLevel];

  const fontClass = fontStyle === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div
      className={`relative h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 select-none overflow-hidden transition-colors duration-700 ${
        isDarkTheme
          ? 'bg-[#141312] text-[#FAF8F5]'
          : 'bg-[#FAF8F5] text-[#1C1A17] bg-paper-texture'
      }`}
    >
      {/* Ambient glow effects tailored to Stones of the Yarra Valley */}
      {isDarkTheme ? (
        <>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[450px] bg-[#C2A265]/10 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-[550px] h-[380px] bg-[#A6685B]/8 blur-[130px] rounded-full pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#C2A265]/5 blur-[120px] rounded-full pointer-events-none" />
        </>
      )}

      {/* Top Banner: Venue Identification & Projection Quick Controls */}
      <div
        className={`relative z-20 flex flex-wrap items-center justify-between pb-3 md:pb-4 border-b gap-3 transition-colors ${
          isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isDarkTheme ? 'bg-[#C2A265] shadow-sm shadow-[#C2A265]' : 'bg-[#1C1A17]'
            }`}
          />
          <div>
            <h2 className="font-serif tracking-[0.2em] uppercase text-xs md:text-sm font-semibold">
              The Stable at Stones
            </h2>
            <p className="text-[11px] font-sans tracking-widest uppercase text-stone-500">
              {wedding.bride_name} &amp; {wedding.groom_name} • Yarra Valley
            </p>
          </div>
        </div>

        {/* Floating Quick Settings Deck */}
        <div
          className={`flex flex-wrap items-center space-x-1.5 md:space-x-2 backdrop-blur-md px-3 py-1.5 rounded-xl border text-xs transition-all ${
            isDarkTheme
              ? 'bg-[#1D1B18]/90 border-[rgba(194,162,101,0.25)] text-stone-200 shadow-lg'
              : 'bg-[#F4EFEA]/95 border-[#DFD7CB] text-stone-700 shadow-sm'
          }`}
        >
          {/* Audio VU Indicator */}
          {isSessionActive && (
            <div className="flex items-center space-x-2 mr-1 pr-2 border-r border-stone-500/30">
              <Volume2
                className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-[#C2A265]' : 'text-stone-800'}`}
              />
              <div className="w-12 md:w-16 h-1.5 bg-stone-700/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-[#C2A265] to-amber-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          )}

          {/* Layout Mode Segmented Control */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              isDarkTheme ? 'bg-[#141312]/80 border-[rgba(194,162,101,0.2)]' : 'bg-stone-200/60 border-stone-300'
            }`}
            title="Choose Subtitle Layout"
          >
            <button
              onClick={() => setLayoutMode('side-by-side')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-sans uppercase tracking-wider font-semibold transition-all ${
                layoutMode === 'side-by-side'
                  ? isDarkTheme
                    ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                    : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Side-by-Side Split View (Dual Language Columns)"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Side-by-Side</span>
            </button>
            <button
              onClick={() => setLayoutMode('stacked')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-sans uppercase tracking-wider font-semibold transition-all ${
                layoutMode === 'stacked'
                  ? isDarkTheme
                    ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                    : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Stacked Subtitles (Cinema Style)"
            >
              <Rows2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stacked</span>
            </button>
            <button
              onClick={() => setLayoutMode('english')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-sans uppercase tracking-wider font-semibold transition-all ${
                layoutMode === 'english'
                  ? isDarkTheme
                    ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                    : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="English Translation Only"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">EN Only</span>
            </button>
          </div>

          {/* Font Style Toggle: Serif vs Modern Sans */}
          <button
            onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-sans uppercase tracking-widest font-semibold border transition-all ${
              fontStyle === 'sans'
                ? isDarkTheme
                  ? 'bg-[#C2A265]/20 text-[#DFCA9B] border-[#C2A265]/40'
                  : 'bg-stone-200 border-stone-300 text-stone-900'
                : isDarkTheme
                ? 'border-transparent text-stone-400 hover:text-stone-200'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
            title={fontStyle === 'serif' ? 'Switch to Modern Sans-Serif Typography' : 'Switch to Romantic Editorial Serif Typography'}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{fontStyle === 'serif' ? 'Serif' : 'Modern Sans'}</span>
          </button>

          {/* Auto-scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-sans uppercase tracking-widest font-semibold border transition-all ${
              autoScroll
                ? isDarkTheme
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                : isDarkTheme
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                : 'bg-amber-100 border-amber-300 text-amber-800'
            }`}
            title={autoScroll ? 'Auto-scroll is Active (Click to Pause)' : 'Auto-scroll is Paused (Click to Resume)'}
          >
            {autoScroll ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
            <span className="hidden lg:inline">{autoScroll ? 'Auto-scroll' : 'Paused'}</span>
          </button>

          {/* Font Size Selector */}
          <div className="flex items-center space-x-1 pl-1">
            {(['md', 'lg', 'xl'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFontSizeLevel(lvl)}
                className={`w-6 h-6 rounded uppercase font-bold text-[10px] transition-all ${
                  fontSizeLevel === lvl
                    ? isDarkTheme
                      ? 'bg-[#C2A265] text-[#141311] font-bold shadow-sm'
                      : 'bg-[#1C1A17] text-[#FAF8F5] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-500/20'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Atmospheric Theme Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded text-[11px] transition-all ${
                isDarkTheme
                  ? 'hover:bg-[#2B2824] text-[#DFCA9B]'
                  : 'hover:bg-[#EAE3D9] text-stone-700'
              }`}
              title="Toggle Stable Candlelight / Daylight"
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded text-[11px] transition-all ${
              isDarkTheme
                ? 'hover:bg-[#2B2824] text-stone-300 hover:text-white'
                : 'hover:bg-[#EAE3D9] text-stone-700'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Shortcut: F)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Center Stage: Continuous Auto-Scrolling Translation Feed */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col my-3 md:my-5">
        {/* Soft top gradient mask so older sentences dissolve smoothly */}
        <div
          className={`pointer-events-none absolute top-0 left-0 right-0 h-10 z-10 transition-colors ${
            isDarkTheme
              ? 'bg-gradient-to-b from-[#141312] to-transparent'
              : 'bg-gradient-to-b from-[#FAF8F5] to-transparent'
          }`}
        />

        {subtitles.length === 0 && !activePartial ? (
          /* Empty / Waiting state with Wedding Welcome */
          <div className="h-full flex flex-col items-center justify-center text-center space-y-5 py-12 px-4">
            <div
              className={`inline-flex p-4 md:p-5 rounded-full border transition-all ${
                isDarkTheme
                  ? 'bg-[#1D1B18] border-[rgba(194,162,101,0.3)] text-[#C2A265] shadow-lg shadow-[#C2A265]/10'
                  : 'bg-[#F2ECE3] border-[#DFD7CB] text-[#1C1A17]'
              }`}
            >
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
            </div>
            <h3 className="text-3xl md:text-5xl lg:text-6xl font-serif tracking-wide font-normal">
              {wedding.bride_name} &amp; {wedding.groom_name}
            </h3>
            <p className="font-serif italic text-stone-400 text-base md:text-xl max-w-xl mx-auto leading-relaxed">
              Welcome to The Stable at Stones of the Yarra Valley. Continuous simultaneous English translation will begin once the speaker begins.
            </p>
            <div className="flex items-center space-x-2 text-xs font-sans tracking-widest uppercase text-[#C2A265]/80 pt-2">
              <span className="w-2 h-2 rounded-full bg-[#C2A265] animate-ping" />
              <span>Microphone &amp; Translation Engine Ready</span>
            </div>
          </div>
        ) : (
          /* Continuous Scrollable Subtitle Feed */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-1 sm:px-3 md:px-6 py-2 space-y-4 md:space-y-6 scrollbar-thin"
          >
            {/* Sticky Header for Side-by-Side Columns */}
            {layoutMode === 'side-by-side' && (
              <div
                className={`sticky top-0 z-20 grid grid-cols-1 md:grid-cols-12 gap-4 pb-2 pt-1 px-4 md:px-6 border-b text-[11px] font-sans uppercase tracking-widest font-semibold backdrop-blur-md transition-colors ${
                  isDarkTheme
                    ? 'bg-[#141312]/95 border-[rgba(194,162,101,0.25)] text-stone-400'
                    : 'bg-[#FAF8F5]/95 border-[#DFD7CB] text-stone-600'
                }`}
              >
                <div className="md:col-span-5 flex items-center space-x-2">
                  <span className="px-1.5 py-0.2 rounded bg-stone-700/50 text-stone-300 text-[10px]">ZH</span>
                  <span>Mandarin Speech (现场原声)</span>
                </div>
                <div className="md:col-span-7 flex items-center space-x-2 pl-0 md:pl-4 md:border-l border-[rgba(194,162,101,0.25)]">
                  <span className="px-1.5 py-0.2 rounded bg-[#C2A265]/20 text-[#DFCA9B] text-[10px]">EN</span>
                  <span className="text-[#C2A265]">Live English Translation (实时同传)</span>
                </div>
              </div>
            )}

            {/* Render Finalized History Sentences */}
            {subtitles.map((item) => (
              <div
                key={item.id}
                className={`transition-all duration-300 ${
                  layoutMode === 'side-by-side'
                    ? /* ================= SIDE-BY-SIDE SPLIT CARD ================= */
                      `grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 sm:p-5 md:p-6 rounded-2xl border ${
                        isDarkTheme
                          ? 'bg-[#191816]/75 border-[rgba(194,162,101,0.18)] hover:border-[#C2A265]/40'
                          : 'bg-[#FAF8F5]/90 border-[#DFD7CB] hover:border-[#C2A265]/40'
                      }`
                    : layoutMode === 'stacked'
                    ? /* ================= STACKED CARD ================= */
                      `p-4 sm:p-6 rounded-2xl border space-y-3 ${
                        isDarkTheme
                          ? 'bg-[#191816]/75 border-[rgba(194,162,101,0.18)] hover:border-[#C2A265]/40'
                          : 'bg-[#FAF8F5]/90 border-[#DFD7CB] hover:border-[#C2A265]/40'
                      }`
                    : /* ================= ENGLISH ONLY CARD ================= */
                      `p-4 sm:p-6 rounded-2xl border space-y-2 ${
                        isDarkTheme
                          ? 'bg-[#191816]/75 border-[rgba(194,162,101,0.18)] hover:border-[#C2A265]/40'
                          : 'bg-[#FAF8F5]/90 border-[#DFD7CB] hover:border-[#C2A265]/40'
                      }`
                }`}
              >
                {layoutMode === 'side-by-side' ? (
                  <>
                    {/* Left Column: Mandarin Speech */}
                    <div className="md:col-span-5 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-stone-500 mb-1.5">
                          <span className="font-semibold">#{item.id}</span>
                          <span>•</span>
                          <span>{item.timestamp}</span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed tracking-wide ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                          } ${fontSizes.chineseSplit}`}
                        >
                          {item.chinese || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Right Column: English Translation */}
                    <div
                      className={`md:col-span-7 flex flex-col justify-between pl-0 md:pl-4 md:border-l pt-3 md:pt-0 border-t md:border-t-0 ${
                        isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#EAE3D9]'
                      }`}
                    >
                      <p
                        className={`${fontClass} font-medium tracking-normal ${fontSizes.englishSplit} ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.2)]'
                            : 'text-[#1C1A17]'
                        }`}
                      >
                        {item.english}
                      </p>
                    </div>
                  </>
                ) : layoutMode === 'stacked' ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] font-mono text-stone-500">
                      <span className="font-semibold">#{item.id}</span>
                      <span>{item.timestamp}</span>
                    </div>

                    {item.chinese && (
                      <div className="flex items-start space-x-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold tracking-wider uppercase border mt-0.5 ${
                            isDarkTheme
                              ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                              : 'bg-stone-200 border-stone-300 text-stone-700'
                          }`}
                        >
                          ZH
                        </span>
                        <p
                          className={`font-sans leading-relaxed ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-600'
                          } ${fontSizes.chineseStacked}`}
                        >
                          {item.chinese}
                        </p>
                      </div>
                    )}

                    <div
                      className={`flex items-start space-x-2.5 pt-2 border-t ${
                        isDarkTheme ? 'border-[rgba(194,162,101,0.18)]' : 'border-[#F2ECE3]'
                      }`}
                    >
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B] mt-0.5">
                        EN
                      </span>
                      <p
                        className={`${fontClass} font-medium tracking-normal ${fontSizes.englishStacked} ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_10px_rgba(223,202,155,0.22)]'
                            : 'text-[#1C1A17]'
                        }`}
                      >
                        {item.english}
                      </p>
                    </div>
                  </>
                ) : (
                  /* English Only */
                  <>
                    <div className="text-[10px] font-mono text-stone-500 mb-1">
                      {item.timestamp}
                    </div>
                    <p
                      className={`${fontClass} font-medium tracking-normal ${fontSizes.englishStacked} ${
                        isDarkTheme
                          ? 'text-[#FAF8F5] drop-shadow-[0_1px_10px_rgba(223,202,155,0.22)]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      {item.english}
                    </p>
                  </>
                )}
              </div>
            ))}

            {/* Active Streaming Partial Sentence (The Speaker is Currently Talking) */}
            {activePartial && (
              <div
                className={`transition-all duration-300 rounded-2xl border-2 shadow-2xl animate-subtle-pulse ${
                  isDarkTheme
                    ? 'bg-[#22201D] border-[#C2A265] shadow-[#C2A265]/15'
                    : 'bg-[#FFFDF9] border-[#C2A265] shadow-stone-300/60'
                } ${
                  layoutMode === 'side-by-side'
                    ? 'grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 sm:p-5 md:p-6'
                    : 'p-4 sm:p-6 space-y-3'
                }`}
              >
                {layoutMode === 'side-by-side' ? (
                  <>
                    {/* Left: Live Chinese Input */}
                    <div className="md:col-span-5 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-[#C2A265] mb-1.5 uppercase font-bold tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C2A265] animate-ping" />
                          <span>Live Input • {activePartial.timestamp}</span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed tracking-wide ${
                            isDarkTheme ? 'text-[#FAF8F5]' : 'text-stone-800'
                          } ${fontSizes.chineseSplit}`}
                        >
                          {activePartial.chinese || (
                            <span className="italic text-stone-500">正在倾听原声发言...</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Live English Translation */}
                    <div
                      className={`md:col-span-7 flex flex-col justify-between pl-0 md:pl-4 md:border-l pt-3 md:pt-0 border-t md:border-t-0 ${
                        isDarkTheme ? 'border-[#C2A265]/40' : 'border-[#C2A265]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-1.5 text-[10px] font-sans uppercase tracking-widest font-bold text-[#C2A265] mb-1.5">
                          <span>Interpreting Speech...</span>
                        </div>
                        <p
                          className={`${fontClass} font-semibold tracking-normal ${fontSizes.englishSplit} ${
                            isDarkTheme
                              ? 'text-[#FAF8F5] drop-shadow-[0_2px_14px_rgba(223,202,155,0.3)]'
                              : 'text-[#1C1A17]'
                          }`}
                        >
                          <span>{activePartial.english}</span>
                          <span
                            className={`inline-block w-2 md:w-2.5 h-5 md:h-7 ml-2 align-middle rounded-full animate-pulse ${
                              isDarkTheme ? 'bg-[#C2A265]' : 'bg-[#1C1A17]'
                            }`}
                          />
                        </p>
                      </div>
                    </div>
                  </>
                ) : layoutMode === 'stacked' ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#C2A265] font-bold uppercase tracking-wider">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#C2A265] animate-ping" />
                        <span>Live Interpretation in Progress</span>
                      </span>
                      <span className="text-stone-400 font-normal">{activePartial.timestamp}</span>
                    </div>

                    {activePartial.chinese && (
                      <div className="flex items-start space-x-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold tracking-wider uppercase border mt-0.5 ${
                            isDarkTheme
                              ? 'bg-stone-800 border-stone-700 text-stone-300'
                              : 'bg-stone-200 border-stone-300 text-stone-700'
                          }`}
                        >
                          ZH
                        </span>
                        <p
                          className={`font-sans leading-relaxed ${
                            isDarkTheme ? 'text-[#FAF8F5]' : 'text-stone-800'
                          } ${fontSizes.chineseStacked}`}
                        >
                          {activePartial.chinese}
                        </p>
                      </div>
                    )}

                    <div
                      className={`flex items-start space-x-2.5 pt-2 border-t ${
                        isDarkTheme ? 'border-[#C2A265]/30' : 'border-[#F2ECE3]'
                      }`}
                    >
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B] mt-0.5">
                        EN
                      </span>
                      <p
                        className={`${fontClass} font-semibold tracking-normal ${fontSizes.englishStacked} ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_2px_16px_rgba(223,202,155,0.32)]'
                            : 'text-[#1C1A17]'
                        }`}
                      >
                        <span>{activePartial.english}</span>
                        <span
                          className={`inline-block w-2.5 md:w-3.5 h-6 md:h-9 ml-2.5 align-middle rounded-full animate-pulse ${
                            isDarkTheme ? 'bg-[#C2A265]' : 'bg-[#1C1A17]'
                          }`}
                        />
                      </p>
                    </div>
                  </>
                ) : (
                  /* English Only */
                  <>
                    <div className="flex items-center space-x-1.5 text-[10px] font-sans uppercase tracking-widest font-bold text-[#C2A265] mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C2A265] animate-ping" />
                      <span>Live Speech • {activePartial.timestamp}</span>
                    </div>
                    <p
                      className={`${fontClass} font-semibold tracking-normal ${fontSizes.englishStacked} ${
                        isDarkTheme
                          ? 'text-[#FAF8F5] drop-shadow-[0_2px_16px_rgba(223,202,155,0.32)]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      <span>{activePartial.english}</span>
                      <span
                        className={`inline-block w-2.5 md:w-3.5 h-6 md:h-9 ml-2.5 align-middle rounded-full animate-pulse ${
                          isDarkTheme ? 'bg-[#C2A265]' : 'bg-[#1C1A17]'
                        }`}
                      />
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Bottom scroll target anchor */}
            <div ref={bottomAnchorRef} className="h-4" />
          </div>
        )}

        {/* Floating "Resume Auto-scroll" Pill Button if User Scrolled Up */}
        {!autoScroll && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={scrollToBottom}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-full border shadow-2xl backdrop-blur-md transition-all animate-bounce cursor-pointer ${
                isDarkTheme
                  ? 'bg-[#C2A265] text-[#141311] border-[#DFCA9B] font-semibold hover:bg-[#DFCA9B]'
                  : 'bg-[#1C1A17] text-[#FAF8F5] border-stone-800 font-semibold hover:bg-black'
              }`}
            >
              <ArrowDown className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-bold">Resume Auto-Scroll</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer Details */}
      <div
        className={`relative z-20 flex flex-col sm:flex-row items-center justify-between text-xs pt-3 border-t gap-2 transition-colors ${
          isDarkTheme ? 'border-[rgba(194,162,101,0.2)] text-stone-400' : 'border-[#DFD7CB] text-stone-500'
        }`}
      >
        <div className="font-sans tracking-wide">
          Venue: <span className="font-serif italic font-medium text-stone-300 dark:text-stone-200">The Stable</span>
          <span className="mx-2">•</span>
          Stones of the Yarra Valley
        </div>

        <div className="flex items-center space-x-3 font-sans tracking-wider text-[11px] uppercase">
          <span>{subtitles.length} phrases translated</span>
          <span>•</span>
          <span>Press <kbd className={`px-1.5 py-0.5 rounded text-[10px] ${isDarkTheme ? 'bg-[#22201D] text-stone-200' : 'bg-[#EAE3D9] text-stone-800'}`}>F</kbd> for Fullscreen</span>
        </div>
      </div>

      {/* Floating Corner QR Badge for Guest Scanning */}
      {onOpenQrCode && (
        <button
          onClick={onOpenQrCode}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 p-2 sm:p-2.5 rounded-xl border flex items-center space-x-2.5 shadow-xl transition-all backdrop-blur-md cursor-pointer group ${
            isDarkTheme
              ? 'bg-[#1D1B18]/90 border-[rgba(194,162,101,0.3)] text-[#FAF8F5] hover:border-[#C2A265] hover:bg-[#25221E]'
              : 'bg-[#FAF8F5]/95 border-[#DFD7CB] text-[#1C1A17] hover:border-stone-400 hover:bg-white'
          }`}
          title="Scan QR Code for Mobile Subtitles"
        >
          <div className="p-1.5 rounded-md bg-white text-stone-900 shadow-xs group-hover:scale-105 transition-transform">
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="text-left font-sans pr-1">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#C2A265]">
              Mobile Subtitles
            </div>
            <div className="text-[11px] font-serif italic text-stone-400">
              Click to enlarge QR
            </div>
          </div>
        </button>
      )}
    </div>
  );
};
