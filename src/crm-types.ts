/** Native public UUID strings. The server validates their UUIDv7 format. */
export type PublicId = string;
export type Locale = 'es' | 'en' | 'ca';
export type Audience = 'internal' | 'portal' | 'public';
export type EmptyInput = Record<string, never>;
export interface DataEnvelope<Data> {
  data: Data;
}

export interface ReceiptInput {
  idempotency_key: string;
}
export interface ConfirmedInput extends ReceiptInput {
  /** Set only after human authorization of this concrete effect. */
  confirmed: true;
}
export interface ArticleIdentity {
  id: PublicId;
}
export interface ArticleCasInput extends ConfirmedInput, ArticleIdentity {
  expected_version: number;
}
export interface EditorialInput {
  title: string;
  body: string;
  editorial_locale: Locale;
  category_ids: PublicId[];
}
export interface CreateArticleInput extends ConfirmedInput, EditorialInput {
  expected_version: 0;
  slug: string;
}
export interface SaveCategoryInput extends ConfirmedInput {
  id?: PublicId;
  taxonomy_id: PublicId;
  expected_taxonomy_version: number;
  /** Explicit null creates a term; updates require the original positive term CAS. */
  expected_version: number | null;
  name: string;
  slug: string;
  parent_id: PublicId | null;
  visibility: Audience;
  status: 'active' | 'archived';
}
export type PublishCenterInput = ConfirmedInput & {
  slug: string;
  display_name: string;
  locale: Locale;
  article_slugs: string[];
} & ({ id?: never; expected_version: 0 } | { id: PublicId; expected_version: number });

export interface CrmInputs {
  search_knowledge_articles: { query?: string; locale?: Locale | null; page?: number; per_page?: number };
  get_knowledge_article: ArticleIdentity;
  get_knowledge_article_versions: ArticleIdentity;
  list_knowledge_categories: EmptyInput;
  suggest_service_articles: {
    ticket_id: PublicId;
    ticket_version: number;
    query?: string;
    locale?: Locale | null;
    audience?: Audience;
    limit?: number;
  };
  create_knowledge_article: CreateArticleInput;
  save_knowledge_article: ArticleCasInput & EditorialInput;
  submit_knowledge_article_review: ArticleCasInput;
  approve_knowledge_article: ArticleCasInput;
  publish_knowledge_article_version: ArticleCasInput & { published_version: number; audience: Audience };
  unpublish_knowledge_article: ArticleCasInput;
  archive_knowledge_article: ArticleCasInput;
  link_knowledge_article: ArticleCasInput & {
    target_type: 'ticket' | 'document';
    target_id: PublicId;
    target_version: number;
  };
  recover_knowledge_article_create_receipt: ReceiptInput;
  recover_knowledge_article_save_receipt: ReceiptInput;
  recover_knowledge_article_submit_receipt: ReceiptInput;
  recover_knowledge_article_approve_receipt: ReceiptInput;
  recover_knowledge_article_publish_receipt: ReceiptInput;
  recover_knowledge_article_unpublish_receipt: ReceiptInput;
  recover_knowledge_article_archive_receipt: ReceiptInput;
  recover_knowledge_article_link_receipt: ReceiptInput;
  save_knowledge_category: SaveCategoryInput;
  recover_knowledge_category_receipt: ReceiptInput;
  get_help_center_administration: EmptyInput;
  publish_help_center: PublishCenterInput;
  unpublish_help_center: ArticleCasInput;
  recover_help_center_publish_receipt: ReceiptInput;
  recover_help_center_unpublish_receipt: ReceiptInput;
}

/** Optional fields reflect the owner's current masks; omission never supplies a default. */
export interface KnowledgeArticle {
  id: PublicId;
  version: number;
  slug?: string;
  title?: string;
  body?: string;
  editorial_locale?: string;
  category_ids?: PublicId[];
  workflow_state?: string;
  revision_number?: number;
  review_state?: string;
  published_version?: number | null;
  audience?: Audience | null;
  archived?: boolean;
}
export interface ArticleReceipt<Operation extends string = string> {
  effect_id: PublicId;
  operation: Operation;
  expected_version: number;
  article: KnowledgeArticle;
  confirmed: true;
}
export type ArticleRevision = Pick<
  KnowledgeArticle,
  'id' | 'version' | 'title' | 'body' | 'editorial_locale' | 'category_ids' | 'review_state'
> & { revision_number: number };
export type SuggestedArticle = Pick<
  KnowledgeArticle,
  'id' | 'version' | 'slug' | 'title' | 'body' | 'editorial_locale' | 'review_state'
> &
  Required<Pick<KnowledgeArticle, 'revision_number' | 'published_version' | 'audience'>>;
export interface KnowledgeCategory {
  id: PublicId;
  version: number;
  taxonomy_id: PublicId;
  taxonomy_version: number;
  parent_id: PublicId | null;
  name: string;
  slug: string;
  visibility: string;
}
export interface CategoryReceipt {
  effect_id: PublicId;
  operation: 'knowledge_articles.category_save';
  expected_version: number | null;
  expected_taxonomy_version: number;
  category: Omit<KnowledgeCategory, 'name' | 'slug' | 'visibility'> & {
    name?: string;
    slug?: string;
    visibility?: string;
    status?: string;
  };
  confirmed: true;
}
export interface HelpCenter {
  id: PublicId;
  version: number;
  slug: string;
  display_name: string;
  locale: string;
  article_slugs: string[];
  enabled: boolean;
}
export interface HelpCenterReceipt<Operation extends string = string> {
  confirmed: true;
  operation: Operation;
  effect_id: PublicId;
  expected_version: number;
  center: HelpCenter;
}

export interface CrmOutputs {
  search_knowledge_articles: { items: KnowledgeArticle[]; total: number; page: number; per_page: number };
  get_knowledge_article: KnowledgeArticle;
  get_knowledge_article_versions: { items: ArticleRevision[] };
  list_knowledge_categories: { items: KnowledgeCategory[]; total: number };
  suggest_service_articles: {
    items: SuggestedArticle[];
    total: number;
    ticket_id: PublicId;
    ticket_version: number;
    audience: string;
  };
  create_knowledge_article: ArticleReceipt<'knowledge_articles.create'>;
  save_knowledge_article: ArticleReceipt<'knowledge_articles.save'>;
  submit_knowledge_article_review: ArticleReceipt<'knowledge_articles.submit'>;
  approve_knowledge_article: ArticleReceipt<'knowledge_articles.approve'>;
  publish_knowledge_article_version: ArticleReceipt<'knowledge_articles.publish'>;
  unpublish_knowledge_article: ArticleReceipt<'knowledge_articles.unpublish'>;
  archive_knowledge_article: ArticleReceipt<'knowledge_articles.archive'>;
  link_knowledge_article: ArticleReceipt<'knowledge_articles.link'>;
  recover_knowledge_article_create_receipt: ArticleReceipt<'knowledge_articles.create'>;
  recover_knowledge_article_save_receipt: ArticleReceipt<'knowledge_articles.save'>;
  recover_knowledge_article_submit_receipt: ArticleReceipt<'knowledge_articles.submit'>;
  recover_knowledge_article_approve_receipt: ArticleReceipt<'knowledge_articles.approve'>;
  recover_knowledge_article_publish_receipt: ArticleReceipt<'knowledge_articles.publish'>;
  recover_knowledge_article_unpublish_receipt: ArticleReceipt<'knowledge_articles.unpublish'>;
  recover_knowledge_article_archive_receipt: ArticleReceipt<'knowledge_articles.archive'>;
  recover_knowledge_article_link_receipt: ArticleReceipt<'knowledge_articles.link'>;
  save_knowledge_category: CategoryReceipt;
  recover_knowledge_category_receipt: CategoryReceipt;
  get_help_center_administration: { center: HelpCenter | null };
  publish_help_center: HelpCenterReceipt<'public_help_centers.publish'>;
  unpublish_help_center: HelpCenterReceipt<'public_help_centers.unpublish'>;
  recover_help_center_publish_receipt: HelpCenterReceipt<'public_help_centers.publish'>;
  recover_help_center_unpublish_receipt: HelpCenterReceipt<'public_help_centers.unpublish'>;
}
