export interface ICampaign {
  id: string;
  template_id: string;
  filters: Record<string, any>;
  send_type: 'now' | 'schedule';
  schedule_at?: Date;
  ab_test?: Record<string, any>;
  status: 'queued' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}
