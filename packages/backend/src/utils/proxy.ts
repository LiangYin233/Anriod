import { config } from '../config'

/**
 * Get the active proxy. Priority: config.yaml > system env vars > undefined.
 */
function getProxy(): string | undefined {
  // 1. explicit config.yaml
  if (config.proxy) return config.proxy

  // 2. auto-detect from standard env vars (Clash, v2ray, etc.)
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy
  ]
  for (const p of candidates) {
    if (p && p.trim()) return p.trim()
  }

  return undefined
}

export function proxyFetchOptions(): RequestInit {
  const proxy = getProxy()
  if (!proxy) return {}
  return { proxy } as RequestInit & { proxy?: string }
}
