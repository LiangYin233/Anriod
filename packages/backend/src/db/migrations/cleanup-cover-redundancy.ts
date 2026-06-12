/**
 * Migration: Cleanup cover URL redundancy
 *
 * For media with both cover_url and cover_local_path set,
 * clear the remote cover_url to avoid data redundancy.
 *
 * This is a one-time cleanup migration.
 */

import { all, run } from '../helpers'

export function cleanupCoverRedundancy() {
  const media = all<{ id: string; cover_url: string | null; cover_local_path: string | null }>(
    'SELECT id, cover_url, cover_local_path FROM media WHERE cover_url IS NOT NULL AND cover_local_path IS NOT NULL'
  )

  if (media.length === 0) {
    console.log('✓ No redundant cover URLs found')
    return
  }

  console.log(`Found ${media.length} media with redundant cover URLs`)

  for (const item of media) {
    run('UPDATE media SET cover_url = NULL WHERE id = ?', [item.id])
  }

  console.log(`✓ Cleaned up ${media.length} redundant cover URLs`)
}

// Run migration if executed directly
if (import.meta.main) {
  cleanupCoverRedundancy()
}
