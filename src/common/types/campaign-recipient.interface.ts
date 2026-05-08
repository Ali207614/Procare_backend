import { User } from 'src/common/types/user.interface';

export interface ICampaignRecipient {
  id: string;
  campaign_id: string;
  user_id: string;
  message_id?: number;
  variant_template_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'blocked' | 'unsubscribed';
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  error?: string;
  created_at: Date;
  updated_at: Date;

  user: User;
}
