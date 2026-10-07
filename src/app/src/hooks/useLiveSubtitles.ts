import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveWsUrl } from '../services/audioCapture';
import type { BackendConfig, LiveEvent, SubtitleItem, TranslationSessionInfo, WeddingContextData } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useLiveSubtitles() {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [activePartial, setActivePartial] = useState<SubtitleItem | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [sessionInfo, setSessionInfo] = useState<TranslationSessionInfo>({
    session_id: 'session_init',
    session_number: 1,
    session_title: 'Ceremony Speeches',
  });
  const [wedding, setWedding] = useState<WeddingContextData>({
    bride_name: 'Joy',
    groom_name: 'Xinrong',
    speaker_role: 'Guest',
    custom_notes: '',
  });
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const apiBase = window.location.port === '5173' ? `http://${window.location.hostname}:8000` : '';

  // Fetch initial REST config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/config`);
      if (res.ok) {
        const data: BackendConfig = await res.json();
        setBackendConfig(data);
        if (data.wedding) {
          setWedding(data.wedding);
        }
        if (data.session_id) {
          setSessionInfo({
            session_id: data.session_id,
            session_number: data.session_number ?? 1,
            session_title: data.session_title ?? 'Ceremony Speeches',
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch backend configuration:', err);
    }
  }, [apiBase]);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus('connecting');
    const wsUrl = resolveWsUrl('/ws/subtitles');

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;

      // Start keepalive ping every 15 seconds
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;

      try {
        const data: LiveEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'init':
            if (data.history) setSubtitles(data.history);
            if (data.wedding) setWedding(data.wedding);
            if (data.session_id) {
              setSessionInfo({
                session_id: data.session_id,
                session_number: data.session_number ?? 1,
                session_title: data.session_title ?? 'Ceremony Speeches',
              });
            }
            break;

          case 'new_session':
            setSubtitles([]);
            setActivePartial(null);
            if (data.session_id) {
              setSessionInfo({
                session_id: data.session_id,
                session_number: data.session_number ?? 1,
                session_title: data.session_title ?? 'Speech Session',
                timestamp: data.timestamp,
              });
            }
            break;

          case 'partial':
          case 'interim':
            if (data.chinese !== undefined || data.english !== undefined) {
              setActivePartial((prev) => ({
                id: data.id ?? prev?.id ?? Date.now(),
                chinese:
                  data.chinese !== undefined && data.chinese !== ''
                    ? data.chinese
                    : (prev?.chinese ?? ''),
                english:
                  data.english !== undefined && data.english !== ''
                    ? data.english
                    : (prev?.english ?? ''),
                timestamp:
                  data.timestamp ?? prev?.timestamp ?? new Date().toLocaleTimeString(),
                isPartial: true,
                is_interim: data.is_interim ?? false,
              }));
            }
            break;

          case 'final':
            setActivePartial(null);
            if (data.chinese || data.english) {
              const newRecord: SubtitleItem = {
                id: data.id ?? Date.now(),
                chinese: data.chinese ?? '',
                english: data.english ?? '',
                timestamp: data.timestamp ?? new Date().toLocaleTimeString(),
                isPartial: false,
              };
              setSubtitles((prev) => {
                const existingIndex = prev.findIndex((s) => s.id === newRecord.id);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = newRecord;
                  return updated;
                }
                return [...prev, newRecord];
              });
            }
            break;

          case 'interrupted':
            // Model detected user interruption / barge-in. Clear live partial; backend finalizes if applicable.
            setActivePartial(null);
            break;

          case 'transcript_cleared':
            setSubtitles([]);
            setActivePartial(null);
            break;

          case 'audio_level':
            if (typeof data.level === 'number') {
              setAudioLevel(data.level);
            }
            break;

          case 'session_status':
            setIsSessionActive(data.status === 'live' || data.status === 'connected');
            break;
        }
      } catch (e) {
        console.error('Failed to parse subtitle event:', e);
      }
    };

    ws.onerror = (e) => {
      console.warn('Subtitle WebSocket error:', e);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Exponential backoff reconnect: 1s, 2s, 4s, max 10s
      const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttemptsRef.current));
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = window.setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    fetchConfig();
    connect();

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, fetchConfig]);

  const createNewSession = useCallback(
    async (title?: string) => {
      try {
        const res = await fetch(`${apiBase}/api/session/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title || undefined }),
        });
        if (res.ok) {
          const data = await res.json();
          setSubtitles([]);
          setActivePartial(null);
          setSessionInfo({
            session_id: data.session_id,
            session_number: data.session_number,
            session_title: data.session_title,
            timestamp: data.timestamp,
          });
          return true;
        }
      } catch (err) {
        console.error('Failed to create new session:', err);
      }
      return false;
    },
    [apiBase]
  );

  const clearTranscript = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/transcript/clear`, { method: 'POST' });
      if (res.ok) {
        setSubtitles([]);
        setActivePartial(null);
      }
    } catch (err) {
      console.error('Failed to clear transcript:', err);
    }
  }, [apiBase]);

  const exportTranscript = useCallback(
    (format: 'markdown' | 'csv' = 'markdown') => {
      window.open(`${apiBase}/api/transcript/export?format=${format}`, '_blank');
    },
    [apiBase]
  );

  return {
    subtitles,
    activePartial,
    connectionStatus,
    audioLevel,
    isSessionActive,
    sessionInfo,
    wedding,
    backendConfig,
    createNewSession,
    clearTranscript,
    exportTranscript,
    reconnect: connect,
  };
}
