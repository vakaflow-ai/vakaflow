import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { ecosystemMapApi, EcosystemSummary } from '../lib/ecosystemMap'
import Layout from '../components/Layout'
import PageContainer, { PageHeader } from '../components/PageContainer'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { NetworkIcon, MapIcon, LinkIcon, AlertTriangleIcon } from '../components/Icons'
import EcosystemMapVisualization from '../components/EcosystemMap'
import type { EcosystemNode, EcosystemLink } from '../components/EcosystemMap'

export default function EcosystemMapV2() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [activeView, setActiveView] = useState<'network' | 'landscape' | 'dependencies' | 'risk'>('network')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ecosystem-map-summary'],
    queryFn: () => ecosystemMapApi.getSummary(),
    enabled: !!user
  })

  const { data: networkData, isLoading: networkLoading } = useQuery({
    queryKey: ['ecosystem-map-network'],
    queryFn: () => ecosystemMapApi.getNetworkGraph(),
    enabled: !!user && activeView === 'network'
  })

  const { data: landscapeData, isLoading: landscapeLoading } = useQuery({
    queryKey: ['ecosystem-map-landscape'],
    queryFn: () => ecosystemMapApi.getLandscapeQuadrant(),
    enabled: !!user && activeView === 'landscape'
  })

  const { data: dependencyData, isLoading: dependencyLoading } = useQuery({
    queryKey: ['ecosystem-map-dependencies'],
    queryFn: () => ecosystemMapApi.getDependencyGraph(),
    enabled: !!user && activeView === 'dependencies'
  })

  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ['ecosystem-map-risk'],
    queryFn: () => ecosystemMapApi.getRiskHeatmap(),
    enabled: !!user && activeView === 'risk'
  })

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <Layout user={user}>
      <PageContainer>
        <PageHeader 
          title="Ecosystem Map (Multi-View)"
          subtitle="Visualize vendor, product, service, and agent relationships"
        />

        {/* Summary Cards */}
        {summaryLoading ? (
          <div className="text-center py-12">Loading summary...</div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Vendors</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.total_vendors}</p>
                </div>
                <NetworkIcon className="w-8 h-8 text-blue-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Agents</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.total_agents}</p>
                </div>
                <NetworkIcon className="w-8 h-8 text-green-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Products</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.total_products}</p>
                </div>
                <NetworkIcon className="w-8 h-8 text-purple-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Services</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.total_services}</p>
                </div>
                <NetworkIcon className="w-8 h-8 text-orange-500" />
              </div>
            </MaterialCard>
          </div>
        ) : null}

        {/* Risk Distribution */}
        {summary && (
          <MaterialCard className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 rounded-md">
                <p className="text-sm text-gray-500">High Risk</p>
                <p className="text-2xl font-semibold text-red-600">{summary.risk_distribution.high}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-md">
                <p className="text-sm text-gray-500">Medium Risk</p>
                <p className="text-2xl font-semibold text-yellow-600">{summary.risk_distribution.medium}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-md">
                <p className="text-sm text-gray-500">Low Risk</p>
                <p className="text-2xl font-semibold text-green-600">{summary.risk_distribution.low}</p>
              </div>
            </div>
          </MaterialCard>
        )}

        {/* View Tabs */}
        <div className="flex gap-2 mb-6">
          <MaterialButton
            variant={activeView === 'network' ? 'contained' : 'outlined'}
            onClick={() => setActiveView('network')}
          >
            <NetworkIcon className="w-4 h-4 mr-2" />
            Network Graph
          </MaterialButton>
          <MaterialButton
            variant={activeView === 'landscape' ? 'contained' : 'outlined'}
            onClick={() => setActiveView('landscape')}
          >
            <MapIcon className="w-4 h-4 mr-2" />
            Landscape Quadrant
          </MaterialButton>
          <MaterialButton
            variant={activeView === 'dependencies' ? 'contained' : 'outlined'}
            onClick={() => setActiveView('dependencies')}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Dependencies
          </MaterialButton>
          <MaterialButton
            variant={activeView === 'risk' ? 'contained' : 'outlined'}
            onClick={() => setActiveView('risk')}
          >
            <AlertTriangleIcon className="w-4 h-4 mr-2" />
            Risk Heatmap
          </MaterialButton>
        </div>

        {/* View Content */}
        <MaterialCard className="p-6">
          {activeView === 'network' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Network Graph</h2>
              {networkLoading ? (
                <div className="text-center py-12">Loading network graph...</div>
              ) : networkData && networkData.nodes && networkData.nodes.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {networkData.nodes.length} nodes, {networkData.edges?.length || 0} relationships
                  </p>
                  <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    <EcosystemMapVisualization
                      nodes={networkData.nodes.map((n: any) => ({
                        id: n.id || n.node_id,
                        name: n.label || n.name || n.id,
                        type: (n.type || n.entity_type || 'other').toLowerCase() as EcosystemNode['type'],
                        attributes: n
                      }))}
                      links={(networkData.edges || []).map((e: any) => ({
                        source: e.source || e.from,
                        target: e.target || e.to,
                        type: e.type || e.relationship_type,
                        attributes: e
                      }))}
                      height={600}
                      onNodeClick={(node) => {
                        console.log('Node clicked:', node)
                        // Navigate to entity detail page based on type
                        if (node.type === 'agent') {
                          navigate(`/agents/${node.id}`)
                        } else if (node.type === 'vendor') {
                          navigate(`/vendors/${node.id}`)
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">No network data available</p>
              )}
            </div>
          )}

          {activeView === 'landscape' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Landscape Quadrant</h2>
              {landscapeLoading ? (
                <div className="text-center py-12">Loading landscape data...</div>
              ) : landscapeData && landscapeData.positions && landscapeData.positions.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {landscapeData.positions.length} positions
                  </p>
                  <div className="border rounded-lg overflow-hidden bg-gray-50" style={{ height: '600px', position: 'relative' }}>
                    {/* Simple quadrant visualization */}
                    <svg width="100%" height="100%" className="absolute inset-0">
                      {/* Quadrant lines */}
                      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#e5e7eb" strokeWidth="2" />
                      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#e5e7eb" strokeWidth="2" />
                      {/* Quadrant labels */}
                      <text x="25%" y="5%" textAnchor="middle" className="text-sm font-semibold fill-gray-600">Innovator</text>
                      <text x="75%" y="5%" textAnchor="middle" className="text-sm font-semibold fill-gray-600">Leader</text>
                      <text x="25%" y="95%" textAnchor="middle" className="text-sm font-semibold fill-gray-600">Niche</text>
                      <text x="75%" y="95%" textAnchor="middle" className="text-sm font-semibold fill-gray-600">Challenger</text>
                      {/* Position entities */}
                      {landscapeData.positions.map((pos: any, idx: number) => {
                        const x = (pos.x_axis_value || pos.position_x || 50) + '%'
                        const y = (pos.y_axis_value || pos.position_y || 50) + '%'
                        return (
                          <g key={idx}>
                            <circle
                              cx={x}
                              cy={y}
                              r="8"
                              fill="#3b82f6"
                              className="cursor-pointer hover:fill-blue-600"
                            />
                            <text
                              x={x}
                              y={parseFloat(y) + 20}
                              textAnchor="middle"
                              className="text-xs fill-gray-700"
                            >
                              {pos.name || pos.entity_name}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">No landscape data available</p>
              )}
            </div>
          )}

          {activeView === 'dependencies' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Dependency Graph</h2>
              {dependencyLoading ? (
                <div className="text-center py-12">Loading dependency graph...</div>
              ) : dependencyData && dependencyData.nodes && dependencyData.nodes.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {dependencyData.nodes.length} nodes, {dependencyData.edges?.length || 0} dependencies
                  </p>
                  <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    <EcosystemMapVisualization
                      nodes={dependencyData.nodes.map((n: any) => ({
                        id: n.id || n.node_id,
                        name: n.label || n.name || n.id,
                        type: (n.type || n.entity_type || 'other').toLowerCase() as EcosystemNode['type'],
                        attributes: n
                      }))}
                      links={(dependencyData.edges || []).map((e: any) => ({
                        source: e.source || e.from,
                        target: e.target || e.to,
                        type: e.type || e.relationship_type || 'dependency',
                        attributes: e
                      }))}
                      height={600}
                      onNodeClick={(node) => {
                        console.log('Node clicked:', node)
                        if (node.type === 'agent') {
                          navigate(`/agents/${node.id}`)
                        } else if (node.type === 'vendor') {
                          navigate(`/vendors/${node.id}`)
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">No dependency data available</p>
              )}
            </div>
          )}

          {activeView === 'risk' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Heatmap</h2>
              {riskLoading ? (
                <div className="text-center py-12">Loading risk heatmap...</div>
              ) : riskData && riskData.heatmap_data && riskData.heatmap_data.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {riskData.heatmap_data.length} entities
                  </p>
                  <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    {/* Convert risk data to network graph format for visualization */}
                    <EcosystemMapVisualization
                      nodes={riskData.heatmap_data.map((item: any) => ({
                        id: item.entity_id || item.id,
                        name: item.entity_name || item.name || item.id,
                        type: (item.entity_type || 'other').toLowerCase() as EcosystemNode['type'],
                        attributes: {
                          ...item,
                          risk_score: item.risk_score || item.risk_level
                        }
                      }))}
                      links={[]}
                      height={600}
                      onNodeClick={(node) => {
                        console.log('Risk node clicked:', node)
                        if (node.type === 'agent') {
                          navigate(`/agents/${node.id}`)
                        } else if (node.type === 'vendor') {
                          navigate(`/vendors/${node.id}`)
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">No risk data available</p>
              )}
            </div>
          )}
        </MaterialCard>
      </PageContainer>
    </Layout>
  )
}
