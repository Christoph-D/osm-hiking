import { useState, useEffect } from 'react'

/**
 * Progressive Loading Message Hook
 *
 * Returns a loading message that updates progressively over time to provide
 * feedback for long-running operations.
 *
 * @param baseMessage - The initial loading message (e.g., "Loading hiking paths...")
 * @param isLoading - Whether the loading operation is currently active
 * @returns The current message string
 */
export function useProgressiveLoadingMessage(
  baseMessage: string,
  isLoading: boolean
) {
  const [message, setMessage] = useState(baseMessage)

  useEffect(() => {
    // Only start timers when loading is active
    if (!isLoading) {
      return
    }

    // Define progressive messages with their timing
    const progressiveMessages = [
      { delaySeconds: 5, message: `${baseMessage} still loading...` },
      { delaySeconds: 10, message: `${baseMessage} this is taking a while...` },
      { delaySeconds: 15, message: `${baseMessage} any moment now...` },
      { delaySeconds: 25, message: `${baseMessage} almost there...` },
    ]

    // Create timers for each progressive message
    const timers = progressiveMessages.map(({ delaySeconds, message }) =>
      setTimeout(() => setMessage(message), 1000 * delaySeconds)
    )

    // Cleanup timers on unmount or when loading completes
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [baseMessage, isLoading])

  return isLoading ? message : baseMessage
}
