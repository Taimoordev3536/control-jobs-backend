export interface SaveResult {
  ref: string;
}

export interface StorageProvider {
  key: string;
  label: string;
  isConnected(): Promise<boolean>;
  save(filename: string, buffer: Buffer, settings?: any): Promise<SaveResult>;
  load(ref: string): Promise<Buffer>;
  remove(ref: string): Promise<void>;
}
