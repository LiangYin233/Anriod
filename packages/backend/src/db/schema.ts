import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { MediaProgress, MediaType, Status } from '@anriod/shared'

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    type: text('type').$type<MediaType>().notNull(),

    status: text('status').$type<Status>().notNull().default('plan_to_watch'),
    rating: real('rating'),
    notes: text('notes'),
    currentProgress: text('current_progress', { mode: 'json' }).$type<MediaProgress>(),

    coverUrl: text('cover_url'),
    coverLocalPath: text('cover_local_path'),
    description: text('description'),
    externalRating: real('external_rating'),
    airDate: text('air_date'),
    totalEpisodes: integer('total_episodes'),
    studio: text('studio'),
    sourceMetadata: text('source_metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

    source: text('source'),
    sourceId: text('source_id'),
    sourceUrl: text('source_url'),
    syncedAt: text('synced_at'),

    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    typeIdx: index('idx_media_type').on(table.type),
    statusIdx: index('idx_media_status').on(table.status),
    sourceIdx: index('idx_media_source').on(table.source, table.sourceId),
    updatedIdx: index('idx_media_updated').on(table.updatedAt)
  })
)

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
})

export const mediaTags = sqliteTable(
  'media_tags',
  {
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.tagId] }),
    mediaIdx: index('idx_media_tags_media').on(table.mediaId),
    tagIdx: index('idx_media_tags_tag').on(table.tagId)
  })
)

export const watchHistory = sqliteTable(
  'watch_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    progressFrom: text('progress_from', { mode: 'json' }).$type<MediaProgress>(),
    progressTo: text('progress_to', { mode: 'json' }).$type<MediaProgress>(),
    rating: real('rating'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    mediaIdx: index('idx_watch_history_media').on(table.mediaId),
    dateIdx: index('idx_watch_history_date').on(table.startedAt)
  })
)
