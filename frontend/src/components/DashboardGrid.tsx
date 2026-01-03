import { useEffect, useState, ReactNode } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import { cn } from '@/lib/utils'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

interface DashboardGridProps {
  children: ReactNode[]
  layouts?: Layout[]
  onLayoutChange?: (layouts: Layout[]) => void
  storageKey?: string
  className?: string
  cols?: number
  rowHeight?: number
  isDraggable?: boolean
  isResizable?: boolean
}

export default function DashboardGrid({
  children,
  layouts: initialLayouts,
  onLayoutChange,
  storageKey,
  className,
  cols = 12,
  rowHeight = 100,
  isDraggable = true,
  isResizable = true
}: DashboardGridProps) {
  const [containerWidth, setContainerWidth] = useState(1200)
  const [layouts, setLayouts] = useState<Layout[]>(() => {
    if (initialLayouts) {
      return initialLayouts
    }
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Validate that saved layout has matching widget IDs
            const widgetIds = children.map((child, idx) => {
              // Try to get key from React element
              if (child && typeof child === 'object' && 'key' in child) {
                return child.key as string
              }
              return `widget-${idx}`
            })
            const savedIds = parsed.map((l: Layout) => l.i)
            // If all widget IDs match, use saved layout
            if (widgetIds.every(id => savedIds.includes(id)) && savedIds.every(id => widgetIds.includes(id))) {
              return parsed
            }
          }
        } catch (e) {
          console.error('Failed to parse saved layout:', e)
        }
      }
    }
    // Generate default layout using widget keys
    return children.map((child, index) => {
      // Try to get key from React element
      let widgetId = `widget-${index}`
      if (child && typeof child === 'object' && 'key' in child && child.key) {
        widgetId = child.key as string
      }
      const colSpan = index % 3 === 0 ? 6 : 3 // Alternate between 6 and 3 columns
      return {
        i: widgetId,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 2,
        w: colSpan,
        h: 4,
        minW: 3,
        minH: 3
      }
    })
  })

  useEffect(() => {
    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        const container = document.querySelector('.dashboard-grid')?.parentElement
        if (container) {
          setContainerWidth(container.clientWidth - 48) // Account for padding
        } else {
          setContainerWidth(window.innerWidth - 200) // Fallback
        }
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  useEffect(() => {
    if (storageKey && layouts && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(layouts))
    }
  }, [layouts, storageKey])

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayouts(newLayout)
    if (onLayoutChange) {
      onLayoutChange(newLayout)
    }
  }

  return (
    <div className={cn("dashboard-grid", className)}>
      <GridLayout
        className="layout"
        layout={layouts}
        onLayoutChange={handleLayoutChange}
        cols={cols}
        rowHeight={rowHeight}
        isDraggable={isDraggable}
        isResizable={isResizable}
        draggableHandle=".widget-drag-handle"
        margin={[8, 8]}
        containerPadding={[0, 0]}
        width={containerWidth}
        compactType="vertical"
      >
        {children.map((child, index) => {
          // Extract widget ID from child's key if available, otherwise use index
          const widgetId = child?.key || `widget-${index}`
          return (
            <div key={widgetId} className="widget-container">
              {child}
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
