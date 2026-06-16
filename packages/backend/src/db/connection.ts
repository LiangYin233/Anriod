import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config'

mkdirSync(dirname(config.databasePath), { recursive: true })
mkdirSync(config.coversDir, { recursive: true })

export const sqlite = new Database(config.databasePath)
sqlite.run('PRAGMA foreign_keys = ON')
