import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

/** Table and columns (existing Supabase schema) */
const FACE_TABLE = process.env.SUPABASE_FACE_TABLE ?? 'profiles';
const FACE_EMBEDDING_COLUMN = process.env.SUPABASE_FACE_EMBEDDING_COLUMN ?? 'face_embedding';
const FACE_URL_PHOTO_COLUMN = process.env.SUPABASE_FACE_URL_PHOTO_COLUMN ?? '';
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

export type StoredDescriptor = number[];

/** Fetch stored face embedding (array) by userId. Returns null if column missing or empty. */
export async function getStoredDescriptor(
  userId: string
): Promise<StoredDescriptor | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(FACE_TABLE)
    .select(FACE_EMBEDDING_COLUMN)
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`);
  }

  const raw = (data as Record<string, unknown>)?.[FACE_EMBEDDING_COLUMN];
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') return JSON.parse(raw) as number[];
  return null;
}

/** Fetch stored face photo URL by userId. Use when schema has face_photo_url (no embedding). */
export async function getStoredFacePhotoUrl(userId: string): Promise<string | null> {
  if (!FACE_URL_PHOTO_COLUMN) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(FACE_TABLE)
    .select(FACE_URL_PHOTO_COLUMN)
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`);
  }

  const url = (data as Record<string, unknown>)?.[FACE_URL_PHOTO_COLUMN];
  return typeof url === 'string' && url.length > 0 ? url : null;
}
