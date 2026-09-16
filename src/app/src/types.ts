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
  transcribe_model: string;
  translation_model: string;
  source_language: string;
  target_language: string;
  wedding: WeddingContextData;
  enable_live_audio_stream: boolean;
}

export type ViewMode = 'projector' | 'speaker' | 'mobile';

export type SubtitleLayoutMode = 'stacked' | 'side-by-side' | 'english';

export type SubtitleFontStyle = 'serif' | 'sans';

export interface LiveEvent {
  type: 'init' | 'partial' | 'interim' | 'final' | 'interrupted' | 'transcript_cleared' | 'audio_level' | 'session_status';
  id?: number;
  chinese?: string;
  english?: string;
  timestamp?: string;
  level?: number;
  status?: string;
  history?: SubtitleItem[];
  wedding?: WeddingContextData;
  transcribe_model?: string;
  translation_model?: string;
  source_language?: string;
  target_language?: string;
}
