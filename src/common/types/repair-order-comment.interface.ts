export type RepairOrderCommentType = 'manual' | 'history';

export interface RepairOrderComment {
  id: string;
  repair_order_id: string;
  text: string;
  status: 'Open' | 'Deleted';
  comment_type: RepairOrderCommentType;
  history_change_id: string | null;
  created_by: string;
  status_by: string;
  created_at: string;
  updated_at: string;
}

export interface RepairOrderCommentResponse extends RepairOrderComment {
  is_editable: boolean;
  is_deletable: boolean;
  created_by_admin: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
  };
  repair_order_status: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
    can_user_view?: boolean | null;
  };
}
