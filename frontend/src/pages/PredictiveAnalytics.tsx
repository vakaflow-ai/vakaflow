import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { predictiveApi, Prediction } from '../lib/predictive'
import { agentsApi } from '../lib/agents'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'

export default function PredictiveAnalytics() {
  const navigate = useNavigate()
  const { agentId } = useParams()
  const [user, setUser] = useState<any>(null)
  const [selectedPrediction, setSelectedPrediction] = useState<'success' | 'approval' | 'risk'>('success')

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

  const { data: prediction, isLoading } = useQuery<Prediction | null>({
    queryKey: ['prediction', agentId, selectedPrediction],
    queryFn: async () => {
      if (!agentId) return null
      switch (selectedPrediction) {
        case 'success':
          return predictiveApi.predictSuccess(agentId)
        case 'approval':
          return predictiveApi.predictApproval(agentId)
        case 'risk':
          return predictiveApi.predictRisk(agentId)
        default:
          return null
      }
    },
    enabled: !!agentId,
  })

  if (!agentId) {
    return (
      <Layout user={user}>
        <MaterialCard>
          <p className="text-gray-500">Please select an agent to view predictions.</p>
        </MaterialCard>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Predictive Analytics</h1>
          <p className="text-gray-500">
            {agent ? `Predictions for ${agent.name}` : 'Loading agent...'}
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <MaterialButton
            onClick={() => setSelectedPrediction('success')}
            variant={selectedPrediction === 'success' ? 'contained' : 'text'}
            color="primary"
          >
            Success Prediction
          </MaterialButton>
          <MaterialButton
            onClick={() => setSelectedPrediction('approval')}
            variant={selectedPrediction === 'approval' ? 'contained' : 'text'}
            color="primary"
          >
            Approval Likelihood
          </MaterialButton>
          <MaterialButton
            onClick={() => setSelectedPrediction('risk')}
            variant={selectedPrediction === 'risk' ? 'contained' : 'text'}
            color="primary"
          >
            Risk Assessment
          </MaterialButton>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500 font-medium">Loading predictions...</div>
        ) : prediction ? (
          <div className="space-y-6">
            <MaterialCard elevation={2}>
              <h2 className="text-xl font-medium mb-6 text-gray-900">
                {selectedPrediction === 'success' && 'Success Probability'}
                {selectedPrediction === 'approval' && 'Approval Likelihood'}
                {selectedPrediction === 'risk' && 'Risk Assessment'}
              </h2>

              {selectedPrediction === 'success' && prediction.success_probability !== undefined && (
                <div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Success Probability</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {Math.round(prediction.success_probability * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${prediction.success_probability * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-primary-50 rounded-lg">
                    <p className="text-sm font-medium text-primary-900 mb-1">Prediction: {prediction.prediction}</p>
                    <p className="text-xs text-primary-700 font-medium">Confidence: {prediction.confidence || 'Medium'}</p>
                  </div>
                </div>
              )}

              {selectedPrediction === 'approval' && (
                <div>
                  <div className="mb-4">
                    <MaterialChip
                      label={prediction.approval_likelihood || 'Unknown'}
                      color={
                        prediction.approval_likelihood === 'High' ? 'success' :
                        prediction.approval_likelihood === 'Medium' ? 'warning' :
                        'error'
                      }
                      size="medium"
                    />
                  </div>
                  {(prediction as any).all_reviews_complete !== undefined && (
                    <p className="text-sm text-gray-500 font-medium">
                      All reviews complete: {(prediction as any).all_reviews_complete ? 'Yes' : 'No'}
                    </p>
                  )}
                </div>
              )}

              {selectedPrediction === 'risk' && prediction.risk_score !== undefined && (
                <div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Risk Score</span>
                      <span className={`text-2xl font-bold ${
                        prediction.risk_level === 'high' ? 'text-red-600' :
                        prediction.risk_level === 'medium' ? 'text-warning-600' :
                        'text-green-600'
                      }`}>
                        {Math.round(prediction.risk_score * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          prediction.risk_level === 'high' ? 'bg-error-500' :
                          prediction.risk_level === 'medium' ? 'bg-warning-500' :
                          'bg-success-500'
                        }`}
                        style={{ width: `${prediction.risk_score * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <MaterialChip
                      label={prediction.risk_level || 'Unknown'}
                      color={
                        prediction.risk_level === 'high' ? 'error' :
                        prediction.risk_level === 'medium' ? 'warning' :
                        'success'
                      }
                    />
                  </div>
                </div>
              )}

              {prediction.factors && prediction.factors.length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 tracking-tight mb-4">Contributing Factors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {prediction.factors.map((factor: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">{factor.factor || factor.name}</span>
                        <div className="flex items-center gap-2">
                          {factor.contribution !== undefined && (
                            <span className={`text-xs font-bold ${factor.contribution > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {factor.contribution > 0 ? '+' : ''}{Math.round(factor.contribution * 100)}%
                            </span>
                          )}
                          {factor.value !== undefined && (
                            <span className="text-xs font-medium text-gray-500">
                              ({factor.value})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </MaterialCard>
          </div>
        ) : (
          <MaterialCard>
            <div className="text-center py-8">
              <p className="text-gray-500">No prediction data available</p>
            </div>
          </MaterialCard>
        )}
      </div>
    </Layout>
  )
}

