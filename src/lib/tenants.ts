/**
 * Organizasyon (büro) tipi.
 * Veri Supabase'de tutulur; bu dosya yalnızca paylaşılan tipi sağlar.
 */

export type Organization = {
  id: string;
  name: string;
  createdAt: string;
  active: boolean;
};
