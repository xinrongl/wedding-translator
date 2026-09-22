import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Download,
  Trash2,
  Volume2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Radio,
  Sliders,
  QrCode,
  Sun,
  Moon,
  Columns2,
  Rows2,
  Type,
} from 'lucide-react';
import { AudioCaptureService, resolveWsUrl } from '../services/audioCapture';
import { decodeGoogleIdToken, loadGoogleIdentityScript, type GoogleIdentityClaims } from '../services/googleAuth';
import type { BackendConfig, SubtitleItem, WeddingContextData, SubtitleFontStyle } from '../types';

interface SpeakerConsoleProps {
  subtitles: SubtitleItem[];
  activePartial: SubtitleItem | null;
  wedding: WeddingContextData;
  backendConfig: BackendConfig | null;
  clearTranscript: () => Promise<void>;
  exportTranscript: (format: 'markdown' | 'csv') => void;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode?: () => void;
}

export const SpeakerConsole: React.FC<SpeakerConsoleProps> = ({
  subtitles,
  activePartial,
  wedding,
  backendConfig,
  clearTranscript,
  exportTranscript,
  isDarkTheme = true,
  onToggleTheme,
  onOpenQrCode,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedLayout, setFeedLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [fontStyle, setFontStyle] = useState<SubtitleFontStyle>('serif');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleIdentityClaims | null>(null);

  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const oauthClientId = backendConfig?.google_oauth_client_id ?? null;

  // Load Google Identity Services and render its "Sign in with Google" button once the
  // client ID arrives from the backend. Only the speaker console pulls this script in.
  useEffect(() => {
    if (!oauthClientId) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: oauthClientId,
          callback: (response) => {
            setIdToken(response.credential);
            setGoogleUser(decodeGoogleIdToken(response.credential));
            setErrorMessage(null);
          },
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: isDarkTheme ? 'filled_black' : 'outline',
          size: 'medium',
          text: 'signin_with',
        });
      })
      .catch((err: Error) => setErrorMessage(err.message));

    return () => {
      cancelled = true;
    };
  }, [oauthClientId, isDarkTheme]);

  const handleSignOut = () => {
    setIdToken(null);
    setGoogleUser(null);
    window.google?.accounts.id.disableAutoSelect();
  };

  useEffect(() => {
    const service = new AudioCaptureService({
      onAudioLevel: (lvl) => setLocalAudioLevel(lvl),
      onError: (err, code) => {
        setErrorMessage(err.message);
        setIsStreaming(false);
        if (code === 4401) {
          // The token was rejected or has expired — drop it so the Sign In
          // button reappears instead of showing a stale "signed in" state.
          setIdToken(null);
          setGoogleUser(null);
        }
      },
      onStateChange: (state) => setIsStreaming(state),
    });
    audioServiceRef.current = service;

    return () => {
      service.stop();
    };
  }, []);

  // Auto-scroll transcript feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtitles, activePartial]);

  const toggleStreaming = async () => {
    setErrorMessage(null);
    const service = audioServiceRef.current;
    if (!service) return;

    if (isStreaming) {
      service.stop();
      setIsStreaming(false);
    } else {
      if (oauthClientId && !idToken) {
        setErrorMessage('Sign in with an approved Google account first.');
        return;
      }
      try {
        const base = resolveWsUrl('/ws/speaker');
        const wsUrl = idToken ? `${base}?id_token=${encodeURIComponent(idToken)}` : base;
        await service.start(wsUrl);
        setIsStreaming(true);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setErrorMessage(error.message);
        setIsStreaming(false);
      }
    }
  };

  const toggleMute = () => {
    const service = audioServiceRef.current;
    if (!service) return;
    const nextMuted = !isMuted;
    service.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 space-y-8">
      {/* Top Deck: Acoustic Controller & Wedding Context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Microphone & Audio Deck */}
        <div
          className={`lg:col-span-2 rounded-xl p-6 sm:p-8 shadow-sm flex flex-col justify-between transition-colors ${
            isDarkTheme
              ? 'bg-[#1B1A18] border border-[rgba(194,162,101,0.22)]'
              : 'bg-[#FAF8F5] border border-[#DFD7CB]'
          }`}
        >
          <div>
            <div
              className={`flex items-center justify-between mb-4 pb-4 border-b transition-colors ${
                isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
              }`}
            >
              <div>
                <div className="flex items-center space-x-3">
                  <h2
                    className={`font-serif text-lg sm:text-xl font-semibold tracking-wide transition-colors ${
                      isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
                    }`}
                  >
                    Speech Capture Console
                  </h2>
                  {isStreaming && (
                    <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-300 text-rose-700 text-[10px] font-sans uppercase tracking-widest font-bold">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>On Air (16kHz PCM)</span>
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs font-sans mt-1 transition-colors ${
                    isDarkTheme ? 'text-stone-400' : 'text-stone-500'
                  }`}
                >
                  Source: Mandarin Chinese (with English code-switching) • Simultaneous Translation
                </p>
              </div>

              {/* Top controls: Theme Toggle & Mute */}
              <div className="flex items-center space-x-2">
                {onToggleTheme && (
                  <button
                    onClick={onToggleTheme}
                    className={`p-2.5 rounded-md border text-xs font-sans uppercase tracking-widest font-semibold flex items-center space-x-2 transition-all ${
                      isDarkTheme
                        ? 'border-[rgba(194,162,101,0.3)] text-[#DFCA9B] hover:bg-[#22201D]'
                        : 'border-[#1C1A17]/30 text-stone-700 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
                    }`}
                    title={isDarkTheme ? 'Switch to Daylight Theme' : 'Switch to Candlelight Theme'}
                  >
                    {isDarkTheme ? <Sun className="w-4 h-4 text-[#DFCA9B]" /> : <Moon className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isDarkTheme ? 'Day' : 'Night'}</span>
                  </button>
                )}

                {/* Mute button */}
                {isStreaming && (
                  <button
                    onClick={toggleMute}
                    className={`p-2.5 rounded-md border text-xs font-sans uppercase tracking-widest font-semibold flex items-center space-x-2 transition-all ${
                      isMuted
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : isDarkTheme
                        ? 'border-[rgba(194,162,101,0.3)] text-stone-300 hover:bg-[#22201D] hover:text-[#DFCA9B]'
                        : 'border-[#1C1A17]/30 text-stone-700 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? 'Muted' : 'Mute'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Analog-styled VU Meter */}
            <div className="space-y-2 my-5">
              <div
                className={`flex justify-between text-xs font-sans tracking-wider uppercase transition-colors ${
                  isDarkTheme ? 'text-stone-400' : 'text-stone-500'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#C2A265]" />
                  <span>Acoustic Energy Meter</span>
                </span>
                <span
                  className={`font-mono font-semibold transition-colors ${
                    isDarkTheme ? 'text-[#DFCA9B]' : 'text-[#1C1A17]'
                  }`}
                >
                  {localAudioLevel}%
                </span>
              </div>
              <div
                className={`w-full h-3 rounded-full overflow-hidden p-0.5 border transition-colors ${
                  isDarkTheme
                    ? 'bg-[#22201D] border-[rgba(194,162,101,0.25)]'
                    : 'bg-[#EAE3D9] border-[#DFD7CB]'
                }`}
              >
                <div
                  className="h-full rounded-full transition-all duration-75 ease-out bg-gradient-to-r from-[#626D59] via-[#C2A265] to-[#A6685B]"
                  style={{ width: `${localAudioLevel}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 font-mono tracking-widest">
                <span>-40 dB</span>
                <span>-20 dB</span>
                <span>-6 dB</span>
                <span>0 dB</span>
              </div>
            </div>
          </div>

          {/* Action Button: Start / Stop Microphone */}
          <div
            className={`pt-4 border-t transition-colors space-y-3 ${
              isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
            }`}
          >
            <div>
              <label
                className={`block text-[10px] uppercase tracking-widest mb-1.5 ${
                  isDarkTheme ? 'text-stone-400' : 'text-stone-500'
                }`}
              >
                Speaker Sign-In
              </label>

              {!oauthClientId && (
                <p className="mb-2 text-[11px] text-amber-500 leading-relaxed">
                  GOOGLE_OAUTH_CLIENT_ID is not configured on the backend — the speaker
                  microphone is currently open to anyone with this link. Set it before the
                  wedding.
                </p>
              )}

              {oauthClientId && googleUser && (
                <div
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 mb-2 transition-colors ${
                    isDarkTheme
                      ? 'bg-[#141311] border-[rgba(194,162,101,0.25)]'
                      : 'bg-white border-[#DFD7CB]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {googleUser.picture && (
                      <img
                        src={googleUser.picture}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-full flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`truncate text-xs font-semibold ${
                          isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
                        }`}
                      >
                        {googleUser.name}
                      </p>
                      <p className="truncate text-[10px] text-stone-400">{googleUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={isStreaming}
                    className={`flex-shrink-0 text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                      isDarkTheme
                        ? 'border-[rgba(194,162,101,0.3)] text-stone-300 hover:bg-[#22201D]'
                        : 'border-[#1C1A17]/25 text-stone-700 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
                    }`}
                  >
                    Sign out
                  </button>
                </div>
              )}

              {/* GIS renders its own button here; kept mounted (hidden, not unmounted) so it
                  doesn't need to be re-rendered every time sign-in state changes. */}
              <div ref={googleButtonRef} className={googleUser ? 'hidden' : ''} />
            </div>
            <button
              onClick={toggleStreaming}
              disabled={!isStreaming && !!oauthClientId && !idToken}
              className={`w-full py-4 px-6 rounded-md font-sans uppercase tracking-[0.16em] text-xs font-bold flex items-center justify-center space-x-2.5 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-none ${
                isStreaming
                  ? 'bg-[#A6685B] hover:bg-[#8E554B] text-white shadow-[#A6685B]/20 animate-subtle-pulse'
                  : isDarkTheme
                  ? 'bg-[#C2A265] hover:bg-[#D4BC88] text-[#141311] shadow-[#C2A265]/10'
                  : 'bg-[#1C1A17] hover:bg-[#2B2824] text-[#FAF8F5] shadow-stone-800/20'
              }`}
            >
              {isStreaming ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Stop Speech Stream</span>
                </>
              ) : (
                <>
                  <Mic className={`w-4 h-4 ${isDarkTheme ? 'text-[#141311]' : 'text-[#DFCA9B]'}`} />
                  <span>Start Microphone (Connect Live Gemini)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Wedding Context & Details */}
        <div
          className={`rounded-xl p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-5 transition-colors ${
            isDarkTheme
              ? 'bg-[#1B1A18] border border-[rgba(194,162,101,0.22)]'
              : 'bg-[#FAF8F5] border border-[#DFD7CB]'
          }`}
        >
          <div>
            <div
              className={`flex items-center justify-between mb-4 pb-3 border-b transition-colors ${
                isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
              }`}
            >
              <h3
                className={`font-serif text-sm font-semibold uppercase tracking-[0.18em] flex items-center space-x-2 transition-colors ${
                  isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
                }`}
              >
                <Sliders className="w-4 h-4 text-[#C2A265]" />
                <span>Wedding Context</span>
              </h3>
              <span
                className={`text-[10px] font-sans uppercase tracking-widest px-2 py-0.5 rounded flex items-center space-x-1 ${
                  isDarkTheme
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Synchronized</span>
              </span>
            </div>

            <dl className="space-y-3 text-xs font-sans">
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Bride &amp; Groom</dt>
                <dd
                  className={`font-serif font-semibold text-sm transition-colors ${
                    isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
                  }`}
                >
                  {wedding.bride_name} &amp; {wedding.groom_name}
                </dd>
              </div>
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Venue</dt>
                <dd
                  className={`font-medium transition-colors ${
                    isDarkTheme ? 'text-[#DFCA9B]' : 'text-stone-800'
                  }`}
                >
                  The Stable
                </dd>
              </div>
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Speaker Role</dt>
                <dd className={`font-medium ${isDarkTheme ? 'text-amber-400' : 'text-amber-800'}`}>
                  {wedding.speaker_role || 'Wedding Guest'}
                </dd>
              </div>
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Target Output</dt>
                <dd
                  className={`font-medium transition-colors ${
                    isDarkTheme ? 'text-stone-200' : 'text-stone-900'
                  }`}
                >
                  English (en) Subtitles
                </dd>
              </div>
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Architecture</dt>
                <dd className={`font-semibold ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-800'}`}>
                  Two-Step (ASR + Flash LLM)
                </dd>
              </div>
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Live ASR</dt>
                <dd
                  className={`font-mono text-[11px] text-right transition-colors ${
                    isDarkTheme ? 'text-stone-400' : 'text-stone-600'
                  }`}
                >
                  {backendConfig?.transcribe_model || 'gemini-3.5-transcribe-live-preview'}
                </dd>
              </div>
              <div
                className={`flex justify-between py-1 border-b transition-colors ${
                  isDarkTheme ? 'border-[rgba(194,162,101,0.15)]' : 'border-[#EAE3D9]'
                }`}
              >
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>Translation</dt>
                <dd
                  className={`font-mono text-[11px] text-right transition-colors ${
                    isDarkTheme ? 'text-stone-400' : 'text-stone-600'
                  }`}
                >
                  {backendConfig?.translation_model || 'gemini-3.5-flash'}
                </dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className={isDarkTheme ? 'text-stone-400' : 'text-stone-500'}>GCP Region</dt>
                <dd
                  className={`font-mono text-[11px] transition-colors ${
                    isDarkTheme ? 'text-stone-400' : 'text-stone-600'
                  }`}
                >
                  global (Vertex AI)
                </dd>
              </div>
            </dl>
          </div>

          {/* Transcript Export & QR Actions */}
          <div
            className={`pt-4 border-t space-y-2 transition-colors ${
              isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
            }`}
          >
            {onOpenQrCode && (
              <button
                onClick={onOpenQrCode}
                className={`w-full py-2.5 px-3 rounded border text-[11px] font-sans uppercase tracking-widest font-semibold flex items-center justify-center space-x-2 transition-all shadow-2xs ${
                  isDarkTheme
                    ? 'border-[rgba(194,162,101,0.3)] bg-[#22201D] text-[#DFCA9B] hover:bg-[#C2A265] hover:text-[#141311]'
                    : 'border-[#C2A265] bg-[#F5EFEB] hover:bg-[#C2A265] text-[#1C1A17]'
                }`}
                title="Open and print the Guest Mobile QR Code"
              >
                <QrCode className="w-4 h-4" />
                <span>Show / Print Guest QR Code</span>
              </button>
            )}

            <div className="flex items-center space-x-2">
              <button
                onClick={() => exportTranscript('markdown')}
                className={`flex-1 py-2 px-3 rounded border text-[11px] font-sans uppercase tracking-widest font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  isDarkTheme
                    ? 'border-[rgba(194,162,101,0.3)] text-stone-300 hover:bg-[#22201D] hover:text-[#DFCA9B]'
                    : 'border-[#1C1A17]/30 text-stone-800 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
                }`}
                title="Export complete speech transcript as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span>MD</span>
              </button>
              <button
                onClick={() => exportTranscript('csv')}
                className={`flex-1 py-2 px-3 rounded border text-[11px] font-sans uppercase tracking-widest font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  isDarkTheme
                    ? 'border-[rgba(194,162,101,0.3)] text-stone-300 hover:bg-[#22201D] hover:text-[#DFCA9B]'
                    : 'border-[#1C1A17]/30 text-stone-800 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
                }`}
                title="Export complete speech transcript as CSV"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={clearTranscript}
                className={`py-2 px-3 rounded border text-[11px] font-sans uppercase tracking-widest font-semibold flex items-center justify-center space-x-1 transition-all ${
                  isDarkTheme
                    ? 'border-rose-400/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                    : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
                title="Clear transcript history for new speaker"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Simultaneous Speech Feed */}
      <div
        className={`rounded-xl p-6 sm:p-8 shadow-sm transition-colors ${
          isDarkTheme
            ? 'bg-[#1B1A18] border border-[rgba(194,162,101,0.22)]'
            : 'bg-[#FAF8F5] border border-[#DFD7CB]'
        }`}
      >
        <div
          className={`flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b gap-3 transition-colors ${
            isDarkTheme ? 'border-[rgba(194,162,101,0.2)]' : 'border-[#DFD7CB]'
          }`}
        >
          <div>
            <h3
              className={`font-serif text-lg font-semibold flex items-center space-x-2 transition-colors ${
                isDarkTheme ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
              }`}
            >
              <span>Simultaneous Speech &amp; Subtitle Feed</span>
              <span className="text-xs font-normal text-stone-500 font-sans">
                ({subtitles.length} finalized phrases)
              </span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Dual-channel verification for the sound booth &amp; wedding coordinator
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Feed Layout Toggle */}
            <div
              className={`flex items-center p-0.5 rounded-lg border ${
                isDarkTheme ? 'bg-[#141312] border-[rgba(194,162,101,0.2)]' : 'bg-stone-200/60 border-stone-300'
              }`}
            >
              <button
                onClick={() => setFeedLayout('side-by-side')}
                className={`p-1 px-2 rounded text-[11px] font-sans uppercase tracking-wider font-semibold transition-all flex items-center space-x-1 ${
                  feedLayout === 'side-by-side'
                    ? isDarkTheme
                      ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                      : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Side-by-Side Dual Column View"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Side-by-Side</span>
              </button>
              <button
                onClick={() => setFeedLayout('stacked')}
                className={`p-1 px-2 rounded text-[11px] font-sans uppercase tracking-wider font-semibold transition-all flex items-center space-x-1 ${
                  feedLayout === 'stacked'
                    ? isDarkTheme
                      ? 'bg-[#C2A265] text-[#141311] shadow-xs'
                      : 'bg-[#1C1A17] text-[#FAF8F5] shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Stacked Cards View"
              >
                <Rows2 className="w-3.5 h-3.5" />
                <span>Stacked</span>
              </button>
            </div>

            {/* Font Style Toggle */}
            <button
              onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
              className={`p-1.5 px-2.5 rounded text-xs font-sans uppercase tracking-wider font-semibold border transition-all flex items-center ${
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
              <Type className="w-3 h-3 mr-1" />
              <span className="text-[10px] font-bold">{fontStyle === 'serif' ? 'Serif' : 'Sans'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Feed Container */}
        <div
          ref={scrollRef}
          className={`h-96 overflow-y-auto space-y-3 p-3 sm:p-5 rounded-lg border transition-colors ${
            isDarkTheme
              ? 'bg-[#141312] border-[rgba(194,162,101,0.2)]'
              : 'bg-[#F5EFEB] border-[#DFD7CB]'
          }`}
        >
          {subtitles.length === 0 && !activePartial ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs space-y-2 py-10">
              <Mic className="w-8 h-8 text-stone-400 stroke-[1.5]" />
              <p className="font-serif italic text-sm">No speech captured yet. Click "Start Microphone" above to begin.</p>
            </div>
          ) : feedLayout === 'side-by-side' ? (
            /* ================= SIDE-BY-SIDE DUAL COLUMN TABLE ================= */
            <div className="space-y-2">
              {/* Table Column Headers */}
              <div
                className={`sticky top-0 z-10 grid grid-cols-12 gap-3 pb-2 px-3 border-b text-[10px] font-sans uppercase tracking-widest font-semibold backdrop-blur-md transition-colors ${
                  isDarkTheme
                    ? 'bg-[#141312]/95 border-[rgba(194,162,101,0.2)] text-stone-400'
                    : 'bg-[#F5EFEB]/95 border-[#DFD7CB] text-stone-500'
                }`}
              >
                <div className="col-span-5 flex items-center space-x-1.5">
                  <span className="px-1.5 py-0.2 rounded bg-stone-700/50 text-stone-300">ZH</span>
                  <span>Spoken Mandarin Input</span>
                </div>
                <div className="col-span-7 flex items-center space-x-1.5 pl-3 border-l border-stone-800">
                  <span className="px-1.5 py-0.2 rounded bg-[#C2A265]/20 text-[#DFCA9B]">EN</span>
                  <span className="text-[#C2A265]">Live English Translation</span>
                </div>
              </div>

              {/* Rows */}
              {subtitles.map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-3 p-3 rounded-lg border text-sm transition-all ${
                    isDarkTheme
                      ? 'bg-[#1B1A18] border-[rgba(194,162,101,0.18)] hover:border-[#C2A265]/40'
                      : 'bg-[#FAF8F5] border-[#E5DED5] hover:border-[#C2A265]/40'
                  }`}
                >
                  {/* Left Column: Spoken Mandarin */}
                  <div className="col-span-5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                      <span className="font-semibold text-stone-500">#{item.id}</span>
                      <span>{item.timestamp}</span>
                    </div>
                    <p
                      className={`font-sans leading-relaxed ${
                        isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                      }`}
                    >
                      {item.chinese || '—'}
                    </p>
                  </div>

                  {/* Right Column: English Translation */}
                  <div
                    className={`col-span-7 space-y-1 pl-3 border-l ${
                      isDarkTheme ? 'border-[rgba(194,162,101,0.18)]' : 'border-[#EAE3D9]'
                    }`}
                  >
                    <div className="text-[10px] font-sans tracking-widest uppercase font-semibold text-[#C2A265]">
                      Projected Subtitle
                    </div>
                    <p
                      className={`${
                        fontStyle === 'serif' ? 'font-serif font-medium' : 'font-sans font-medium'
                      } text-base leading-relaxed ${
                        isDarkTheme
                          ? 'text-[#FAF8F5] drop-shadow-[0_1px_6px_rgba(223,202,155,0.18)]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      {item.english}
                    </p>
                  </div>
                </div>
              ))}

              {/* Active Partial Stream in Side-by-Side */}
              {activePartial && (
                <div
                  className={`grid grid-cols-12 gap-3 p-3 rounded-lg border-2 shadow-sm animate-subtle-pulse transition-all ${
                    isDarkTheme
                      ? 'bg-[#22201D] border-[#C2A265] shadow-lg shadow-[#C2A265]/10'
                      : 'bg-[#FFFDF9] border-[#C2A265]'
                  }`}
                >
                  <div className="col-span-5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#C2A265]">
                      <span className="font-bold uppercase tracking-wider flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C2A265] animate-ping" />
                        <span>Live Input</span>
                      </span>
                      <span className="text-stone-400">{activePartial.timestamp}</span>
                    </div>
                    <p
                      className={`font-sans leading-relaxed ${
                        isDarkTheme ? 'text-stone-300' : 'text-stone-700'
                      }`}
                    >
                      {activePartial.chinese || 'Listening...'}
                    </p>
                  </div>

                  <div
                    className={`col-span-7 space-y-1 pl-3 border-l ${
                      isDarkTheme ? 'border-[#C2A265]/40' : 'border-[#C2A265]/40'
                    }`}
                  >
                    <div className="text-[10px] font-sans tracking-widest uppercase font-bold text-[#C2A265]">
                      Translating...
                    </div>
                    <p
                      className={`${
                        fontStyle === 'serif' ? 'font-serif font-semibold' : 'font-sans font-semibold'
                      } text-base leading-relaxed ${
                        isDarkTheme
                          ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.22)]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      <span>{activePartial.english}</span>
                      <span className="w-1.5 h-4 bg-[#C2A265] animate-pulse ml-1.5 inline-block align-middle" />
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ================= STACKED CARDS LAYOUT ================= */
            <>
              {subtitles.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border space-y-2 shadow-xs transition-all ${
                    isDarkTheme
                      ? 'bg-[#1B1A18] border-[rgba(194,162,101,0.22)] hover:border-[#C2A265]/50'
                      : 'bg-[#FAF8F5] border-[#E5DED5] hover:border-[#C2A265]/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono">
                    <span className="font-semibold text-stone-500">#{item.id}</span>
                    <span>{item.timestamp}</span>
                  </div>
                  {item.chinese && (
                    <div className="flex items-start space-x-2">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase border mt-0.5 ${
                          isDarkTheme
                            ? 'bg-stone-800 border-stone-700 text-stone-300'
                            : 'bg-stone-200 border-stone-300 text-stone-700'
                        }`}
                      >
                        ZH
                      </span>
                      <span
                        className={`text-sm font-sans ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-600'
                        }`}
                      >
                        {item.chinese}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-start space-x-2 pt-1 border-t transition-colors ${
                      isDarkTheme
                        ? 'border-[rgba(194,162,101,0.15)]'
                        : 'border-[#F2ECE3]'
                    }`}
                  >
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B] mt-0.5">
                      EN
                    </span>
                    <span
                      className={`${
                        fontStyle === 'serif' ? 'font-serif font-medium' : 'font-sans font-medium'
                      } text-base leading-relaxed ${
                        isDarkTheme
                          ? 'text-[#FAF8F5] drop-shadow-[0_1px_6px_rgba(223,202,155,0.18)]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      {item.english}
                    </span>
                  </div>
                </div>
              ))}

              {/* Active Partial Stream Card */}
              {activePartial && (
                <div
                  className={`p-4 rounded-lg border-2 space-y-2 shadow-sm animate-subtle-pulse transition-all ${
                    isDarkTheme
                      ? 'bg-[#22201D] border-[#C2A265] shadow-lg shadow-[#C2A265]/10'
                      : 'bg-[#FFFDF9] border-[#C2A265]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[#C2A265] font-sans tracking-widest uppercase font-bold">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C2A265] animate-ping" />
                      <span>Live Speech Interpretation</span>
                    </span>
                    <span className="font-mono text-stone-400 font-normal">{activePartial.timestamp}</span>
                  </div>
                  {activePartial.chinese && (
                    <div className="flex items-start space-x-2">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase border mt-0.5 ${
                          isDarkTheme
                            ? 'bg-stone-800 border-stone-700 text-stone-300'
                            : 'bg-stone-200 border-stone-300 text-stone-700'
                        }`}
                      >
                        ZH
                      </span>
                      <span
                        className={`text-sm font-sans ${
                          isDarkTheme ? 'text-stone-300' : 'text-stone-600'
                        }`}
                      >
                        {activePartial.chinese}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-start space-x-2 pt-1 border-t transition-colors ${
                      isDarkTheme
                        ? 'border-[rgba(194,162,101,0.2)]'
                        : 'border-[#F2ECE3]'
                    }`}
                  >
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase bg-[#C2A265]/20 border border-[#C2A265]/40 text-[#DFCA9B] mt-0.5">
                      EN
                    </span>
                    <span
                      className={`${
                        fontStyle === 'serif' ? 'font-serif font-semibold' : 'font-sans font-semibold'
                      } text-base leading-relaxed ${
                        isDarkTheme
                          ? 'text-[#FAF8F5] drop-shadow-[0_1px_8px_rgba(223,202,155,0.22)]'
                          : 'text-[#1C1A17]'
                      }`}
                    >
                      <span>{activePartial.english}</span>
                      <span className="w-1.5 h-4 bg-[#C2A265] animate-pulse ml-1 inline-block align-middle" />
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

