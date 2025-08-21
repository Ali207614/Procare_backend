export interface ICampaign {
  id: string;
  template_id: string;
  filters: Record<string, any>;
  send_type: 'now' | 'schedule';
  schedule_at?: Date;
  status: 'queued' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed' | 'canceled';
  created_at: Date;
  updated_at: Date;
  ab_test: {
    enabled: boolean;
    variants: {
      name: string;
      template_id: string;
      percentage: number;
    }[];
  } | null;
}
