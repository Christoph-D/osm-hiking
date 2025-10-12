import { useState, useEffect } from 'react'

/**
 * Progressive Loading Message Hook
 *
 * Returns a loading message that updates progressively over time to provide
 * feedback for long-running operations.
 *
 * @param baseMessage - The initial loading message (e.g., "Loading hiking paths...")
 * @param isLoading - Whether loading is currently active
 * @returns The current message to display based on elapsed time
 */
export function useProgressiveLoadingMessage(
  baseMessage: string,
  isLoading: boolean
): string {
  const [message, setMessage] = useState(baseMessage)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(baseMessage)

    // Reset to base message when loading state changes
    if (!isLoading) {
      return
    }

    // Define progressive messages with their timing
    const progressiveMessages = [
      { delaySeconds: 5, message: `${baseMessage} still loading...` },
      { delaySeconds: 10, message: `${baseMessage} this is taking a while...` },
      { delaySeconds: 20, message: `${baseMessage} any moment now...` },
      { delaySeconds: 30, message: `${baseMessage} almost there...` },
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

  return message
}
