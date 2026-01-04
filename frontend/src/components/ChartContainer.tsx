import { ReactNode } from 'react'
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

  return (
    <div 
      className={`w-full ${className}`}
      style={{ 
        height: heightValue,
        minHeight: minHeightValue,
        minWidth: 0,
        position: 'relative'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

