/**
 * supabaseServerClient.ts — Process-scoped singleton Supabase client.
 *
 * Every repository previously called createClient() in its constructor, so a
 * single page render building ~7 repositories created ~7 clients. The client
 * is stateless (service-role key, no per-user session), so one instance per
 * server process is safe to share across all repositories.
 *
 * Server-only: uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) and must never
 * be imported from client components.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Return the shared service-role Supabase client, creating it on first use.
 * Throws if the required environment variables are missing.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (client === null) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    client = createClient(url, key)
  }
  return client
}

/** Reset the singleton — intended for tests only. */
export function resetSupabaseServerClient(): void {
  client = null
}
