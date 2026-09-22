import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Mic, Monitor, Smartphone, Radio, QrCode, Sun, Moon } from 'lucide-react';
import type { ConnectionStatus } from '../hooks/useLiveSubtitles';
import type { ViewMode, WeddingContextData } from '../types';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  connectionStatus: ConnectionStatus;
  isSessionActive: boolean;
  wedding: WeddingContextData;
  liveModel?: string;
  isDark?: boolean;
  isProjectorDark?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  connectionStatus,
  isSessionActive,
  wedding,
  liveModel = 'gemini-3.5-transcribe + gemini-3.5-flash',
  isDark: isDarkProp,
  isProjectorDark = true,
  onToggleTheme,
  onOpenQrCode,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const isDark = isDarkProp !== undefined ? isDarkProp : (currentView === 'projector' && isProjectorDark);

  // Guests on phones only need the brand + connection status; view switching,
  // QR, theme and fullscreen are operator controls (theme/QR live in the guest toolbar).
  const isGuestPhone = currentView === 'mobile';
  const operatorOnly = isGuestPhone ? 'hidden sm:flex' : 'flex';

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors duration-500 border-b px-4 sm:px-8 h-16 sm:h-auto py-0 sm:py-3.5 flex items-center justify-between gap-3 backdrop-blur-md ${
        isDark
          ? 'bg-[#141312]/90 border-[rgba(194,162,101,0.2)] text-[#FAF8F5]'
          : 'bg-[#FAF8F5]/90 border-[#DFD7CB] text-[#1C1A17]'
      }`}
    >
      {/* Brand & Venue Signature Header */}
      <div className="flex items-center space-x-3.5 min-w-0">
        <div
          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border transition-all ${
            isDark
              ? 'border-[#C2A265]/40 bg-[#1D1B18] text-[#C2A265]'
              : 'border-[#1C1A17]/20 bg-[#F5EFEB] text-[#1C1A17]'
          }`}
        >
          <span className="font-serif italic font-bold text-lg">S</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="font-serif tracking-[0.08em] sm:tracking-[0.18em] text-[11px] sm:text-sm uppercase font-semibold truncate">
              Stones of the Yarra Valley
            </h1>
            <span
              className={`hidden sm:inline-block text-[10px] px-2 py-0.5 uppercase tracking-widest font-sans font-medium rounded-sm border ${
                isDark
                  ? 'border-[#C2A265]/30 text-[#DFCA9B] bg-[#C2A265]/10'
                  : 'border-[#1C1A17]/20 text-[#7A746C] bg-[#EAE3D9]/40'
              }`}
            >
              The Stable
            </span>
          </div>
          <div className="text-[11px] tracking-wide flex items-center space-x-2 font-serif italic text-stone-500 dark:text-stone-400">
            <span className="truncate">
              {wedding.bride_name} &amp; {wedding.groom_name}’s Wedding
            </span>
            <span className="hidden sm:inline not-italic text-stone-400">•</span>
            <span className="hidden sm:inline not-italic font-sans text-[10px] uppercase tracking-wider text-amber-600 dark:text-[#C2A265]">
              Live Translation
            </span>
          </div>
        </div>
      </div>

      {/* View Mode Navigation Tabs */}
      <nav
        className={`${operatorOnly} items-center p-1 rounded-lg border transition-all shadow-sm ${
          isDark
            ? 'bg-[#1B1A18] border-[rgba(194,162,101,0.25)]'
            : 'bg-[#F2ECE3] border-[#DFD7CB]'
        }`}
      >
        <button
          onClick={() => onSelectView('projector')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-md text-[11px] font-sans uppercase tracking-[0.14em] font-medium transition-all ${
            currentView === 'projector'
              ? isDark
                ? 'bg-[#C2A265] text-[#141311] font-semibold shadow-sm'
                : 'bg-[#1C1A17] text-[#FAF8F5] font-semibold shadow-sm'
              : isDark
              ? 'text-stone-400 hover:text-stone-200'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          title="The Stable Projector & Stage View (P)"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Projector</span>
        </button>

        <button
          onClick={() => onSelectView('speaker')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-md text-[11px] font-sans uppercase tracking-[0.14em] font-medium transition-all ${
            currentView === 'speaker'
              ? isDark
                ? 'bg-[#C2A265] text-[#141311] font-semibold shadow-sm'
                : 'bg-[#1C1A17] text-[#FAF8F5] font-semibold shadow-sm'
              : isDark
              ? 'text-stone-400 hover:text-stone-200'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          title="Microphone & Speaker Deck (S)"
        >
          <Mic className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Speaker Deck</span>
        </button>

        <button
          onClick={() => onSelectView('mobile')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-md text-[11px] font-sans uppercase tracking-[0.14em] font-medium transition-all ${
            currentView === 'mobile'
              ? isDark
                ? 'bg-[#C2A265] text-[#141311] font-semibold shadow-sm'
                : 'bg-[#1C1A17] text-[#FAF8F5] font-semibold shadow-sm'
              : isDark
              ? 'text-stone-400 hover:text-stone-200'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          title="Guest Mobile Program (M)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guest View</span>
        </button>
      </nav>

      {/* Right Controls & Status Indicator */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Guest QR Code Modal Trigger */}
        <button
          onClick={onOpenQrCode}
          className={`${operatorOnly} items-center space-x-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-sans uppercase tracking-[0.14em] font-medium transition-all ${
            isDark
              ? 'border-[rgba(194,162,101,0.3)] bg-[#1B1A18] text-[#DFCA9B] hover:bg-[#C2A265] hover:text-[#141311]'
              : 'border-[#1C1A17]/25 bg-[#FAF8F5] text-stone-800 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
          }`}
          title="Open Mobile Guest QR Code"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guest QR</span>
        </button>

        {/* On Air Broadcast status */}
        {isSessionActive && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans uppercase tracking-widest font-semibold border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse">
            <Radio className="w-3 h-3" />
            <span>On Air</span>
          </div>
        )}

        {/* WebSocket Connection Beacon */}
        <div
          className={`flex items-center space-x-1.5 text-[11px] font-sans tracking-wider px-2.5 py-1 rounded-full border transition-all ${
            isDark
              ? 'bg-[#1B1A18] border-[rgba(194,162,101,0.2)] text-stone-300'
              : 'bg-[#F2ECE3] border-[#DFD7CB] text-stone-700'
          }`}
          title={`Connection: ${connectionStatus} (${liveModel})`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-emerald-600 dark:bg-emerald-400 shadow-sm'
                : connectionStatus === 'connecting'
                ? 'bg-amber-500 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="hidden lg:inline capitalize">{connectionStatus}</span>
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className={`${operatorOnly} p-2 rounded-md border transition-all ${
              isDark
                ? 'border-[rgba(194,162,101,0.3)] bg-[#1B1A18] text-[#DFCA9B] hover:bg-[#C2A265] hover:text-[#141311]'
                : 'border-[#1C1A17]/25 bg-[#FAF8F5] text-stone-700 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
            }`}
            title={isDark ? 'Switch to Daylight Theme' : 'Switch to Stable Candlelight Theme'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className={`${operatorOnly} p-2 rounded-md border transition-all ${
            isDark
              ? 'border-[rgba(194,162,101,0.3)] text-stone-300 hover:bg-[#C2A265] hover:text-[#141311]'
              : 'border-[#1C1A17]/25 text-stone-700 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};

