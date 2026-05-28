export interface UploadProgress {
  ratio: number;
  loaded: number;
  total: number;
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadResult {
  id: string;
  status: string;
}
