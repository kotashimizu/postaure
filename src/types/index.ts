export * from './settings';

// Common image data interface used across the application
export interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}

// Analysis result types
export interface PostureAnalysisResult {
  frontalLandmarks: NormalizedLandmark[];
  sagittalLandmarks: NormalizedLandmark[];
  scores: PostureScores;
  angles: PostureAngles;
  assessments: PostureAssessment[];
  timestamp: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PostureScores {
  overallScore: number;
  frontalScore: number;
  sagittalScore: number;
}

export interface PostureAngles {
  headTilt?: number;
  shoulderTilt?: number;
  hipTilt?: number;
  forwardHeadAngle?: number;
  thoracicKyphosis?: number;
  lumbarLordosis?: number;
  pelvicTilt?: number;
}

export interface PostureAssessment {
  type: 'frontal' | 'sagittal' | 'overall';
  issue: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation?: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

// API types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}

// Service types
export type ServiceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ServiceState {
  status: ServiceStatus;
  error?: string;
}