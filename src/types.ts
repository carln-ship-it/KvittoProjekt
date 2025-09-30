export interface ReceiptItem {
  id?: number;
  receiptId?: number;
  description: string | null;
  quantity: number | null;
  price: number | null;
}

export interface ExtractedReceiptData {
  id?: number;
  fileName?: string;
  date: string | null;
  storeName: string | null;
  normalizedStoreName?: string | null;
  items: ReceiptItem[];
  totalAmount: number | null;
  currency: string | null;
  vatAmount: number | null;
  error?: string; // Fält för att fånga fel per objekt i en batch
}

export interface ProcessedFile {
  fileName: string;
  status: 'queued' | 'pending' | 'processing' | 'success' | 'error';
  data?: ExtractedReceiptData;
  error?: string;
  file: File;
}