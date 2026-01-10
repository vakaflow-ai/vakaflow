import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidDiagramProps {
  diagram: string
  id?: string
  showZoomControls?: boolean
}

export default function MermaidDiagram({ diagram, id = 'mermaid-diagram', showZoomControls = true }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoomLevel, setZoomLevel] = useState(1.5) // Start at 150% for better readability
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const applyZoom = () => {
    if (svgContainerRef.current) {
      svgContainerRef.current.style.transform = `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`
      svgContainerRef.current.style.transformOrigin = 'top left'
    }
  }

  useEffect(() => {
    applyZoom()
  }, [zoomLevel, position])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      }
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove)
        document.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }
  }, [isDragging, dragStart])

  useEffect(() => {
    if (!diagram || !svgContainerRef.current) return

    // Initialize Mermaid (only once)
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      themeVariables: {
        edgeThickness: '2px',
        mainBkg: '#ffffff',
        nodeBorder: '#d1d5db',
        lineColor: '#94a3b8',
        fontSize: '18px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 100,
        rankSpacing: 120,
        padding: 30
      },
      er: {
        fontSize: '18px',
        padding: 30
      }
    })

    // Clear previous content
    svgContainerRef.current.innerHTML = ''

    // Generate unique ID for this diagram
    const diagramId = `${id}-${Date.now()}`

    // Render the diagram
    mermaid.render(diagramId, diagram.trim()).then((result) => {
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = result.svg
        // Scale the SVG for better readability
        const svg = svgContainerRef.current.querySelector('svg')
        if (svg) {
          svg.style.width = '100%'
          svg.style.height = 'auto'
          svg.style.minWidth = '1800px'
          // Increase font sizes in the SVG
          const textElements = svg.querySelectorAll('text')
          textElements.forEach((text) => {
            const currentSize = text.getAttribute('font-size')
            if (currentSize) {
              const size = parseFloat(currentSize)
              if (size < 18) {
                text.setAttribute('font-size', '18')
              }
            } else {
              text.setAttribute('font-size', '18')
            }
          })
          // Apply initial zoom
          applyZoom()
        }
      }
    }).catch((error) => {
      console.error('Error rendering Mermaid diagram:', error)
      console.error('Diagram code that failed:', diagram)
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = `<div class="text-red-600 text-sm p-4">
          <p>Error rendering diagram: ${error.message || error}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs">Show diagram code</summary>
            <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto">${diagram}</pre>
          </details>
        </div>`
      }
    })
  }, [diagram, id])

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 4)) // Max 400%
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5)) // Min 50%
  }

  const handleZoomReset = () => {
    setZoomLevel(1.5) // Reset to 150%
  }

  const handleZoomFit = () => {
    setZoomLevel(1) // Fit to container
  }

  if (!diagram) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No diagram to display</p>
      </div>
    )
  }

  return (
    <div className="mermaid-diagram-container w-full">
      {/* Zoom Controls */}
      {showZoomControls && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-gray-100 rounded-lg border">
          <span className="text-sm font-medium text-gray-700">Zoom:</span>
          <button
            onClick={handleZoomOut}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-sm"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-sm text-gray-600 font-mono min-w-[60px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-sm"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomFit}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-sm ml-2"
            title="Fit to Container"
          >
            Fit
          </button>
          <button
            onClick={handleZoomReset}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-sm"
            title="Reset to Default (150%)"
          >
            Reset
          </button>
          <button
            onClick={() => setPosition({ x: 0, y: 0 })}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-sm ml-2"
            title="Reset Position"
          >
            Reset Position
          </button>
          <div className="ml-auto text-xs text-gray-500">
            Drag to pan | Ctrl/Cmd + scroll to zoom
          </div>
        </div>
      )}

      {/* Diagram Container with Scroll */}
      <div 
        ref={containerRef}
        className="relative bg-white rounded-lg border overflow-hidden"
        style={{ 
          minHeight: '600px',
          maxHeight: '85vh',
          width: '100%',
          cursor: isDragging ? 'grabbing' : (zoomLevel > 1 ? 'grab' : 'default')
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.15 : 0.15
            setZoomLevel(prev => Math.max(0.5, Math.min(4, prev + delta)))
          } else if (zoomLevel > 1) {
            // Allow scrolling when zoomed in
            e.preventDefault()
            setPosition(prev => ({
              x: prev.x - e.deltaX,
              y: prev.y - e.deltaY
            }))
          }
        }}
      >
        <div 
          ref={svgContainerRef}
          className="transition-transform duration-100"
          style={{
            padding: '20px',
            minWidth: '100%',
            userSelect: 'none'
          }}
        />
      </div>

      <details className="mt-4">
        <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">Show Mermaid Code</summary>
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono mt-2 p-4 bg-gray-50 rounded border">
          {diagram}
        </pre>
      </details>
    </div>
  )
}

