import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function cleanEnvValue(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

const rawSupabaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL
    : '';

const rawSupabaseAnonKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : '';

const supabaseUrl = cleanEnvValue(rawSupabaseUrl);
const supabaseAnonKey = cleanEnvValue(rawSupabaseAnonKey);

console.log('[Supabase Init]', {
  supabaseUrl,
  supabaseAnonKeyPrefix: supabaseAnonKey.slice(0, 15),
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function requireSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.',
    );
  }
  return supabase;
}
