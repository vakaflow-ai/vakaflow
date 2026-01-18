import React, { useMemo, useCallback, memo, useState, useRef, useEffect } from 'react'
import { Tree } from 'react-d3-tree'

export interface HierarchicalNode {
  name: string
  attributes?: {
    [key: string]: any
  }
  children?: HierarchicalNode[]
  [key: string]: any
}

export interface MetricConfig {
  color?: string
  width?: string
  label?: string[]
}

export interface HierarchicalVisualizationProps {
  data: HierarchicalNode
  availableMetrics?: string[]
  onMetricConfigChange?: (config: { color?: string; width?: string; label?: string[] }) => void
  initialConfig?: MetricConfig
  height?: number
  width?: number
}

// Memoized node component to prevent unnecessary re-renders
const CustomNode = memo(({ nodeDatum, colorMetric, widthMetric, labelMetrics }: {
  nodeDatum: any
  colorMetric?: string
  widthMetric?: string
  labelMetrics?: string[]
}) => {
  const nodeColor = colorMetric && nodeDatum.attributes?.[colorMetric]
    ? getColorForValue(nodeDatum.attributes[colorMetric])
    : '#3b82f6'
  
  const nodeWidth = widthMetric && nodeDatum.attributes?.[widthMetric]
    ? getWidthForValue(nodeDatum.attributes[widthMetric])
    : 2

  const labels = labelMetrics?.map(metric => {
    const value = nodeDatum.attributes?.[metric]
    return value ? `${metric}: ${value}` : null
  }).filter(Boolean) || []

  return (
    <g>
      <circle
        r={15}
        fill={nodeColor}
        stroke="#fff"
        strokeWidth={nodeWidth}
        style={{ cursor: 'pointer' }}
      />
      <text
        x={0}
        y={25}
        textAnchor="middle"
        fill="#333"
        fontSize="12"
        fontWeight="500"
      >
        {nodeDatum.name}
      </text>
      {labels.length > 0 && (
        <text
          x={0}
          y={40}
          textAnchor="middle"
          fill="#666"
          fontSize="10"
        >
          {labels.join(', ')}
        </text>
      )}
    </g>
  )
})

CustomNode.displayName = 'CustomNode'

// Memoized link component
const CustomLink = memo(({ source, target, widthMetric }: {
  source: any
  target: any
  widthMetric?: string
}) => {
  const linkWidth = widthMetric && target.attributes?.[widthMetric]
    ? getWidthForValue(target.attributes[widthMetric])
    : 1.5

  return (
    <line
      stroke="#94a3b8"
      strokeWidth={linkWidth}
      strokeOpacity={0.6}
    />
  )
})

CustomLink.displayName = 'CustomLink'

// Helper functions
function getColorForValue(value: number): string {
  // Simple color scale - can be enhanced
  if (value < 1000) return '#10b981' // green
  if (value < 5000) return '#3b82f6' // blue
  if (value < 10000) return '#f59e0b' // amber
  return '#ef4444' // red
}

function getWidthForValue(value: number): number {
  // Normalize width between 1 and 5
  if (!value) return 1.5
  const normalized = Math.min(Math.max(value / 1000, 0.5), 5)
  return normalized
}

const HierarchicalVisualization: React.FC<HierarchicalVisualizationProps> = ({
  data,
  availableMetrics = [],
  onMetricConfigChange,
  initialConfig,
  height = 600,
  width = 800
}) => {
  const [colorMetric, setColorMetric] = useState<string | undefined>(initialConfig?.color)
  const [widthMetric, setWidthMetric] = useState<string | undefined>(initialConfig?.width)
  const [labelMetrics, setLabelMetrics] = useState<string[]>(initialConfig?.label || [])
  const [isExpanded, setIsExpanded] = useState<{ [key: string]: boolean }>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: width, height: height })

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth || width,
          height: containerRef.current.offsetHeight || height
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [width, height])

  // Memoize the tree data transformation to avoid unnecessary recalculations
  const transformedData = useMemo(() => {
    return transformDataForTree(data, colorMetric, widthMetric, labelMetrics)
  }, [data, colorMetric, widthMetric, labelMetrics])

  // Memoize node component renderer
  const renderCustomNode = useCallback((nodeDatum: any) => {
    return (
      <CustomNode
        nodeDatum={nodeDatum}
        colorMetric={colorMetric}
        widthMetric={widthMetric}
        labelMetrics={labelMetrics}
      />
    )
  }, [colorMetric, widthMetric, labelMetrics])

  // Memoize link component renderer
  const renderCustomLink = useCallback((source: any, target: any) => {
    return (
      <CustomLink
        source={source}
        target={target}
        widthMetric={widthMetric}
      />
    )
  }, [widthMetric])

  const handleColorChange = useCallback((metric: string) => {
    setColorMetric(metric)
    onMetricConfigChange?.({ color: metric, width: widthMetric, label: labelMetrics })
  }, [widthMetric, labelMetrics, onMetricConfigChange])

  const handleWidthChange = useCallback((metric: string) => {
    setWidthMetric(metric)
    onMetricConfigChange?.({ color: colorMetric, width: metric, label: labelMetrics })
  }, [colorMetric, labelMetrics, onMetricConfigChange])

  const handleLabelToggle = useCallback((metric: string) => {
    const newLabels = labelMetrics.includes(metric)
      ? labelMetrics.filter(m => m !== metric)
      : [...labelMetrics, metric]
    setLabelMetrics(newLabels)
    onMetricConfigChange?.({ color: colorMetric, width: widthMetric, label: newLabels })
  }, [labelMetrics, colorMetric, widthMetric, onMetricConfigChange])

  return (
    <div className="flex gap-4 h-full">
      {/* Control Panel */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Metric Set 1</h3>
        
        {/* COLOR Configuration */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">COLOR</label>
            <button className="text-gray-600 hover:text-gray-600 text-xs">✎</button>
          </div>
          <MetricSelector
            selected={colorMetric}
            options={availableMetrics}
            onChange={handleColorChange}
            placeholder="Click to add, or drop data"
          />
        </div>

        {/* WIDTH Configuration */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">WIDTH</label>
            <button className="text-gray-600 hover:text-gray-600 text-xs">✎</button>
          </div>
          <MetricSelector
            selected={widthMetric}
            options={availableMetrics}
            onChange={handleWidthChange}
            placeholder="Click to add, or drop data"
          />
        </div>

        {/* LABEL Configuration */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">LABEL</label>
          </div>
          <div className="space-y-2">
            {availableMetrics.map(metric => (
              <label key={metric} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={labelMetrics.includes(metric)}
                  onChange={() => handleLabelToggle(metric)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-700">{metric}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Visualization Area */}
      <div 
        ref={containerRef}
        className="flex-1 bg-gray-50 border border-gray-300 rounded relative"
        style={{ minHeight: height }}
      >
        {transformedData && (
          <Tree
            data={transformedData}
            orientation="horizontal"
            translate={{ x: 50, y: dimensions.height / 2 }}
            pathFunc="diagonal"
            nodeSize={{ x: 200, y: 100 }}
            separation={{ siblings: 1, nonSiblings: 2 }}
            renderCustomNodeElement={renderCustomNode}
            // renderCustomLinkElement={renderCustomLink} // Disabled due to type mismatch
            zoom={0.8}
            scaleExtent={{ min: 0.1, max: 2 }}
            dimensions={{ width: dimensions.width, height: dimensions.height }}
            transitionDuration={300}
          />
        )}
      </div>
    </div>
  )
}

// Transform data for react-d3-tree format
function transformDataForTree(
  data: HierarchicalNode,
  colorMetric?: string,
  widthMetric?: string,
  labelMetrics?: string[]
): any {
  return {
    name: data.name,
    attributes: {
      ...data.attributes,
      _colorMetric: colorMetric,
      _widthMetric: widthMetric,
      _labelMetrics: labelMetrics
    },
    children: data.children?.map(child => transformDataForTree(child, colorMetric, widthMetric, labelMetrics))
  }
}

// Memoized metric selector component
const MetricSelector = memo(({ 
  selected, 
  options, 
  onChange, 
  placeholder 
}: { 
  selected?: string
  options: string[]
  onChange: (value: string) => void
  placeholder: string
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-between"
      >
        {selected ? (
          <span className="text-green-700 font-medium">{selected}</span>
        ) : (
          <span className="text-gray-600">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
            {options.map(option => (
              <button
                key={option}
                onClick={() => {
                  onChange(option)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                  selected === option ? 'bg-blue-50 font-medium' : ''
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

MetricSelector.displayName = 'MetricSelector'

export default memo(HierarchicalVisualization)
