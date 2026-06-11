import type { DiscoverSection, MediaDetails, MediaType, SearchResult } from '@anriod/shared'

export interface DataSource {
  name: string
  /** Supported media types for this data source */
  supportedTypes: MediaType[]
  search(query: string, mediaType?: MediaType): Promise<SearchResult[]>
  getDetails(sourceId: string, mediaType?: MediaType): Promise<MediaDetails>
  getDiscover?(): Promise<DiscoverSection[]>
  downloadCover?(coverUrl: string, savePath: string): Promise<void>
}
