import React, { useEffect, useState, ReactNode } from 'react'
import { ResponsiveGridLayout } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
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
    // Extract widget IDs consistently
    const getWidgetId = (child: ReactNode, index: number): string => {
      if (React.isValidElement(child) && child.key) {
        return String(child.key);
      }
      return `widget-${index}`;
    };

    if (initialLayouts) {
      return initialLayouts;
    }

    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Simple validation: check if layout length matches children count
            const widgetIds = children.map(getWidgetId);
            const savedIds = parsed.map((l: any) => l.i);
            
            if (widgetIds.length === savedIds.length) {
              return parsed;
            }
          }
        } catch (e) {
          console.error('Failed to parse saved layout:', e);
        }
      }
    }

    // Generate default layout
    return children.map((child, index) => ({
      i: getWidgetId(child, index),
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 2,
      w: index % 3 === 0 ? 6 : 3,
      h: 4,
      minW: 3,
      minH: 3
    }));
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

  return (
    <div className={cn("dashboard-grid", className)}>
      {/* @ts-ignore */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layouts }}
        onLayoutChange={(newLayout: any) => {
          const updatedLayout = Array.isArray(newLayout) ? newLayout : [newLayout];
          setLayouts(updatedLayout);
          onLayoutChange?.(updatedLayout);
        }}
        cols={{ lg: cols, md: cols, sm: cols, xs: cols, xxs: cols }}
        rowHeight={rowHeight}
        isDraggable={isDraggable}
        isResizable={isResizable}
        draggableHandle=".widget-drag-handle"
        margin={[8, 8]}
        containerPadding={[0, 0]}
        width={containerWidth}
        compactType="vertical"
      >
        {children.map((child, index) => (
          <div 
            key={React.isValidElement(child) && child.key ? String(child.key) : `widget-${index}`} 
            className="widget-container"
          >
            {child}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}
