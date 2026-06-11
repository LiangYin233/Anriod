import { $ } from 'bun'
import { config } from '../config'

/**
 * Get the active proxy. Priority: config.yaml > env vars > Windows registry.
 */
function getProxy(): string | undefined {
  // 1. explicit config.yaml
  if (config.proxy) return config.proxy

  // 2. auto-detect from standard env vars (Clash, v2ray, etc.)
  const envCandidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy
  ]
  for (const p of envCandidates) {
    if (p && p.trim()) return p.trim()
  }

  // 3. Windows registry (system proxy settings)
  if (process.platform === 'win32') {
    return getWindowsProxy()
  }

  return undefined
}

function getWindowsProxy(): string | undefined {
  try {
    // Query the Windows registry for proxy settings
    const output = Bun.spawnSync(['reg', 'query', 
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
      '/v', 'ProxyEnable'
    ])
    const enabled = output.stdout.toString()
    if (!enabled.includes('0x1')) return undefined

    const serverOut = Bun.spawnSync(['reg', 'query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', 
      '/v', 'ProxyServer'
    ])
    const serverLine = serverOut.stdout.toString()
    const match = serverLine.match(/ProxyServer\s+REG_SZ\s+(\S+)/)
    if (match) {
      let proxy = match[1].trim()
      // If no protocol prefix, add http://
      if (!proxy.startsWith('http://') && !proxy.startsWith('https://') && !proxy.startsWith('socks')) {
        proxy = `http://${proxy}`
      }
      return proxy
    }
  } catch {
    // reg query not available or failed
  }
  return undefined
}

export function proxyFetchOptions(): RequestInit {
  const proxy = getProxy()
  if (!proxy) return {}
  return { proxy } as RequestInit & { proxy?: string }
}
