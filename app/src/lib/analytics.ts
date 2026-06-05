// §13 instrumentation — writes to Supabase events table.
// Best-effort: never throws, never blocks the caller.
// Extend to PostHog by calling posthog.capture() alongside the insert.

import { supabase } from './supabase';

let _userId: string | null = null;
let _rideId: string | null = null;

export function setAnalyticsUser(id: string) { _userId = id; }
export function setAnalyticsRide(id: string)  { _rideId = id; }

export function track(name: string, props?: Record<string, unknown>) {
  if (!supabase) return; // Supabase not configured — skip silently
  supabase
    .from('events')
    .insert({ user_id: _userId, ride_id: _rideId, name, props: props ?? null })
    .then(({ error }) => { if (error) console.warn('[analytics]', name, error.message); });
}
