import React, { useEffect, useRef, useState } from 'react';
import {
  Languages,
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
import { StreamingSubtitleText } from './StreamingSubtitleText';

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
      className={`relative h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 select-none overflow-hidden transition-colors duration-300 ${
        isDarkTheme
          ? 'bg-[#090A0B] text-[#F4F4F5]'
          : 'bg-[#FAFAFA] text-[#18181B]'
      }`}
    >
      {/* Top Banner: Venue Identification & Projection Quick Controls */}
      <div
        className={`relative z-20 flex flex-wrap items-center justify-between pb-3 md:pb-4 border-b gap-3 transition-colors ${
          isDarkTheme ? 'border-[rgba(255,255,255,0.08)]' : 'border-[rgba(0,0,0,0.08)]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-2 h-2 rounded-full ${
              isSessionActive ? 'bg-[#10B981]' : isDarkTheme ? 'bg-[#52525B]' : 'bg-[#D4D4D8]'
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="tracking-widest uppercase text-xs md:text-sm font-semibold text-stone-300 dark:text-stone-300">
                The Stable at Stones
              </h2>
              {sessionInfo && (
                <span
                  className={`text-[10px] font-sans px-2 py-0.5 rounded-full font-medium tracking-normal ${
                    isDarkTheme
                      ? 'bg-[rgba(255,255,255,0.06)] text-[#A1A1AA] border border-[rgba(255,255,255,0.08)]'
                      : 'bg-[rgba(0,0,0,0.04)] text-[#71717A] border border-[rgba(0,0,0,0.06)]'
                  }`}
                >
                  #{sessionInfo.session_number}: {sessionInfo.session_title}
                </span>
              )}
            </div>
            <p className="text-[11px] font-sans tracking-widest uppercase text-stone-500">
              {wedding.bride_name} &amp; {wedding.groom_name}
            </p>
          </div>
        </div>

        {/* Floating Quick Settings Deck */}
        <div
          className={`flex flex-wrap items-center space-x-1.5 md:space-x-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
            isDarkTheme
              ? 'bg-[#121316] border-[rgba(255,255,255,0.08)] text-stone-300'
              : 'bg-white border-[rgba(0,0,0,0.08)] text-stone-700'
          }`}
        >
          {/* New Session Operator Button */}
          {onOpenNewSession && (
            <button
              onClick={onOpenNewSession}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans font-medium transition-all border ${
                isDarkTheme
                  ? 'border-[rgba(255,255,255,0.1)] text-[#D4D4D8] hover:bg-[rgba(255,255,255,0.05)]'
                  : 'border-[rgba(0,0,0,0.1)] text-[#52525B] hover:bg-[rgba(0,0,0,0.03)]'
              }`}
              title="Start a new translation speech session"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Session</span>
            </button>
          )}

          {/* Audio VU Indicator */}
          {isSessionActive && (
            <div className="flex items-center space-x-2 mr-1 pr-2 border-r border-stone-500/20">
              <Volume2 className="w-3.5 h-3.5 text-stone-400" />
              <div className="w-12 md:w-16 h-1 bg-stone-700/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          )}

          {/* Layout Mode Segmented Control */}
          <div
            className={`flex items-center p-0.5 rounded-full border ${
              isDarkTheme ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)]' : 'bg-[rgba(0,0,0,0.02)] border-[rgba(0,0,0,0.06)]'
            }`}
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
              onClick={() => setLayoutMode('side-by-side')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-wider font-medium transition-all ${
                layoutMode === 'side-by-side'
                  ? isDarkTheme
                    ? 'bg-[rgba(255,255,255,0.1)] text-[#F4F4F5]'
                    : 'bg-black text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Side-by-Side Split View"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Side-by-Side</span>
            </button>
            <button
              onClick={() => setLayoutMode('stacked')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-wider font-medium transition-all ${
                layoutMode === 'stacked'
                  ? isDarkTheme
                    ? 'bg-[rgba(255,255,255,0.1)] text-[#F4F4F5]'
                    : 'bg-black text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Stacked Subtitles"
            >
              <Rows2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stacked</span>
            </button>
            <button
              onClick={() => setLayoutMode('english')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-wider font-medium transition-all ${
                layoutMode === 'english'
                  ? isDarkTheme
                    ? 'bg-[rgba(255,255,255,0.1)] text-[#F4F4F5]'
                    : 'bg-black text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="English Only"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">EN Only</span>
            </button>
          </div>

          {/* Font Style Toggle: Serif vs Modern Sans */}
          <button
            onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-widest font-medium border transition-all ${
              fontStyle === 'sans'
                ? isDarkTheme
                  ? 'bg-[rgba(255,255,255,0.06)] text-[#F4F4F5] border-[rgba(255,255,255,0.12)]'
                  : 'bg-[rgba(0,0,0,0.04)] text-black border-[rgba(0,0,0,0.1)]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{fontStyle === 'serif' ? 'Serif' : 'Sans'}</span>
          </button>

          {/* Auto-scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-sans uppercase tracking-widest font-medium border transition-all ${
              autoScroll
                ? isDarkTheme
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isDarkTheme
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-400'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {autoScroll ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
            <span className="hidden lg:inline">{autoScroll ? 'Scroll On' : 'Paused'}</span>
          </button>

          {/* Font Size Selector */}
          <div className="flex items-center space-x-1 pl-1">
            {(['md', 'lg', 'xl'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFontSizeLevel(lvl)}
                className={`w-6 h-6 rounded-full uppercase font-medium text-[10px] transition-all ${
                  fontSizeLevel === lvl
                    ? isDarkTheme
                      ? 'bg-[rgba(255,255,255,0.15)] text-[#F4F4F5]'
                      : 'bg-black text-white'
                    : 'text-stone-400 hover:text-stone-200'
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
                  ? 'hover:bg-[rgba(255,255,255,0.06)] text-stone-300'
                  : 'hover:bg-[rgba(0,0,0,0.04)] text-stone-700'
              }`}
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-full text-[11px] transition-all ${
              isDarkTheme
                ? 'hover:bg-[rgba(255,255,255,0.06)] text-stone-300'
                : 'hover:bg-[rgba(0,0,0,0.04)] text-stone-700'
            }`}
            title="Toggle fullscreen (Shortcut: F)"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Center Stage: Continuous Auto-Scrolling Translation Feed */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col my-3 md:my-5">
        {subtitles.length === 0 && !activePartial ? (
          /* Empty / Waiting state */
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12 px-4">
            <h3 className="text-3xl md:text-5xl lg:text-6xl font-serif tracking-normal font-normal">
              {wedding.bride_name} &amp; {wedding.groom_name}
            </h3>
            <p className="font-serif italic text-stone-400 text-base md:text-xl max-w-lg mx-auto leading-relaxed">
              Live English interpretation will begin as words are spoken.
            </p>
            <div className={`flex items-center space-x-2 text-xs font-sans tracking-widest uppercase pt-2 text-stone-500`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isDarkTheme ? 'bg-[#10B981]' : 'bg-[#10B981]'}`} />
              <span>Live Subtitles Ready</span>
            </div>
          </div>
        ) : (
          /* Continuous Scrollable Subtitle Feed */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-1 sm:px-3 md:px-6 py-2 space-y-4 md:space-y-5 scrollbar-thin"
          >
            {/* Sticky Header for Side-by-Side Columns */}
            {layoutMode === 'side-by-side' && (
              <div
                className={`sticky top-0 z-20 grid grid-cols-1 md:grid-cols-12 gap-4 pb-2 pt-1 px-4 md:px-6 border-b text-[11px] font-sans uppercase tracking-widest font-semibold backdrop-blur-md transition-colors ${
                  isDarkTheme
                    ? 'bg-[#090A0B]/95 border-[rgba(255,255,255,0.06)] text-stone-400'
                    : 'bg-[#FAFAFA]/95 border-[rgba(0,0,0,0.06)] text-stone-600'
                }`}
              >
                <div className="md:col-span-5 flex items-center space-x-2">
                  <span>Mandarin Speech</span>
                </div>
                <div className={`md:col-span-7 flex items-center space-x-2 pl-0 md:pl-4 md:border-l ${isDarkTheme ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.06)]'}`}>
                  <span>English Translation</span>
                </div>
              </div>
            )}

            {/* Render Finalized History Sentences */}
            {subtitles.map((item) => (
              <div
                key={item.id}
                className={`transition-all duration-300 ${
                  layoutMode === 'side-by-side'
                    ? /* Side-by-Side */
                      `grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 sm:p-5 md:p-6 rounded-2xl border ${
                        isDarkTheme
                          ? 'bg-[#121316] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                          : 'bg-white border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]'
                      }`
                    : layoutMode === 'stacked'
                    ? /* Stacked */
                      `p-4 sm:p-6 rounded-2xl border space-y-3 ${
                        isDarkTheme
                          ? 'bg-[#121316] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                          : 'bg-white border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]'
                      }`
                    : /* English Only */
                      `p-4 sm:p-6 rounded-2xl border space-y-2 ${
                        isDarkTheme
                          ? 'bg-[#121316] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                          : 'bg-white border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]'
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
                            isDarkTheme ? 'text-stone-400' : 'text-stone-600'
                          } ${fontSizes.chineseSplit}`}
                        >
                          {item.chinese || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Right Column: English Translation */}
                    <div
                      className={`md:col-span-7 flex flex-col justify-between pl-0 md:pl-4 md:border-l pt-3 md:pt-0 border-t md:border-t-0 ${
                        isDarkTheme ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.06)]'
                      }`}
                    >
                      <p
                        className={`${fontClass} font-normal tracking-normal ${fontSizes.englishSplit} ${
                          isDarkTheme ? 'text-[#F4F4F5]' : 'text-[#18181B]'
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
                      <p
                        className={`font-sans leading-relaxed ${
                          isDarkTheme ? 'text-stone-400' : 'text-stone-600'
                        } ${fontSizes.chineseStacked}`}
                      >
                        {item.chinese}
                      </p>
                    )}

                    <div
                      className={`pt-2 border-t ${
                        isDarkTheme ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.06)]'
                      }`}
                    >
                      <p
                        className={`${fontClass} font-normal tracking-normal ${fontSizes.englishStacked} ${
                          isDarkTheme ? 'text-[#F4F4F5]' : 'text-[#18181B]'
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
                      className={`${fontClass} font-normal tracking-normal ${fontSizes.englishStacked} ${
                        isDarkTheme ? 'text-[#F4F4F5]' : 'text-[#18181B]'
                      }`}
                    >
                      {item.english}
                    </p>
                  </>
                )}
              </div>
            ))}

            {/* Active Streaming Partial Sentence */}
            {activePartial && (
              <div
                className={`transition-all duration-200 rounded-2xl border ${
                  isDarkTheme
                    ? 'bg-[#121316] border-[rgba(255,255,255,0.22)]'
                    : 'bg-white border-[rgba(0,0,0,0.25)]'
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
                        <div className="flex items-center space-x-2 text-[10px] font-mono mb-1.5 uppercase tracking-wider text-stone-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                          <span>Live Input • {activePartial.timestamp}</span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed tracking-wide ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                          } ${fontSizes.chineseSplit}`}
                        >
                          {activePartial.chinese ? (
                            <StreamingSubtitleText
                              text={activePartial.chinese}
                              isChinese
                              showCursor={false}
                            />
                          ) : (
                            <span className="italic text-stone-500">Listening...</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Live English Translation */}
                    <div
                      className={`md:col-span-7 flex flex-col justify-between pl-0 md:pl-4 md:border-l pt-3 md:pt-0 border-t md:border-t-0 ${
                        isDarkTheme ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.06)]'
                      }`}
                    >
                      <div>
                        <p
                          className={`${fontClass} font-normal tracking-normal ${fontSizes.englishSplit} ${
                            isDarkTheme ? 'text-[#F4F4F5]' : 'text-[#18181B]'
                          }`}
                        >
                          <StreamingSubtitleText
                            text={activePartial.english}
                            isChinese={false}
                            showCursor
                            cursorColor="#10B981"
                          />
                        </p>
                      </div>
                    </div>
                  </>
                ) : layoutMode === 'stacked' ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] font-mono tracking-wider text-stone-500">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                        <span>Live Interpretation</span>
                      </span>
                      <span>{activePartial.timestamp}</span>
                    </div>

                    {activePartial.chinese && (
                      <p
                        className={`font-sans leading-relaxed ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                        } ${fontSizes.chineseStacked}`}
                      >
                        <StreamingSubtitleText
                          text={activePartial.chinese}
                          isChinese
                          showCursor={false}
                        />
                      </p>
                    )}

                    <div
                      className={`pt-2 border-t ${
                        isDarkTheme ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.06)]'
                      }`}
                    >
                      <p
                        className={`${fontClass} font-normal tracking-normal ${fontSizes.englishStacked} ${
                          isDarkTheme ? 'text-[#F4F4F5]' : 'text-[#18181B]'
                        }`}
                      >
                        <StreamingSubtitleText
                          text={activePartial.english}
                          isChinese={false}
                          showCursor
                          cursorColor="#10B981"
                        />
                      </p>
                    </div>
                  </>
                ) : (
                  /* English Only */
                  <>
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono tracking-wider text-stone-500 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                      <span>Live • {activePartial.timestamp}</span>
                    </div>
                    <p
                      className={`${fontClass} font-normal tracking-normal ${fontSizes.englishStacked} ${
                        isDarkTheme ? 'text-[#F4F4F5]' : 'text-[#18181B]'
                      }`}
                    >
                      <StreamingSubtitleText
                        text={activePartial.english}
                        isChinese={false}
                        showCursor
                        cursorColor="#10B981"
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                isDarkTheme
                  ? 'bg-[#121316] text-[#F4F4F5] border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.08)]'
                  : 'bg-white text-black border-[rgba(0,0,0,0.15)] hover:bg-[rgba(0,0,0,0.04)]'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span className="text-xs uppercase tracking-wider font-medium">Resume Scroll</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer Details */}
      <div
        className={`relative z-20 flex flex-col sm:flex-row items-center justify-between text-xs pt-3 border-t gap-2 transition-colors ${
          isDarkTheme ? 'border-[rgba(255,255,255,0.08)] text-stone-500' : 'border-[rgba(0,0,0,0.08)] text-stone-500'
        }`}
      >
        <div className="font-sans tracking-wide">
          The Stable at Stones of the Yarra Valley
        </div>

        <div className="flex items-center space-x-3 font-sans tracking-wider text-[11px] uppercase">
          <span>{subtitles.length} phrases</span>
          <span>•</span>
          <span>Press <kbd className={`px-1.5 py-0.5 rounded text-[10px] ${isDarkTheme ? 'bg-[rgba(255,255,255,0.06)] text-stone-300' : 'bg-[rgba(0,0,0,0.06)] text-stone-700'}`}>F</kbd> for Fullscreen</span>
        </div>
      </div>

      {/* Floating Corner QR Badge for Guest Scanning */}
      {onOpenQrCode && (
        <button
          onClick={onOpenQrCode}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 p-2 rounded-xl border flex items-center space-x-2 shadow-md transition-all cursor-pointer ${
            isDarkTheme
              ? 'bg-[#121316] border-[rgba(255,255,255,0.08)] text-stone-300 hover:border-[rgba(255,255,255,0.2)]'
              : 'bg-white border-[rgba(0,0,0,0.08)] text-stone-700 hover:border-[rgba(0,0,0,0.2)]'
          }`}
          title="Scan QR Code for Mobile Subtitles"
        >
          <QrCode className="w-4 h-4 text-stone-400" />
          <span className="text-[11px] font-sans font-medium">Guest QR</span>
        </button>
      )}
    </div>
  );
};
