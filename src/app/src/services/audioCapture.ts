/**
 * Audio capture service for capturing microphone audio via Web Audio API,
 * downsampling to 16,000 Hz mono 16-bit linear PCM, and streaming over WebSocket.
 */

export interface AudioCaptureCallbacks {
  onAudioLevel?: (level: number) => void;
  onError?: (err: Error) => void;
  onStateChange?: (isRecording: boolean) => void;
}

export function resolveWsUrl(endpoint: string, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // When running under Vite dev server (e.g. port 5173), direct connect to backend on port 8000
  // avoids Vite dev proxy latency and potential node websocket proxy drops with binary audio streaming.
  if (window.location.port === '5173') {
    return `${protocol}//${window.location.hostname}:8000${endpoint}`;
  }
  return `${protocol}//${window.location.host}${endpoint}`;
}

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private websocket: WebSocket | null = null;
  private isRecording = false;
  private isMuted = false;
  private targetSampleRate = 16000;
  private callbacks: AudioCaptureCallbacks;

  constructor(callbacks: AudioCaptureCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public get recording(): boolean {
    return this.isRecording;
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Start microphone capture and WebSocket streaming to the backend.
   */
  public async start(wsUrl?: string): Promise<void> {
    if (this.isRecording) return;

    try {
      // 1. Request microphone access with acoustic settings optimized for speech recognition
      // Note: Setting aggressive noiseSuppression=true often clips initial Chinese consonants (zh/ch/sh/j/q/x).
      // We set ideal constraints so browsers preserve consonant frequency fidelity and phonetic dynamics.
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: true },
        },
      });

      // 2. Resolve WebSocket endpoint
      const url = resolveWsUrl('/ws/speaker', wsUrl);

      this.websocket = new WebSocket(url);
      this.websocket.binaryType = 'arraybuffer';

      await new Promise<void>((resolve, reject) => {
        if (!this.websocket) return reject(new Error('WebSocket initialization failed'));

        const timer = setTimeout(() => {
          reject(new Error(`WebSocket connection to ${url} timed out (5s)`));
        }, 5000);

        this.websocket.onopen = () => {
          clearTimeout(timer);
          resolve();
        };

        this.websocket.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error(
              `Cannot connect to WebSocket at ${url}. Please verify that the backend is running on port 8000 (\`make service-up\`).`
            )
          );
        };

        this.websocket.onclose = (event) => {
          this.stop();
          if (event.code === 4401 || event.code === 4409) {
            if (this.callbacks.onError) {
              this.callbacks.onError(new Error(event.reason || 'Connection rejected by server.'));
            }
          }
        };
      });

      // 3. Setup Web Audio API pipeline with native 16kHz hardware resampling
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        // Modern Chrome/Safari/Edge natively resample mic input to 16kHz via OS-level bandlimited sinc filter
        this.audioContext = new AudioCtx({ sampleRate: 16000 });
      } catch {
        this.audioContext = new AudioCtx();
      }
      const inputSampleRate = this.audioContext.sampleRate;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessorNode bufferSize = 2048 (~42ms at 48kHz, ~128ms at 16kHz) for lower capture latency
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRecording || this.isMuted) {
          if (this.callbacks.onAudioLevel) this.callbacks.onAudioLevel(0);
          return;
        }

        const inputChannelData = e.inputBuffer.getChannelData(0);

        // Compute local RMS energy for immediate VU meter response
        let sumSquares = 0;
        for (let i = 0; i < inputChannelData.length; i++) {
          const sample = inputChannelData[i];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / inputChannelData.length);
        const levelPercent = Math.min(100, Math.round(rms * 250));
        if (this.callbacks.onAudioLevel) {
          this.callbacks.onAudioLevel(levelPercent);
        }

        // Downsample to 16,000 Hz if hardware sample rate is higher
        const pcm16Data = this.downsampleTo16kHz(inputChannelData, inputSampleRate, this.targetSampleRate);

        // Send 16-bit linear PCM binary frame through WebSocket
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(pcm16Data.buffer as ArrayBuffer);
        }
      };

      this.sourceNode.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
    } catch (err: unknown) {
      this.stop();
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.callbacks.onError) this.callbacks.onError(error);
      throw error;
    }
  }

  /**
   * Stop microphone capture and close audio/WebSocket resources cleanly.
   */
  public stop(): void {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
      }
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.websocket) {
      try {
        if (this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.close(1000, 'User stopped streaming');
        }
      } catch {
        // Ignore close error
      }
      this.websocket = null;
    }

    if (this.callbacks.onAudioLevel) this.callbacks.onAudioLevel(0);
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(false);
  }

  /**
   * High-fidelity downsampling of Float32 audio to 16kHz Int16 PCM.
   * If AudioContext is already at 16,000 Hz, performs direct conversion without resampling.
   * Otherwise uses linear interpolation to prevent muffling of high-frequency speech consonants.
   */
  private downsampleTo16kHz(
    buffer: Float32Array,
    inputSampleRate: number,
    targetSampleRate: number
  ): Int16Array {
    if (inputSampleRate === targetSampleRate) {
      const result = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return result;
    }

    const sampleRateRatio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    const filterRadius = Math.max(1, Math.floor(sampleRateRatio / 2));

    for (let i = 0; i < newLength; i++) {
      const centerPos = i * sampleRateRatio;
      const start = Math.max(0, Math.floor(centerPos - filterRadius));
      const end = Math.min(buffer.length, Math.ceil(centerPos + filterRadius + 1));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += buffer[j];
        count++;
      }
      const averaged = count > 0 ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, averaged));
      result[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    return result;
  }
}
