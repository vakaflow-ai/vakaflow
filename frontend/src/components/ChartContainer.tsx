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
        const width = rect.width
        const height = rect.height
        
        // Only render chart if container has valid dimensions (> 0)
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
          setHasDimensions(true)
        } else {
          setHasDimensions(false)
        }
      }
    }

    // Check immediately
    checkDimensions()

    // Use ResizeObserver to watch for dimension changes
    const resizeObserver = new ResizeObserver(checkDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Also check on window resize
    window.addEventListener('resize', checkDimensions)

    return () => {
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
        width: '100%'
      }}
    >
      {hasDimensions && dimensions.width > 0 && dimensions.height > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        <div 
          className="flex items-center justify-center"
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: minHeightValue,
            minWidth: '200px'
          }}
        >
          <div className="text-sm text-gray-400">Loading chart...</div>
        </div>
      )}
    </div>
  )
}

