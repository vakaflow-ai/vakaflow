import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { recommendationsApi, Recommendation } from '../lib/recommendations'
import { agentsApi } from '../lib/agents'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'

export default function Recommendations() {
  const navigate = useNavigate()
  const { agentId } = useParams()
  const [user, setUser] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<'similar' | 'historical' | 'review' | 'compliance'>('similar')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agent } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  })

  const { data: recommendations, isLoading } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', agentId, selectedType],
    queryFn: async () => {
      if (!agentId) return []
      switch (selectedType) {
        case 'similar':
          return recommendationsApi.getSimilar(agentId)
        case 'historical':
          return recommendationsApi.getHistorical(agentId)
        case 'review':
          return recommendationsApi.getReview(agentId)
        case 'compliance':
          return recommendationsApi.getCompliance(agentId)
        default:
          return []
      }
    },
    enabled: !!agentId,
  })

  if (!agentId) {
    return (
      <Layout user={user}>
        <MaterialCard elevation={1} className="p-6">
          <p className="text-gray-600">Please select an agent to view recommendations.</p>
        </MaterialCard>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Recommendations</h1>
          <p className="text-muted-foreground">
            {agent ? `Recommendations for ${agent.name}` : 'Loading agent...'}
          </p>
        </div>

        <MaterialCard elevation={2} className="p-6">
          <div className="flex gap-3 mb-8 flex-wrap">
            <MaterialButton
              variant={selectedType === 'similar' ? 'contained' : 'outlined'}
              color={selectedType === 'similar' ? 'primary' : 'gray'}
              onClick={() => setSelectedType('similar')}
            >
              Similar Agents
            </MaterialButton>
            <MaterialButton
              variant={selectedType === 'historical' ? 'contained' : 'outlined'}
              color={selectedType === 'historical' ? 'primary' : 'gray'}
              onClick={() => setSelectedType('historical')}
            >
              Historical Cases
            </MaterialButton>
            <MaterialButton
              variant={selectedType === 'review' ? 'contained' : 'outlined'}
              color={selectedType === 'review' ? 'primary' : 'gray'}
              onClick={() => setSelectedType('review')}
            >
              Review Recommendations
            </MaterialButton>
            <MaterialButton
              variant={selectedType === 'compliance' ? 'contained' : 'outlined'}
              color={selectedType === 'compliance' ? 'primary' : 'gray'}
              onClick={() => setSelectedType('compliance')}
            >
              Compliance Tips
            </MaterialButton>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-600">Loading recommendations...</div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec, idx) => (
                <MaterialCard key={idx} elevation={0} className="p-5 border border-gray-200 hover:border-primary-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{rec.title}</h3>
                    {rec.confidence && (
                      <MaterialChip 
                        label={`${Math.round(rec.confidence * 100)}% confidence`}
                        color="primary"
                        size="small"
                        variant="filled"
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                  {rec.reason && (
                    <p className="text-xs text-gray-500 italic mb-3">Reason: {rec.reason}</p>
                  )}
                  {rec.agent_id && (
                    <MaterialButton
                      variant="text"
                      color="primary"
                      size="small"
                      onClick={() => navigate(`/agents/${rec.agent_id}`)}
                    >
                      View Agent →
                    </MaterialButton>
                  )}
                </MaterialCard>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-600">
              No recommendations available for this type.
            </div>
          )}
        </MaterialCard>
      </div>
    </Layout>
  )
}

