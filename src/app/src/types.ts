export interface SubtitleItem {
  id: number;
  chinese: string;
  english: string;
  timestamp: string;
  isPartial?: boolean;
}

export interface WeddingContextData {
  bride_name: string;
  groom_name: string;
  speaker_role: string;
  custom_notes: string;
}

export interface BackendConfig {
  project_id: string;
  location: string;
  live_model: string;
  use_vertex: boolean;
  source_language: string;
  target_language: string;
  wedding: WeddingContextData;
  google_oauth_client_id: string | null;
}

export type ViewMode = 'projector' | 'speaker' | 'mobile';

export type SubtitleLayoutMode = 'stacked' | 'side-by-side' | 'english';

export type SubtitleFontStyle = 'serif' | 'sans';

export interface LiveEvent {
  type: 'init' | 'partial' | 'interim' | 'final' | 'interrupted' | 'transcript_cleared' | 'audio_level' | 'session_status' | 'error';
  id?: number;
  chinese?: string;
  english?: string;
  timestamp?: string;
  level?: number;
  status?: string;
  live_model?: string;
  use_vertex?: boolean;
  history?: SubtitleItem[];
  wedding?: WeddingContextData;
  source_language?: string;
  target_language?: string;
  error?: string;
}
