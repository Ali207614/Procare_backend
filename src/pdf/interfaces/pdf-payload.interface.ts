export interface PdfFormPayload {
  date: string;
  pin: string;
  customer_name: string;
  phone_number: string;
  device_name: string;
  imei: string;
  specialist_name: string;
  promo_code: string;
  repair_id: string;
  source: string;
}

export interface PdfChecklistItem {
  id: string;
  checked: boolean;
}

export interface PdfChecklist {
  display: PdfChecklistItem[];
  body: PdfChecklistItem[];
  'ports-1': PdfChecklistItem[];
  ports: PdfChecklistItem[];
  other: PdfChecklistItem[];
}

export interface PdfPayload {
  warranty_id: string;
  form: PdfFormPayload;
  pattern: number[];
  device_points: Record<string, { x: number; y: number }[]>;
  checklist: PdfChecklist;
  comments: string;
}
