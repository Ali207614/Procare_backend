export interface ICampaignRecipient {
  id: string;
  campaign_id: string;
  user_id: string;
  message_id?: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'blocked' | 'unsubscribed';
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  variant_template_id?: string;
  error?: string;
  created_at: Date;
  updated_at: Date;
}
