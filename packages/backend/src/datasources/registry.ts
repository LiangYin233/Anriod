import { config } from '../config'
import { BangumiDataSource } from './bangumi'
import type { DataSource } from './types'

const registeredSources: Record<string, DataSource> = {}

if (config.datasources.bangumi?.enabled) {
  registeredSources.bangumi = new BangumiDataSource()
}

export const dataSources = registeredSources

export function getDataSource(name: string): DataSource | undefined {
  return dataSources[name]
}

export function listDataSources(): string[] {
  return Object.keys(dataSources)
}
