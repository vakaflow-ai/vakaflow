import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formLayoutsApi, WorkflowLayoutGroup, FormLayout } from '../lib/formLayouts'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import Layout from '../components/Layout'
import { authApi } from '../lib/auth'
import { showToast } from '../utils/toast'
import { Edit2, Plus, Trash2, ChevronDown, ChevronRight, Settings, Copy, X, Check } from 'lucide-react'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { useDialogContext } from '../contexts/DialogContext'

export default function FormDesignerList() {
  const [user, setUser] = useState<any>(null)
  const queryClient = useQueryClient()
  const dialog = useDialogContext()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingEntities, setEditingEntities] = useState<{ groupId: string; entities: string[] } | null>(null)
  const [editingWorkflowContext, setEditingWorkflowContext] = useState<{ groupId: string; request_type: string; workflow_config_id?: string } | null>(null)
  const [editingName, setEditingName] = useState<{ groupId: string; name: string } | null>(null)

  // If any of the per-group edit UIs are open, we treat it as a global edit state and hide some actions
  const isAnyEditOpen = Boolean(editingName || editingEntities || editingWorkflowContext)

  // Available entity options
  const availableEntities = [
    { value: 'vendor', label: 'Vendor' },
    { value: 'agent', label: 'Agent' },
    { value: 'users', label: 'Users' },
    { value: 'workflow_ticket', label: 'Workflow Ticket' },
    { value: 'master_data', label: 'Master Data' },
    { value: 'assessments', label: 'Assessments' },
    { value: 'submission_requirements', label: 'Submission Requirements' }
  ]

  // Fetch workflow types from master data (for labels)
  const { data: workflowTypes } = useQuery({
    queryKey: ['workflow-types'],
    queryFn: () => formLayoutsApi.getWorkflowTypes(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Fetch all layout groups (only active ones, and we'll filter to defaults in configuredWorkflows)
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['workflow-layout-groups'],
    queryFn: () => formLayoutsApi.listGroups(undefined, true), // Explicitly request only active groups
    enabled: !!user,
  })

  // Fetch workflows to map request_type to actual workflow names
  const { data: workflows } = useQuery({
    queryKey: ['workflow-configs'],
    queryFn: () => workflowConfigApi.list(),
    enabled: !!user && (user?.role === 'tenant_admin' || user?.role === 'platform_admin'),
  })

  // Get configured workflows from existing groups (only show workflows that are actually configured)
  const configuredWorkflows = useMemo(() => {
    if (!groups || groups.length === 0) return []
    
    // Filter to only active DEFAULT groups that have ACTUAL stage mappings configured
    // This excludes auto-seeded groups that only have placeholder mappings
    const defaultGroups = groups.filter(group => {
      if (!group.is_active || !group.is_default || !group.request_type || group.request_type.trim() === '') {
        return false
      }
      
      // Check if group has actual stage mappings with layout_ids (not just placeholders)
      const stageMappings = group.stage_mappings || {}
      const hasActualMappings = Object.values(stageMappings).some((mapping: any) => {
        return mapping && 
               typeof mapping === 'object' && 
               mapping.layout_id && 
               mapping.layout_id !== null && 
               mapping.layout_id !== 'null' &&
               mapping.layout_id !== 'undefined' &&
               mapping.layout_id.trim() !== ''
      })
      
      return hasActualMappings
    })
    
    // Extract unique request_type values from default groups only
    const uniqueRequestTypes = new Set<string>()
    defaultGroups.forEach(group => {
      if (group.request_type) {
        uniqueRequestTypes.add(group.request_type)
      }
    })
    
    // Map to workflow type objects with labels from master data
    const configured = Array.from(uniqueRequestTypes).map(requestType => {
      const workflowType = workflowTypes?.find(wt => wt.value === requestType)
      return {
        value: requestType,
        label: workflowType?.label || requestType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        order: workflowType?.order || 0,
        is_active: true
      }
    })
    
    // Sort by order
    configured.sort((a, b) => a.order - b.order)
    
    return configured
  }, [groups, workflowTypes])

  // Build formTypeLabels from workflow types master data
  const formTypeLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    if (workflowTypes) {
      workflowTypes
        .filter(wt => wt.is_active)
        .forEach(wt => {
          labels[wt.value] = wt.label
        })
    } else {
      labels['vendor_submission_workflow'] = 'Vendor Submission Workflow'
      labels['agent_onboarding_workflow'] = 'Agent Onboarding Workflow'
      labels['assessment_workflow'] = 'Assessment Workflow'
    }
    return labels
  }, [workflowTypes])

  // Debug flag controlled by query param: ?debug_workflows=1 or ?debug_workflows=true
  // Declare early so it can be used in useEffect hooks below
  const [searchParams] = useSearchParams()
  const debugWorkflows = searchParams.get('debug_workflows') === '1' || searchParams.get('debug_workflows') === 'true'

  // Debug: Log configured workflows (only in development with debug flag)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && debugWorkflows) {
      console.log('📋 Configured Workflows Debug:', {
        groupsCount: groups?.length,
        configuredWorkflows: configuredWorkflows,
        configuredWorkflowsCount: configuredWorkflows.length,
        uniqueRequestTypes: groups ? Array.from(new Set(groups.filter(g => g.is_active).map(g => g.request_type))) : []
      })
    }
  }, [groups, configuredWorkflows, debugWorkflows])

  // Fetch form library (templates) - for creating new groups
  const { data: library, isLoading: libraryLoading } = useQuery({
    queryKey: ['form-library'],
    queryFn: () => formLayoutsApi.getLibrary(),
    enabled: !!user,
  })

  // Fetch all active forms from library - forms are created and saved in library with type attributes
  // This is the lookup for selecting forms to map to workflow stages
  // Use library endpoint to get forms from the Forms entity (not FormLayout)
  const { data: allFormsFromLibrary, isLoading: formsLoading } = useQuery({
    queryKey: ['form-library'],
    queryFn: () => formLayoutsApi.getLibrary(), // This loads from Forms entity
    enabled: !!user,
  })
  
  // Debug: Log forms from library (only in development with debug flag)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && debugWorkflows && allFormsFromLibrary) {
      console.log('📚 Forms in library:', allFormsFromLibrary.length, allFormsFromLibrary.map(f => ({ name: f.name, id: f.id, layout_type: f.layout_type })))
    }
  }, [allFormsFromLibrary, debugWorkflows])

  // Fetch current user
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])
  const targetGroupIdFromParams = searchParams.get('groupId') || searchParams.get('group_id')

  // Auto-open / highlight behavior for a specific group when ?groupId=... is supplied
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null)
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    if (!groups || groups.length === 0) return
    if (autoOpenedRef.current) return
    const gid = targetGroupIdFromParams
    if (!gid) return
    const found = groups.find(g => g.id === gid)
    if (!found) return

    // Expand the group row
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.add(gid)
      return next
    })

    // Scroll the row into view after render
    setTimeout(() => {
      const el = document.querySelector(`[data-group-id="${gid}"]`) as HTMLElement | null
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 120)

    // Visually highlight the row briefly
    setHighlightedGroupId(gid)
    autoOpenedRef.current = true
    const t = setTimeout(() => setHighlightedGroupId(null), 4000)
    return () => clearTimeout(t)
  }, [groups, targetGroupIdFromParams])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const cloneGroupMutation = useMutation({
    mutationFn: async (group: WorkflowLayoutGroup) => {
      const cloneData: any = {
        name: `${group.name} (Copy)`,
        request_type: group.request_type,
        description: group.description,
        covered_entities: group.covered_entities,
        stage_mappings: group.stage_mappings,
        is_default: false
      }
      return formLayoutsApi.createGroup(cloneData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      showToast.success('Layout group cloned successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to clone layout group')
    }
  })

  const handleCreateGroup = () => {
    // Try to find a default template to use for new steps
    const defaultTemplate = library?.[0]
    const templateId = defaultTemplate?.id || null
    const templateName = defaultTemplate?.name || 'Default Form'

    const newGroup: any = {
      name: 'New Workflow Layout Group',
      request_type: '', // User will configure this
      description: 'Define your custom workflow layout steps and mappings here',
      covered_entities: ['vendor', 'agent', 'users', 'workflow_ticket'],
      stage_mappings: templateId ? {
        'submission': { layout_id: templateId, name: templateName },
        'approval': { layout_id: templateId, name: templateName }
      } : {},
      is_default: false
    }
    createGroupMutation.mutate(newGroup)
  }

  const createGroupMutation = useMutation({
    mutationFn: (group: any) => formLayoutsApi.createGroup(group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      showToast.success('New layout group created')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to create layout group')
    }
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => formLayoutsApi.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      showToast.success('Layout group deleted')
    }
  })

  // Update covered entities mutation
  const updateCoveredEntitiesMutation = useMutation({
    mutationFn: async ({ groupId, coveredEntities }: { groupId: string; coveredEntities: string[] }) => {
      return formLayoutsApi.updateGroup(groupId, { covered_entities: coveredEntities })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      setEditingEntities(null)
      showToast.success('Covered entities updated')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update covered entities')
    }
  })

  // Update workflow mapping (business process to workflow) mutation
  const updateWorkflowMappingMutation = useMutation({
    mutationFn: async ({ groupId, workflow_config_id }: { groupId: string; workflow_config_id?: string }) => {
      return formLayoutsApi.updateGroup(groupId, { workflow_config_id: workflow_config_id || undefined })
    },
    onSuccess: (data, variables) => {
      // Debug: log server response and the variables we used for the update
      // Check DevTools console for this after saving a mapping
      // eslint-disable-next-line no-console
      console.info('updateWorkflowMapping success', { data, variables })

      // Optimistically update the cached groups so UI reflects the new mapping immediately
      try {
        queryClient.setQueryData(['workflow-layout-groups'], (old: any) => {
          if (!Array.isArray(old?.data ?? old)) return old
          // Support both paginated ({data: []}) and plain list shapes
          const list = Array.isArray(old) ? old : old.data
          const updated = list.map((g: any) => g.id === variables.groupId ? { ...g, workflow_config_id: variables.workflow_config_id } : g)
          return Array.isArray(old) ? updated : { ...(old || {}), data: updated }
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to optimistically update workflow-layout-groups cache', e)
      }

      // Invalidate and refetch to ensure server is authoritative and names are up-to-date
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      queryClient.invalidateQueries({ queryKey: ['form-layouts', 'mapped'] }) // Invalidate stage settings cache
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] }) // Ensure workflow list is fresh so names update
      // Force refetch and then log the refetched data for debugging
      Promise.all([
        queryClient.refetchQueries({ queryKey: ['workflow-layout-groups'] }),
        queryClient.refetchQueries({ queryKey: ['workflow-configs'] })
      ]).then(() => {
        // eslint-disable-next-line no-console
        console.info('Refetched groups:', queryClient.getQueryData(['workflow-layout-groups']))
        // eslint-disable-next-line no-console
        console.info('Refetched workflows:', queryClient.getQueryData(['workflow-configs']))
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Refetch after updateWorkflowMapping failed', err)
      })

      setEditingWorkflowContext(null)
      showToast.success('Workflow mapping updated')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update workflow mapping')
    }
  })

  // Update a single stage mapping (submission/approval/rejection/completion)
  const updateStageMappingMutation = useMutation({
    mutationFn: async ({ groupId, stepKey, layoutId, layoutName }: { groupId: string; stepKey: string; layoutId?: string | null; layoutName?: string | null }) => {
      // Build new stage_mappings by taking the group's current mappings and applying the change
      const cache = queryClient.getQueryData(['workflow-layout-groups']) as any
      const list = Array.isArray(cache) ? cache as any[] : (cache?.data || [])
      const group = list.find((g: any) => g.id === groupId)
      const currentMappings = (group && group.stage_mappings) ? { ...group.stage_mappings } : {}
      if (layoutId) {
        currentMappings[stepKey] = { layout_id: layoutId, name: layoutName || '' }
      } else {
        // Clear mapping
        delete currentMappings[stepKey]
      }
      return formLayoutsApi.updateGroup(groupId, { stage_mappings: currentMappings })
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workflow-layout-groups'] })
      const previous = queryClient.getQueryData(['workflow-layout-groups'])
      try {
        queryClient.setQueryData(['workflow-layout-groups'], (old: any) => {
          if (!Array.isArray(old?.data ?? old)) return old
          const list = Array.isArray(old) ? old : old.data
          const updated = list.map((g: any) => {
            if (g.id !== variables.groupId) return g
            const nextMappings = { ...(g.stage_mappings || {}) }
            if (variables.layoutId) {
              nextMappings[variables.stepKey] = { layout_id: variables.layoutId, name: variables.layoutName || '' }
            } else {
              delete nextMappings[variables.stepKey]
            }
            return { ...g, stage_mappings: nextMappings }
          })
          return Array.isArray(old) ? updated : { ...(old || {}), data: updated }
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to optimistic update stage mapping', e)
      }
      return { previous }
    },
    onSuccess: (data, variables) => {
      // eslint-disable-next-line no-console
      console.info('updateStageMapping success', { data, variables })
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      queryClient.invalidateQueries({ queryKey: ['form-layouts', 'mapped'] })
      showToast.success('Stage mapping updated')
    },
    onError: (err, _variables, context: any) => {
      showToast.error((err as any)?.response?.data?.detail || 'Failed to update stage mapping')
      if (context?.previous) {
        queryClient.setQueryData(['workflow-layout-groups'], context.previous)
      }
    }
  })

  // Update business process name mutation
  const updateNameMutation = useMutation({
    mutationFn: async ({ groupId, name }: { groupId: string; name: string }) => {
      return formLayoutsApi.updateGroup(groupId, { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
      setEditingName(null)
      showToast.success('Business process name updated')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update business process name')
    }
  })

  const handleSaveWorkflowMapping = () => {
    if (!editingWorkflowContext) return
    // Debug: log what we're about to send to the server
    // eslint-disable-next-line no-console
    console.info('Saving workflow mapping:', editingWorkflowContext)
    updateWorkflowMappingMutation.mutate({
      groupId: editingWorkflowContext.groupId,
      workflow_config_id: editingWorkflowContext.workflow_config_id
    })
  }

  const handleCancelEditWorkflowContext = () => {
    setEditingWorkflowContext(null)
  }

  const handleStartEditEntities = (group: WorkflowLayoutGroup) => {
    setEditingEntities({ groupId: group.id, entities: [...group.covered_entities] })
  }

  const handleToggleEntity = (entityValue: string) => {
    if (!editingEntities) return
    const currentEntities = editingEntities.entities
    if (currentEntities.includes(entityValue)) {
      setEditingEntities({
        ...editingEntities,
        entities: currentEntities.filter(e => e !== entityValue)
      })
    } else {
      setEditingEntities({
        ...editingEntities,
        entities: [...currentEntities, entityValue]
      })
    }
  }

  const handleSaveEntities = () => {
    if (!editingEntities) return
    updateCoveredEntitiesMutation.mutate({
      groupId: editingEntities.groupId,
      coveredEntities: editingEntities.entities
    })
  }

  const handleCancelEditEntities = () => {
    setEditingEntities(null)
  }

  // Map step/action names to layout_type values
  // Simplified to 2 types: Submission and Approval
  // Actions: Submission → submission, Rejection → submission, Approval → approver, Completion → approver
  const getLayoutTypeForStep = (stepKey: string): string | null => {
    const stepLower = stepKey.toLowerCase().trim()
    // Match exact action names first, then check for partial matches
    if (stepLower === 'submission' || stepLower.includes('submission')) return 'submission'
    if (stepLower === 'rejection' || stepLower.includes('rejection')) return 'submission' // Rejection uses submission view
    if (stepLower === 'approval' || stepLower.includes('approval')) return 'approver'
    if (stepLower === 'completion' || stepLower.includes('completion')) return 'approver' // Completion uses approver view
    return null
  }

  // Get available forms from library for a specific step (filtered by layout_type)
  // Forms in library have layout_type attribute (submission, approver, completed)
  // Library just has forms, not related to workflow type
  // Show ALL forms that match the action's layout_type
  const getAvailableLayoutsForStep = (stepKey: string): FormLayout[] => {
    if (!allFormsFromLibrary) return []
    
    const layoutType = getLayoutTypeForStep(stepKey)
    if (!layoutType) {
      console.warn(`No layout_type found for step: ${stepKey}`)
      return []
    }
    
    // Filter by layout_type only - show all forms matching the action's type
    const matchingForms = allFormsFromLibrary.filter(layout => {
      // Must match the layout_type (forms can have multiple types, check if it includes this type)
      let layoutTypes: string[] = []
      if (layout.layout_type) {
        if (typeof layout.layout_type === 'string') {
          // Handle comma-separated layout_types (e.g., "submission,approver")
          layoutTypes = layout.layout_type.split(',').map(t => t.trim().toLowerCase())
        } else {
          layoutTypes = [String(layout.layout_type).toLowerCase()]
        }
      }
      
      // Check if the form's layout_type includes the action's required type
      const requiredType = layoutType.toLowerCase()
      let matches = layoutTypes.length > 0 && layoutTypes.includes(requiredType)
      
      // Backward compatibility: Handle deprecated types
      // Forms with "rejection" or "completed" types should still work
      if (!matches) {
        if (requiredType === 'submission' && (layoutTypes.includes('rejection') || layoutTypes.includes('submission'))) {
          matches = true
        } else if (requiredType === 'approver' && (layoutTypes.includes('completed') || layoutTypes.includes('approver'))) {
          matches = true
        }
      }
      
      return matches
    })
    
    // Debug logging (only in development with debug flag)
    if (process.env.NODE_ENV === 'development' && debugWorkflows) {
      console.log(`📋 Forms for action "${stepKey}" (layout_type: ${layoutType}):`, {
        totalForms: allFormsFromLibrary.length,
        matchingForms: matchingForms.length,
        formNames: matchingForms.map(f => f.name)
      })
    }
    
    return matchingForms
  }

  // Filter groups to only show those with actual stage mappings configured (not placeholders from seed script)
  // MUST be before early return to follow Rules of Hooks
  const groupsWithActualMappings = useMemo(() => {
    if (!groups || groups.length === 0) return []
    
    return groups.filter(group => {
      // Only show groups that have actual stage mappings with layout_ids
      const stageMappings = group.stage_mappings || {}
      const hasActualMappings = Object.values(stageMappings).some((mapping: any) => {
        return mapping && 
               typeof mapping === 'object' && 
               mapping.layout_id && 
               mapping.layout_id !== null && 
               mapping.layout_id !== 'null' &&
               mapping.layout_id !== 'undefined' &&
               mapping.layout_id.trim() !== ''
      })
      return hasActualMappings
    })
  }, [groups])

  const navigate = useNavigate()

  const handleOpenDesign = (layoutId?: string) => {
    if (!layoutId) {
      showToast.error('No layout mapped for this group')
      return
    }
    navigate(`/admin/form-library/designer/${layoutId}?mode=edit`)
  }

  if (groupsLoading || libraryLoading || formsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading configurations...</div>
      </div>
    )
  }

  // Define the standard steps we expect for every group if not provided (use lowercase keys that match stored mappings)
  // Simplified to 2 steps: Submission (for submission/rejection stages) and Approval (for approval/completed stages)
  const DEFAULT_STEPS = ['submission', 'approval']

  return (
    <Layout user={user}>
      <div className="w-full max-w-[98%] mx-auto p-6 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Workflow Layout Manager</h1>
            <p className="text-sm text-gray-600 mt-1">
              Link entities, workflows, and form steps into cohesive layout groups
            </p>
          </div>
          <MaterialButton
            onClick={handleCreateGroup}
            startIcon={<Plus className="w-4 h-4" />}
            variant="contained"
          >
            New Layout Group
          </MaterialButton>
        </div>

        <MaterialCard elevation={0} className="overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-sm font-semibold text-gray-900 w-[25%]">Business Process</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900 w-[20%]">Covered Entities</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900 w-[20%]">Workflow Context</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900 w-[25%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupsWithActualMappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-500">
                        <Settings className="w-8 h-8" />
                      </div>
                      <div className="text-gray-500 font-medium italic">No layout groups configured yet.</div>
                      <MaterialButton
                        variant="outlined"
                        onClick={handleCreateGroup}
                        size="small"
                      >
                        Create Default Group
                      </MaterialButton>
                    </div>
                  </td>
                </tr>
              ) : (
                groupsWithActualMappings.map((group) => {
                  const isExpanded = expandedGroups.has(group.id)

                  return (
                    <React.Fragment key={group.id}>
                      {/* Parent Row */}
                      <tr
                        data-group-id={group.id}
                        id={`group-row-${group.id}`}
                        className={`group hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : 'bg-white'} ${highlightedGroupId === group.id ? 'ring-2 ring-primary-500 bg-primary-50' : ''}`}
                      >
                        <td className="px-6 py-2.5 align-top">
                          <div className="flex items-start gap-3">
                            <button 
                              onClick={() => toggleGroup(group.id)}
                              className="mt-1 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {editingName?.groupId === group.id ? (
                                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                    <input
                                      type="text"
                                      value={editingName.name}
                                      onChange={(e) => setEditingName({ ...editingName, name: e.target.value })}
                                      className="flex-1 text-sm rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          if (editingName.name.trim()) {
                                            updateNameMutation.mutate({ groupId: group.id, name: editingName.name.trim() })
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingName(null)
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        if (editingName.name.trim()) {
                                          updateNameMutation.mutate({ groupId: group.id, name: editingName.name.trim() })
                                        }
                                      }}
                                      disabled={!editingName.name.trim() || updateNameMutation.isPending}
                                      className="p-1 hover:bg-green-50 rounded-lg text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                                      title="Save name"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingName(null)}
                                      className="p-1 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="font-medium text-gray-900 text-sm">{group.name}</div>
                                    <button
                                      onClick={() => setEditingName({ groupId: group.id, name: group.name })}
                                      className="p-1 hover:bg-primary-50 rounded-lg text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Edit name"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {group.is_default && (
                                  <MaterialChip label="Default" color="primary" size="small" variant="filled" className="text-xs h-5" />
                                )}
                                {(() => {
                                   // If any edit UI is open anywhere, hide clone/delete globally to avoid accidental clicks
                                   if (isAnyEditOpen) return null
                                   return (
                                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                       <button 
                                         onClick={() => cloneGroupMutation.mutate(group)}
                                         className="p-1 hover:bg-primary-50 rounded-lg text-blue-600 transition-colors" 
                                         title="Clone Group"
                                       >
                                         <Copy className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={async () => {
                                           const confirmed = await dialog.confirm({
                                             title: 'Delete Layout Group',
                                             message: 'Are you sure you want to delete this layout group? This action cannot be undone.',
                                             variant: 'destructive'
                                           })
                                           if (confirmed) {
                                             deleteGroupMutation.mutate(group.id)
                                           }
                                         }}
                                         className="p-1 hover:bg-error-50 rounded-lg text-red-600 transition-colors" 
                                         title="Delete Group"
                                       >
                                         <Trash2 className="w-3.5 h-3.5" />
                                       </button>
                                     </div>
                                   )
                                 })()}
                              </div>
                              {group.description && (
                                <div className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{group.description}</div>
                              )}
                              {/* Show a compact mapping summary so users can see step -> mapping at a glance */}
                              <div className="text-sm text-gray-600 mt-2">
                                {(() => {
                                  const mappingKeys = Object.keys(group.stage_mappings || {})
                                  const stepsToShow = mappingKeys.length > 0 ? mappingKeys : DEFAULT_STEPS
                                  const summary = stepsToShow.map((sk) => {
                                    const canonical = mappingKeys.find(k => k.toLowerCase() === sk.toLowerCase()) || sk
                                    const m = group.stage_mappings[canonical]
                                    const name = m && m.layout_id ? (m.name || m.layout_id) : 'Not mapped'
                                    const label = sk.charAt(0).toUpperCase() + sk.slice(1).toLowerCase()
                                    return `${label}: ${name}`
                                  }).slice(0, 2)
                                  return <div className="text-xs text-gray-500">{summary.join(' · ')}</div>
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-2.5 align-top">
                          {editingEntities?.groupId === group.id ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {availableEntities.map((entity) => {
                                  const isSelected = editingEntities.entities.includes(entity.value)
                                  return (
                                    <button
                                      key={entity.value}
                                      onClick={() => handleToggleEntity(entity.value)}
                                      className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                                        isSelected
                                          ? 'bg-primary-600 text-white font-medium'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                    >
                                      {entity.label}
                                    </button>
                                  )
                                })}
                              </div>
                              <div className="flex items-center gap-2 mt-2 z-10">
                                <button
                                  onClick={handleSaveEntities}
                                  disabled={updateCoveredEntitiesMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed z-10 font-medium"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEditEntities}
                                  disabled={updateCoveredEntitiesMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="flex flex-wrap gap-1.5 mt-0.5 flex-1">
                                {group.covered_entities.map((entity) => {
                                  const entityLabel = availableEntities.find(e => e.value === entity)?.label || entity.replace('_', ' ')
                                  return (
                                    <MaterialChip 
                                      key={entity}
                                      label={entityLabel}
                                      size="small"
                                      variant="filled"
                                      className="text-xs capitalize bg-gray-100 text-gray-700"
                                    />
                                  )
                                })}
                              </div>
                              <button
                                onClick={() => handleStartEditEntities(group)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary-50 rounded text-primary-600"
                                title="Edit covered entities"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-2.5 align-top">
                          {editingWorkflowContext?.groupId === group.id ? (
                            <div className="space-y-2 flex flex-col items-start">
                              <select
                                value={editingWorkflowContext.workflow_config_id || ''}
                                onChange={(e) => setEditingWorkflowContext({
                                  ...editingWorkflowContext,
                                  workflow_config_id: e.target.value || undefined
                                })}
                                disabled={updateWorkflowMappingMutation.isPending || groupsLoading}
                                className="w-full text-sm rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                              >
                                <option value="">-- Select Workflow --</option>
                                {workflows && workflows.length > 0 ? (
                                  workflows.map((workflow: WorkflowConfig) => (
                                    <option key={workflow.id} value={workflow.id}>
                                      {workflow.name} {workflow.is_default && '(Default)'}
                                    </option>
                                  ))
                                ) : (
                                  <option value="">No workflows configured</option>
                                )}
                              </select>
                              <div className="flex items-center gap-2 z-10">
                                <button
                                  onClick={handleSaveWorkflowMapping}
                                  disabled={updateWorkflowMappingMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed z-10 font-medium"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEditWorkflowContext}
                                  disabled={updateWorkflowMappingMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {/* Workflow name and type */}
                              <div className="flex flex-col">
                                {workflows && workflows.length > 0 && group.workflow_config_id ? (
                                  <>
                                    <div className="text-sm font-semibold text-gray-900">
                                      {workflows.find(w => w.id === group.workflow_config_id)?.name || 'Mapped'}
                                    </div>
                                    {group.request_type && (
                                      <div className="text-xs text-gray-500 mt-0.5">{formTypeLabels[group.request_type] || group.request_type}</div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="text-sm font-medium text-amber-600">Not configured</div>
                                    {group.request_type && (
                                      <div className="text-xs text-gray-500 mt-0.5">{formTypeLabels[group.request_type] || group.request_type}</div>
                                    )}
                                    <button
                                      onClick={() => setEditingWorkflowContext({ groupId: group.id, request_type: group.request_type || '', workflow_config_id: group.workflow_config_id })}
                                      className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium self-start"
                                    >
                                      Configure →
                                    </button>
                                  </>
                                )}
                              </div>
                              {/* Stage mapping controls - properly aligned */}
                              <div className="flex flex-col gap-2">
                                {DEFAULT_STEPS.map((stepKey) => {
                                  const canonical = Object.keys(group.stage_mappings || {}).find(k => k.toLowerCase() === stepKey.toLowerCase()) || stepKey
                                  const m = (group.stage_mappings || {})[canonical]
                                  const layoutId = m?.layout_id
                                  const available = getAvailableLayoutsForStep(canonical)
                                  return (
                                    <div key={stepKey} className="flex items-center gap-2">
                                      <div className="text-xs text-gray-600 font-medium w-20 flex-shrink-0">{stepKey.charAt(0).toUpperCase() + stepKey.slice(1)}</div>
                                      <select
                                        value={layoutId || ''}
                                        onChange={(e) => {
                                          const val = e.target.value || ''
                                          if (val === '') {
                                            updateStageMappingMutation.mutate({ groupId: group.id, stepKey: canonical, layoutId: null })
                                          } else {
                                            const chosen = available.find(a => a.id === val)
                                            updateStageMappingMutation.mutate({ groupId: group.id, stepKey: canonical, layoutId: val, layoutName: chosen?.name || undefined })
                                          }
                                        }}
                                        disabled={updateStageMappingMutation.isPending}
                                        className="flex-1 text-xs rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                                      >
                                        <option value="">-- Not mapped --</option>
                                        {available.length === 0 && (
                                          <option value="" disabled>No matching forms</option>
                                        )}
                                        {available.map((form) => (
                                          <option key={form.id} value={form.id}>{form.name || form.id}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-2.5 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <MaterialButton 
                              size="small" 
                              variant="outlined" 
                              onClick={() => handleOpenDesign(Object.values(group.stage_mappings || {})[0]?.layout_id)}
                              disabled={!Object.values(group.stage_mappings || {})[0]?.layout_id}
                            >
                              Open Design
                            </MaterialButton>
                            <MaterialButton 
                              size="small" 
                              variant="contained"
                              onClick={() => setEditingWorkflowContext({ groupId: group.id, request_type: group.request_type || '', workflow_config_id: group.workflow_config_id })}
                            >
                              Edit Mapping
                            </MaterialButton>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {DEFAULT_STEPS.map((step) => {
                                const canonical = Object.keys(group.stage_mappings || {}).find(k => k.toLowerCase() === step.toLowerCase()) || step
                                const m = (group.stage_mappings || {})[canonical]
                                const layoutId = m?.layout_id
                                // const layoutName = m?.name || 'Not mapped'
                                const available = getAvailableLayoutsForStep(canonical)
                                return (
                                  <div key={step} className="p-4 bg-white rounded-lg">
                                    <div className="text-xs font-semibold text-gray-900 mb-2">{step.charAt(0).toUpperCase() + step.slice(1)}</div>
                                    <div className="mt-2">
                                      <select
                                        value={layoutId || ''}
                                        onChange={(e) => {
                                          const val = e.target.value || ''
                                          if (val === '') {
                                            // Clear mapping
                                            updateStageMappingMutation.mutate({ groupId: group.id, stepKey: canonical, layoutId: null })
                                          } else {
                                            const chosen = available.find(a => a.id === val)
                                            updateStageMappingMutation.mutate({ groupId: group.id, stepKey: canonical, layoutId: val, layoutName: chosen?.name || undefined })
                                          }
                                        }}
                                        disabled={updateStageMappingMutation.isPending}
                                        className="w-full text-sm rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      >
                                        <option value="">-- Not mapped --</option>
                                        {available.length === 0 && (
                                          <option value="" disabled>No matching forms</option>
                                        )}
                                        {available.map((form) => (
                                          <option key={form.id} value={form.id}>{form.name || form.id}</option>
                                        ))}
                                      </select>
                                      <div className="mt-2 flex items-center gap-2">
                                        <button
                                          onClick={() => handleOpenDesign(layoutId)}
                                          disabled={!layoutId}
                                          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${layoutId ? 'text-primary-600 hover:bg-primary-50' : 'text-gray-400 cursor-not-allowed'}`}
                                        >
                                          Open Design
                                        </button>
                                        <button
                                          onClick={() => updateStageMappingMutation.mutate({ groupId: group.id, stepKey: canonical, layoutId: null })}
                                          className="text-sm px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                                        >
                                          Clear
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}

                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </MaterialCard>
      </div>
    </Layout>
  )
}
