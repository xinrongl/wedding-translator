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

export const MobileView: React.FC<MobileViewProps> = ({
  subtitles,
  activePartial,
  wedding,
  isDarkTheme = true,
  onToggleTheme,
  onOpenQrCode,
}) => {
  const [layoutMode, setLayoutMode] = useState<SubtitleLayoutMode>('stacked');
  const [fontStyle, setFontStyle] = useState<SubtitleFontStyle>('serif');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [subtitles, activePartial, autoScroll]);

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

  return (
    <div className="max-w-2xl mx-auto min-h-[calc(100vh-65px)] flex flex-col justify-between p-4 sm:p-6 pb-20">
      {/* Wedding Program Header Banner */}
      <div
        className={`text-center py-4 sm:py-6 border-b mb-5 transition-colors ${
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
      </div>

      {/* Sticky Mobile Subheader with quick toggles */}
      <div
        className={`sticky top-16 z-20 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border shadow-sm mb-5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
          isDarkTheme
            ? 'bg-[#1B1A18]/92 border-[rgba(194,162,101,0.25)] text-stone-200'
            : 'bg-[#FAF8F5]/95 border-[#DFD7CB] text-stone-800'
        }`}
      >
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-[#C2A265] animate-ping" />
          <span
            className={`text-[11px] font-sans uppercase tracking-widest font-semibold transition-colors ${
              isDarkTheme ? 'text-[#DFCA9B]' : 'text-stone-800'
            }`}
          >
            Live Feed
          </span>
        </div>

        <div className="flex flex-wrap items-center space-x-1 sm:space-x-1.5">
          {/* Layout Mode Selector: Stacked vs Side-by-Side vs English */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              isDarkTheme ? 'bg-[#141312]/80 border-[rgba(194,162,101,0.2)]' : 'bg-stone-200/60 border-stone-300'
            }`}
          >
            <button
              onClick={() => setLayoutMode('stacked')}
              className={`p-1 sm:px-2 rounded text-[10px] font-sans uppercase tracking-wider font-semibold transition-all flex items-center space-x-1 ${
                layoutMode === 'stacked'
                  ? isDarkTheme
                    ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                    : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Stacked Subtitles"
            >
              <Rows2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Stacked</span>
            </button>
            <button
              onClick={() => setLayoutMode('side-by-side')}
              className={`p-1 sm:px-2 rounded text-[10px] font-sans uppercase tracking-wider font-semibold transition-all flex items-center space-x-1 ${
                layoutMode === 'side-by-side'
                  ? isDarkTheme
                    ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                    : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Side-by-Side View"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Split</span>
            </button>
            <button
              onClick={() => setLayoutMode('english')}
              className={`p-1 sm:px-2 rounded text-[10px] font-sans uppercase tracking-wider font-semibold transition-all flex items-center space-x-1 ${
                layoutMode === 'english'
                  ? isDarkTheme
                    ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                    : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="English Translation Only"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">EN</span>
            </button>
          </div>

          {/* Font style toggle */}
          <button
            onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
            className={`p-1.5 px-2 rounded text-xs font-sans uppercase tracking-wider font-semibold border transition-all ${
              fontStyle === 'sans'
                ? isDarkTheme
                  ? 'bg-[#C2A265]/20 text-[#DFCA9B] border-[#C2A265]/40'
                  : 'bg-[#1C1A17] text-[#FAF8F5] border-[#1C1A17]'
                : isDarkTheme
                ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)] text-stone-300 hover:text-[#DFCA9B]'
                : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-600 hover:text-stone-900'
            }`}
            title={fontStyle === 'serif' ? 'Switch to Modern Sans font' : 'Switch to Romantic Serif font'}
          >
            <span className="text-[10px] font-bold">{fontStyle === 'serif' ? 'Serif' : 'Sans'}</span>
          </button>

          {/* Font size toggle */}
          <button
            onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
            className={`p-1.5 px-2 rounded text-xs font-sans uppercase tracking-wider font-semibold border transition-all ${
              fontSize === 'large'
                ? 'bg-[#C2A265] text-[#141311] border-[#C2A265]'
                : isDarkTheme
                ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)] text-stone-300 hover:text-[#DFCA9B]'
                : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-600 hover:text-stone-900'
            }`}
            title="Toggle Font Size"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* Theme toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-1.5 px-2 rounded text-xs font-sans uppercase tracking-wider font-semibold border transition-all ${
                isDarkTheme
                  ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)] text-[#DFCA9B] hover:bg-[#C2A265] hover:text-[#141311]'
                  : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-700 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
              }`}
              title={isDarkTheme ? 'Switch to Daylight Theme' : 'Switch to Candlelight Theme'}
            >
              {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-stone-700" />}
            </button>
          )}

          {/* Share link */}
          <button
            onClick={handleShare}
            className={`p-1.5 px-2 rounded text-xs font-sans uppercase tracking-wider font-semibold border transition-colors flex items-center space-x-1 ${
              isDarkTheme
                ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)] text-stone-300 hover:text-[#DFCA9B]'
                : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-700 hover:text-stone-900'
            }`}
            title="Share this page with table guests"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          {/* Show QR code modal */}
          {onOpenQrCode && (
            <button
              onClick={onOpenQrCode}
              className={`p-1.5 px-2 rounded text-xs font-sans uppercase tracking-wider font-semibold border transition-colors flex items-center space-x-1 ${
                isDarkTheme
                  ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)] text-stone-300 hover:text-[#DFCA9B]'
                  : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-700 hover:text-stone-900'
              }`}
              title="Show QR code for table guests"
            >
              <QrCode className="w-3.5 h-3.5" />
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
                <div className="flex justify-between items-center text-[10px] text-stone-400 font-mono tracking-wider mb-2.5">
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
                          className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase border ${
                            isDarkTheme
                              ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                              : 'bg-stone-200 border-stone-300 text-stone-700'
                          }`}
                        >
                          ZH
                        </span>
                        <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400">
                          Mandarin
                        </span>
                      </div>
                      <p
                        className={`font-sans leading-relaxed transition-colors ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                        } ${fontSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}
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
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                          EN
                        </span>
                        <span className="text-[10px] font-sans uppercase tracking-widest text-[#C2A265]">
                          English
                        </span>
                      </div>
                      <p
                        className={`${fontClass} font-medium leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.18)]'
                            : 'text-[#1C1A17]'
                        } ${fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}
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
                            className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase border ${
                              isDarkTheme
                                ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                                : 'bg-stone-200 border-stone-300 text-stone-700'
                            }`}
                          >
                            ZH
                          </span>
                          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400">
                            Spoken Mandarin
                          </span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed transition-colors ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                          } ${fontSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}
                        >
                          {item.chinese}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      {layoutMode !== 'english' && (
                        <div className="flex items-center space-x-1.5 pt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                            EN
                          </span>
                          <span className="text-[10px] font-sans uppercase tracking-widest text-[#C2A265]">
                            English Interpretation
                          </span>
                        </div>
                      )}
                      <p
                        className={`${fontClass} font-medium leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.18)]'
                            : 'text-[#1C1A17]'
                        } ${fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}
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
                <div className="flex justify-between items-center text-[10px] text-[#C2A265] font-sans tracking-widest uppercase font-bold mb-2.5">
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
                          className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase border ${
                            isDarkTheme
                              ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                              : 'bg-stone-200 border-stone-300 text-stone-700'
                          }`}
                        >
                          ZH
                        </span>
                        <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400">
                          Mandarin
                        </span>
                      </div>
                      <p
                        className={`font-sans leading-relaxed transition-colors ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                        } ${fontSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}
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
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                          EN
                        </span>
                        <span className="text-[10px] font-sans uppercase tracking-widest text-[#C2A265]">
                          English
                        </span>
                      </div>
                      <p
                        className={`${fontClass} font-semibold leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.22)]'
                            : 'text-[#1C1A17]'
                        } ${fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}
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
                            className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase border ${
                              isDarkTheme
                                ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                                : 'bg-stone-200 border-stone-300 text-stone-700'
                            }`}
                          >
                            ZH
                          </span>
                          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400">
                            Spoken Mandarin
                          </span>
                        </div>
                        <p
                          className={`font-sans leading-relaxed transition-colors ${
                            isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                          } ${fontSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}
                        >
                          {activePartial.chinese}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      {layoutMode !== 'english' && (
                        <div className="flex items-center space-x-1.5 pt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B]">
                            EN
                          </span>
                          <span className="text-[10px] font-sans uppercase tracking-widest text-[#C2A265]">
                            English Interpretation
                          </span>
                        </div>
                      )}
                      <p
                        className={`${fontClass} font-semibold leading-relaxed transition-colors ${
                          isDarkTheme
                            ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.22)]'
                            : 'text-[#1C1A17]'
                        } ${fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}
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
        <div ref={bottomRef} />
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
          className={`font-sans text-[10px] uppercase tracking-widest ${
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
          className={`fixed bottom-6 right-6 z-30 p-3 px-4 rounded-full shadow-xl flex items-center space-x-2 text-xs font-sans uppercase tracking-widest font-semibold transition-all animate-bounce ${
            isDarkTheme
              ? 'bg-[#C2A265] text-[#141311] hover:bg-[#D4BC88]'
              : 'bg-[#1C1A17] text-[#FAF8F5] hover:bg-stone-800'
          }`}
        >
          <ArrowDown className="w-4 h-4" />
          <span>Latest</span>
        </button>
      )}
    </div>
  );
};

