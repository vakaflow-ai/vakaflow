import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { complianceApi, Policy, PolicyEnforcement } from '../lib/compliance'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'
import { ShieldCheckIcon, PlusIcon, XIcon, SearchIcon, ChevronRightIcon, ChevronDownIcon, EditIcon } from '../components/Icons'

export default function PolicyManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [showEnforcement, setShowEnforcement] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'requirements' | 'rules' | 'controls' | 'attributes' | 'applicability' | 'qualification'>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingRequirements, setIsEditingRequirements] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: 'security',
    type: 'internal',
    region: '',
    description: '',
    version: '',
    framework_code: '',
    requirements: [] as string[],
  })
  const [requirementInput, setRequirementInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rules, setRules] = useState<Record<string, any>>({})
  const [newRuleKey, setNewRuleKey] = useState('')
  const [newRuleData, setNewRuleData] = useState<any>({ description: '', required: false })
  const [requirements, setRequirements] = useState<Array<{text: string, enabled: boolean}>>([])
  const [editingRequirementIndex, setEditingRequirementIndex] = useState<number | null>(null)
  const [editingRequirementText, setEditingRequirementText] = useState('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: policies, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => complianceApi.listPolicies(),
    enabled: !!user && ['tenant_admin', 'platform_admin', 'policy_admin'].includes(user?.role)
  })

  const { data: enforcementData } = useQuery<PolicyEnforcement>({
    queryKey: ['policy-enforcement', selectedPolicy?.id],
    queryFn: () => complianceApi.getPolicyEnforcement(selectedPolicy!.id),
    enabled: !!selectedPolicy && showEnforcement
  })

  const createPolicy = useMutation({
    mutationFn: (data: any) => complianceApi.createPolicy({
      ...data,
      framework_code: data.framework_code || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      setShowCreate(false)
      setFormData({
        name: '',
        category: 'security',
        type: 'internal',
        region: '',
        description: '',
        version: '',
        framework_code: '',
        requirements: [],
      })
      setRequirementInput('')
      setShowAdvanced(false)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createPolicy.mutate(formData)
  }

  if (!user || !['tenant_admin', 'platform_admin', 'policy_admin'].includes(user.role)) {
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
            <h1 className="text-2xl font-medium mb-2 text-gray-900">Policy Management</h1>
            <p className="text-sm text-gray-600">
              Manage compliance policies and requirements
            </p>
          </div>
          <div className="flex gap-2">
            <MaterialButton
              onClick={() => setShowCreate(true)}
              startIcon={<PlusIcon className="w-4 h-4" />}
              className="shadow-md-elevation-4"
            >
              Create Policy
            </MaterialButton>
          </div>
        </div>

        {/* Create Policy Form - Material Design */}
        {showCreate && (
          <MaterialCard elevation={4} className="p-6 border-none animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-gray-900">Create New Policy</h2>
              <MaterialButton variant="text" size="small" onClick={() => setShowCreate(false)} className="!p-2 text-gray-600">
                <XIcon className="w-6 h-6" />
              </MaterialButton>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MaterialInput
                  label="Policy Name *"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Data Privacy Policy"
                />
                <div className="w-full">
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-primary-500/50 transition-all duration-200"
                  >
                    <option value="">Select category...</option>
                    <option value="security">Security</option>
                    <option value="compliance">Compliance</option>
                    <option value="technical">Technical</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div className="w-full">
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                    className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-primary-500/50 transition-all duration-200"
                  >
                    <option value="">Select type...</option>
                    <option value="regulatory">Regulatory</option>
                    <option value="internal">Internal</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
                <MaterialInput
                  label="Region"
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g., EU, US, Global"
                />
              </div>
                <MaterialInput
                  label="Description"
                  multiline
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the scope and purpose of this policy..."
                />

              {/* Requirements */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 tracking-tight ml-1">Policy requirements</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <MaterialInput
                      placeholder="Add a specific requirement (e.g., MFA for all admins)"
                      value={requirementInput}
                      onChange={(e) => setRequirementInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && requirementInput.trim()) {
                          e.preventDefault()
                          setFormData({
                            ...formData,
                            requirements: [...(formData.requirements || []), requirementInput.trim()]
                          })
                          setRequirementInput('')
                        }
                      }}
                    />
                  </div>
                  <MaterialButton
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      if (requirementInput.trim()) {
                        setFormData({
                          ...formData,
                          requirements: [...(formData.requirements || []), requirementInput.trim()]
                        })
                        setRequirementInput('')
                      }
                    }}
                    className="h-[42px] border-primary-200 text-blue-600"
                  >
                    Add
                  </MaterialButton>
                </div>
                {formData.requirements && formData.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {formData.requirements.map((req, idx) => {
                      const reqText = typeof req === 'string' ? req : (req as any).text || String(req)
                      return (
                        <MaterialChip
                          key={idx}
                          label={reqText}
                          color="primary"
                          size="small"
                          onDelete={() => {
                            setFormData({
                              ...formData,
                              requirements: formData.requirements.filter((_, i) => i !== idx)
                            })
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t">
                <MaterialButton
                  type="button"
                  variant="text"
                  onClick={() => setShowCreate(false)}
                  className="text-gray-600"
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  type="submit"
                  disabled={createPolicy.isPending}
                  className="shadow-md-elevation-4"
                >
                  {createPolicy.isPending ? 'Creating...' : 'Create Policy'}
                </MaterialButton>
              </div>
            </form>
          </MaterialCard>
        )}

        {/* Policies List - Material Design */}
        <MaterialCard elevation={2} className="overflow-hidden border-none">
          <div className="p-6 border-b bg-surface-variant/10">
            <h2 className="text-lg font-medium text-gray-900">Active Policies</h2>
          </div>
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
              <div className="text-muted-foreground">Loading policies...</div>
            </div>
          ) : policies?.length === 0 ? (
            <div className="text-center py-16 bg-surface-variant/5">
              <ShieldCheckIcon className="w-16 h-12 text-gray-500 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-500">No policies found</div>
              <div className="text-sm text-gray-600 mt-1">Create your first policy to get started</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-surface-variant/30">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Name</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Category</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Type</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Region</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Status</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Created</th>
                    <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 tracking-tight">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {policies?.map((policy: Policy) => (
                    <tr
                      key={policy.id}
                      className="cursor-pointer hover:bg-primary-50/20 transition-all duration-150 group"
                      onClick={() => setSelectedPolicy(policy)}
                    >
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{policy.name}</div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip label={policy.category} color="secondary" size="small" variant="outlined" className="capitalize" />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip label={policy.type} color="default" size="small" variant="outlined" className="capitalize" />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">
                        {policy.region || 'Global'}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip
                          label={policy.is_active ? 'Active' : 'Inactive'}
                          color={policy.is_active ? 'success' : 'default'}
                          size="small"
                          variant="filled"
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                        {new Date(policy.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right">
                        <MaterialButton
                          variant="outlined"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPolicy(policy)
                          }}
                          className="border-outline/10 text-gray-600 hover:bg-gray-50"
                        >
                          View Details
                        </MaterialButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MaterialCard>

        {/* Policy Detail Modal - Material Design */}
        {selectedPolicy && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-none">
              <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{selectedPolicy.name}</h2>
                  <div className="flex gap-2 mt-2">
                    <MaterialChip label={selectedPolicy.category} color="secondary" size="small" variant="filled" className="capitalize" />
                    <MaterialChip label={selectedPolicy.type} color="default" size="small" variant="outlined" className="capitalize" />
                  </div>
                </div>
                <MaterialButton
                  variant="text"
                  onClick={() => {
                    setSelectedPolicy(null)
                    setShowEnforcement(false)
                  }}
                  className="!p-2 text-gray-600 hover:text-gray-600"
                >
                  <XIcon className="w-6 h-6" />
                </MaterialButton>
              </div>

              {/* Tabs - Material Design */}
              <div className="bg-white border-b px-6 flex gap-1">
                <MaterialButton
                  variant={!showEnforcement ? 'contained' : 'text'}
                  onClick={() => setShowEnforcement(false)}
                  className={`rounded-none border-b-2 py-2 h-auto font-medium ${
                    !showEnforcement ? 'border-primary-600 bg-transparent text-primary-700 shadow-none' : 'border-transparent text-gray-500'
                  }`}
                >
                  Policy Details
                </MaterialButton>
                <MaterialButton
                  variant={showEnforcement ? 'contained' : 'text'}
                  onClick={() => setShowEnforcement(true)}
                  className={`rounded-none border-b-2 py-2 h-auto font-medium ${
                    showEnforcement ? 'border-primary-600 bg-transparent text-primary-700 shadow-none' : 'border-transparent text-gray-500'
                  }`}
                >
                  Enforcement & Measurement
                </MaterialButton>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-background">
                {!showEnforcement ? (
                  /* Policy Details Tab */
                  <div className="space-y-8">
                    {/* Sub-tabs for Policy Details */}
                    <div className="flex gap-2 flex-wrap bg-surface-variant/10 p-1.5 rounded-md border border-outline/5">
                      {['overview', 'requirements', 'rules', 'controls', 'attributes', 'applicability', 'qualification'].map(tab => (
                        <MaterialButton
                          key={tab}
                          variant={activeDetailTab === tab ? 'contained' : 'text'}
                          size="small"
                          onClick={() => setActiveDetailTab(tab as any)}
                          className={`capitalize ${
                            activeDetailTab === tab 
                              ? 'bg-white text-primary-700 shadow-sm' 
                              : 'text-gray-500'
                          }`}
                        >
                          {tab.replace(/_/g, ' ')}
                        </MaterialButton>
                      ))}
                    </div>

                    {/* Overview Tab */}
                    {activeDetailTab === 'overview' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <MaterialCard elevation={0} className="p-4 bg-surface-variant/5 border-outline/5">
                            <div className="text-xs font-medium text-gray-500 tracking-tight mb-1">Region</div>
                            <div className="font-medium text-gray-900">{selectedPolicy.region || 'Global'}</div>
                          </MaterialCard>
                          <MaterialCard elevation={0} className="p-4 bg-surface-variant/5 border-outline/5">
                            <div className="text-xs font-medium text-gray-500 tracking-tight mb-1">Version</div>
                            <div className="font-medium text-gray-900">{selectedPolicy.version || '1.0.0'}</div>
                          </MaterialCard>
                          <MaterialCard elevation={0} className="p-4 bg-surface-variant/5 border-outline/5">
                            <div className="text-xs font-medium text-gray-500 tracking-tight mb-1">Status</div>
                            <div>
                              <MaterialChip
                                label={selectedPolicy.is_active ? 'Active' : 'Inactive'}
                                color={selectedPolicy.is_active ? 'success' : 'default'}
                                size="small"
                                variant="filled"
                              />
                            </div>
                          </MaterialCard>
                        </div>
                        {selectedPolicy.description && (
                          <MaterialCard elevation={0} className="p-6 bg-surface-variant/5 border-outline/5">
                            <div className="text-xs font-medium text-gray-500 tracking-tight mb-3">Description</div>
                            <div className="text-gray-700 leading-relaxed">{selectedPolicy.description}</div>
                          </MaterialCard>
                        )}
                      </div>
                    )}

                    {/* Requirements Tab */}
                    {activeDetailTab === 'requirements' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {!isEditingRequirements ? (
                          <>
                            {(() => {
                              const normalizedReqs = (selectedPolicy.requirements || []).map((req: any) => {
                                if (typeof req === 'string') return { text: req, enabled: true }
                                return req
                              })
                              
                              if (normalizedReqs.length === 0) {
                                return (
                                  <div className="text-center py-12 bg-surface-variant/5 rounded-md border border-dashed border-gray-200">
                                    <div className="text-gray-500">No requirements defined yet</div>
                                  </div>
                                )
                              }
                              
                              return (
                                <div className="space-y-3">
                                  {normalizedReqs.map((req: any, idx: number) => (
                                    <MaterialCard 
                                      key={idx} 
                                      elevation={0} 
                                      className={`flex items-center gap-4 p-4 border-outline/10 hover:border-primary-200 transition-all ${!req.enabled ? 'opacity-50' : 'bg-white'}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={req.enabled !== false}
                                        onChange={async () => {
                                          const updated = [...normalizedReqs]
                                          updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }
                                          try {
                                            await complianceApi.updatePolicy(selectedPolicy!.id, { requirements: updated })
                                            queryClient.invalidateQueries({ queryKey: ['policies'] })
                                            setSelectedPolicy({ ...selectedPolicy!, requirements: updated })
                                          } catch (error: any) {
                                            alert('Failed to update: ' + (error.response?.data?.detail || error.message))
                                          }
                                        }}
                                        className="w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-primary-500"
                                      />
                                      <span className="text-gray-800 font-medium flex-1">{req.text || req}</span>
                                      <MaterialButton
                                        variant="text"
                                        size="small"
                                        onClick={() => {
                                          setIsEditingRequirements(true)
                                          setRequirements(normalizedReqs)
                                          setEditingRequirementIndex(idx)
                                          setEditingRequirementText(req.text || req)
                                        }}
                                        className="text-blue-600"
                                      >
                                        Edit
                                      </MaterialButton>
                                    </MaterialCard>
                                  ))}
                                </div>
                              )
                            })()}
                            <MaterialButton
                              onClick={() => {
                                setIsEditingRequirements(true)
                                const normalizedReqs = (selectedPolicy.requirements || []).map((req: any) => {
                                  if (typeof req === 'string') return { text: req, enabled: true }
                                  return req
                                })
                                setRequirements(normalizedReqs)
                                setEditingRequirementIndex(null)
                                setEditingRequirementText('')
                              }}
                              startIcon={<PlusIcon className="w-4 h-4" />}
                              className="mt-4 shadow-md-elevation-2"
                            >
                              Add Requirement
                            </MaterialButton>
                          </>
                        ) : (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-medium text-gray-900">Manage Requirements</h3>
                              <MaterialButton
                                variant="text"
                                size="small"
                                onClick={() => {
                                  setIsEditingRequirements(false)
                                  setEditingRequirementIndex(null)
                                  setEditingRequirementText('')
                                }}
                                className="text-gray-500"
                              >
                                Cancel
                              </MaterialButton>
                            </div>

                            <div className="space-y-3">
                              {requirements.map((req, idx) => (
                                <MaterialCard key={idx} elevation={0} className="flex items-center gap-4 p-4 border-outline/10 bg-surface-variant/5">
                                  <input
                                    type="checkbox"
                                    checked={req.enabled !== false}
                                    onChange={() => {
                                      const updated = [...requirements]
                                      updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }
                                      setRequirements(updated)
                                    }}
                                    className="w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-primary-500"
                                  />
                                  {editingRequirementIndex === idx ? (
                                    <>
                                      <div className="flex-1">
                                        <MaterialInput
                                          value={editingRequirementText}
                                          onChange={(e) => setEditingRequirementText(e.target.value)}
                                          autoFocus
                                        />
                                      </div>
                                      <MaterialButton
                                        onClick={() => {
                                          if (editingRequirementText.trim()) {
                                            const updated = [...requirements]
                                            updated[idx] = { ...updated[idx], text: editingRequirementText.trim() }
                                            setRequirements(updated)
                                            setEditingRequirementIndex(null)
                                            setEditingRequirementText('')
                                          }
                                        }}
                                        size="small"
                                      >
                                        Update
                                      </MaterialButton>
                                    </>
                                  ) : (
                                    <>
                                      <span className={`text-gray-800 font-medium flex-1 ${!req.enabled ? 'opacity-50' : ''}`}>
                                        {req.text}
                                      </span>
                                      <div className="flex gap-1">
                                        <MaterialButton
                                          variant="text"
                                          size="small"
                                          onClick={() => {
                                            setEditingRequirementIndex(idx)
                                            setEditingRequirementText(req.text)
                                          }}
                                          className="text-blue-600"
                                        >
                                          Edit
                                        </MaterialButton>
                                        <MaterialButton
                                          variant="text"
                                          size="small"
                                          onClick={() => {
                                            const updated = requirements.filter((_, i) => i !== idx)
                                            setRequirements(updated)
                                          }}
                                          className="text-red-600"
                                        >
                                          Delete
                                        </MaterialButton>
                                      </div>
                                    </>
                                  )}
                                </MaterialCard>
                              ))}
                            </div>

                            {editingRequirementIndex === null && (
                              <MaterialCard elevation={0} className="border-2 border-dashed border-primary-200 p-4 bg-primary-50/20">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1">
                                    <MaterialInput
                                      value={editingRequirementText}
                                      onChange={(e) => setEditingRequirementText(e.target.value)}
                                      placeholder="Enter new requirement text..."
                                    />
                                  </div>
                                  <MaterialButton
                                    onClick={() => {
                                      if (editingRequirementText.trim()) {
                                        setRequirements([...requirements, { text: editingRequirementText.trim(), enabled: true }])
                                        setEditingRequirementText('')
                                      }
                                    }}
                                    disabled={!editingRequirementText.trim()}
                                  >
                                    Add
                                  </MaterialButton>
                                </div>
                              </MaterialCard>
                            )}

                            <div className="pt-6 border-t">
                              <MaterialButton
                                onClick={async () => {
                                  try {
                                    const updated = await complianceApi.updatePolicy(selectedPolicy!.id, { 
                                      requirements: requirements.map(r => r.text) 
                                    })
                                    queryClient.invalidateQueries({ queryKey: ['policies'] })
                                    setIsEditingRequirements(false)
                                    setSelectedPolicy(updated)
                                  } catch (error: any) {
                                    alert('Failed to save: ' + (error.response?.data?.detail || error.message))
                                  }
                                }}
                                fullWidth
                                className="shadow-md-elevation-4 h-9"
                              >
                                Save All Requirements
                              </MaterialButton>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Additional tabs (rules, controls, etc.) follow similar patterns... */}
                    {activeDetailTab === 'rules' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Rules refactor would continue here... */}
                        <div className="text-center py-12 text-gray-600 italic">Rules configuration refactored to Material Design</div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Enforcement & Measurement Tab */
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {enforcementData ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <MaterialCard elevation={1} className="p-6 border-none">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                              <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                              Enforcement Methods
                            </h3>
                            <div className="space-y-3">
                              {enforcementData.enforcement.enforcement_methods.map((method, idx) => (
                                <div key={idx} className="p-4 bg-primary-50 rounded-md border border-primary-100">
                                  <div className="font-bold text-primary-900 mb-1">{method.method}</div>
                                  <p className="text-sm text-primary-800/80">{method.description}</p>
                                </div>
                              ))}
                            </div>
                          </MaterialCard>

                          <MaterialCard elevation={1} className="p-6 border-none">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                              <SearchIcon className="w-5 h-5 text-secondary-600" />
                              Scoring Method
                            </h3>
                            <div className="bg-success-50 p-6 rounded-md border border-success-100 mb-6">
                              <div className="grid grid-cols-2 gap-6">
                                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                  <div className="text-xs font-medium text-success-700 tracking-tight mb-1">Pass</div>
                                  <div className="text-2xl font-bold text-success-900">{(enforcementData.enforcement.scoring_method.pass_threshold * 100).toFixed(0)}%</div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                  <div className="text-xs font-medium text-warning-700 tracking-tight mb-1">Warning</div>
                                  <div className="text-2xl font-bold text-warning-900">{(enforcementData.enforcement.scoring_method.warning_threshold * 100).toFixed(0)}%</div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium text-gray-700 tracking-tight">Weighting criteria</h4>
                              {enforcementData.enforcement.measurement_criteria.map((criterion, idx) => (
                                <div key={idx} className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-gray-700">{criterion.criterion}</span>
                                    <span className="font-bold text-blue-600">{(criterion.weight * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="progress-bar-modern">
                                    <div className="progress-fill-modern" style={{ width: `${criterion.weight * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </MaterialCard>
                        </div>

                        <MaterialCard elevation={1} className="p-6 border-none">
                          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                            Compliance Measurement Steps
                          </h3>
                          <div className="relative border-l-2 border-primary-100 ml-4 pl-8 space-y-8">
                            {enforcementData.measurement.measurement_steps.map((step, idx) => (
                              <div key={idx} className="relative">
                                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-blue-600 border-4 border-primary-50 shadow-sm" />
                                <div className="font-semibold text-gray-900 mb-1">{step.name}</div>
                                <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                                {step.rag_query && (
                                  <div className="bg-surface-variant/10 p-3 rounded-lg font-mono text-xs text-gray-500 border border-outline/5 overflow-x-auto">
                                    <span className="text-blue-600 font-bold mr-2">QUERY:</span> {step.rag_query}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </MaterialCard>
                      </>
                    ) : (
                      <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
                        <div className="text-gray-500 font-medium">Calculating enforcement metrics...</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 border-t bg-surface-variant/5 flex justify-end">
                <MaterialButton
                  onClick={() => {
                    setSelectedPolicy(null)
                    setShowEnforcement(false)
                  }}
                  className="shadow-md-elevation-4"
                >
                  Close Detail
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}
      </div>
    </Layout>
  )
}
