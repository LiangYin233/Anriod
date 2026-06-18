import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { MediaProgress, MediaSource, MediaType, Status } from '@anriod/shared'

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    type: text('type').$type<MediaType>().notNull(),

    status: text('status').$type<Status>().notNull().default('plan_to_watch'),
    rating: real('rating'),

    cover_url: text('cover_url'),
    description: text('description'),
    external_rating: real('external_rating'),
    air_date: text('air_date'),
    total_episodes: integer('total_episodes'),
    studio: text('studio'),
    source_metadata: text('source_metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

    source: text('source').$type<MediaSource>(),
    source_id: text('source_id'),
    source_url: text('source_url'),
    synced_at: text('synced_at'),

    created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    typeIdx: index('idx_media_type').on(table.type),
    statusIdx: index('idx_media_status').on(table.status),
    sourceIdx: index('idx_media_source').on(table.source, table.source_id),
    updatedIdx: index('idx_media_updated').on(table.updated_at)
  })
)

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const mediaTags = sqliteTable(
  'media_tags',
  {
    media_id: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    tag_id: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.media_id, table.tag_id] }),
    mediaIdx: index('idx_media_tags_media').on(table.media_id),
    tagIdx: index('idx_media_tags_tag').on(table.tag_id)
  })
)

export const watchRecord = sqliteTable(
  'watch_record',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    media_id: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    episode: integer('episode'),
    chapter: integer('chapter'),
    watched_at: text('watched_at').notNull(),
    created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    mediaIdx: index('idx_wr_media').on(table.media_id),
    episodeIdx: index('idx_wr_ep').on(table.media_id, table.episode),
    chapterIdx: index('idx_wr_ch').on(table.media_id, table.chapter),
    dateIdx: index('idx_wr_date').on(table.watched_at)
  })
)

export type MediaRow = typeof media.$inferSelect
export type NewMediaRow = typeof media.$inferInsert
export type NewTagRow = typeof tags.$inferInsert
export type NewWatchRecordRow = typeof watchRecord.$inferInsert
