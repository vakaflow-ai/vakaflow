import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, Agent } from '../lib/agents'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'

export default function ReviewerDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents', 'in_review'],
    queryFn: () => agentsApi.list(1, 50, 'in_review'),
  })

  const pendingReviews = agentsData?.agents || []

  const getStageForRole = (role: string) => {
    const mapping: Record<string, string> = {
      security_reviewer: 'security',
      compliance_reviewer: 'compliance',
      technical_reviewer: 'technical',
      business_reviewer: 'business',
    }
    return mapping[role] || 'security'
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium mb-2">Review Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve agents pending your review
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="compact-card">
            <div className="text-sm text-muted-foreground mb-1">Pending Reviews</div>
            <div className="text-2xl font-medium">{pendingReviews.length}</div>
          </div>
          <div className="compact-card">
            <div className="text-sm text-muted-foreground mb-1">Your Stage</div>
            <div className="text-lg font-medium capitalize">
              {getStageForRole(user?.role)}
            </div>
          </div>
          <div className="compact-card">
            <div className="text-sm text-muted-foreground mb-1">This Month</div>
            <div className="text-2xl font-medium">-</div>
          </div>
        </div>

        {/* Pending Reviews */}
        <div className="compact-card">
          <h2 className="text-lg font-medium mb-4">Pending Reviews</h2>
          {pendingReviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending reviews
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviews.map((agent: Agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 border rounded cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/reviews/${agent.id}`)}
                >
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.type} • {agent.category || 'N/A'}
                    </div>
                    {agent.compliance_score !== null && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Compliance: {agent.compliance_score}/100
                      </div>
                    )}
                  </div>
                  <button className="compact-button-primary text-sm">
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

