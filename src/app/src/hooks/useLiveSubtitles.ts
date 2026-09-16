import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveWsUrl } from '../services/audioCapture';
import type { BackendConfig, LiveEvent, SubtitleItem, WeddingContextData } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useLiveSubtitles() {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [activePartial, setActivePartial] = useState<SubtitleItem | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
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
            break;

          case 'partial':
          case 'interim':
            if (data.chinese !== undefined || data.english !== undefined) {
              setActivePartial({
                id: data.id ?? Date.now(),
                chinese: data.chinese ?? '',
                english: data.english ?? '',
                timestamp: data.timestamp ?? new Date().toLocaleTimeString(),
                isPartial: true,
              });
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
              setSubtitles((prev) => [...prev, newRecord]);
            }
            break;

          case 'interrupted':
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
    wedding,
    backendConfig,
    clearTranscript,
    exportTranscript,
    reconnect: connect,
  };
}
