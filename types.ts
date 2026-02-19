
export type ScriptFormat = 'tamil' | 'tanglish';

export interface ScriptLineVersions {
  spoken: string;
  tanglish: string;
  syncShort: string;
}

export interface ScriptLine {
  person: string;
  startTime: string;
  endTime: string;
  dialogue: string; // Legacy support
  versions: ScriptLineVersions;
  emotion?: string;
  confidenceScore?: number;
  actionDescription?: string;
  originalMeaning?: string;
}

export interface ProcessingState {
  isProcessing: boolean;
  step: number;
  message: string;
}

export type AppTab = 'script' | 'visuals' | 'analysis' | 'audio' | 'history';

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  scriptsGenerated: number;
  lastLogin?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ─── History Types ───────────────────────────────────────────────────────────

export interface HistoryRecord {
  _id: string;
  videoName: string;
  videoSize: number;
  videoType: string;
  format: ScriptFormat;
  script?: ScriptLine[];
  totalLines: number;
  duration?: string;
  status: 'completed' | 'failed' | 'processing';
  exportedAt?: string;
  createdAt: string;
  user?: { name: string; email: string };
}
