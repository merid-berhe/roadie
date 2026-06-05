import { deriveIdentity, type GlyphIdentity } from '@roadie/shared';
import { supabase, supabaseConfigured } from '../lib/supabase';

const LOCAL_ID_KEY = 'roadie.localUserId';

export type Session = { userId: string; identity: GlyphIdentity };

/**
 * Establish the anonymous-persistent identity (§6). With Supabase configured,
 * signInAnonymously() yields a stable user_id (persisted by supabase-js) and we
 * best-effort upsert the §14 users row. Without keys, fall back to a local UUID
 * so M0 runs offline. Either way the glyph is derived from the id, so identity
 * is stable across refresh — the M0 acceptance criterion.
 */
export async function ensureIdentity(): Promise<Session> {
  if (supabaseConfigured && supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let userId = session?.user?.id ?? null;
    if (!userId) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      userId = data.user?.id ?? null;
    }
    if (!userId) throw new Error('Anonymous sign-in returned no user id.');

    const identity = deriveIdentity(userId);
    // Best-effort: the users table arrives with the §14 schema (by M6). If it
    // isn't there yet this resolves with an error we ignore — identity is still
    // stable from the id.
    await supabase
      .from('users')
      .upsert({ id: userId, glyph: identity.glyph, color: identity.color }, { onConflict: 'id' });

    return { userId, identity };
  }

  // Local fallback so M0 runs before Supabase keys are wired.
  let userId = localStorage.getItem(LOCAL_ID_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(LOCAL_ID_KEY, userId);
  }
  return { userId, identity: deriveIdentity(userId) };
}
