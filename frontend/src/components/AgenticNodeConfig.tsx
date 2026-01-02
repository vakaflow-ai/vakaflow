import { useState, useEffect } from 'react'
import { MaterialButton } from './material'
import { PlusIcon } from './Icons'
import { useQuery } from '@tanstack/react-query'
import { vendorsApi } from '../lib/vendors'

interface AgenticNodeConfigProps {
  value: AgenticNodeConfig
  onChange: (config: AgenticNodeConfig) => void
  nodeInputData?: Record<string, any>  // Input data from the node to find vendor_id
}

export interface AgenticNodeConfig {
  // Email configuration
  email?: {
    enabled: boolean
    send_on?: 'before' | 'after' | 'both' | 'error'
    recipients?: Array<{
      type: 'user' | 'vendor' | 'custom'
      value: string  // user_id, vendor_id, or email address
    }>
    template?: string
    subject?: string
    include_result?: boolean
  }
  
  // Push data configuration
  push_data?: {
    enabled: boolean
    targets?: Array<{
      type: 'webhook' | 'mcp' | 'database' | 'api'
      endpoint?: string
      mcp_connection_id?: string
      method?: 'POST' | 'PUT' | 'PATCH'
      headers?: Record<string, string>
      data_mapping?: Record<string, string>  // Map result fields to target fields
    }>
  }
  
  // Collect data configuration
  collect_data?: {
    enabled: boolean
    sources?: Array<{
      type: 'api' | 'database' | 'mcp' | 'rag' | 'file'
      endpoint?: string
      mcp_connection_id?: string
      query?: string
      params?: Record<string, any>
      merge_strategy?: 'replace' | 'merge' | 'append'
    }>
  }
}

export default function AgenticNodeConfig({ value, onChange, nodeInputData }: AgenticNodeConfigProps) {
  const [config, setConfig] = useState<AgenticNodeConfig>(value || {})

  // Fetch vendors for email auto-population
  const { data: vendors } = useQuery({
    queryKey: ['vendors-for-email'],
    queryFn: () => vendorsApi.list(true)
  })

  // Extract vendor_id from node input data (for intelligent auto-detection)
  const vendorIdFromInput = nodeInputData?.vendor_id || 
    (nodeInputData?.agent_selection?.vendor_ids?.[0]) ||
    (nodeInputData?.agent_selection?.vendors?.[0])

  // Auto-populate vendor email when vendor is selected
  useEffect(() => {
    if (config.email?.recipients) {
      const updatedRecipients = config.email.recipients.map(recipient => {
        // If recipient is vendor type and has vendor_id, fetch email
        if (recipient.type === 'vendor' && recipient.value && vendors) {
          const vendor = vendors.find(v => v.id === recipient.value)
          if (vendor && !recipient.value.includes('@')) {
            // If value is vendor_id (not email), replace with email
            return { ...recipient, value: vendor.contact_email }
          }
        }
        return recipient
      })
      
      // Check if we need to update
      const needsUpdate = updatedRecipients.some((r, idx) => 
        r.value !== config.email?.recipients?.[idx]?.value
      )
      
      if (needsUpdate) {
        updateEmail({ recipients: updatedRecipients })
      }
    }
  }, [vendors, vendorIdFromInput])

  // Auto-add vendor email recipient if vendor_id is in input data
  useEffect(() => {
    if (vendorIdFromInput && vendors && config.email?.enabled) {
      const vendor = vendors.find(v => v.id === vendorIdFromInput)
      if (vendor) {
        const existingVendorRecipient = config.email.recipients?.find(
          r => r.type === 'vendor' && (r.value === vendor.id || r.value === vendor.contact_email)
        )
        
        if (!existingVendorRecipient) {
          const newRecipients = [
            ...(config.email.recipients || []),
            { type: 'vendor' as const, value: vendor.contact_email }
          ]
          updateEmail({ recipients: newRecipients })
        }
      }
    }
  }, [vendorIdFromInput, vendors, config.email?.enabled])

  const updateConfig = (updates: Partial<AgenticNodeConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    onChange(newConfig)
  }

  const updateEmail = (updates: Partial<AgenticNodeConfig['email']>) => {
    updateConfig({
      email: { ...config.email, ...updates } as AgenticNodeConfig['email']
    })
  }

  const updatePushData = (updates: Partial<AgenticNodeConfig['push_data']>) => {
    updateConfig({
      push_data: { ...config.push_data, ...updates } as AgenticNodeConfig['push_data']
    })
  }

  const updateCollectData = (updates: Partial<AgenticNodeConfig['collect_data']>) => {
    updateConfig({
      collect_data: { ...config.collect_data, ...updates } as AgenticNodeConfig['collect_data']
    })
  }

  return (
    <div className="space-y-3 overflow-y-auto">
      {/* Email Configuration */}
      <div className="border border-gray-100 rounded-md p-5 bg-white shadow-sm ring-1 ring-gray-200/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-[15px] font-medium text-gray-900 tracking-tight">Email Notifications</h3>
          </div>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={config.email?.enabled || false}
              onChange={(e) => updateEmail({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-primary-500 transition-all cursor-pointer"
            />
            <span className="ml-2 text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Enable</span>
          </label>
        </div>

        {config.email?.enabled && (
          <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-500 tracking-tight ml-1">
                Send Notification
              </label>
              <select
                value={config.email.send_on || 'after'}
                onChange={(e) => updateEmail({ send_on: e.target.value as any })}
                className="w-full h-10 px-3 text-sm font-medium border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200"
              >
                <option value="before">Before Execution</option>
                <option value="after">After Execution</option>
                <option value="both">Before & After</option>
                <option value="error">On Error Only</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-500 tracking-tight ml-1">
                Recipients
              </label>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {(config.email.recipients || []).map((recipient, idx) => {
                  const vendor = recipient.type === 'vendor' && vendors?.find(v => 
                    v.id === recipient.value || v.contact_email === recipient.value
                  )
                  
                  return (
                    <div key={idx} className="relative group/recipient p-3 bg-gray-50 rounded-md border border-gray-200/60 hover:border-primary-200 hover:bg-white transition-all duration-200">
                      <div className="flex-1 space-y-2">
                        <select
                          value={recipient.type}
                          onChange={(e) => {
                            const newRecipients = [...(config.email?.recipients || [])]
                            const newType = e.target.value as any
                            let newValue = recipient.value
                            
                            if (newType === 'vendor' && vendorIdFromInput && vendors) {
                              const vendor = vendors.find(v => v.id === vendorIdFromInput)
                              if (vendor) {
                                newValue = vendor.contact_email
                              }
                            }
                            
                            newRecipients[idx] = { ...recipient, type: newType, value: newValue }
                            updateEmail({ recipients: newRecipients })
                          }}
                          className="w-full h-8 px-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-500 transition-all"
                        >
                          <option value="user">Platform User</option>
                          <option value="vendor">External Vendor</option>
                          <option value="custom">Custom Address</option>
                        </select>
                        {recipient.type === 'vendor' ? (
                          <select
                            value={recipient.value}
                            onChange={(e) => {
                              const newRecipients = [...(config.email?.recipients || [])]
                              const selectedVendor = vendors?.find(v => v.id === e.target.value)
                              newRecipients[idx] = { 
                                ...recipient, 
                                value: selectedVendor?.contact_email || e.target.value 
                              }
                              updateEmail({ recipients: newRecipients })
                            }}
                            className="w-full h-9 px-2 text-xs font-medium border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-500 transition-all"
                          >
                            <option value="">Select vendor contact...</option>
                            {vendors?.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.contact_email})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={recipient.type === 'custom' ? 'email' : 'text'}
                            value={recipient.value}
                            onChange={(e) => {
                              const newRecipients = [...(config.email?.recipients || [])]
                              newRecipients[idx] = { ...recipient, value: e.target.value }
                              updateEmail({ recipients: newRecipients })
                            }}
                            placeholder={recipient.type === 'custom' ? 'email@example.com' : 'User ID or email'}
                            className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-500 transition-all"
                          />
                        )}
                        {vendor && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 mt-1 pl-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Linked: {vendor.name}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const newRecipients = (config.email?.recipients || []).filter((_, i) => i !== idx)
                          updateEmail({ recipients: newRecipients })
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-red-600 hover:border-error-200 shadow-sm opacity-0 group-hover/recipient:opacity-100 transition-all"
                        title="Remove recipient"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
                <MaterialButton
                  variant="outlined"
                  size="small"
                  color="gray"
                  onClick={() => {
                    let initialType: 'user' | 'vendor' | 'custom' = 'custom'
                    let initialValue = ''
                    
                    if (vendorIdFromInput && vendors) {
                      const vendor = vendors.find(v => v.id === vendorIdFromInput)
                      if (vendor) {
                        initialType = 'vendor'
                        initialValue = vendor.contact_email
                      }
                    }
                    
                    const newRecipients = [
                      ...(config.email?.recipients || []), 
                      { type: initialType, value: initialValue }
                    ]
                    updateEmail({ recipients: newRecipients })
                  }}
                  startIcon={<PlusIcon className="w-3.5 h-3.5" />}
                  fullWidth
                  className="rounded-md border-dashed border-2 py-2.5"
                >
                  Add Recipient
                </MaterialButton>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-500 tracking-tight ml-1">
                Custom Subject (Optional)
              </label>
              <input
                type="text"
                value={config.email.subject || ''}
                onChange={(e) => updateEmail({ subject: e.target.value })}
                placeholder="Supports ${variable} syntax"
                className="w-full h-10 px-3 text-sm font-medium border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            <label className="flex items-center cursor-pointer group p-1">
              <input
                type="checkbox"
                checked={config.email.include_result || false}
                onChange={(e) => updateEmail({ include_result: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-primary-500 transition-all cursor-pointer"
              />
              <span className="ml-2 text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">Include execution result in body</span>
            </label>
          </div>
        )}
      </div>

      {/* Push Data Configuration */}
      <div className="border border-gray-100 rounded-md p-5 bg-white shadow-sm ring-1 ring-gray-200/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center text-secondary-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-[15px] font-medium text-gray-900 tracking-tight">Data Export (Push)</h3>
          </div>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={config.push_data?.enabled || false}
              onChange={(e) => updatePushData({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-secondary-600 focus:ring-secondary-500 transition-all cursor-pointer"
            />
            <span className="ml-2 text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Enable</span>
          </label>
        </div>

        {config.push_data?.enabled && (
          <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-3">
              {(config.push_data.targets || []).map((target, idx) => (
                <div key={idx} className="relative group/target p-4 bg-gray-50 rounded-md border border-gray-200/60 hover:border-secondary-200 hover:bg-white transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 tracking-tight">Target {idx + 1}</span>
                    <button
                      onClick={() => {
                        const newTargets = (config.push_data?.targets || []).filter((_, i) => i !== idx)
                        updatePushData({ targets: newTargets })
                      }}
                      className="text-sm font-medium text-red-600 hover:text-error-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <select
                      value={target.type}
                      onChange={(e) => {
                        const newTargets = [...(config.push_data?.targets || [])]
                        newTargets[idx] = { ...target, type: e.target.value as any }
                        updatePushData({ targets: newTargets })
                      }}
                      className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-secondary-500/20 transition-all"
                    >
                      <option value="webhook">Webhook Endpoint</option>
                      <option value="mcp">MCP Connection</option>
                      <option value="database">Internal Database</option>
                      <option value="api">External REST API</option>
                    </select>

                    {target.type === 'webhook' || target.type === 'api' ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={target.endpoint || ''}
                          onChange={(e) => {
                            const newTargets = [...(config.push_data?.targets || [])]
                            newTargets[idx] = { ...target, endpoint: e.target.value }
                            updatePushData({ targets: newTargets })
                          }}
                          placeholder="Target URL (https://...)"
                          className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-secondary-500/20 transition-all"
                        />
                        <select
                          value={target.method || 'POST'}
                          onChange={(e) => {
                            const newTargets = [...(config.push_data?.targets || [])]
                            newTargets[idx] = { ...target, method: e.target.value as any }
                            updatePushData({ targets: newTargets })
                          }}
                          className="w-full h-9 px-3 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-secondary-500/20 transition-all"
                        >
                          <option value="POST">HTTP POST</option>
                          <option value="PUT">HTTP PUT</option>
                          <option value="PATCH">HTTP PATCH</option>
                        </select>
                      </div>
                    ) : target.type === 'mcp' ? (
                      <input
                        type="text"
                        value={target.mcp_connection_id || ''}
                        onChange={(e) => {
                          const newTargets = [...(config.push_data?.targets || [])]
                          newTargets[idx] = { ...target, mcp_connection_id: e.target.value }
                          updatePushData({ targets: newTargets })
                        }}
                        placeholder="MCP Connection Reference"
                        className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-secondary-500/20 transition-all"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
              <MaterialButton
                variant="outlined"
                size="small"
                color="secondary"
                onClick={() => {
                  const newTargets = [...(config.push_data?.targets || []), { type: 'webhook' as const, endpoint: '' }]
                  updatePushData({ targets: newTargets })
                }}
                startIcon={<PlusIcon className="w-3.5 h-3.5" />}
                fullWidth
                className="rounded-md border-dashed border-2 py-2.5"
              >
                Add Export Target
              </MaterialButton>
            </div>
          </div>
        )}
      </div>

      {/* Collect Data Configuration */}
      <div className="border border-gray-100 rounded-md p-5 bg-white shadow-sm ring-1 ring-gray-200/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center text-green-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="text-[15px] font-medium text-gray-900 tracking-tight">Data Ingestion (Pull)</h3>
          </div>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={config.collect_data?.enabled || false}
              onChange={(e) => updateCollectData({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-success-500 transition-all cursor-pointer"
            />
            <span className="ml-2 text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Enable</span>
          </label>
        </div>

        {config.collect_data?.enabled && (
          <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-3">
              {(config.collect_data.sources || []).map((source, idx) => (
                <div key={idx} className="relative group/source p-4 bg-gray-50 rounded-md border border-gray-200/60 hover:border-success-200 hover:bg-white transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 tracking-tight">Source {idx + 1}</span>
                    <button
                      onClick={() => {
                        const newSources = (config.collect_data?.sources || []).filter((_, i) => i !== idx)
                        updateCollectData({ sources: newSources })
                      }}
                      className="text-sm font-medium text-red-600 hover:text-error-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <select
                      value={source.type}
                      onChange={(e) => {
                        const newSources = [...(config.collect_data?.sources || [])]
                        newSources[idx] = { ...source, type: e.target.value as any }
                        updateCollectData({ sources: newSources })
                      }}
                      className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-success-500/20 transition-all"
                    >
                      <option value="api">External REST API</option>
                      <option value="database">Internal Database</option>
                      <option value="mcp">MCP Connection</option>
                      <option value="rag">RAG Knowledge Base</option>
                      <option value="file">File System / Local Storage</option>
                    </select>

                    {source.type === 'api' ? (
                      <input
                        type="text"
                        value={source.endpoint || ''}
                        onChange={(e) => {
                          const newSources = [...(config.collect_data?.sources || [])]
                          newSources[idx] = { ...source, endpoint: e.target.value }
                          updateCollectData({ sources: newSources })
                        }}
                        placeholder="Source URL (https://...)"
                        className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-success-500/20 transition-all"
                      />
                    ) : source.type === 'mcp' ? (
                      <input
                        type="text"
                        value={source.mcp_connection_id || ''}
                        onChange={(e) => {
                          const newSources = [...(config.collect_data?.sources || [])]
                          newSources[idx] = { ...source, mcp_connection_id: e.target.value }
                          updateCollectData({ sources: newSources })
                        }}
                        placeholder="MCP Connection Reference"
                        className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-success-500/20 transition-all"
                      />
                    ) : source.type === 'rag' ? (
                      <input
                        type="text"
                        value={source.query || ''}
                        onChange={(e) => {
                          const newSources = [...(config.collect_data?.sources || [])]
                          newSources[idx] = { ...source, query: e.target.value }
                          updateCollectData({ sources: newSources })
                        }}
                        placeholder="Knowledge Retrieval Query"
                        className="w-full h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-success-500/20 transition-all"
                      />
                    ) : null}

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600 tracking-tight ml-1">Merge Strategy</label>
                      <select
                        value={source.merge_strategy || 'merge'}
                        onChange={(e) => {
                          const newSources = [...(config.collect_data?.sources || [])]
                          newSources[idx] = { ...source, merge_strategy: e.target.value as any }
                          updateCollectData({ sources: newSources })
                        }}
                        className="w-full h-9 px-3 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-success-500/20 transition-all"
                      >
                        <option value="replace">Overwrite Existing Data</option>
                        <option value="merge">Deep Merge Attributes</option>
                        <option value="append">Append to Result Set</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <MaterialButton
                variant="outlined"
                size="small"
                color="success"
                onClick={() => {
                  const newSources = [...(config.collect_data?.sources || []), { type: 'api' as const, endpoint: '' }]
                  updateCollectData({ sources: newSources })
                }}
                startIcon={<PlusIcon className="w-3.5 h-3.5" />}
                fullWidth
                className="rounded-md border-dashed border-2 py-2.5"
              >
                Add Data Source
              </MaterialButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
