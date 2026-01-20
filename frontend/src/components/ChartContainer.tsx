import { ReactNode, useEffect, useRef, useState } from 'react'
import { ResponsiveContainer } from 'recharts'

interface ChartContainerProps {
  children: ReactNode
  height?: number | string
  className?: string
}

/**
 * Wrapper component for Recharts ResponsiveContainer that ensures proper dimensions
 * to prevent width/height warnings when charts are in collapsed or hidden containers
 */
export default function ChartContainer({ 
  children, 
  height = 300,
  className = '' 
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasDimensions, setHasDimensions] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Convert height to pixels if it's a percentage or number
  const heightValue = typeof height === 'number' 
    ? `${height}px` 
    : height === '100%' 
      ? '100%' 
      : height || '300px'
  
  const minHeightValue = typeof height === 'number' 
    ? `${height}px` 
    : height === '100%'
      ? '200px' // Provide a minimum when using 100%
      : height || '300px'

  // Check if container has valid dimensions
  useEffect(() => {
    const checkDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(containerRef.current)
        
        // Check if element is visible (not hidden or collapsed)
        const isVisible = computedStyle.display !== 'none' &&
                         computedStyle.visibility !== 'hidden' &&
                         computedStyle.opacity !== '0'
        
        const width = Math.max(0, rect.width)
        const height = Math.max(0, rect.height)
        
        // Only render chart if container has valid dimensions (> 0) and is visible
        // Use a minimum threshold to avoid rendering with tiny dimensions
        if (isVisible && width >= 200 && height >= 200) {
          setDimensions({ width, height })
          setHasDimensions(true)
        } else {
          setHasDimensions(false)
          setDimensions({ width: 0, height: 0 })
        }
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      checkDimensions()
    })

    // Use ResizeObserver to watch for dimension changes
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize checks
      requestAnimationFrame(checkDimensions)
    })
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Also check on window resize
    window.addEventListener('resize', checkDimensions)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkDimensions)
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ 
        height: heightValue,
        minHeight: minHeightValue,
        minWidth: '200px', // Ensure minimum width
        position: 'relative',
        width: '100%',
        overflow: 'hidden', // Prevent overflow issues
        display: 'block' // Ensure proper display
      }}
    >
      {hasDimensions && dimensions.width >= 200 && dimensions.height >= 200 ? (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          minWidth: '200px', 
          minHeight: '200px',
          position: 'relative'
        }}>
          <ResponsiveContainer 
            width="100%" 
            height="100%"
            debounce={100} // Add debounce to prevent rapid re-renders
          >
            {children}
          </ResponsiveContainer>
        </div>
      ) : (
        <div 
          className="flex items-center justify-center"
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: minHeightValue,
            minWidth: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="text-sm text-gray-400">Loading chart...</div>
        </div>
      )}
    </div>
  )
}

