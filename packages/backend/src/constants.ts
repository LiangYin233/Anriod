// Pagination constants
export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_PAGE = 100000
export const MAX_LIMIT = 100

// Rating constants
export const MIN_RATING = 0
export const MAX_RATING = 10

// Credits display limits
export const MAX_CAST_DISPLAY = 20
export const MAX_CREW_DISPLAY = 20

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: '未授权',
  NOT_FOUND: '未找到',
  INTERNAL_SERVER_ERROR: '服务器内部错误',
  INVALID_JSON: '无效的 JSON 数据',

  // Media errors
  TITLE_REQUIRED: '标题不能为空',
  INVALID_MEDIA_TYPE: '无效的媒体类型',
  INVALID_STATUS: '无效的状态',
  INVALID_RATING: '评分必须在 0-10 之间',
  MEDIA_NOT_FOUND: '媒体不存在',
  MEDIA_NO_SOURCE: '媒体没有绑定数据源',

  // Data source errors
  UNKNOWN_DATA_SOURCE: '未知或已禁用的数据源',
  NO_DATA_SOURCES: '没有启用的数据源，请检查 config.yaml',
  DATA_SOURCE_NO_CREDITS: '数据源不支持演职员表',
  SOURCE_ID_REQUIRED: 'source 和 source_id 参数必填',

  // Search errors
  SEARCH_QUERY_REQUIRED: '搜索关键词不能为空',

  // Tag errors
  TAG_NAME_REQUIRED: '标签名不能为空',
  TAG_NOT_FOUND: '标签不存在',
  TAG_CREATE_FAILED: '创建标签失败',

  // Record errors
  RECORD_NOT_FOUND: '观看记录不存在',
  RECORD_CREATE_FAILED: '创建观看记录失败',

  // Backup errors
  INVALID_EXPORT_FORMAT: '无效的导出数据格式',
  EXPORT_MISSING_ARRAYS: '导出数据缺少必需的数组字段',
} as const
