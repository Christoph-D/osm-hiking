/**
 * Debounce Utility
 *
 * Utility function to debounce function calls, useful for
 * preventing excessive API calls during rapid events like dragging.
 */

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified wait time has elapsed since the last call.
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, wait)
  }
}

/**
 * Creates a throttled version of a function that limits execution
 * to at most once per specified time period.
 */
export function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastExecution = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    const now = Date.now()

    if (now - lastExecution >= wait) {
      func(...args)
      lastExecution = now
    } else {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(
        () => {
          func(...args)
          lastExecution = Date.now()
          timeoutId = null
        },
        wait - (now - lastExecution)
      )
    }
  }
}
