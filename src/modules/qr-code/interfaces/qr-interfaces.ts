export interface QrValidationResult {
  valid: boolean;
  workCenterId?: number;
  workCenterName?: string;
  qrType?: 'static' | 'dynamic';
  message?: string;
}

export interface MergedQrData {
  workCenters: {
    id: number;
    name: string;
    tokens: string[];
    type: 'static' | 'dynamic' | 'both';
  }[];
  jobId: number;
  generatedAt: string;
}

export interface MergedQrResponse {
  qrImage: string;
  mergedToken: string;
  workCenters: {
    id: number;
    name: string;
    qrType: 'static' | 'dynamic';
    address?: string;
  }[];
  expiresAt: Date | null;
  refreshInterval: number;
  generatedAt: Date;
}
