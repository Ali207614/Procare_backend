export interface ITemplate {
  id: string;
  title: string;
  language: 'uz' | 'ru' | 'en';
  body: string;
  variables?: string[];
  status: 'Draft' | 'Open' | 'Deleted';
  created_by: string;
  used_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ITemplateHistory {
  id: string;
  template_id: string;
  version: number;
  body: string;
  variables?: string[];
  author_id: string;
  updated_at: Date;
}

export interface ITemplateWithHistories extends ITemplate {
  histories: ITemplateHistory[];
}
