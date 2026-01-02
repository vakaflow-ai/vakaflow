import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auditApi, AuditLog, PurgeAuditRequest } from '../lib/audit'
import { authApi } from '../lib/auth'
import { tenantsApi, Tenant } from '../lib/tenants'
import { usersApi, User } from '../lib/users'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialInput, MaterialChip } from '../components/material'

export default function AuditTrail() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [filters, setFilters] = useState({
    resourceType: '',
    action: '',
    startDate: '',
    endDate: ''
  })
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [purgeOptions, setPurgeOptions] = useState<PurgeAuditRequest>({
    tenant_id: undefined,
    older_than_days: undefined,
    older_than_years: undefined
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => auditApi.getLogs(
      undefined,
      undefined,
      filters.resourceType || undefined,
      undefined,
      filters.action || undefined,
      filters.startDate || undefined,
      filters.endDate || undefined
    ),
    enabled: !!user && ['tenant_admin', 'platform_admin', 'approver', 'security_reviewer', 'compliance_reviewer', 'technical_reviewer', 'business_reviewer'].includes(user?.role)
  })

  // Extract unique user IDs from audit logs
  const uniqueUserIds = useMemo(() => {
    if (!auditData?.logs) return []
    const userIds = new Set<string>()
    auditData.logs.forEach((log: AuditLog) => {
      if (log.user_id) {
        userIds.add(log.user_id)
      }
    })
    return Array.from(userIds)
  }, [auditData?.logs])

  // Fetch user information for all unique user IDs
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'audit', uniqueUserIds],
    queryFn: async () => {
      // Fetch users in parallel
      const userPromises = uniqueUserIds.map(userId => 
        usersApi.get(userId).catch(() => null) // Return null if user not found
      )
      const userResults = await Promise.all(userPromises)
      return userResults.filter((u): u is User => u !== null)
    },
    enabled: uniqueUserIds.length > 0 && !!user
  })

  // Create a map of user_id -> user for quick lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, User>()
    if (users) {
      users.forEach(user => {
        map.set(user.id, user)
      })
    }
    return map
  }, [users])

  // Fetch tenants for platform admin purge options
  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantsApi.list(1, 100),
    enabled: !!user && user.role === 'platform_admin'
  })

  const purgeMutation = useMutation({
    mutationFn: (options: PurgeAuditRequest) => auditApi.purge(options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      setShowPurgeModal(false)
      setPurgeOptions({
        tenant_id: undefined,
        older_than_days: undefined,
        older_than_years: undefined
      })
      alert(
        `Audit data purged successfully!\n` +
        `Deleted ${result.deleted_count} record(s)\n` +
        `Cutoff date: ${new Date(result.cutoff_date).toLocaleString()}`
      )
    },
    onError: (error: any) => {
      alert(`Failed to purge audit data: ${error?.response?.data?.detail || error.message}`)
    },
  })

  if (!user || !['tenant_admin', 'platform_admin', 'approver', 'security_reviewer', 'compliance_reviewer', 'technical_reviewer', 'business_reviewer'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  const getActionBadge = (action: string) => {
    const badges: Record<string, string> = {
      create: 'status-badge-success',
      update: 'status-badge-info',
      delete: 'status-badge-error',
      approve: 'status-badge-success',
      reject: 'status-badge-error',
      submit: 'status-badge-info',
      review: 'status-badge-warning',
    }
    return badges[action] || 'status-badge'
  }

  // Format details for better readability
  const formatDetails = (details: any): string => {
    if (!details) return '-'
    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details)
        return formatDetails(parsed)
      } catch {
        return details
      }
    }
    if (typeof details === 'object') {
      // Format common fields
      const parts: string[] = []
      if (details.name) parts.push(`Name: ${details.name}`)
      if (details.description) parts.push(`Description: ${details.description}`)
      if (details.message) parts.push(`Message: ${details.message}`)
      if (details.changes) parts.push(`Changes: ${JSON.stringify(details.changes)}`)
      
      // If we have formatted parts, return them
      if (parts.length > 0) {
        return parts.join(' | ')
      }
      
      // Otherwise return formatted JSON
      return JSON.stringify(details, null, 2)
    }
    return String(details)
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2">Audit Trail</h1>
            <p className="text-sm text-muted-foreground">
              Complete history of platform activities
            </p>
          </div>
          {user.role === 'platform_admin' && (
            <MaterialButton
              variant="outlined"
              color="error"
              onClick={() => setShowPurgeModal(true)}
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending ? 'Purging...' : 'Purge Old Data'}
            </MaterialButton>
          )}
        </div>

        {/* Filters */}
        <MaterialCard elevation={1} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
              <select
                value={filters.resourceType}
                onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
              >
                <option value="">All Types</option>
                <option value="agent">Agent</option>
                <option value="review">Review</option>
                <option value="policy">Policy</option>
                <option value="tenant">Tenant</option>
                <option value="user">User</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="submit">Submit</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="review">Review</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
              />
            </div>
          </div>
        </MaterialCard>

        {/* Audit Logs Table */}
        <MaterialCard elevation={1} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
            <div className="text-sm font-medium text-gray-600">
              Total: {auditData?.total || 0}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : auditData?.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData?.logs.map((log: AuditLog) => {
                    const user = usersMap.get(log.user_id)
                    const userName = user ? `${user.name} (${user.email})` : 'Unknown User'
                    const userDisplay = usersLoading ? 'Loading...' : (
                      <div className="text-sm">
                        <div className="font-medium">{userName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          ID: {log.user_id}
                        </div>
                      </div>
                    )
                    
                    return (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                        <td>{userDisplay}</td>
                      <td>
                        <MaterialChip 
                          label={log.action} 
                          color={log.action === 'delete' || log.action === 'reject' ? 'error' : log.action === 'create' || log.action === 'approve' ? 'success' : log.action === 'review' ? 'warning' : 'primary'}
                          size="small"
                          variant="filled"
                        />
                      </td>
                      <td>
                        <div className="text-sm">
                          <div className="font-medium capitalize">{log.resource_type}</div>
                          {log.resource_id && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {log.resource_id}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                          {log.details ? (
                            <div className="text-xs text-muted-foreground max-w-md">
                              <div className="whitespace-pre-wrap break-words">
                                {formatDetails(log.details)}
                              </div>
                          </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-xs text-muted-foreground">{log.ip_address || '-'}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </MaterialCard>

        {/* Purge Audit Data Modal */}
        {showPurgeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <MaterialCard elevation={8} className="p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Purge Audit Data</h2>
              <p className="text-sm text-gray-600 mb-8">
                Delete old audit log entries. This action cannot be undone.
              </p>

              <div className="space-y-6">
                {/* Tenant Selection */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Tenant (Optional)
                  </label>
                  <select
                    className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                    value={purgeOptions.tenant_id || ''}
                    onChange={(e) => setPurgeOptions({
                      ...purgeOptions,
                      tenant_id: e.target.value || undefined
                    })}
                  >
                    <option value="">All Tenants</option>
                    {tenants?.map((tenant: Tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Leave empty to purge all tenants
                  </p>
                </div>

                {/* Age Selection - Days or Years */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Purge Data Older Than
                  </label>
                  <div className="space-y-3">
                    {/* Days Options */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-2 block">Days:</label>
                      <div className="flex gap-2">
                        <MaterialButton
                          variant={purgeOptions.older_than_days === 180 ? 'contained' : 'outlined'}
                          color="gray"
                          size="small"
                          onClick={() => setPurgeOptions({
                            ...purgeOptions,
                            older_than_days: 180,
                            older_than_years: undefined
                          })}
                          className="flex-1"
                        >
                          180 Days
                        </MaterialButton>
                        <MaterialButton
                          variant={purgeOptions.older_than_days === 365 ? 'contained' : 'outlined'}
                          color="gray"
                          size="small"
                          onClick={() => setPurgeOptions({
                            ...purgeOptions,
                            older_than_days: 365,
                            older_than_years: undefined
                          })}
                          className="flex-1"
                        >
                          365 Days
                        </MaterialButton>
                      </div>
                    </div>

                    {/* Years Options */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-2 block">Years:</label>
                      <div className="flex gap-2">
                        <MaterialButton
                          variant={purgeOptions.older_than_years === 1 ? 'contained' : 'outlined'}
                          color="gray"
                          size="small"
                          onClick={() => setPurgeOptions({
                            ...purgeOptions,
                            older_than_days: undefined,
                            older_than_years: 1
                          })}
                          className="flex-1"
                        >
                          1 Year
                        </MaterialButton>
                        <MaterialButton
                          variant={purgeOptions.older_than_years === 2 ? 'contained' : 'outlined'}
                          color="gray"
                          size="small"
                          onClick={() => setPurgeOptions({
                            ...purgeOptions,
                            older_than_days: undefined,
                            older_than_years: 2
                          })}
                          className="flex-1"
                        >
                          2 Years
                        </MaterialButton>
                        <MaterialButton
                          variant={purgeOptions.older_than_years === 3 ? 'contained' : 'outlined'}
                          color="gray"
                          size="small"
                          onClick={() => setPurgeOptions({
                            ...purgeOptions,
                            older_than_days: undefined,
                            older_than_years: 3
                          })}
                          className="flex-1"
                        >
                          3 Years
                        </MaterialButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <MaterialButton
                  variant="text"
                  color="gray"
                  onClick={() => {
                    setShowPurgeModal(false)
                    setPurgeOptions({
                      tenant_id: undefined,
                      older_than_days: undefined,
                      older_than_years: undefined
                    })
                  }}
                  disabled={purgeMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    if (!purgeOptions.older_than_days && !purgeOptions.older_than_years) {
                      alert('Please select an age option (days or years)')
                      return
                    }
                    const ageDesc = purgeOptions.older_than_days 
                      ? `${purgeOptions.older_than_days} days`
                      : `${purgeOptions.older_than_years} year(s)`
                    const tenantDesc = purgeOptions.tenant_id 
                      ? tenants?.find((t: Tenant) => t.id === purgeOptions.tenant_id)?.name || 'selected tenant'
                      : 'all tenants'
                    if (window.confirm(
                      `Purge audit data older than ${ageDesc} for ${tenantDesc}?\n\n` +
                      `This action cannot be undone.`
                    )) {
                      purgeMutation.mutate(purgeOptions)
                    }
                  }}
                  disabled={purgeMutation.isPending || (!purgeOptions.older_than_days && !purgeOptions.older_than_years)}
                  className="flex-1"
                >
                  {purgeMutation.isPending ? 'Purging...' : 'Purge Data'}
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}
      </div>
    </Layout>
  )
}

