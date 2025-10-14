/**
 * Debounce Utility Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce, throttle } from './debounce'

describe('debounce utility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('debounce', () => {
    it('should delay function execution', () => {
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      expect(mockFn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should cancel previous calls when called multiple times', () => {
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should pass arguments to the original function', () => {
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn('arg1', 'arg2', 42)

      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 42)
    })

    it('should allow multiple calls after debounce period', () => {
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)

      debouncedFn()
      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('throttle', () => {
    it('should execute function immediately on first call', () => {
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should throttle subsequent calls', () => {
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(mockFn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(2) // Should execute once more after throttle period
    })

    it('should pass arguments to the original function', () => {
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn('test', 123)

      expect(mockFn).toHaveBeenCalledWith('test', 123)
    })

    it('should allow execution after throttle period', () => {
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(2)
    })
  })
})
