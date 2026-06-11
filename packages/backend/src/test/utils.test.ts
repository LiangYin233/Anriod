import { describe, test, expect } from 'bun:test'
import { isMediaType, isStatus, toInt, parseJsonField, jsonString } from '../utils/http'
import { HttpError } from '../middleware/error'

// Pure functions — no DB needed

describe('isMediaType', () => {
  test('recognises valid types', () => {
    expect(isMediaType('anime')).toBe(true)
    expect(isMediaType('movie')).toBe(true)
    expect(isMediaType('tv')).toBe(true)
    expect(isMediaType('game')).toBe(true)
    expect(isMediaType('novel')).toBe(true)
    expect(isMediaType('manga')).toBe(true)
  })

  test('rejects invalid types', () => {
    expect(isMediaType('comic')).toBe(false)
    expect(isMediaType('')).toBe(false)
    expect(isMediaType(undefined)).toBe(false)
    expect(isMediaType(null)).toBe(false)
    expect(isMediaType(123)).toBe(false)
  })
})

describe('isStatus', () => {
  test('recognises valid statuses', () => {
    expect(isStatus('plan_to_watch')).toBe(true)
    expect(isStatus('watching')).toBe(true)
    expect(isStatus('completed')).toBe(true)
    expect(isStatus('on_hold')).toBe(true)
    expect(isStatus('dropped')).toBe(true)
  })

  test('rejects invalid statuses', () => {
    expect(isStatus('paused')).toBe(false)
    expect(isStatus('')).toBe(false)
    expect(isStatus(undefined)).toBe(false)
  })
})

describe('toInt', () => {
  test('parses valid numbers', () => {
    expect(toInt('5', 1)).toBe(5)
    expect(toInt('42', 1)).toBe(42)
  })

  test('returns fallback for invalid input', () => {
    expect(toInt('abc', 1)).toBe(1)
    expect(toInt('', 1)).toBe(1)
    expect(toInt(undefined, 1)).toBe(1)
    expect(toInt(null, 1)).toBe(1)
  })

  test('clamps to min/max', () => {
    expect(toInt('0', 1, 1, 100)).toBe(1)
    expect(toInt('200', 1, 1, 100)).toBe(100)
  })

  test('truncates floats', () => {
    expect(toInt('3.9', 1)).toBe(3)
  })
})

describe('parseJsonField', () => {
  test('parses valid JSON strings', () => {
    expect(parseJsonField<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonField<string[]>('["a","b"]')).toEqual(['a', 'b'])
    expect(parseJsonField<number>('42')).toBe(42)
  })

  test('returns null for null/undefined/empty', () => {
    expect(parseJsonField(null)).toBeNull()
    expect(parseJsonField(undefined)).toBeNull()
    expect(parseJsonField('')).toBeNull()
  })

  test('passes through non-string values', () => {
    const obj = { a: 1 }
    expect(parseJsonField(obj)).toBe(obj)
  })

  test('returns null for invalid JSON', () => {
    expect(parseJsonField('{broken')).toBeNull()
  })
})

describe('jsonString', () => {
  test('serialises objects', () => {
    expect(jsonString({ a: 1 })).toBe('{"a":1}')
  })

  test('returns null for undefined/null', () => {
    expect(jsonString(undefined)).toBeNull()
    expect(jsonString(null)).toBeNull()
  })
})

describe('HttpError', () => {
  test('creates error with status and message', () => {
    const err = new HttpError(404, 'Not found')
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err.name).toBe('HttpError')
  })

  test('supports optional details', () => {
    const err = new HttpError(400, 'Invalid', { field: 'title' })
    expect(err.details).toEqual({ field: 'title' })
  })
})
