export interface ICampaignRecipient {
  id: string;
  campaign_id: string;
  user_id: string;
  message_id?: number;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'blocked' | 'unsubscribed';
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  error?: string;
  created_at: Date;
  updated_at: Date;
}