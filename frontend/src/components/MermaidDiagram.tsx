import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

interface MermaidDiagramProps {
  diagram: string
  id?: string
}

export default function MermaidDiagram({ diagram, id = 'mermaid-diagram' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!diagram || !containerRef.current) return

    // Initialize Mermaid (only once)
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      themeVariables: {
        edgeThickness: '1px',
        mainBkg: '#ffffff',
        nodeBorder: '#d1d5db',
        lineColor: '#94a3b8'
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    })

    // Clear previous content
    containerRef.current.innerHTML = ''

    // Generate unique ID for this diagram
    const diagramId = `${id}-${Date.now()}`

    // Render the diagram
    mermaid.render(diagramId, diagram.trim()).then((result) => {
      if (containerRef.current) {
        containerRef.current.innerHTML = result.svg
      }
    }).catch((error) => {
      console.error('Error rendering Mermaid diagram:', error)
      console.error('Diagram code that failed:', diagram)
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div class="text-red-600 text-sm p-4">
          <p>Error rendering diagram: ${error.message || error}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs">Show diagram code</summary>
            <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto">${diagram}</pre>
          </details>
        </div>`
      }
    })
  }, [diagram, id])

  if (!diagram) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No diagram to display</p>
      </div>
    )
  }

  return (
    <div className="mermaid-diagram-container">
      <div ref={containerRef} className="flex justify-center items-center min-h-[200px] bg-white p-4 rounded border overflow-auto" />
      <details className="mt-2">
        <summary className="text-xs text-muted-foreground cursor-pointer">Show Mermaid Code</summary>
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono mt-2 p-2 bg-gray-50 rounded">
          {diagram}
        </pre>
      </details>
    </div>
  )
}

