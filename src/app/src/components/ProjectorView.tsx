import React, { useEffect, useRef, useState } from 'react';
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
  PlusCircle,
} from 'lucide-react';
import type {
  SubtitleItem,
  WeddingContextData,
  SubtitleLayoutMode,
  SubtitleFontStyle,
  TranslationSessionInfo,
} from '../types';

interface ProjectorViewProps {
  subtitles: SubtitleItem[];
  activePartial: SubtitleItem | null;
  wedding: WeddingContextData;
  sessionInfo: TranslationSessionInfo;
  isSessionActive: boolean;
  audioLevel: number;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode?: () => void;
  onOpenNewSession?: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  subtitles,
  activePartial,
  wedding,
  sessionInfo,
  isSessionActive,
  audioLevel,
  isDarkTheme = true,
  onToggleTheme,
  onOpenQrCode,
  onOpenNewSession,
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

  const fontSizesMap: Record<'md' | 'lg' | 'xl', {
    englishStacked: string;
    chineseStacked: string;
    englishSplit: string;
    chineseSplit: string;
  }> = {
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
  };
  const fontSizes = fontSizesMap[fontSizeLevel];

  const fontClass = fontStyle === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div
      className={`relative h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 select-none overflow-hidden transition-colors duration-700 ${
        isDarkTheme
          ? 'bg-[#141312] text-[#FAF8F5]'
          : 'bg-[#FAF8F5] text-[#1C1A17] bg-paper-texture'
      }`}
    >
      {/* Ambient glow effects */}
      {isDarkTheme ? (
        <>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[450px] bg-[#0B57D0]/10 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-[550px] h-[380px] bg-[#34A853]/8 blur-[130px] rounded-full pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#0B57D0]/5 blur-[120px] rounded-full pointer-events-none" />
        </>
      )}

      {/* Top Banner: Venue Identification & Projection Quick Controls */}
      <div
        className={`relative z-20 flex flex-wrap items-center justify-between pb-3 md:pb-4 border-b gap-3 transition-colors ${
          isDarkTheme ? 'border-[#333538]' : 'border-[#DEE2E6]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isDarkTheme ? 'bg-[#A8C7FA] shadow-sm shadow-[#A8C7FA]' : 'bg-[#0B57D0]'
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="tracking-[0.15em] uppercase text-xs md:text-sm font-bold">
                The Stable at Stones
              </h2>
              {sessionInfo && (
                <span
                  className={`text-[10px] font-sans px-2.5 py-0.5 rounded-full font-medium tracking-normal ${
                    isDarkTheme
                      ? 'bg-[#0B57D0]/20 text-[#A8C7FA] border border-[#0B57D0]/40'
                      : 'bg-[#E8F0FE] text-[#0B57D0] border border-[#D3E3FD]'
                  }`}
                >
                  #{sessionInfo.session_number}: {sessionInfo.session_title}
                </span>
              )}
            </div>
            <p className="text-[11px] font-sans tracking-widest uppercase text-stone-500">
              {wedding.bride_name} &amp; {wedding.groom_name} • Live Translation
            </p>
          </div>
        </div>

        {/* Floating Quick Settings Deck */}
        <div
          className={`flex flex-wrap items-center space-x-1.5 md:space-x-2 backdrop-blur-md px-3 py-1.5 rounded-2xl border text-xs transition-all ${
            isDarkTheme
              ? 'bg-[#1E1F22]/90 border-[#333538] text-stone-200 shadow-lg'
              : 'bg-white/95 border-[#DEE2E6] text-stone-700 shadow-sm'
          }`}
        >
          {/* New Session Operator Button */}
          {onOpenNewSession && (
            <button
              onClick={onOpenNewSession}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-sans font-semibold transition-all border ${
                isDarkTheme
                  ? 'bg-[#0B57D0]/20 border-[#0B57D0]/40 text-[#A8C7FA] hover:bg-[#0B57D0]/35 hover:text-white'
                  : 'bg-[#E8F0FE] border-[#D3E3FD] text-[#0B57D0] hover:bg-[#D3E3FD]'
              }`}
              title="Start a new translation speech session"
            >
              <PlusCircle className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`} />
              <span className="hidden sm:inline">New Session</span>
            </button>
          )}
          {/* Audio VU Indicator */}
          {isSessionActive && (
            <div className="flex items-center space-x-2 mr-1 pr-2 border-r border-stone-500/30">
              <Volume2
                className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}
              />
              <div className="w-12 md:w-16 h-1.5 bg-stone-700/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-[#4285F4] to-amber-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          )}

          {/* Layout Mode Segmented Control */}
          <div
            className={`flex items-center p-0.5 rounded-full border ${
              isDarkTheme ? 'bg-[#282A2E] border-[#3C4043]' : 'bg-[#F0F4F9] border-[#DEE2E6]'
            }`}
            title="Choose Subtitle Layout"
          >
            <button
              onClick={() => setLayoutMode('side-by-side')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-wider font-semibold transition-all ${
                layoutMode === 'side-by-side'
                  ? isDarkTheme
                    ? 'bg-[#A8C7FA] text-[#041E49] shadow-xs'
                    : 'bg-[#0B57D0] text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Side-by-Side Split View (Dual Language Columns)"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Side-by-Side</span>
            </button>
            <button
              onClick={() => setLayoutMode('stacked')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-wider font-semibold transition-all ${
                layoutMode === 'stacked'
                  ? isDarkTheme
                    ? 'bg-[#A8C7FA] text-[#041E49] shadow-xs'
                    : 'bg-[#0B57D0] text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Stacked Subtitles (Cinema Style)"
            >
              <Rows2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stacked</span>
            </button>
            <button
              onClick={() => setLayoutMode('english')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-wider font-semibold transition-all ${
                layoutMode === 'english'
                  ? isDarkTheme
                    ? 'bg-[#A8C7FA] text-[#041E49] shadow-xs'
                    : 'bg-[#0B57D0] text-white shadow-xs'
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
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-widest font-semibold border transition-all ${
              fontStyle === 'sans'
                ? isDarkTheme
                  ? 'bg-[#0B57D0]/20 text-[#A8C7FA] border-[#0B57D0]/40'
                  : 'bg-[#E8F0FE] text-[#0B57D0] border-[#D3E3FD]'
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
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-widest font-semibold border transition-all ${
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
                className={`w-6 h-6 rounded-full uppercase font-bold text-[10px] transition-all ${
                  fontSizeLevel === lvl
                    ? isDarkTheme
                      ? 'bg-[#A8C7FA] text-[#041E49] font-bold shadow-sm'
                      : 'bg-[#0B57D0] text-white font-bold shadow-sm'
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
              className={`p-1.5 rounded-full text-[11px] transition-all ${
                isDarkTheme
                  ? 'hover:bg-[#282A2E] text-[#A8C7FA]'
                  : 'hover:bg-[#E0E2EC] text-[#1D1B20]'
              }`}
              title="Toggle Stable Candlelight / Daylight"
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-full text-[11px] transition-all ${
              isDarkTheme
                ? 'hover:bg-[#282A2E] text-stone-300 hover:text-white'
                : 'hover:bg-[#E0E2EC] text-[#1D1B20]'
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
                  ? 'bg-[#1E1F22] border-[#333538] text-[#A8C7FA] shadow-lg shadow-[#0B57D0]/10'
                  : 'bg-[#E8F0FE] border-[#D3E3FD] text-[#0B57D0]'
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
            <div className={`flex items-center space-x-2 text-xs font-sans tracking-widest uppercase pt-2 ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
              <span className={`w-2 h-2 rounded-full animate-ping ${isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'}`} />
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
                    ? 'bg-[#121316]/95 border-[#333538] text-stone-400'
                    : 'bg-[#F8FAFD]/95 border-[#DEE2E6] text-stone-600'
                }`}
              >
                <div className="md:col-span-5 flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-stone-700/50 text-stone-300 text-[10px]">ZH</span>
                  <span>Mandarin Speech (现场原声)</span>
                </div>
                <div className={`md:col-span-7 flex items-center space-x-2 pl-0 md:pl-4 md:border-l ${isDarkTheme ? 'border-[#333538]' : 'border-[#DEE2E6]'}`}>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDarkTheme ? 'bg-[#0B57D0]/25 text-[#A8C7FA]' : 'bg-[#E8F0FE] text-[#0B57D0]'}`}>EN</span>
                  <span className={isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}>Live English Translation (实时同传)</span>
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
                      `grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 sm:p-5 md:p-6 rounded-3xl border ${
                        isDarkTheme
                          ? 'bg-[#1E1F22]/90 border-[#333538] hover:border-[#A8C7FA]/40'
                          : 'bg-[#FFFFFF] border-[#DEE2E6] hover:border-[#0B57D0]/40 shadow-xs'
                      }`
                    : layoutMode === 'stacked'
                    ? /* ================= STACKED CARD ================= */
                      `p-4 sm:p-6 rounded-3xl border space-y-3 ${
                        isDarkTheme
                          ? 'bg-[#1E1F22]/90 border-[#333538] hover:border-[#A8C7FA]/40'
                          : 'bg-[#FFFFFF] border-[#DEE2E6] hover:border-[#0B57D0]/40 shadow-xs'
                      }`
                    : /* ================= ENGLISH ONLY CARD ================= */
                      `p-4 sm:p-6 rounded-3xl border space-y-2 ${
                        isDarkTheme
                          ? 'bg-[#1E1F22]/90 border-[#333538] hover:border-[#A8C7FA]/40'
                          : 'bg-[#FFFFFF] border-[#DEE2E6] hover:border-[#0B57D0]/40 shadow-xs'
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
                        isDarkTheme ? 'border-[rgba(255,255,255,0.1)]' : 'border-[rgba(0,0,0,0.08)]'
                      }`}
                    >
                      <p
                        className={`${fontClass} font-medium tracking-normal ${fontSizes.englishSplit} ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(66,133,244,0.15)]'
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
                        isDarkTheme ? 'border-[#333538]' : 'border-[#DEE2E6]'
                      }`}
                    >
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold tracking-wider uppercase mt-0.5 ${isDarkTheme ? 'bg-[#0B57D0]/20 text-[#A8C7FA]' : 'bg-[#E8F0FE] text-[#0B57D0]'}`}>
                        EN
                      </span>
                      <p
                        className={`${fontClass} font-medium tracking-normal ${fontSizes.englishStacked} ${
                          isDarkTheme
                            ? 'text-[#FAF8F5]'
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
                className={`transition-all duration-300 rounded-3xl border-2 shadow-2xl animate-subtle-pulse ${
                  isDarkTheme
                    ? 'bg-[#1E1F22] border-[#A8C7FA] shadow-[#0B57D0]/20'
                    : 'bg-[#FFFFFF] border-[#0B57D0] shadow-[#0B57D0]/10'
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
                        <div className={`flex items-center space-x-2 text-[10px] font-mono mb-1.5 uppercase font-bold tracking-wider ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'}`} />
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
                        isDarkTheme ? 'border-[#333538]' : 'border-[#DEE2E6]'
                      }`}
                    >
                      <div>
                        <div className={`flex items-center space-x-1.5 text-[10px] font-sans uppercase tracking-widest font-bold mb-1.5 ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
                          <span>Interpreting Speech...</span>
                        </div>
                        <p
                          className={`${fontClass} font-semibold tracking-normal ${fontSizes.englishSplit} ${
                            isDarkTheme
                              ? 'text-[#FAF8F5]'
                              : 'text-[#1C1A17]'
                          }`}
                        >
                          <span>{activePartial.english}</span>
                          <span
                            className={`inline-block w-2 md:w-2.5 h-5 md:h-7 ml-2 align-middle rounded-full animate-pulse ${
                              isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'
                            }`}
                          />
                        </p>
                      </div>
                    </div>
                  </>
                ) : layoutMode === 'stacked' ? (
                  <>
                    <div className={`flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
                      <span className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full animate-ping ${isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'}`} />
                        <span>Live Interpretation in Progress</span>
                      </span>
                      <span className="text-stone-400 font-normal">{activePartial.timestamp}</span>
                    </div>

                    {activePartial.chinese && (
                      <div className="flex items-start space-x-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold tracking-wider uppercase border mt-0.5 ${
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
                        isDarkTheme ? 'border-[#333538]' : 'border-[#DEE2E6]'
                      }`}
                    >
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold tracking-wider uppercase mt-0.5 ${isDarkTheme ? 'bg-[#0B57D0]/20 text-[#A8C7FA]' : 'bg-[#E8F0FE] text-[#0B57D0]'}`}>
                        EN
                      </span>
                      <p
                        className={`${fontClass} font-semibold tracking-normal ${fontSizes.englishStacked} ${
                          isDarkTheme
                            ? 'text-[#FAF8F5]'
                            : 'text-[#1C1A17]'
                        }`}
                      >
                        <span>{activePartial.english}</span>
                        <span
                          className={`inline-block w-2.5 md:w-3.5 h-6 md:h-9 ml-2.5 align-middle rounded-full animate-pulse ${
                            isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'
                          }`}
                        />
                      </p>
                    </div>
                  </>
                ) : (
                  /* English Only */
                  <>
                    <div className={`flex items-center space-x-1.5 text-[10px] font-sans uppercase tracking-widest font-bold mb-1 ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'}`} />
                      <span>Live Speech • {activePartial.timestamp}</span>
                    </div>
                    <p
                      className={`${fontClass} font-semibold tracking-normal ${fontSizes.englishStacked} ${
                        isDarkTheme
                          ? 'text-[#FAF8F5]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      <span>{activePartial.english}</span>
                      <span
                        className={`inline-block w-2.5 md:w-3.5 h-6 md:h-9 ml-2.5 align-middle rounded-full animate-pulse ${
                          isDarkTheme ? 'bg-[#A8C7FA]' : 'bg-[#0B57D0]'
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
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full border shadow-2xl backdrop-blur-md transition-all animate-bounce cursor-pointer ${
                isDarkTheme
                  ? 'bg-[#A8C7FA] text-[#041E49] border-[#A8C7FA] font-semibold hover:bg-[#D3E3FD]'
                  : 'bg-[#0B57D0] text-white border-[#0B57D0] font-semibold hover:bg-[#0842A0]'
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
          isDarkTheme ? 'border-[#333538] text-stone-400' : 'border-[#DEE2E6] text-stone-500'
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
          <span>Press <kbd className={`px-2 py-0.5 rounded-md text-[10px] ${isDarkTheme ? 'bg-[#282A2E] text-stone-200' : 'bg-[#F0F4F9] text-stone-800'}`}>F</kbd> for Fullscreen</span>
        </div>
      </div>

      {/* Floating Corner QR Badge for Guest Scanning */}
      {onOpenQrCode && (
        <button
          onClick={onOpenQrCode}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 p-2 sm:p-2.5 rounded-2xl border flex items-center space-x-2.5 shadow-xl transition-all backdrop-blur-md cursor-pointer group ${
            isDarkTheme
              ? 'bg-[#1E1F22]/95 border-[#333538] text-[#E3E2E6] hover:border-[#A8C7FA] hover:bg-[#282A2E]'
              : 'bg-white/95 border-[#DEE2E6] text-[#1D1B20] hover:border-[#0B57D0] hover:bg-white'
          }`}
          title="Scan QR Code for Mobile Subtitles"
        >
          <div className="p-1.5 rounded-xl bg-[#E8F0FE] text-[#0B57D0] shadow-xs group-hover:scale-105 transition-transform">
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="text-left font-sans pr-1">
            <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
              Mobile Subtitles
            </div>
            <div className="text-[11px] text-stone-400">
              Click to enlarge QR
            </div>
          </div>
        </button>
      )}
    </div>
  );
};
