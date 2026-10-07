import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getAppTheme } from './theme';
import { Header } from './components/Header';
import { MobileView } from './components/MobileView';
import { ProjectorView } from './components/ProjectorView';
import { SpeakerConsole } from './components/SpeakerConsole';
import { QRCodeModal } from './components/QRCodeModal';
import { NewSessionDialog } from './components/NewSessionDialog';
import { useLiveSubtitles } from './hooks/useLiveSubtitles';
import type { ViewMode } from './types';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('speaker')) return 'speaker';
    if (hash.includes('projector')) return 'projector';
    if (hash.includes('mobile') || hash.includes('guest')) return 'mobile';

    const params = new URLSearchParams(window.location.search);
    const view = params.get('view')?.toLowerCase();
    if (view === 'speaker') return 'speaker';
    if (view === 'projector') return 'projector';
    if (view === 'mobile' || view === 'guest') return 'mobile';

    // Guest view by default for all guests!
    return 'mobile';
  });

  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('google_wedding_theme') || localStorage.getItem('stones_wedding_theme');
      if (saved !== null) {
        return saved === 'dark';
      }
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }
    return false;
  });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);

  const muiTheme = useMemo(() => getAppTheme(isDarkTheme ? 'dark' : 'light'), [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('google_wedding_theme', next ? 'dark' : 'light');
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
    sessionInfo,
    createNewSession,
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
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div
        className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
          isDark
            ? 'bg-[#121316] text-[#E2E2E6] selection:bg-[#A8C7FA]/30 selection:text-[#E2E2E6]'
            : 'bg-[#F8FAFD] text-[#1F1F1F] selection:bg-[#0B57D0]/20 selection:text-[#041E49]'
        }`}
      >
        <Header
          currentView={viewMode}
          onSelectView={handleSelectView}
          connectionStatus={connectionStatus}
          isSessionActive={isSessionActive}
          wedding={wedding}
          sessionInfo={sessionInfo}
          onOpenNewSession={() => setIsNewSessionDialogOpen(true)}
          isDark={isDarkTheme}
          onToggleTheme={toggleTheme}
          onOpenQrCode={() => setIsQrModalOpen(true)}
        />

        <main className="flex-1 w-full">
          <div className={viewMode === 'projector' ? 'block' : 'hidden'}>
            <ProjectorView
              subtitles={subtitles}
              activePartial={activePartial}
              wedding={wedding}
              sessionInfo={sessionInfo}
              isSessionActive={isSessionActive}
              audioLevel={audioLevel}
              isDarkTheme={isDarkTheme}
              onToggleTheme={toggleTheme}
              onOpenQrCode={() => setIsQrModalOpen(true)}
              onOpenNewSession={() => setIsNewSessionDialogOpen(true)}
            />
          </div>

          <div className={viewMode === 'speaker' ? 'block' : 'hidden'}>
            <SpeakerConsole
              subtitles={subtitles}
              activePartial={activePartial}
              wedding={wedding}
              backendConfig={backendConfig}
              sessionInfo={sessionInfo}
              clearTranscript={clearTranscript}
              exportTranscript={exportTranscript}
              onOpenNewSession={() => setIsNewSessionDialogOpen(true)}
              onOpenQrCode={() => setIsQrModalOpen(true)}
              isDarkTheme={isDarkTheme}
            />
          </div>

          <div className={viewMode === 'mobile' ? 'block' : 'hidden'}>
            <MobileView
              subtitles={subtitles}
              activePartial={activePartial}
              wedding={wedding}
              sessionInfo={sessionInfo}
              onOpenQrCode={() => setIsQrModalOpen(true)}
              isDarkTheme={isDarkTheme}
              onToggleTheme={toggleTheme}
              onSelectView={handleSelectView}
              onOpenNewSession={() => setIsNewSessionDialogOpen(true)}
              isSessionActive={isSessionActive}
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

        {/* Material UI New Session Dialog */}
        <NewSessionDialog
          open={isNewSessionDialogOpen}
          onClose={() => setIsNewSessionDialogOpen(false)}
          currentSession={sessionInfo}
          transcriptCount={subtitles.length}
          onConfirmNewSession={createNewSession}
          onExportTranscript={exportTranscript}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
