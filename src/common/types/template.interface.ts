export interface ITemplate {
  id: string;
  title: string;
  language: 'uz' | 'ru' | 'en';
  body: string;
  variables?: Record<string, any>;
  status: 'draft' | 'active' | 'archived';
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
  variables?: Record<string, any>;
  author_id: string;
  updated_at: Date;
}

export interface ITemplateWithHistories extends ITemplate {
  histories: ITemplateHistory[];
}
