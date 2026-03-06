import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

/** Table and columns (existing Supabase schema) */
const FACE_TABLE = process.env.SUPABASE_FACE_TABLE ?? 'profiles';
const FACE_FRONT_URL_COLUMN = process.env.SUPABASE_FACE_FRONT_URL_COLUMN ?? '';
const FACE_LEFT_URL_COLUMN = process.env.SUPABASE_FACE_LEFT_URL_COLUMN ?? '';
const FACE_RIGHT_URL_COLUMN = process.env.SUPABASE_FACE_RIGHT_URL_COLUMN ?? '';
const USER_ID_COLUMN = process.env.SUPABASE_USER_ID_COLUMN ?? 'id';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_SECRET) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET must be set');
    }
    client = createClient(SUPABASE_URL, SUPABASE_SECRET);
  }
  return client;
}

/** Fetch stored face photo URLs (front, left, right) by userId. Returns non-null URLs only. */
export async function getStoredFacePhotoUrls(userId: string): Promise<string[]> {
  const columns = [FACE_FRONT_URL_COLUMN, FACE_LEFT_URL_COLUMN, FACE_RIGHT_URL_COLUMN].filter(
    (c): c is string => Boolean(c)
  );
  if (columns.length === 0) return [];

  const columnsStr = columns.join(', ');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(FACE_TABLE)
    .select(columnsStr)
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`);
  }

  if (!data || typeof data !== 'object') return [];

  return columns
    .map((col) => (data as Record<string, unknown>)[col])
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}
