import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { MobileView } from './components/MobileView';
import { ProjectorView } from './components/ProjectorView';
import { SpeakerConsole } from './components/SpeakerConsole';
import { QRCodeModal } from './components/QRCodeModal';
import { useLiveSubtitles } from './hooks/useLiveSubtitles';
import type { ViewMode } from './types';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('speaker')) return 'speaker';
    if (hash.includes('mobile')) return 'mobile';

    const params = new URLSearchParams(window.location.search);
    const view = params.get('view')?.toLowerCase();
    if (view === 'speaker') return 'speaker';
    if (view === 'mobile') return 'mobile';

    return 'projector';
  });

  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stones_wedding_theme');
      if (saved !== null) {
        return saved === 'dark';
      }
    }
    return true; // Default to The Stable Candlelight (dark theme)
  });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const toggleTheme = () => {
    setIsDarkTheme((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('stones_wedding_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  };

  const {
    subtitles,
    activePartial,
    connectionStatus,
    audioLevel,
    isSessionActive,
    wedding,
    backendConfig,
    clearTranscript,
    exportTranscript,
  } = useLiveSubtitles();

  // Sync viewMode changes to URL hash
  const handleSelectView = (mode: ViewMode) => {
    setViewMode(mode);
    window.location.hash = mode;
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'p' || e.key === 'P') handleSelectView('projector');
      if (e.key === 's' || e.key === 'S') handleSelectView('speaker');
      if (e.key === 'm' || e.key === 'M') handleSelectView('mobile');
      if (e.key === 't' || e.key === 'T') toggleTheme();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDark = isDarkTheme;

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${
        isDark
          ? 'bg-[#141312] text-[#FAF8F5] selection:bg-[#C2A265]/30 selection:text-[#FAF8F5]'
          : 'bg-[#FAF8F5] text-[#1C1A17] bg-paper-texture selection:bg-[#C2A265]/30 selection:text-[#1C1A17]'
      }`}
    >
      <Header
        currentView={viewMode}
        onSelectView={handleSelectView}
        connectionStatus={connectionStatus}
        isSessionActive={isSessionActive}
        wedding={wedding}
        liveModel={
          backendConfig?.transcribe_model && backendConfig?.translation_model
            ? `${backendConfig.transcribe_model} + ${backendConfig.translation_model}`
            : 'gemini-3.5-transcribe + gemini-3.5-flash'
        }
        isDark={isDarkTheme}
        onToggleTheme={toggleTheme}
        isProjectorDark={isDarkTheme}
        onOpenQrCode={() => setIsQrModalOpen(true)}
      />

      <main className="flex-1 w-full">
        <div className={viewMode === 'projector' ? 'block' : 'hidden'}>
          <ProjectorView
            subtitles={subtitles}
            activePartial={activePartial}
            wedding={wedding}
            isSessionActive={isSessionActive}
            audioLevel={audioLevel}
            isDarkTheme={isDarkTheme}
            onToggleTheme={toggleTheme}
            onOpenQrCode={() => setIsQrModalOpen(true)}
          />
        </div>

        <div className={viewMode === 'speaker' ? 'block' : 'hidden'}>
          <SpeakerConsole
            subtitles={subtitles}
            activePartial={activePartial}
            wedding={wedding}
            backendConfig={backendConfig}
            clearTranscript={clearTranscript}
            exportTranscript={exportTranscript}
            onOpenQrCode={() => setIsQrModalOpen(true)}
            isDarkTheme={isDarkTheme}
            onToggleTheme={toggleTheme}
          />
        </div>

        <div className={viewMode === 'mobile' ? 'block' : 'hidden'}>
          <MobileView
            subtitles={subtitles}
            activePartial={activePartial}
            wedding={wedding}
            onOpenQrCode={() => setIsQrModalOpen(true)}
            isDarkTheme={isDarkTheme}
            onToggleTheme={toggleTheme}
          />
        </div>
      </main>

      {/* Stones of the Yarra Valley Styled QR Code Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        wedding={wedding}
        isDark={isDarkTheme}
      />
    </div>
  );
}

export default App;
