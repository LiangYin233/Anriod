const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
}

function timestamp() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

export const logger = {
  info: (msg: string, ...args: any[]) => {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}INFO${colors.reset}  ${msg}`, ...args)
  },
  success: (msg: string, ...args: any[]) => {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}OK${colors.reset}    ${msg}`, ...args)
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${msg}`, ...args)
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset} ${msg}`, ...args)
  }
}
