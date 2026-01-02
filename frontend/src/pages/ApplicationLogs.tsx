import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { logsApi, LogEntry, ClearLogsOptions } from '../lib/logs'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialInput, MaterialChip } from '../components/material'

export default function ApplicationLogs() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showClearModal, setShowClearModal] = useState(false)
  const [showStats, setShowStats] = useState(false) // Collapsed by default
  const [clearOptions, setClearOptions] = useState<ClearLogsOptions>({
    older_than_days: undefined,
    include_rotated: true,
    log_type: undefined
  })
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const limit = 100 // Load 100 logs per page

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Use infinite query for scroll-based pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['logs', levelFilter, startDate, endDate],
    queryFn: ({ pageParam = 0 }) => 
      logsApi.list(levelFilter || undefined, startDate || undefined, endDate || undefined, limit, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !lastPage.logs) {
        return undefined
      }
      const totalLoaded = allPages.reduce((sum, page) => {
        return sum + (page?.logs?.length || 0)
      }, 0)
      if (totalLoaded < (lastPage.total || 0)) {
        return totalLoaded
      }
      return undefined
    },
    initialPageParam: 0,
  })

  // Flatten all pages into a single array with null safety
  const allLogs = data?.pages?.flatMap(page => page?.logs || []) || []
  const totalLogs = data?.pages?.[0]?.total || 0

  const { data: logStats, refetch: refetchStats } = useQuery({
    queryKey: ['log-stats'],
    queryFn: () => logsApi.getStats(),
    enabled: !!user && user.role === 'platform_admin',
  })

  const clearMutation = useMutation({
    mutationFn: (options?: ClearLogsOptions) => logsApi.clear(options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      queryClient.invalidateQueries({ queryKey: ['log-stats'] })
      refetchStats()
      setShowClearModal(false)
      alert(
        `Logs cleared successfully!\n` +
        `Deleted ${result.deleted_count} file(s)\n` +
        `Freed ${result.size_freed_mb} MB`
      )
    },
    onError: (error: any) => {
      alert(`Failed to clear logs: ${error?.response?.data?.detail || error.message}`)
    },
  })

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when user scrolls to 80% of the content
    if (scrollPercentage > 0.8 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  const getLevelColor = (level: string) => {
    const levelUpper = level.toUpperCase()
    if (levelUpper === 'ERROR' || levelUpper === 'CRITICAL') return 'text-red-600 bg-red-50'
    if (levelUpper === 'WARNING') return 'text-amber-600 bg-amber-50'
    if (levelUpper === 'INFO') return 'text-blue-600 bg-blue-50'
    if (levelUpper === 'DEBUG') return 'text-gray-600 bg-gray-50'
    return 'text-gray-600 bg-gray-50'
  }

  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Application Logs</h1>
            <p className="text-muted-foreground">
              View application logs and system events
            </p>
          </div>
          {user.role === 'platform_admin' && (
            <MaterialButton
              variant="outlined"
              color="error"
              onClick={() => setShowClearModal(true)}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? 'Clearing...' : 'Clear Logs'}
            </MaterialButton>
          )}
        </div>

        {/* Log Statistics (Platform Admin only) - Collapsible */}
        {user.role === 'platform_admin' && logStats && (
          <MaterialCard elevation={2} className="p-6">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowStats(!showStats)}
            >
              <h2 className="text-xl font-semibold text-gray-900">Log File Statistics</h2>
              <div className="flex items-center gap-3">
                <MaterialButton
                  variant="outlined"
                  color="gray"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    refetchStats()
                  }}
                >
                  Refresh Stats
                </MaterialButton>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${showStats ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {showStats && (
              <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Files</div>
                <div className="text-2xl font-bold">{logStats.total_files}</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Size</div>
                <div className="text-2xl font-bold">{logStats.total_size_mb} MB</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Size (Bytes)</div>
                <div className="text-2xl font-bold">{logStats.total_size_bytes.toLocaleString()}</div>
              </div>
            </div>
            {logStats.files.length > 0 && (
              <div className="overflow-x-auto overflow-hidden">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 w-1/6">Filename</th>
                      <th className="text-left p-2 w-2/5">Full Path</th>
                      <th className="text-right p-2 w-1/6">Size (MB)</th>
                      <th className="text-right p-2 w-1/6">Age (Days)</th>
                      <th className="text-left p-2 w-1/6">Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logStats.files.map((file, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="p-2 font-mono text-xs break-words">{file.filename}</td>
                        <td className="p-2 font-mono text-xs break-words text-muted-foreground">
                          {file.filepath || file.filename}
                        </td>
                        <td className="p-2 text-right">{file.size_mb}</td>
                        <td className="p-2 text-right">{file.age_days}</td>
                        <td className="p-2 text-xs text-muted-foreground break-words">
                          {new Date(file.modified).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}
          </MaterialCard>
        )}

        {/* Filters */}
        <MaterialCard elevation={1} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Log Level</label>
              <select
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value)
                }}
              >
                <option value="">All Levels</option>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</label>
              <input
                type="datetime-local"
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
              <input
                type="datetime-local"
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                }}
              />
            </div>
            <div className="flex items-end">
              <MaterialButton
                variant="outlined"
                color="gray"
                onClick={() => {
                  setLevelFilter('')
                  setStartDate('')
                  setEndDate('')
                }}
                className="w-full"
              >
                Clear Filters
              </MaterialButton>
            </div>
          </div>
        </MaterialCard>

        {/* Logs List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
        ) : (allLogs && allLogs.length > 0) ? (
          <>
            <MaterialCard elevation={2} className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-600">
                  Showing {allLogs.length} of {totalLogs} log{totalLogs !== 1 ? 's' : ''}
                  {hasNextPage && ` (scroll to load more)`}
                </div>
                <MaterialButton
                  variant="outlined"
                  color="gray"
                  size="small"
                  onClick={() => refetch()}
                >
                  Refresh
                </MaterialButton>
              </div>
              <div 
                ref={scrollContainerRef}
                className="space-y-2 overflow-y-auto overflow-x-hidden" 
                style={{ maxHeight: 'calc(100vh - 400px)' }}
              >
                {allLogs.map((log: LogEntry, idx: number) => (
                  <MaterialCard
                    key={idx}
                    elevation={0}
                    className="p-4 border border-gray-200 hover:border-primary-300 transition-colors font-mono text-sm"
                  >
                    <div className="flex items-start gap-3">
                      <MaterialChip
                        label={log.level}
                        color={log.level.toUpperCase() === 'ERROR' || log.level.toUpperCase() === 'CRITICAL' ? 'error' : log.level.toUpperCase() === 'WARNING' ? 'warning' : log.level.toUpperCase() === 'INFO' ? 'primary' : 'gray'}
                        size="small"
                        variant="filled"
                      />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          {log.logger && (
                            <span className="text-xs text-muted-foreground">
                              [{log.logger}]
                            </span>
                          )}
                        </div>
                        <div className="text-gray-900 break-words overflow-wrap-anywhere">{log.message}</div>
                      </div>
                    </div>
                  </MaterialCard>
                ))}
                {isFetchingNextPage && (
                  <div className="text-center py-3 text-gray-600">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    Loading more logs...
                  </div>
                )}
                {!hasNextPage && allLogs.length > 0 && (
                  <div className="text-center py-3 text-gray-600 text-sm font-medium">
                    All logs loaded
                  </div>
                )}
              </div>
            </MaterialCard>
          </>
        ) : (
          <MaterialCard elevation={1} className="p-8 text-center">
            <p className="text-gray-600">No logs found</p>
          </MaterialCard>
        )}

        {/* Clear Logs Modal */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <MaterialCard elevation={8} className="p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Clear Logs</h2>
              <p className="text-sm text-gray-600 mb-8">
                Configure options for clearing log files. This action cannot be undone.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Delete logs older than (days)
                  </label>
                  <input
                    type="number"
                    className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                    placeholder="Leave empty to delete all"
                    min="1"
                    value={clearOptions.older_than_days || ''}
                    onChange={(e) => setClearOptions({
                      ...clearOptions,
                      older_than_days: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Only delete logs older than specified days. Leave empty to delete all logs.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Log Type</label>
                  <select
                    className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                    value={clearOptions.log_type || ''}
                    onChange={(e) => setClearOptions({
                      ...clearOptions,
                      log_type: e.target.value || undefined
                    })}
                  >
                    <option value="">All Logs (application + errors)</option>
                    <option value="application">Application Logs Only</option>
                    <option value="errors">Error Logs Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="include-rotated"
                    checked={clearOptions.include_rotated}
                    onChange={(e) => setClearOptions({
                      ...clearOptions,
                      include_rotated: e.target.checked
                    })}
                    className="rounded"
                  />
                  <label htmlFor="include-rotated" className="text-sm">
                    Include rotated backup files (application.log.1, errors.log.1, etc.)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <MaterialButton
                  variant="text"
                  color="gray"
                  onClick={() => {
                    setShowClearModal(false)
                    setClearOptions({
                      older_than_days: undefined,
                      include_rotated: true,
                      log_type: undefined
                    })
                  }}
                  disabled={clearMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    const confirmMsg = clearOptions.older_than_days
                      ? `Delete logs older than ${clearOptions.older_than_days} days?`
                      : 'Delete all logs?'
                    if (window.confirm(confirmMsg + ' This action cannot be undone.')) {
                      clearMutation.mutate(clearOptions)
                    }
                  }}
                  disabled={clearMutation.isPending}
                  className="flex-1"
                >
                  {clearMutation.isPending ? 'Clearing...' : 'Clear Logs'}
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}
      </div>
    </Layout>
  )
}

