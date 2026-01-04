import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formLayoutsApi, FormLayout, FormLayoutCreate, FormLayoutUpdate, SectionDefinition, CustomField, FieldAccessCreate } from '../lib/formLayouts'
import { masterDataListsApi } from '../lib/masterDataLists'
import { SubmissionRequirement } from '../lib/submissionRequirements'
import DeleteConfirmation from '../components/DeleteConfirmation'
import Layout from '../components/Layout'
import FormsDesigner from '../components/FormsDesigner'
import { authApi } from '../lib/auth'
import { ChevronDown, ChevronUp, ChevronRight, Plus, Shield, AlertTriangle, FolderOpen, FileText, CheckCircle2, Search, X, Save, ArrowLeft, Settings, List, Layers } from 'lucide-react'
import { showToast } from '../utils/toast'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'
import ReactQuillWrapper from '../components/ReactQuillWrapper'
import JsonFieldInput from '../components/JsonFieldInput'
import DiagramFieldInput from '../components/DiagramFieldInput'

interface GuidedStep {
  id: string
  step_number: number
  title: string
  description?: string
  section_ids: string[] // Sections to show in this step
  field_names?: string[] // Fields directly assigned to this step
  required_fields?: string[] // Names of fields that are required in this step
}

// CustomField interface is now imported from formLayouts.ts

// Field grouping by screen type
// Import form layout configuration
import { 
  DEFAULT_VENDOR_STEPS, 
  getScreenTypeConfig, 
  getBasicInformationStepNumber,
  getStandardFieldsForStep,
  isBasicInformationStep,
  getKeywordMappings
} from '../config/formLayoutConfig'

// Multi-select component with chips for selected items
interface MultiSelectProps {
  value: string | string[] | undefined
  onChange: (value: string | string[] | undefined) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

function MultiSelect({ value, onChange, options, placeholder = 'Select...', disabled = false, required = false }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse value: handle comma-separated strings, arrays, single strings, or undefined
  const selectedValues = useMemo(() => {
    if (!value) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      // Check if it's a comma-separated string
      if (value.includes(',')) {
        return value.split(',').map(v => v.trim()).filter(Boolean)
      }
      return [value]
    }
    return []
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Position dropdown
  useEffect(() => {
    if (isOpen && containerRef.current && dropdownRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      dropdownRef.current.style.top = `${rect.bottom + 4}px`
      dropdownRef.current.style.left = `${rect.left}px`
      dropdownRef.current.style.width = `${rect.width}px`
    }
  }, [isOpen])

  const handleToggle = (optionValue: string) => {
    if (disabled) return
    
    const isSelected = selectedValues.includes(optionValue)
    let newValues: string[]
    
    if (isSelected) {
      newValues = selectedValues.filter(v => v !== optionValue)
    } else {
      newValues = [...selectedValues, optionValue]
    }
    
    // Convert to single value if only one selected, otherwise keep as array
    if (newValues.length === 0) {
      onChange(undefined)
    } else if (newValues.length === 1) {
      onChange(newValues[0])
    } else {
      onChange(newValues)
    }
  }

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    
    const newValues = selectedValues.filter(v => v !== optionValue)
    if (newValues.length === 0) {
      onChange(undefined)
    } else if (newValues.length === 1) {
      onChange(newValues[0])
    } else {
      onChange(newValues)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`enterprise-input w-full min-h-[42px] flex items-start gap-1.5 flex-wrap p-2.5 cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'
        } ${required && selectedValues.length === 0 ? 'border-red-300' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ overflow: 'hidden' }}
      >
        {selectedValues.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 items-center" style={{ maxWidth: 'calc(100% - 24px)' }}>
            {selectedValues.map((val) => {
              const option = options.find(opt => opt.value === val)
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200"
                  style={{ maxWidth: '100%', flexShrink: 1 }}
                >
                  <span className="whitespace-nowrap truncate" style={{ maxWidth: '100px' }}>{option?.label || val}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(val, e)}
                      className="ml-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full p-0.5 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        ) : (
          <span className="text-gray-500 text-sm flex-1 min-w-0">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ marginLeft: 'auto' }} />
      </div>
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-auto"
          style={{ position: 'fixed' }}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToggle(option.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  isSelected ? 'bg-blue-50 font-medium' : ''
                }`}
              >
                <span className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}>
                  {isSelected && <span className="text-white text-xs">✓</span>}
                </span>
                <span className="flex-1">{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Helper function to auto-assign fields to steps based on step title and field keywords
function assignFieldsToStep(
  stepTitle: string,
  stepDescription: string,
  allFields: Array<{ field_name: string; label: string; source: string; description?: string; category?: string; section?: string }>
): string[] {
  const stepTitleLower = stepTitle.toLowerCase()
  const stepDescLower = stepDescription.toLowerCase()
  const assignedFields: string[] = []
  const usedFields = new Set<string>()

  // Get keyword mappings from configuration (can be tenant-specific)
  const keywordMappings = getKeywordMappings()

  // Find matching keywords for this step
  const matchingKeywords: string[] = []
  for (const [key, keywords] of Object.entries(keywordMappings)) {
    if (stepTitleLower.includes(key) || stepDescLower.includes(key)) {
      matchingKeywords.push(...keywords)
    }
  }

  // Assign fields that match keywords
  allFields.forEach((field) => {
    if (usedFields.has(field.field_name)) return

    const fieldNameLower = field.field_name.toLowerCase()
    const fieldLabelLower = field.label.toLowerCase()
    const fieldDescLower = (field.description || '').toLowerCase()
    const fieldCategoryLower = (field.category || '').toLowerCase()
    const fieldSectionLower = (field.section || '').toLowerCase()

    // Check if field matches any keyword
    const matches = matchingKeywords.some(keyword => 
      fieldNameLower.includes(keyword) ||
      fieldLabelLower.includes(keyword) ||
      fieldDescLower.includes(keyword) ||
      fieldCategoryLower.includes(keyword) ||
      fieldSectionLower.includes(keyword)
    )

    if (matches) {
      assignedFields.push(field.field_name)
      usedFields.add(field.field_name)
    }
  })

  // For basic information step, also include standard fields
  const requestType = 'vendor_submission_workflow' // TODO: Get from context or parameter
  const basicStepNumber = getBasicInformationStepNumber(requestType)
  if (basicStepNumber !== null && stepTitleLower.includes('basic information')) {
    const basicFields = getStandardFieldsForStep(requestType, basicStepNumber)
    allFields.forEach((field) => {
      if (usedFields.has(field.field_name)) return
      const fieldNameLower = field.field_name.toLowerCase()
      if (basicFields.some(bf => fieldNameLower.includes(bf) || fieldNameLower === bf)) {
        assignedFields.push(field.field_name)
        usedFields.add(field.field_name)
      }
    })
  }

  return assignedFields
}

// Helper function to create default steps matching the vendor submission form
function createDefaultStepsFromFields(
  fields: Array<{ field_name: string; label: string; source: string; description?: string; category?: string; section?: string }>,
  requestType: string
): GuidedStep[] {
  // For vendor type, use the exact 10-step structure and auto-assign fields
  if (requestType === 'vendor_submission_workflow') {
    return DEFAULT_VENDOR_STEPS.map((step) => {
      // Auto-assign relevant fields to this step
      const assignedFields = assignFieldsToStep(step.title, step.description, fields)
      
      return {
        id: `step-${step.id}`,
        step_number: step.id,
        title: step.title, // Store clean title without "Step X:" prefix
        description: step.description,
        section_ids: [],
        field_names: assignedFields, // Auto-assign fields based on step content
      }
    })
  }

  // For other screen types, create basic steps with auto-assigned fields
  // Try to assign fields based on step titles and available fields
  const steps: GuidedStep[] = []
  const defaultStepTitles = [
    'Basic Information',
    'Details',
    'Configuration',
    'Requirements',
    'Capabilities',
    'Integration',
    'Security',
    'Compliance',
    'Documentation',
    'Review'
  ]
  
  for (let i = 1; i <= 10; i++) {
    const stepTitle = defaultStepTitles[i - 1] || `Step ${i}`
    const stepDesc = `Information about ${stepTitle.toLowerCase()}`
    // Auto-assign relevant fields to each step
    const assignedFields = assignFieldsToStep(stepTitle, stepDesc, fields)
    
    steps.push({
      id: `step-${i}`,
      step_number: i,
      title: stepTitle,
      description: stepDesc,
      section_ids: [],
      field_names: assignedFields, // Seed with default fields
    })
  }
  return steps
}

export default function FormDesignerEditor() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // Handle case where id is undefined - treat as new layout
  // Special case: 'default-layouts' is a virtual layout that aggregates all layouts
  const isNew = !id || id === 'new' || id === 'default-layouts'
  const viewMode = searchParams.get('mode') === 'view'
  const isEdit = isNew || (!viewMode) // New layouts are always in edit mode, existing ones default to edit unless view mode
  const requestTypeParam = searchParams.get('request_type') as 'agent_onboarding_workflow' | 'vendor_submission_workflow' | 'assessment_workflow' | null
  const groupId = searchParams.get('group_id')

  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'steps' | 'roles' | 'preview'>('steps') // Default to steps for simplicity
  // Initialize editingLayout - start with null, will be set in useEffect
  const [editingLayout, setEditingLayout] = useState<Partial<FormLayoutCreate> | null>(null)
  // Initialize covered entities based on request type
  const getDefaultCoveredEntities = (requestType: string | null | undefined): string[] => {
    if (requestType === 'assessment_workflow') {
      return ['vendor', 'agent', 'users', 'workflow_ticket', 'assessments']
    }
    return ['vendor', 'agent', 'users', 'workflow_ticket']
  }
  
  const [coveredEntities, setCoveredEntities] = useState<string[]>(getDefaultCoveredEntities(requestTypeParam))
  // 2-step guided process for both new and edit modes
  const [currentStep, setCurrentStep] = useState<1 | 2>(1) // Step 1: Design Forms, Step 2: Review & Submit
  const [layoutId, setLayoutId] = useState<string | null>(id || null) // Store created layout ID after step 1
  const [guidedSteps, setGuidedSteps] = useState<GuidedStep[]>([])
  const [previewFormData, setPreviewFormData] = useState<Record<string, any>>({})
  const [roleMatrix, setRoleMatrix] = useState<Record<string, Record<string, { show: boolean; edit: boolean; hide: boolean }>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  // Layout Settings collapse/expand state
  const [isLayoutSettingsExpanded, setIsLayoutSettingsExpanded] = useState(true)
  // Design Tools (Library) collapse/expand state
  const [isDesignToolsExpanded, setIsDesignToolsExpanded] = useState(false)
  const [showLibraryList, setShowLibraryList] = useState(false)
  // Fields panel collapse/expand state
  const [isFieldsPanelExpanded, setIsFieldsPanelExpanded] = useState(true)
  // Fields panel state
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')
  const [fieldSourceFilter, setFieldSourceFilter] = useState<string>('all')
  const [fieldCategoryFilter, setFieldCategoryFilter] = useState<string>('all')
  const [expandedEntityGroups, setExpandedEntityGroups] = useState<Set<string>>(new Set())
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const customFieldsRef = useRef<CustomField[]>([])
  // Ref to track if fields have been assigned to existing layouts
  const fieldsAssignedRef = useRef<boolean>(false)
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  
  // Sync customFields to ref for use in handleSaveLayout
  useEffect(() => {
    customFieldsRef.current = customFields
  }, [customFields])

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])

  // Ref to track if layout has been initialized to prevent infinite loops
  const layoutInitializedRef = useRef<boolean>(false)
  const lastRequestTypeRef = useRef<string | null>(null)

  // Initialize layout for new layouts - this MUST run immediately and before other effects
  useEffect(() => {
    if (isNew && !layoutInitializedRef.current) {
      const requestType = requestTypeParam || 'vendor_submission_workflow'
      console.log('Initializing new layout with request type:', requestType, 'id:', id, 'isNew:', isNew)
      const config = getScreenTypeConfig(requestType || 'vendor_submission_workflow')
      const defaultSections = config.defaultSteps.map((step, idx) => ({
        id: `section-${Date.now()}-${step.id}`,
        title: step.title,
        description: step.description,
        fields: step.standardFields || [],
        order: idx + 1,
      }))

      // Forms are workflow-agnostic - no request_type or workflow_stage
      setEditingLayout({
        name: 'New Form',
        // request_type: undefined, // Forms don't have request_type
        layout_type: 'submission', // Default to submission layout type
        // workflow_stage: undefined, // Forms don't have workflow_stage
        sections: defaultSections,
        is_default: false,
        is_template: true, // Mark as form
      })
      setGuidedSteps([])
      layoutInitializedRef.current = true
      lastRequestTypeRef.current = requestType
    } else if (isNew && layoutInitializedRef.current && requestTypeParam) {
      // Update request type if it changed (only if different from last)
      const requestType = requestTypeParam || 'vendor_submission_workflow'
      if (lastRequestTypeRef.current !== requestType) {
        console.log('Updating layout request type to:', requestType)
        // Forms don't have request_type - workflow connection is via process mapping
        setEditingLayout(prev => prev ? {
          ...prev,
          name: 'New Form',
          // request_type: undefined, // Forms are workflow-agnostic
        } : null)
        lastRequestTypeRef.current = requestType
      }
    }
    
    // Reset initialization flag when switching between new/edit modes or changing id
    if (!isNew) {
      layoutInitializedRef.current = false
      lastRequestTypeRef.current = null
    }
  }, [isNew, requestTypeParam, id]) // Removed editingLayout from dependencies to prevent infinite loop

  // Debug logging - must be after editingLayout is declared (only log on meaningful changes)
  useEffect(() => {
    console.log('FormDesignerEditor mount/update:', { id, isNew, requestTypeParam, editingLayout: !!editingLayout })
  }, [id, isNew, requestTypeParam]) // Removed editingLayout to reduce log spam

  const queryClient = useQueryClient()

  // Fetch all layouts for default-layouts view
  const { data: allLayoutsForDefault } = useQuery({
    queryKey: ['form-layouts', 'all', user?.tenant_id],
    queryFn: async () => {
      const layouts = await formLayoutsApi.list(undefined, undefined, true)
      return Array.isArray(layouts) ? layouts : []
    },
    enabled: !!user && !!user.tenant_id && id === 'default-layouts',
  })

  // Fetch group if provided to get covered_entities
  const { data: layoutGroup } = useQuery({
    queryKey: ['workflow-layout-group', groupId],
    queryFn: () => formLayoutsApi.getGroup(groupId!),
    enabled: !!groupId,
  })

  // Fetch form library for lookup
  const { data: library } = useQuery({
    queryKey: ['form-library'],
    queryFn: () => formLayoutsApi.getLibrary(),
    enabled: !!user,
  })

  const [showLibraryModal, setShowLibraryModal] = useState(false)

  // Sync covered_entities from group if it exists, or set defaults based on request type
  useEffect(() => {
    if (layoutGroup?.covered_entities) {
      setCoveredEntities(layoutGroup.covered_entities)
    } else if (editingLayout?.request_type) {
      // If no group, set defaults based on request type
      const requestType = Array.isArray(editingLayout.request_type) 
        ? editingLayout.request_type[0] 
        : editingLayout.request_type
      const defaults = getDefaultCoveredEntities(requestType)
      if (!coveredEntities.includes('assessments') && defaults.includes('assessments')) {
        setCoveredEntities(defaults)
      }
    } else if (requestTypeParam === 'assessment_workflow') {
      // For new assessment workflow layouts, include assessments
      const defaults = getDefaultCoveredEntities(requestTypeParam)
      setCoveredEntities(defaults)
    }
  }, [layoutGroup, editingLayout?.request_type, requestTypeParam])

  // Fetch layout if editing (only if we have a valid id and it's not 'new' or 'default-layouts')
  const { data: existingLayout, isLoading: layoutLoading, error: layoutError } = useQuery({
    queryKey: ['form-layout', id],
    queryFn: () => formLayoutsApi.get(id!).catch((error: any) => {
      // Handle 403 errors gracefully
      if (error?.response?.status === 403) {
        // Use console.warn for expected 403 errors (tenant isolation is working as designed)
        console.warn('Access denied to layout. It may belong to a different tenant.', {
          layoutId: id,
          status: error?.response?.status,
          detail: error?.response?.data?.detail
        })
        // Return null to indicate access denied, don't throw
        return null
      }
      throw error
    }),
    enabled: !isNew && !!id && id !== 'new' && id !== 'default-layouts' && !!user,
    retry: false, // Don't retry on 403 errors
  })

  // Fetch all available fields
  const { data: availableFieldsData, isLoading: fieldsLoading, error: fieldsError } = useQuery({
    queryKey: ['available-fields'],
    queryFn: () => formLayoutsApi.getAvailableFields(),
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data to get updated field_config
  })

  // Fetch field access controls - only when we have a valid request_type
  const { data: fieldAccessList } = useQuery({
    queryKey: ['field-access', editingLayout?.request_type, editingLayout?.workflow_stage],
    queryFn: () => {
      const requestType = editingLayout?.request_type
      // Validate request_type matches backend pattern before making request
      if (!requestType || !['agent_onboarding_workflow', 'vendor_submission_workflow', 'assessment_workflow'].includes(requestType)) {
        return Promise.resolve([])
      }
      // Include workflow_stage when fetching field access, but only if it's a valid value
      // Valid workflow stages: new, in_progress, pending_approval, approved, rejected, closed, cancelled, pending_review, needs_revision
      const validWorkflowStages = ['new', 'in_progress', 'pending_approval', 'approved', 'rejected', 'closed', 'cancelled', 'pending_review', 'needs_revision']
      const workflowStage = editingLayout?.workflow_stage
      const safeWorkflowStage = workflowStage && validWorkflowStages.includes(workflowStage) ? workflowStage : undefined
      
      return formLayoutsApi.listFieldAccess(requestType, safeWorkflowStage, undefined, true).catch((error) => {
        // Handle 400 and 422 errors gracefully (validation errors or missing data)
        // These are expected when field access hasn't been configured yet
        if (error?.response?.status === 400 || error?.response?.status === 422) {
          return []
        }
        throw error
      })
    },
    enabled: !!user && !!editingLayout?.request_type && ['agent_onboarding_workflow', 'vendor_submission_workflow', 'assessment_workflow'].includes(editingLayout.request_type),
    retry: false, // Don't retry on validation errors
  })

  // Fetch master data lists for dropdown binding
  const { data: masterDataLists } = useQuery({
    queryKey: ['master-data-lists'],
    queryFn: () => masterDataListsApi.list(undefined, true),
    enabled: !!user,
  })

  // Fetch workflow types from master data
  const { data: workflowTypes } = useQuery({
    queryKey: ['workflow-types'],
    queryFn: () => formLayoutsApi.getWorkflowTypes(),
    enabled: !!user,
  })

  // Initialize layout when existing layout data loads
  useEffect(() => {
    if (!isNew && existingLayout) {
      // Reset fields assigned ref when loading a new layout
      // Note: stepsInitializedRef is in StepsTab scope, will be handled there
      fieldsAssignedRef.current = false
      
      // Set layout ID if we're editing an existing layout
      setLayoutId(existingLayout.id)
      setCurrentStep(1) // Directly open design form for existing layouts
      
      // Convert single values or comma-separated strings to arrays for multi-select compatibility
      // Backend stores single values or comma-separated strings, but frontend multi-selects expect arrays
      const requestType = existingLayout.request_type
      const workflowStage = existingLayout.workflow_stage
      const layoutType = existingLayout.layout_type || (workflowStage ? 
        (workflowStage === 'new' || workflowStage === 'needs_revision' ? 'submission' :
         workflowStage === 'pending_approval' || workflowStage === 'pending_review' || workflowStage === 'in_progress' ? 'approver' :
         'completed') : 'submission')
      const agentType = existingLayout.agent_type
      
      // Helper function to convert value to array (handles single values, arrays, and comma-separated strings)
      const toArray = (value: any): string[] => {
        if (!value) return []
        if (Array.isArray(value)) return value
        if (typeof value === 'string') {
          // Check if it's a comma-separated string
          if (value.includes(',')) {
            return value.split(',').map(v => v.trim()).filter(v => v.length > 0)
          }
          return [value]
        }
        return []
      }
      
      setEditingLayout({
        name: existingLayout.name,
        // Convert to arrays for multi-select (will be converted back to comma-separated strings on save)
        request_type: toArray(requestType) as any,
        workflow_stage: (toArray(workflowStage).length > 0 ? toArray(workflowStage) : ['new']) as any,
        layout_type: (toArray(layoutType).length > 0 ? toArray(layoutType) : ['submission']) as any,
        agent_type: (toArray(agentType).length > 0 ? toArray(agentType) : undefined) as any,
        description: existingLayout.description,
        sections: existingLayout.sections,
        agent_category: existingLayout.agent_category,
        field_dependencies: existingLayout.field_dependencies,
        custom_fields: existingLayout.custom_fields,
        is_default: existingLayout.is_default,
      })
      
      // Load custom fields if they exist
      if (existingLayout.custom_fields && Array.isArray(existingLayout.custom_fields)) {
        setCustomFields(existingLayout.custom_fields)
      }
      // Initialize guided steps from sections (if stored, otherwise create from sections)
      if (existingLayout.sections && existingLayout.sections.length > 0) {
        const steps: GuidedStep[] = existingLayout.sections
          .sort((a, b) => (a.order || 0) - (b.order || 0)) // Ensure proper order
          .map((section, idx) => {
            // Strip any existing "Step N:" prefix from section.title to avoid duplication
            // Store clean title without prefix - we'll add prefix only when displaying
            const cleanTitle = section.title?.replace(/^Step \d+:\s*/i, '') || section.title || `Step ${idx + 1}`
            // Ensure unique ID: use section.id if available, otherwise generate unique ID based on order and index
            const uniqueId = section.id || `step-${section.order || idx + 1}-${idx}`
            return {
              id: uniqueId,
              step_number: section.order || idx + 1,
              title: cleanTitle, // Store clean title without "Step X:" prefix
              description: section.description || '',
              section_ids: [section.id || uniqueId],
              field_names: Array.isArray(section.fields) ? section.fields : [], // Ensure it's an array
              required_fields: Array.isArray(section.required_fields) ? section.required_fields : [],
            }
          })
        console.log('Loading steps from existing layout:', steps)
        console.log('Steps with fields:', steps.map(s => ({ id: s.id, title: s.title, fieldCount: s.field_names?.length || 0 })))
        setGuidedSteps(steps)
      } else {
        console.warn('No sections found in existing layout:', existingLayout)
      }
    } else if (id === 'default-layouts' && allLayoutsForDefault && allLayoutsForDefault.length > 0) {
      // Create aggregated default layout from all existing layouts
      const aggregatedSections: SectionDefinition[] = allLayoutsForDefault.flatMap((layout) => 
        (layout.sections || []).map((section: SectionDefinition, sectionIdx: number) => ({
          ...section,
          id: `${layout.id}-${section.id || `section-${sectionIdx}`}`,
          title: `${layout.name} - ${section.title}`,
        }))
      )
      
      setEditingLayout({
        name: 'default-Layouts',
        request_type: 'all' as any,
        description: 'Default layout containing all form layouts and configurations',
        sections: aggregatedSections,
        agent_type: undefined,
        agent_category: undefined,
        field_dependencies: undefined,
        is_default: true,
      })
      
      // Initialize guided steps from aggregated sections
      if (aggregatedSections.length > 0) {
        const steps: GuidedStep[] = aggregatedSections.map((section, idx) => ({
          id: section.id || `step-${idx + 1}`,
          step_number: idx + 1,
          title: section.title,
          description: section.description,
          section_ids: [section.id || `step-${idx + 1}`],
          field_names: section.fields || [],
        }))
        setGuidedSteps(steps)
      }
    }
  }, [isNew, existingLayout, id, allLayoutsForDefault])

  // Build role matrix from field access
  useEffect(() => {
    if (editingLayout?.sections) {
      const matrix: Record<string, Record<string, { show: boolean; edit: boolean; hide: boolean }>> = {}
      
      editingLayout.sections.forEach((section) => {
        section.fields.forEach((fieldName) => {
          if (!matrix[fieldName]) {
            matrix[fieldName] = {}
          }
          
          const access = fieldAccessList?.find((fa) => fa.field_name === fieldName)
          if (access) {
            Object.entries(access.role_permissions || {}).forEach(([role, perms]) => {
              matrix[fieldName][role] = {
                show: perms.view || false,
                edit: perms.edit || false,
                hide: !perms.view || false,
              }
            })
          }
          
          // Initialize with defaults for roles that don't have access defined
          ['tenant_admin', 'compliance_reviewer'].forEach((role) => {
            if (!matrix[fieldName][role]) {
              matrix[fieldName][role] = { show: true, edit: true, hide: false }
            }
          })
        })
      })
      setRoleMatrix(matrix)
    }
  }, [fieldAccessList, editingLayout?.sections])

  // Create/Update mutations
  const createLayoutMutation = useMutation({
    mutationFn: (layout: FormLayoutCreate) => formLayoutsApi.create(layout),
    onSuccess: (createdLayout) => {
      // Invalidate both form-layouts and form-library queries (forms are saved to library)
      queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
      queryClient.invalidateQueries({ queryKey: ['form-library'] })
      if (currentStep === 1) {
        // Just created for the first time, save ID and move to review
        setLayoutId(createdLayout.id)
        setCurrentStep(2)
        // Update URL to include the layout ID
        navigate(`/admin/form-designer/${createdLayout.id}`, { replace: true })
        queryClient.invalidateQueries({ queryKey: ['form-layout', createdLayout.id] })
      } else if (currentStep === 2) {
        // Finished review and submitted
        navigate('/admin/form-designer')
      }
    },
    onError: (error: any) => {
      console.error('Failed to create layout:', error)
      console.error('Error response:', error?.response?.data)
      console.error('Error status:', error?.response?.status)
      console.error('Full error:', JSON.stringify(error?.response?.data, null, 2))
      // Show detailed error message
      const errorDetail = error?.response?.data?.detail
      const errorMessage = Array.isArray(errorDetail) 
        ? errorDetail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
        : (typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail))
      showToast.error(`Failed to save layout: ${errorMessage || error.message}`)
    },
  })

  const updateLayoutMutation = useMutation({
    mutationFn: ({ id, layout }: { id: string; layout: FormLayoutUpdate }) =>
      formLayoutsApi.update(id, layout),
    onSuccess: () => {
      // Invalidate both form-layouts and form-library queries (forms are in library)
      queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
      queryClient.invalidateQueries({ queryKey: ['form-library'] })
      if (currentStep === 2) {
        // Finished review and submitted
        navigate('/admin/form-designer')
      } else {
        // Just saved from design view, maybe?
        navigate('/admin/form-designer')
      }
    },
    onError: (error: any) => {
      const errorStatus = error?.response?.status
      const errorDetail = error?.response?.data?.detail
      const errorData = error?.response?.data
      
      if (errorStatus === 403) {
        // Use console.warn instead of console.error for expected 403 errors
        console.warn('Access denied to update layout. It may belong to a different tenant.', {
          layoutId: id,
          status: errorStatus,
          detail: errorDetail
        })
        showToast.error('Access Denied: You don\'t have permission to update this layout. It may belong to a different tenant.')
        // Navigate back to list on 403
        navigate('/admin/form-designer')
        return
      }
      
      // Log detailed error information for debugging
      console.error('Failed to update layout:', error)
      console.error('Error status:', errorStatus)
      console.error('Error response data:', errorData)
      console.error('Full error object:', JSON.stringify(errorData, null, 2))
      
      // Extract detailed error message
      let errorMessage = 'Unknown error'
      if (errorDetail) {
        if (Array.isArray(errorDetail)) {
          // Pydantic validation errors
          errorMessage = errorDetail.map((e: any) => {
            const field = e.loc?.join('.') || 'unknown'
            return `${field}: ${e.msg}`
          }).join('\n')
        } else if (typeof errorDetail === 'string') {
          errorMessage = errorDetail
        } else if (typeof errorDetail === 'object') {
          errorMessage = JSON.stringify(errorDetail, null, 2)
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      showToast.error(`Failed to save layout: ${errorMessage}`)
    },
  })

  // Helper function to format field display as entity.fieldname (for designer only)
  const getFieldDisplayName = (field: {
    field_name: string
    label?: string
    entity_name?: string
    source?: string
  }): string => {
    const entityName = field.entity_name || 
      (field.source?.startsWith('entity:') ? field.source.replace('entity:', '') : null) ||
      (field.source === 'agent' ? 'agents' : null) ||
      (field.source === 'agent_metadata' ? 'agent_metadata' : null) ||
      (field.source === 'custom_field' ? 'custom' : null) ||
      (field.source === 'master_data' ? 'master_data' : null) ||
      (field.source === 'logged_in_user' ? 'users' : null) ||
      (field.source === 'entity_business_owner' ? 'business_owner' : null) ||
      (field.source === 'workflow_ticket' ? 'workflow_ticket' : null) ||
      null
    
    const fieldLabel = field.label || field.field_name
    if (entityName && entityName !== 'custom' && entityName !== 'master_data') {
      return `${entityName}.${field.field_name}`
    }
    return fieldLabel
  }

  // Combine all available fields from different sources
  // Use a Map to deduplicate by field_name + source combination
  // Include category and section info for grouping
  // This function MUST be defined before availableFieldsList is computed
  const getAllAvailableFields = (): Array<{ 
    field_name: string; 
    label: string; 
    source: string; 
    description?: string; 
    category?: string; 
    section?: string; 
    entity_name?: string; 
    entity_label?: string; 
    entity_user_level?: string;
    master_data_list_id?: string; 
    master_data_list_type?: string; 
    visible_if_user_position?: string[]; 
    visible_if_user_role?: string[]; 
    visible_if_user_department?: string[]; 
    field_type?: string 
  }> => {
    const fieldsMap = new Map<string, { 
      field_name: string; 
      label: string; 
      source: string; 
      description?: string; 
      category?: string; 
      section?: string; 
      entity_name?: string; 
      entity_label?: string; 
      entity_user_level?: string;
      master_data_list_id?: string; 
      master_data_list_type?: string; 
      visible_if_user_position?: string[]; 
      visible_if_user_role?: string[]; 
      visible_if_user_department?: string[]; 
      field_type?: string 
    }>()
    
    if (availableFieldsData) {
      // Agent fields
      if (availableFieldsData.agent && Array.isArray(availableFieldsData.agent)) {
        availableFieldsData.agent.forEach((field: any) => {
          const key = `${field.field_name}-agent`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: 'agent',
              description: field.description,
              category: field.category || 'Agent',
              section: field.section,
              entity_name: field.entity_name || 'agents',  // Ensure entity_name is set for grouping
              entity_label: field.entity_label || 'Agents',  // Ensure entity_label is set
              entity_user_level: field.entity_user_level || 'business',
              field_type: field.field_type || 'text',
              field_config: field.field_config || null  // Include field configuration
            } as any)  // Type assertion to allow field_config
          }
        })
      }
      
      // Agent metadata fields - ensure they have entity_name for grouping
      if (availableFieldsData.agent_metadata && Array.isArray(availableFieldsData.agent_metadata)) {
        availableFieldsData.agent_metadata.forEach((field: any) => {
          const key = `${field.field_name}-agent_metadata`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: 'agent_metadata',
              description: field.description,
              category: field.category || 'Agent Metadata',
              section: field.section,
                    entity_name: field.entity_name || 'agent_metadata',  // Ensure entity_name is set for grouping
                    entity_label: field.entity_label || 'Agent Metadata',  // Ensure entity_label is set
              entity_user_level: field.entity_user_level || 'business',
                    field_type: field.field_type || 'text',
                    field_config: field.field_config || null  // Include field configuration
                } as any)  // Type assertion to allow field_config
          }
        })
      }
      
      // Custom fields from Entity and Fields Catalog
      if (availableFieldsData.custom_fields && Array.isArray(availableFieldsData.custom_fields)) {
        availableFieldsData.custom_fields.forEach((field: any) => {
          const key = `${field.field_name}-custom_field`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: 'custom_field',
              description: field.description,
              category: 'Custom Fields',
              section: 'Custom',
              entity_name: field.entity_name,
              entity_label: field.entity_label,
              entity_user_level: 'business', // Custom fields are always business level
              field_type: field.field_type || 'text',
              field_config: field.field_config || null  // Include field configuration for special fields
            } as any)  // Type assertion to allow field_config
          }
        })
      }
      
      // All other entity types (vendors, assessments, etc.)
      if (availableFieldsData.entity_fields && typeof availableFieldsData.entity_fields === 'object') {
        Object.entries(availableFieldsData.entity_fields).forEach(([entityName, fields]: [string, any]) => {
          if (Array.isArray(fields)) {
            fields.forEach((field: any) => {
              const key = `${field.field_name}-entity-${entityName}`
              if (!fieldsMap.has(key)) {
                fieldsMap.set(key, {
                  field_name: field.field_name,
                  label: field.label,
                  source: `entity:${entityName}`,
                  description: field.description,
                  category: field.entity_label || entityName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                  section: field.entity_label || entityName,
                  entity_name: field.entity_name || entityName,
                  entity_label: field.entity_label,
                  entity_user_level: field.entity_user_level || 'business',
                  visible_if_user_position: field.visible_if_user_position,
                  visible_if_user_role: field.visible_if_user_role,
                  visible_if_user_department: field.visible_if_user_department,
                  field_type: field.field_type || 'text',
                  field_config: field.field_config || null  // Include field configuration
                } as any)  // Type assertion to allow field_config
              }
            })
          }
        })
      }
      
      // Master data lists as selectable fields
      if (availableFieldsData.master_data && Array.isArray(availableFieldsData.master_data)) {
        availableFieldsData.master_data.forEach((field: any) => {
          const key = `${field.field_name}-master_data`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: `master_data:${field.master_data_list_type || 'unknown'}`,
              description: field.description,
              category: 'Master Data',
              section: 'Master Data Lists',
              entity_user_level: 'business',
              master_data_list_id: field.master_data_list_id,
              master_data_list_type: field.master_data_list_type,
              field_type: field.field_type || (field.field_type === 'multi_select' ? 'multi_select' : 'select')
            })
          }
        })
      }
      
      // Entity Business Owner attributes (owner/contact of the entity being submitted)
      if (availableFieldsData.entity_business_owner && Array.isArray(availableFieldsData.entity_business_owner)) {
        availableFieldsData.entity_business_owner.forEach((field: any) => {
          const key = `${field.field_name}-entity_business_owner`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: 'entity_business_owner',
              description: field.description,
              category: 'Entity Business Owner',
              section: field.entity_label || 'Business Owner',
              entity_name: field.entity_name,
              entity_label: field.entity_label,
              entity_user_level: 'business',
              visible_if_user_position: field.visible_if_user_position,
              visible_if_user_role: field.visible_if_user_role,
              visible_if_user_department: field.visible_if_user_department
            })
          }
        })
      }
      
      // Logged-in User attributes (current user filling the form)
      if (availableFieldsData.logged_in_user && Array.isArray(availableFieldsData.logged_in_user)) {
        availableFieldsData.logged_in_user.forEach((field: any) => {
          const key = `${field.field_name}-logged_in_user`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: 'logged_in_user',
              description: field.description,
              category: 'Logged-in User',
              section: 'Current User Attributes',
              entity_name: field.entity_name || 'users',
              entity_label: field.entity_label || 'Logged-in User (Current User)',
              entity_user_level: 'business',
              visible_if_user_position: field.visible_if_user_position,
              visible_if_user_role: field.visible_if_user_role,
              visible_if_user_department: field.visible_if_user_department
            })
          }
        })
      }

      // Workflow Ticket attributes (NEW)
      if (availableFieldsData.workflow_ticket && Array.isArray(availableFieldsData.workflow_ticket)) {
        availableFieldsData.workflow_ticket.forEach((field: any) => {
          const key = `${field.field_name}-workflow_ticket`
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              field_name: field.field_name,
              label: field.label,
              source: 'workflow_ticket',
              description: field.description,
              category: 'Workflow Ticket',
              section: 'Ticket Details',
              entity_name: 'workflow_ticket',
              entity_label: 'Workflow Ticket',
              entity_user_level: 'advanced',
              field_type: field.field_type || 'text'
            })
          }
        })
      }
    }
    
    return Array.from(fieldsMap.values())
  }

  // Memoize availableFieldsList to avoid recreating it on every render
  const availableFieldsList = useMemo(() => {
    const fields = getAllAvailableFields()
    
    // Filter fields based on covered entities
    if (coveredEntities && coveredEntities.length > 0) {
      const covered = new Set(coveredEntities.map(e => e.toLowerCase()))
      
      return fields.filter(field => {
        const source = field.source?.toLowerCase() || ''
        
        // Always include custom fields and master data
        if (source === 'custom_field' || source.startsWith('master_data:')) return true
        
        // Map field source to layout group entities
        if (source === 'agent' && covered.has('agent')) return true
        if (source === 'agent_metadata' && covered.has('agent')) return true // metadata is part of agent entity
        if (source === 'vendor' && covered.has('vendor')) return true
        if (source === 'users' && covered.has('users')) return true
        if (source === 'logged_in_user' && covered.has('users')) return true
        if (source === 'workflow_ticket' && covered.has('workflow_ticket')) return true
        if (source === 'assessments' && covered.has('assessments')) return true
        
        // Handle direct entity matching
        if (source.startsWith('entity:')) {
          const entityName = source.replace('entity:', '')
          // Check exact match
          if (covered.has(entityName)) return true
          // Handle plural/singular variations (vendors -> vendor, users -> user)
          if (entityName === 'vendors' && covered.has('vendor')) return true
          if (entityName === 'users' && covered.has('user')) return true
          if (entityName === 'agents' && covered.has('agent')) return true
          if (entityName === 'assessments' && covered.has('assessments')) return true
        }
        
        return false
      })
    }
    
    return fields
  }, [availableFieldsData, coveredEntities])

  // Memoize FormsDesigner sections to avoid conditional hook call
  // This MUST be at the top level to follow Rules of Hooks
  const formsDesignerSections = useMemo(() => {
    const stepsToShow = guidedSteps.filter(step => step.step_number <= 6)
    return stepsToShow.map(step => {
      const fieldInfoMap = new Map(
        availableFieldsList.map(f => [f.field_name, f])
      )
      return {
        id: step.id,
        title: step.title || `Step ${step.step_number}`,
        description: step.description,
        fields: (step.field_names || []).map((fieldName, fieldIndex) => {
          const fieldInfo = fieldInfoMap.get(fieldName)
          return {
            id: `field-${step.id}-${fieldName}`, // Stable ID for dnd-kit
            field_name: fieldName,
            field_label: fieldInfo?.label || fieldName.replace(/_/g, ' '),
            required: step.required_fields?.includes(fieldName) || false
          }
        })
      }
    })
  }, [guidedSteps, availableFieldsList])

  // Ref to track if default steps have been auto-created
  const defaultStepsCreatedRef = useRef<boolean>(false)

  // Auto-organize fields into default steps when available fields are loaded
  // This MUST be after availableFieldsList is declared
  useEffect(() => {
    if (isNew && editingLayout && availableFieldsList.length > 0 && guidedSteps.length === 0 && !defaultStepsCreatedRef.current) {
      // Auto-create default steps based on field categories/sections
      const defaultSteps = createDefaultStepsFromFields(availableFieldsList, editingLayout.request_type || 'vendor_submission_workflow')
      if (defaultSteps.length > 0) {
        setGuidedSteps(defaultSteps)
        defaultStepsCreatedRef.current = true
        // Also create corresponding sections in the layout with fields assigned
        // Store titles without "Step N:" prefix
        const sections: SectionDefinition[] = defaultSteps.map((step, idx) => {
          const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
          return {
            id: step.id,
            title: cleanTitle,
            order: idx + 1,
            fields: step.field_names || [],
            description: step.description,
          }
        })
        // Only update sections if they're empty
        if (!editingLayout.sections || editingLayout.sections.length === 0) {
          setEditingLayout(prev => prev ? { ...prev, sections } : null)
        }
      }
    }
    
    // Reset ref when switching between new/edit modes
    if (!isNew) {
      defaultStepsCreatedRef.current = false
    }
  }, [isNew, availableFieldsList.length, guidedSteps.length]) // Removed editingLayout from deps to prevent loop

  // Don't auto-reset activeTab - let user stay on their selected tab (preview, roles, etc.)
  // Removed auto-reset to prevent switching away from preview tab

  // Build formTypeLabels from workflow types master data
  // This MUST be before any early returns to follow Rules of Hooks
  const formTypeLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    if (workflowTypes) {
      workflowTypes
        .filter(wt => wt.is_active)
        .forEach(wt => {
          labels[wt.value] = wt.label
        })
    } else {
      // Fallback to defaults
      labels['vendor_submission_workflow'] = 'Vendor Submission Workflow'
      labels['agent_onboarding_workflow'] = 'Agent Onboarding Workflow'
      labels['assessment_workflow'] = 'Assessment Workflow'
    }
    return labels
  }, [workflowTypes])

  // Handle Step 1: Create Layout (basic info only)
  const handleStep1Complete = async () => {
    if (!editingLayout) return
    
    // Validate required fields for step 1 (forms only need name)
    if (!editingLayout.name) {
      showToast.warning('Please fill in the form name')
      return
    }

    // Forms are workflow-agnostic - create with minimal sections
    const toCommaString = (value: any, defaultValue?: string): string => {
      if (!value) return defaultValue || ''
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(',') : (defaultValue || '')
      }
      return typeof value === 'string' ? value : (defaultValue || '')
    }
    
    const layoutType = toCommaString(editingLayout.layout_type, 'submission')
    
    // Create empty sections array - user will add fields in the designer
    const defaultSections: SectionDefinition[] = []

    // Forms are saved to Forms entity (library) - no request_type
    const createPayload: FormLayoutCreate = {
      name: editingLayout.name,
      // request_type: undefined, // Forms don't have request_type
      layout_type: layoutType as any,
      // workflow_stage: undefined, // Forms don't have workflow_stage
      description: editingLayout.description, // Preserve user-entered description (don't default to empty string)
      sections: defaultSections,
      // agent_type: undefined, // Forms don't have agent_type
      // agent_category: undefined, // Forms don't have agent_category
      is_default: false, // Forms don't have is_default
      is_template: true, // Mark as form (saves to Forms entity)
    }
    
    createLayoutMutation.mutate(createPayload)
  }

  const handleSaveLayout = async () => {
    if (!editingLayout) return

    // Use sections directly from editingLayout (updated by FormsDesigner via onSectionsChange)
    // The new FormsDesigner component maps workflow steps directly to sections
    // IMPORTANT: Store titles WITHOUT "Step N:" prefix to avoid duplication on reload
    console.log('💾 Saving layout - editingLayout.sections:', {
      sectionsCount: editingLayout.sections?.length || 0,
      sections: editingLayout.sections?.map(s => ({
        id: s.id,
        title: s.title,
        order: s.order,
        fieldCount: (s.fields || []).length,
        fields: s.fields
      })) || []
    })
    
    // Use sections from editingLayout directly (source of truth from FormsDesigner)
    // If sections are not available, fall back to converting from guidedSteps (backward compatibility)
    let sectionsToSave: SectionDefinition[] = []
    
    if (editingLayout.sections && editingLayout.sections.length > 0) {
      // Use sections directly from FormsDesigner (new system)
      sectionsToSave = editingLayout.sections
        .map((section, idx) => {
          // Strip "Step N:" prefix before storing
          const cleanTitle = section.title?.replace(/^Step \d+:\s*/i, '') || section.title || `Section ${idx + 1}`
          return {
            id: section.id || `section-${idx + 1}`,
            title: cleanTitle,
            order: section.order || idx + 1,
            fields: Array.isArray(section.fields) ? section.fields : [],
            description: section.description || '',
            required_fields: Array.isArray(section.required_fields) ? section.required_fields : [],
          }
        })
        .filter((section) => section.id && section.title)
    } else if (guidedSteps.length > 0) {
      // Fallback: Convert from guidedSteps (backward compatibility for old system)
      console.warn('⚠️ No sections in editingLayout, falling back to guidedSteps conversion')
      sectionsToSave = [...guidedSteps]
        .sort((a, b) => a.step_number - b.step_number)
        .map((step, idx) => {
          const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title || `Step ${step.step_number}`
          const uniqueId = step.id || `step-${step.step_number}-${idx}`
          return {
            id: uniqueId,
            title: cleanTitle,
            order: step.step_number,
            fields: Array.isArray(step.field_names) ? step.field_names : [],
            description: step.description || '',
            required_fields: step.required_fields || [],
          }
        })
        .filter((section) => section.id && section.title)
    }
    
    console.log('💾 Saving layout - sectionsToSave:', {
      sectionsCount: sectionsToSave.length,
      sections: sectionsToSave.map(s => ({
        id: s.id,
        title: s.title,
        order: s.order,
        fieldCount: (s.fields || []).length,
        fields: s.fields
      }))
    })

    // Prepare the layout update payload - only include fields allowed in FormLayoutCreate
    if (isNew && !layoutId) {
      // Step 1: Create new layout (including basic info and designer sections)
      if (!editingLayout.name) {
        showToast.warning('Please fill in the form name')
        return
      }

      const toCommaString = (value: any, defaultValue?: string): string => {
        if (!value) return defaultValue || ''
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(',') : (defaultValue || '')
        }
        return typeof value === 'string' ? value : (defaultValue || '')
      }
      
      // Forms are workflow-agnostic - only need layout_type
      const layoutType = toCommaString(editingLayout.layout_type, 'submission')

      // Forms are workflow-agnostic - don't send request_type or workflow_stage
      // Forms are connected to workflows via process mapping screen
      const createPayload: FormLayoutCreate = {
        name: editingLayout.name,
        // request_type: undefined, // Forms don't have request_type - workflow connection is via process mapping
        layout_type: layoutType as any,
        // workflow_stage: undefined, // Forms don't have workflow_stage
        description: editingLayout.description, // Preserve user-entered description (don't default to empty string)
        sections: sectionsToSave, // Use sections from FormsDesigner (new system)
        // agent_type: undefined, // Forms don't have agent_type
        // agent_category: undefined, // Forms don't have agent_category
        is_default: false, // Forms don't have is_default
        is_template: true, // Mark as form (saves to Forms entity)
      }
      
      console.log('💾 Creating form - payload:', JSON.stringify(createPayload, null, 2))
      createLayoutMutation.mutate(createPayload)
      return
    } else if (layoutId || id) {
      const targetId = layoutId || id
      // Update existing layout (or newly created one)
      // Validate sections before saving
      if (sectionsToSave.length === 0) {
        showToast.warning('Cannot save layout: At least one section with fields is required.')
        return
      }

    // Save field access controls from role matrix
    if (sectionsToSave) {
      for (const section of sectionsToSave) {
        for (const fieldName of section.fields) {
          const fieldAccess = roleMatrix[fieldName]
          if (fieldAccess) {
            const rolePermissions: Record<string, { view: boolean; edit: boolean }> = {}
            Object.entries(fieldAccess).forEach(([role, perms]) => {
              rolePermissions[role] = {
                view: perms.show,
                edit: perms.edit,
              }
            })

            // Check if field access already exists
            const existingAccess = fieldAccessList?.find(
                (fa) => fa.field_name === fieldName && fa.request_type === editingLayout.request_type && fa.workflow_stage === editingLayout.workflow_stage
            )

            const accessData: FieldAccessCreate = {
              field_name: fieldName,
              field_source: availableFieldsList.find((f) => f.field_name === fieldName)?.source === 'agent' || 
                           availableFieldsList.find((f) => f.field_name === fieldName)?.source === 'agent_metadata' 
                           ? 'agent' : 'submission_requirement',
                request_type: editingLayout.request_type!,
                workflow_stage: editingLayout.workflow_stage!,
              role_permissions: rolePermissions,
            }

            if (existingAccess) {
              await formLayoutsApi.updateFieldAccess(existingAccess.id, accessData)
            } else {
              await formLayoutsApi.createFieldAccess(accessData)
            }
          }
        }
      }
    }

      // Extract custom_field_ids from customFields if they have IDs
      const customFieldIds = customFields && customFields.length > 0
        ? customFields.filter(cf => cf.id).map(cf => cf.id!)
        : undefined
      
      const updatePayload: FormLayoutUpdate = {
        sections: sectionsToSave,
        custom_field_ids: customFieldIds, // Prefer IDs (no duplication)
        custom_fields: (customFields && customFields.length > 0 && !customFieldIds) ? customFields : undefined, // Legacy fallback
      }
      
      updateLayoutMutation.mutate({ id: layoutId!, layout: updatePayload }, {
        onSuccess: async (updatedLayout) => {
          // Invalidate both form-layouts and form-library queries (forms are in library)
          queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
          queryClient.invalidateQueries({ queryKey: ['form-library'] })
          // After updating, immediately activate it if it's a vendor layout (process, not form)
          if (updatedLayout.request_type === 'vendor_submission_workflow' && !updatedLayout.is_active) {
            try {
              await formLayoutsApi.update(updatedLayout.id, { is_active: true })
              queryClient.invalidateQueries({ queryKey: ['form-layout', 'vendor_submission_workflow', 'new', 'active'] })
            } catch (error) {
              console.error('Failed to activate layout:', error)
            }
          }
          if (id) {
            queryClient.invalidateQueries({ queryKey: ['form-layout', id] })
          }
          // Only navigate if we're on step 2 (final step), otherwise stay on current step
          if (currentStep === 2) {
            // Also update the group's covered_entities if groupId is present
            if (groupId && coveredEntities) {
              try {
                await formLayoutsApi.updateGroup(groupId, { covered_entities: coveredEntities })
                queryClient.invalidateQueries({ queryKey: ['workflow-layout-group', groupId] })
              } catch (error) {
                console.error('Failed to update group entities:', error)
              }
            }
            showToast.success('Layout saved successfully! The vendor submission form will now use this layout.')
            navigate('/admin/form-designer')
          }
        }
      })
    } else if (id) {
      // Validate sections before saving
      if (sectionsToSave.length === 0) {
        showToast.warning('Cannot save layout: At least one section with fields is required.')
        return
      }
      
      // Ensure layout is activated when saved (especially for vendor layouts)
      // This ensures the layout will be used by AgentSubmission
      if (editingLayout.request_type === 'vendor_submission_workflow' && (editingLayout as any).is_active !== false) {
        // Set is_active to true if not explicitly set to false
        (editingLayout as any).is_active = true
      }
      
      // Validate each section has required fields BEFORE validation
      const invalidSections = sectionsToSave.filter((s: SectionDefinition) => {
        const hasId = s.id && String(s.id).trim().length > 0
        const hasTitle = s.title && String(s.title).trim().length > 0
        const hasOrder = s.order !== undefined && s.order !== null
        return !hasId || !hasTitle || !hasOrder
      })
      if (invalidSections.length > 0) {
        showToast.error(`Cannot save layout: Some sections are missing required fields (id, title, or order).`)
        console.error('Invalid sections:', invalidSections)
        console.error('Sections to save:', sectionsToSave)
        return
      }
      
      // Ensure sections are properly formatted (fields should be an array)
      const validatedSections = sectionsToSave.map((section: SectionDefinition) => {
        // Ensure all required fields are present and properly typed
        const validated: SectionDefinition = {
          id: String(section.id || ''),
          title: String(section.title || ''),
          order: typeof section.order === 'number' ? section.order : parseInt(String(section.order || 0), 10),
          fields: Array.isArray(section.fields) ? section.fields.filter((f: any) => f != null && f !== '') : [],
          required_fields: Array.isArray(section.required_fields) ? section.required_fields : [],
        }
        // Include description if present
        if (section.description !== undefined && section.description !== null) {
          validated.description = String(section.description)
        }
        return validated
      })
      
      // Validate section IDs are unique
      const sectionIds = validatedSections.map(s => s.id)
      const duplicateIds = sectionIds.filter((id, index) => sectionIds.indexOf(id) !== index)
      if (duplicateIds.length > 0) {
        showToast.error(`Cannot save layout: Duplicate section IDs found: ${duplicateIds.join(', ')}`)
        console.error('Duplicate section IDs:', duplicateIds)
        return
      }
      
      // Only include fields that are actually set (not undefined)
      // Note: request_type is typically not updatable after creation, so we don't include it
      const updatePayload: FormLayoutUpdate = {}
      if (editingLayout.name !== undefined && editingLayout.name.trim() !== '') {
        updatePayload.name = editingLayout.name.trim()
      }
      if (editingLayout.description !== undefined) {
        updatePayload.description = editingLayout.description
      }
      // Always include sections if we have them (required for the layout to work)
      // Don't send empty sections array - backend might reject it
      if (validatedSections.length > 0) {
        updatePayload.sections = validatedSections
      } else {
        console.warn('No sections to save - this might cause validation errors')
        showToast.warning('Cannot save layout: At least one section is required.')
        return
      }
      // Convert to comma-separated string (backend supports comma-separated values for multiple stages)
      const toCommaString = (value: any): string | undefined => {
        if (!value) return undefined
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(',') : undefined
        }
        return typeof value === 'string' ? value : undefined
      }
      
      if (editingLayout.agent_type !== undefined) {
        updatePayload.agent_type = toCommaString(editingLayout.agent_type)
      }
      if (editingLayout.layout_type !== undefined) {
        updatePayload.layout_type = toCommaString(editingLayout.layout_type) as any
      }
      if (editingLayout.workflow_stage !== undefined) {
        updatePayload.workflow_stage = toCommaString(editingLayout.workflow_stage) as any
      }
      if (editingLayout.agent_category !== undefined) updatePayload.agent_category = editingLayout.agent_category
      
      // Extract custom_field_ids from customFields if they have IDs
      const customFieldIds = customFields && customFields.length > 0
        ? customFields.filter(cf => cf.id).map(cf => cf.id!)
        : undefined
      
      if (customFieldIds && customFieldIds.length > 0) {
        updatePayload.custom_field_ids = customFieldIds // Prefer IDs (no duplication)
      } else if (customFields && customFields.length > 0) {
        updatePayload.custom_fields = customFields // Legacy fallback
      }
      
      if ((editingLayout as any).is_active !== undefined) updatePayload.is_active = (editingLayout as any).is_active
      if (editingLayout.is_default !== undefined) updatePayload.is_default = editingLayout.is_default
      
      // Ensure layout is active so it can be used in the vendor portal
      // Always activate vendor layouts when saving (unless explicitly set to false)
      if (editingLayout.request_type === 'vendor_submission_workflow') {
        // Force activation for vendor layouts to ensure they're used in AgentSubmission
        updatePayload.is_active = (editingLayout as any).is_active !== false
      }
      
      // Final validation before sending
      const finalValidation = {
        allHaveIds: validatedSections.every(s => s.id && String(s.id).trim().length > 0),
        allHaveTitles: validatedSections.every(s => s.title && String(s.title).trim().length > 0),
        allHaveOrders: validatedSections.every(s => typeof s.order === 'number' && !isNaN(s.order)),
        allFieldsAreArrays: validatedSections.every(s => Array.isArray(s.fields)),
        uniqueIds: new Set(validatedSections.map(s => s.id)).size === validatedSections.length,
        noEmptyIds: validatedSections.every(s => s.id.trim() !== ''),
        noEmptyTitles: validatedSections.every(s => s.title.trim() !== ''),
      }
      
      if (!Object.values(finalValidation).every(v => v === true)) {
        console.error('Section validation failed:', finalValidation)
        console.error('Validated sections:', validatedSections)
        showToast.error(`Cannot save layout: Section validation failed. Check console for details.`)
        return
      }
      
      console.log('Updating layout with payload:', JSON.stringify(updatePayload, null, 2))
      console.log('Sections count:', validatedSections.length)
      console.log('Validated sections:', validatedSections)
      console.log('Section validation passed:', finalValidation)
      updateLayoutMutation.mutate({ id, layout: updatePayload }, {
        onSuccess: () => {
          // Invalidate queries to refresh both the list and active layout
          queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
          if (id) {
            queryClient.invalidateQueries({ queryKey: ['form-layout', id] })
          }
          if (editingLayout.request_type === 'vendor_submission_workflow') {
            queryClient.invalidateQueries({ queryKey: ['form-layout', 'vendor_submission_workflow', 'new', 'active'] })
          }
          // Only navigate if we're on step 3 (final step), otherwise stay on current step
          if ((currentStep as any) === 3) {
          showToast.success('Layout saved successfully! The vendor submission form will now use this layout.')
            navigate('/admin/form-designer')
          } else {
            showToast.success('Layout saved successfully!')
          }
        },
        onError: (error: any) => {
          // Don't log 403 errors - they're handled in the mutation's onError handler
          // Only log other errors that might need debugging
          const errorStatus = error?.response?.status
          if (errorStatus !== 403) {
            console.error('Failed to save layout:', error)
            const errorMessage = error?.response?.data?.detail || error?.message || 'Unknown error'
            showToast.error(`Failed to save layout: ${errorMessage}`)
          }
          // 403 errors are already handled in the mutation's onError handler
        }
      })
    }
  }

  const handleAddSection = () => {
    if (!editingLayout) return
    const newSection: SectionDefinition = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      order: editingLayout.sections?.length || 0,
      fields: [],
    }
    setEditingLayout({
      ...editingLayout,
      sections: [...(editingLayout.sections || []), newSection],
    })
  }

  const handleAddFieldToSection = (sectionId: string, fieldName: string) => {
    if (!editingLayout) return false
    
    // Find the section to add the field to
    const targetSection = editingLayout.sections?.find(s => s.id === sectionId)
    if (!targetSection) {
      showToast.error(`Section not found`)
      return false
    }
    
    // Check if field already exists in ANY section (prevent duplicates across all sections)
    const allFieldsInLayout = editingLayout.sections?.flatMap(s => s.fields) || []
    if (allFieldsInLayout.includes(fieldName)) {
      const fieldInfo = availableFieldsList.find(f => f.field_name === fieldName)
      const fieldLabel = fieldInfo?.label || fieldName
      // Find which section(s) contain this field
      const sectionsWithField = editingLayout.sections?.filter(s => s.fields.includes(fieldName)) || []
      const sectionNames = sectionsWithField.map(s => s.title).join(', ')
      showToast.warning(`Field "${fieldLabel}" is already added to the form${sectionNames ? ` (in section${sectionsWithField.length > 1 ? 's' : ''}: ${sectionNames})` : ''}. Duplicate fields are not allowed.`)
      return false
    }
    
    // Add the field to the section
    const sections = editingLayout.sections?.map((section) => {
      if (section.id === sectionId) {
        return { ...section, fields: [...section.fields, fieldName] }
      }
      return section
    })
    setEditingLayout((prev) => {
      if (!prev) return prev
      return { ...prev, sections }
    })
    
    // Show success message with section name
    const fieldInfo = availableFieldsList.find(f => f.field_name === fieldName)
    const fieldLabel = fieldInfo?.label || fieldName
    showToast.success(`Field "${fieldLabel}" added to section "${targetSection.title}"`)
    return true
  }

  const handleRemoveFieldFromSection = (sectionId: string, fieldName: string) => {
    if (!editingLayout) return
    const sections = editingLayout.sections?.map((section) => {
      if (section.id === sectionId) {
        return { ...section, fields: section.fields.filter((f) => f !== fieldName) }
      }
      return section
    })
    setEditingLayout({ ...editingLayout, sections })
  }

  const handleAddGuidedStep = () => {
    const newStep: GuidedStep = {
      id: `step-${Date.now()}`,
      step_number: guidedSteps.length + 1,
      title: `Step ${guidedSteps.length + 1}`, // Store clean title without prefix
      section_ids: [],
    }
    const updatedSteps = [...guidedSteps, newStep]
    setGuidedSteps(updatedSteps)
    
    // Sync sections with editingLayout whenever a step is added
    // Store titles without "Step N:" prefix
    const sections: SectionDefinition[] = updatedSteps.map((step) => {
      const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
      return {
        id: step.id,
        title: cleanTitle,
        order: step.step_number,
        fields: step.field_names || [],
        description: step.description,
      }
    })
    setEditingLayout((prev) => {
      if (!prev) return prev
      return { ...prev, sections }
    })
  }

  const handleUpdateGuidedStep = (stepId: string, updates: Partial<GuidedStep>) => {
    const updatedSteps = guidedSteps.map((step) => 
      step.id === stepId ? { ...step, ...updates } : step
    )
    setGuidedSteps(updatedSteps)
    
    // Sync sections with editingLayout whenever a step is updated
    // Store titles without "Step N:" prefix
    const sections: SectionDefinition[] = updatedSteps.map((step) => {
      const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
      return {
        id: step.id,
        title: cleanTitle,
        order: step.step_number,
        fields: step.field_names || [],
        description: step.description,
      }
    })
    setEditingLayout((prev) => {
      if (!prev) return prev
      return { ...prev, sections }
    })
  }

  const handleDeleteGuidedStep = (stepId: string) => {
    const step = guidedSteps.find((s) => s.id === stepId)
    if (step) {
      // Renumber remaining steps
      const updatedSteps = guidedSteps
          .filter((s) => s.id !== stepId)
          .map((s, idx) => ({ ...s, step_number: idx + 1 }))
      setGuidedSteps(updatedSteps)
      
      // Sync sections with editingLayout whenever a step is deleted
      // Store titles without "Step N:" prefix
      const sections: SectionDefinition[] = updatedSteps.map((step) => {
        const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
        return {
          id: step.id,
          title: cleanTitle,
          order: step.step_number,
          fields: step.field_names || [],
          description: step.description,
        }
      })
      setEditingLayout((prev) => {
        if (!prev) return prev
        return { ...prev, sections }
      })
    }
  }

  const handleUpdateRoleMatrix = (fieldName: string, role: string, permission: 'show' | 'edit' | 'hide', value: boolean) => {
    setRoleMatrix({
      ...roleMatrix,
      [fieldName]: {
        ...roleMatrix[fieldName],
        [role]: {
          ...roleMatrix[fieldName]?.[role],
          [permission]: value,
          // Auto-update: if hide is true, show and edit are false
          ...(permission === 'hide' && value ? { show: false, edit: false } : {}),
          // Auto-update: if show is false, edit is false
          ...(permission === 'show' && !value ? { edit: false } : {}),
          // Auto-update: if edit is true, show must be true
          ...(permission === 'edit' && value ? { show: true } : {}),
        },
      },
    })
  }

  if (!user) {
    return (
      <Layout user={null}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading user...</div>
      </div>
      </Layout>
    )
  }

  // For existing layouts, show loading while fetching
  if (!isNew && layoutLoading) {
    return (
      <Layout user={user}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading layout...</div>
      </div>
      </Layout>
    )
  }

  // For existing layouts, wait for layout to load
  // Show error message if layout access is denied (only after loading is complete)
  if (!isNew && !layoutLoading && (layoutError || existingLayout === null || existingLayout === undefined)) {
    const errorStatus = (layoutError as any)?.response?.status
    if (errorStatus === 403 || errorStatus === 404 || existingLayout === null || existingLayout === undefined) {
      return (
        <Layout user={user}>
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-8">
              <h2 className="text-xl font-medium text-red-900 mb-2">
                {errorStatus === 404 ? 'Layout Not Found' : 'Access Denied'}
              </h2>
              <p className="text-red-700 mb-4">
                {errorStatus === 404 
                  ? 'The requested layout could not be found. It may have been deleted or the ID is incorrect.'
                  : 'You don\'t have permission to access this layout. It may belong to a different tenant.'}
              </p>
              <p className="text-sm text-red-600 mb-4">
                Layout ID: {id}
              </p>
              <button
                onClick={() => navigate('/admin/form-designer')}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Back to Process Designer List
              </button>
            </div>
          </div>
        </Layout>
      )
    }
  }

  // For existing layouts, wait for editingLayout to be set from API
  if (!isNew && !editingLayout && existingLayout) {
    // This should be handled by the useEffect that sets editingLayout from existingLayout
    // But if it's not set yet, show loading
    return (
      <Layout user={user}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading layout data...</div>
      </div>
      </Layout>
    )
  }

  // For new layouts, wait for useEffect to initialize (brief loading state is acceptable)
  if (isNew && !editingLayout) {
    return (
      <Layout user={user}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Initializing new layout...</div>
      </div>
      </Layout>
    )
  }

  // For existing layouts, if editingLayout is still null and we have existingLayout, 
  // the useEffect should have set it. If not, show error.
  if (!isNew && !editingLayout && !layoutLoading && existingLayout) {
    console.error('editingLayout not set from existingLayout, this should not happen')
    return (
      <Layout user={user}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error: Failed to load layout data. Please refresh the page.</div>
      </div>
      </Layout>
    )
  }

  const handleApplyTemplate = (template: FormLayout) => {
    if (!template) return
    
    if (confirm(`Apply design from "${template.name}"? This will replace your current design sections and fields.`)) {
      // Import sections and custom fields from template
      if (template.sections) {
        // Map sections to guided steps
        const newSteps: GuidedStep[] = template.sections.map((section, idx) => ({
          id: section.id || `step-${Date.now()}-${idx}`,
          step_number: section.order || idx + 1,
          title: section.title,
          description: section.description,
          section_ids: [section.id],
          field_names: section.fields || [],
          required_fields: section.required_fields || []
        }))
        setGuidedSteps(newSteps)
        
        // Update editingLayout sections
        setEditingLayout(prev => prev ? {
          ...prev,
          sections: template.sections
        } : null)
        
        showToast.success(`Applied design from ${template.name}`)
        setShowLibraryModal(false)
      }
    }
  }

  // Final safety check
  if (!editingLayout) {
    console.error('editingLayout is null after all checks, id:', id, 'isNew:', isNew, 'layoutLoading:', layoutLoading, 'existingLayout:', existingLayout)
    return (
      <Layout user={user}>
      <div className="min-h-screen flex items-center justify-center">
          <div className="text-red-600">
            <p className="mb-2">Error: Failed to initialize layout.</p>
            <p className="text-sm text-gray-600">Layout ID: {id}</p>
            <button
              onClick={() => navigate('/admin/form-designer')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Back to Activity Designer List
            </button>
      </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="w-full max-w-[98%] mx-auto p-6 space-y-6">
        {/* Header - Material Design */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/form-designer')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              title="Back to List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-medium text-gray-900">
                  {currentStep === 1 ? 'Design Workflow Step' : 'Review & Finalize'}
                </h1>
                <MaterialChip 
                  label={`Step ${currentStep} of 2`} 
                  color="primary"
                  size="small"
                  variant="outlined"
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {currentStep === 1
                  ? `Configuring: ${editingLayout.name}`
                  : `Final review for: ${editingLayout.name}`
                }
              </p>
            </div>
          </div>

          {(isEdit || isNew) && (
            <div className="flex items-center gap-3">
              {currentStep === 1 ? (
                <>
                  <MaterialButton
                    variant="text"
                    onClick={() => navigate('/admin/form-designer')}
                    className="text-gray-600"
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    onClick={() => {
                      if (isNew && !layoutId) {
                        handleSaveLayout()
                      } else {
                        setCurrentStep(2)
                      }
                    }}
                    endIcon={<span className="ml-1">→</span>}
                    className="shadow-md-elevation-4"
                  >
                    Next: Review & Submit
                  </MaterialButton>
                </>
              ) : (
                <>
                  <MaterialButton
                    variant="outlined"
                    onClick={() => setCurrentStep(1)}
                    startIcon={<span className="mr-1">←</span>}
                  >
                    Back to Design
                  </MaterialButton>
                  <MaterialButton
                    onClick={handleSaveLayout}
                    disabled={createLayoutMutation.isPending || updateLayoutMutation.isPending}
                    startIcon={<Save className="w-4 h-4" />}
                    className="shadow-md-elevation-4"
                  >
                    {createLayoutMutation.isPending || updateLayoutMutation.isPending 
                      ? 'Saving...' 
                      : isNew ? 'Save & Complete' : 'Save Changes'}
                  </MaterialButton>
                </>
              )}
            </div>
          )}
        </div>

        {/* Progress Indicator for Guided Process */}
        {(isNew || isEdit) && (
          <div className="mb-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-3 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-600'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${currentStep >= 1 ? 'border-blue-500 bg-primary-50 shadow-sm' : 'border-gray-300 bg-white'}`}>
                    {currentStep > 1 ? '✓' : '1'}
                  </div>
                  <span className="text-sm font-medium tracking-tight">Design Interface</span>
                </div>
                <div className={`w-20 h-0.5 rounded-full transition-all ${currentStep >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
                <div className={`flex items-center gap-3 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-600'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${currentStep >= 2 ? 'border-blue-500 bg-primary-50 shadow-sm' : 'border-gray-300 bg-white'}`}>
                    2
                  </div>
                  <span className="text-sm font-medium tracking-tight">Review & Publish</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Design Forms (up to Connections) */}
        {currentStep === 1 && (isNew || isEdit) && (
          <div className="space-y-6">
            {/* Dynamic Tab Navigation - Material Design */}
            <div className="flex gap-4 border-b border-gray-200">
              {[
                { id: 'steps', label: 'Form Designer', icon: <FolderOpen className="w-4 h-4" /> },
                { id: 'fields', label: 'All Fields', icon: <Layers className="w-4 h-4" /> },
                { id: 'roles', label: 'Role Permissions', icon: <Shield className="w-4 h-4" /> },
                { id: 'preview', label: 'Live Preview', icon: <CheckCircle2 className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 px-4 text-sm font-medium transition-all flex items-center gap-2 border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start relative w-full">
              {/* Toolbar Icons - Floating/Sticky on the left */}
              <div className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start z-10 flex-shrink-0">
                {/* Layout Settings (Form) Icon */}
                <button
                  onClick={() => {
                    setIsLayoutSettingsExpanded(true)
                    setIsDesignToolsExpanded(false)
                    setIsFieldsPanelExpanded(false)
                  }}
                  className={`p-2 rounded-lg shadow-md border transition-colors group ${
                    isLayoutSettingsExpanded
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-white hover:bg-gray-100 border-gray-200'
                  }`}
                  aria-label="Layout Settings"
                  title="Layout Settings (Form)"
                >
                  <Settings className={`w-4 h-4 ${
                    isLayoutSettingsExpanded
                      ? 'text-primary-600'
                      : 'text-primary-500 group-hover:text-primary-600'
                  }`} />
                </button>
                
                {/* Design Tools (Library) Icon - Opens Library List Directly */}
                <button
                  onClick={() => {
                    setShowLibraryList(true)
                    setIsDesignToolsExpanded(false)
                    setIsLayoutSettingsExpanded(false)
                    setIsFieldsPanelExpanded(false)
                  }}
                  className={`p-2 rounded-lg shadow-md border transition-colors group ${
                    showLibraryList
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white hover:bg-gray-100 border-gray-200'
                  }`}
                  aria-label="Form Library"
                  title="Form Library"
                >
                  <FolderOpen className={`w-4 h-4 ${
                    showLibraryList
                      ? 'text-blue-600'
                      : 'text-blue-500 group-hover:text-blue-600'
                  }`} />
                </button>
                
                {/* Fields Panel Icon */}
                <button
                  onClick={() => {
                    setIsFieldsPanelExpanded(true)
                    setIsLayoutSettingsExpanded(false)
                    setIsDesignToolsExpanded(false)
                    setShowLibraryList(false)
                  }}
                  className={`p-2 rounded-lg shadow-md border transition-colors group ${
                    isFieldsPanelExpanded
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-white hover:bg-gray-100 border-gray-200'
                  }`}
                  aria-label="Fields"
                  title="Fields"
                >
                  <Layers className={`w-4 h-4 ${
                    isFieldsPanelExpanded
                      ? 'text-primary-600'
                      : 'text-primary-500 group-hover:text-primary-600'
                  }`} />
                </button>
              </div>

              {/* Middle Panel - Floating/Sticky, Loads based on selection */}
              <div className={`space-y-6 lg:sticky lg:top-6 lg:self-start z-10 flex-shrink-0 transition-all duration-300 ${
                isLayoutSettingsExpanded || isDesignToolsExpanded || isFieldsPanelExpanded || showLibraryList
                  ? 'w-full lg:w-80' 
                  : 'w-0 overflow-hidden'
              }`}>
                {isLayoutSettingsExpanded && (
                <MaterialCard elevation={2} className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary-500" />
                      Layout Settings
                    </h3>
                    <div className="flex items-center gap-2">
                      <MaterialButton
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          // Reset all state to create new layout
                          setEditingLayout({
                            name: '',
                            request_type: undefined,
                            workflow_stage: undefined,
                            layout_type: undefined,
                            description: '',
                            sections: [],
                            agent_type: undefined,
                            agent_category: undefined,
                            field_dependencies: undefined,
                            custom_fields: [],
                            is_active: true,
                            is_default: false,
                            is_template: false,
                          })
                          setLayoutId(null)
                          setCurrentStep(1)
                          setGuidedSteps([])
                          setCustomFields([])
                          setPreviewFormData({})
                          setRoleMatrix({})
                          setActiveSectionId(null)
                          fieldsAssignedRef.current = false
                          navigate('/admin/form-designer/new', { replace: true })
                          queryClient.invalidateQueries({ queryKey: ['form-layout'] })
                          showToast.success('Ready to create new layout')
                        }}
                        startIcon={<Plus className="w-4 h-4" />}
                        className="text-xs"
                      >
                        Create New
                      </MaterialButton>
                      <button
                        onClick={() => setShowLibraryModal(true)}
                        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                        aria-label="Import from Library"
                        title="Import from Library"
                      >
                        <FolderOpen className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => {
                          setIsLayoutSettingsExpanded(false)
                        }}
                        className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                        aria-label="Collapse"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-600" />
                      </button>
                  </div>
                  </div>
                  <div className="space-y-4">
                      <MaterialInput
                        label="Layout Name"
                        value={editingLayout.name}
                        onChange={(e) => setEditingLayout({ ...editingLayout, name: e.target.value })}
                        placeholder="e.g., Default Onboarding"
                        required
                      />

                      <div className="space-y-1.5 w-full">
                        <label className="text-xs font-medium text-gray-600 tracking-tight">Layout Type</label>
                        <div className="w-full space-y-2">
                          {[
                            { value: 'submission', label: 'Submission' },
                            { value: 'approver', label: 'Approval' },
                            { value: 'rejection', label: 'Rejection' },
                            { value: 'completed', label: 'Completed' }
                          ].map((option) => {
                            // Parse current layout_type value (can be comma-separated string, array, or single value)
                            const currentValue = editingLayout.layout_type
                            let selectedValues: string[] = []
                            if (currentValue) {
                              if (Array.isArray(currentValue)) {
                                selectedValues = currentValue
                              } else if (typeof currentValue === 'string') {
                                selectedValues = currentValue.includes(',') 
                                  ? currentValue.split(',').map(v => v.trim()).filter(Boolean)
                                  : [currentValue]
                              }
                            }
                            const isChecked = selectedValues.includes(option.value)
                            
                            return (
                              <label
                                key={option.value}
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    let newValues: string[]
                                    if (e.target.checked) {
                                      newValues = [...selectedValues, option.value]
                                    } else {
                                      newValues = selectedValues.filter(v => v !== option.value)
                                    }
                                    
                                    // Convert to comma-separated string for backend compatibility
                                    const newLayoutTypes = newValues.length > 0 ? newValues.join(',') : undefined
                                    
                                    // Set default workflow stage based on first selected type
                            let defaultWorkflowStage = 'new'
                                    if (newValues.length > 0) {
                                      if (newValues[0] === 'submission') {
                                defaultWorkflowStage = 'new'
                                      } else if (newValues[0] === 'approver') {
                                defaultWorkflowStage = 'pending_approval'
                                      } else if (newValues[0] === 'completed') {
                                defaultWorkflowStage = 'approved'
                              }
                            }
                                    
                            setEditingLayout({ 
                              ...editingLayout, 
                              layout_type: newLayoutTypes as any,
                              workflow_stage: (editingLayout.workflow_stage || defaultWorkflowStage) as any
                            })
                          }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-sm text-gray-700 font-medium">{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <MaterialInput
                        label="Description"
                        value={editingLayout.description || ''}
                        onChange={(e) => setEditingLayout({ ...editingLayout, description: e.target.value })}
                        multiline
                        rows={4}
                        placeholder="Enter a description for this layout..."
                      />

                      {/* Import from Library Button */}
                      <div className="pt-2">
                        <MaterialButton
                          variant="outlined"
                          fullWidth
                          onClick={() => setShowLibraryModal(true)}
                          startIcon={<FolderOpen className="w-4 h-4" />}
                          className="mb-2"
                        >
                          Import from Library
                        </MaterialButton>
                      </div>

                      {/* Save Button */}
                      <div className="pt-2">
                        <MaterialButton
                          variant="contained"
                          fullWidth
                          onClick={async () => {
                            if (!editingLayout.name) {
                              showToast.warning('Please enter a form name')
                              return
                            }

                            const toCommaString = (value: any, defaultValue?: string): string => {
                              if (!value) return defaultValue || ''
                              if (Array.isArray(value)) {
                                return value.length > 0 ? value.join(',') : (defaultValue || '')
                              }
                              return typeof value === 'string' ? value : (defaultValue || '')
                            }

                            const layoutType = toCommaString(editingLayout.layout_type, 'submission')

                            // Get current sections from editingLayout (fields can always be added/updated)
                            // Use the same processing logic as handleSaveLayout to ensure sections are properly formatted
                            let sectionsToSave: SectionDefinition[] = []
                            
                            if (editingLayout.sections && editingLayout.sections.length > 0) {
                              // Use sections directly from FormsDesigner (new system)
                              sectionsToSave = editingLayout.sections
                                .map((section, idx) => {
                                  // Strip "Step N:" prefix before storing
                                  const cleanTitle = section.title?.replace(/^Step \d+:\s*/i, '') || section.title || `Section ${idx + 1}`
                                  
                                  // Extract field names - handle both string[] and FormField[] formats
                                  let fieldNames: string[] = []
                                  if (Array.isArray(section.fields)) {
                                    if (section.fields.length > 0) {
                                      // Check if fields are objects (FormField) or strings
                                      if (typeof section.fields[0] === 'object' && section.fields[0] !== null) {
                                        // Extract field_name from FormField objects
                                        fieldNames = section.fields.map((f: any) => f.field_name || f).filter(Boolean)
                                      } else {
                                        // Already strings
                                        fieldNames = section.fields.filter((f: any) => typeof f === 'string')
                                      }
                                    }
                                  }
                                  
                                  // Extract required field names
                                  let requiredFieldNames: string[] = []
                                  if (Array.isArray(section.required_fields)) {
                                    requiredFieldNames = section.required_fields
                                  } else if (Array.isArray(section.fields)) {
                                    // Extract from fields if they're objects
                                    requiredFieldNames = section.fields
                                      .filter((f: any) => {
                                        if (typeof f === 'object' && f !== null) {
                                          return f.required === true
                                        }
                                        return false
                                      })
                                      .map((f: any) => f.field_name || f)
                                      .filter(Boolean)
                                  }
                                  
                                  return {
                                    id: section.id || `section-${idx + 1}`,
                                    title: cleanTitle,
                                    order: section.order !== undefined ? section.order : idx + 1,
                                    fields: fieldNames, // Ensure fields are string[]
                                    description: section.description || '',
                                    required_fields: requiredFieldNames,
                                  }
                                })
                                .filter((section) => section.id && section.title)
                            } else {
                              // Fallback: if no sections, create a default empty section
                              sectionsToSave = [{
                                id: `section-${Date.now()}`,
                                title: 'Untitled Section',
                                order: 1,
                                fields: [],
                                description: '',
                                required_fields: [],
                              }]
                            }

                            console.log('💾 Save to Library - sections to save:', {
                              sectionsCount: sectionsToSave.length,
                              sections: sectionsToSave.map(s => ({
                                id: s.id,
                                title: s.title,
                                order: s.order,
                                fieldCount: (s.fields || []).length,
                                fields: s.fields
                              }))
                            })

                            if (isNew && !layoutId) {
                              // Create new form with current sections/fields
                              const createPayload: FormLayoutCreate = {
                                name: editingLayout.name,
                                layout_type: layoutType as any,
                                description: editingLayout.description, // Preserve user-entered description (don't default to empty string)
                                sections: sectionsToSave, // Include current sections/fields
                                is_default: false,
                                is_template: true, // Mark as form (saves to Forms entity)
                              }

                              console.log('💾 Saving form to library - payload:', JSON.stringify(createPayload, null, 2))
                              createLayoutMutation.mutate(createPayload)
                            } else if (layoutId || id) {
                              // Update existing form with current sections/fields
                              const updatePayload: FormLayoutUpdate = {
                                name: editingLayout.name,
                                layout_type: layoutType as any,
                                description: editingLayout.description,
                                sections: sectionsToSave, // Include current sections/fields (can always be added/updated)
                              }

                              console.log('💾 Updating form in library - payload:', JSON.stringify(updatePayload, null, 2))
                              updateLayoutMutation.mutate({ id: layoutId || id!, layout: updatePayload })
                            }

                            showToast.success('Form saved to library successfully!')
                          }}
                          startIcon={<Save className="w-4 h-4" />}
                          className="shadow-md-elevation-2"
                        >
                          Save to Library
                        </MaterialButton>
                      </div>
                    </div>
                </MaterialCard>
                )}

                {/* Form Library List - Direct Access */}
                {showLibraryList && (
                  <MaterialCard elevation={2} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-blue-500" />
                        Form Library
                      </h3>
                      <button
                        onClick={() => {
                          setShowLibraryList(false)
                        }}
                        className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                      {!library || library.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-3xl mb-2">📚</div>
                          <p className="text-sm">Your library is empty</p>
                          <p className="text-xs text-gray-400 mt-1">Mark existing layouts as "Templates" to see them here</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {library.map((template) => (
                            <div
                              key={template.id}
                              className="border border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-sm transition-all group"
                            >
                              <div 
                                className="cursor-pointer"
                                onClick={() => {
                                  // Navigate to form designer with this layout's ID to load it for editing
                                  if (template.id) {
                                    navigate(`/admin/form-designer/${template.id}?mode=edit`)
                                    setShowLibraryList(false)
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                    {template.name}
                                  </h4>
                                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded flex-shrink-0 ml-2">
                                    {template.request_type?.replace(/_/g, ' ') || 'All'}
                                  </span>
                                </div>
                                {template.description && (
                                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                    {template.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>{template.sections?.length || 0} Sections</span>
                                  <span>•</span>
                                  <span>{template.sections?.reduce((acc, s) => acc + (s.fields?.length || 0), 0)} Fields</span>
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Navigate to load this form for editing
                                    if (template.id) {
                                      navigate(`/admin/form-designer/${template.id}?mode=edit`)
                                      setShowLibraryList(false)
                                    }
                                  }}
                                  className="flex-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                  Load Form
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Apply template design to current form
                                    handleApplyTemplate(template)
                                    setShowLibraryList(false)
                                  }}
                                  className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                >
                                  Apply Design
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </MaterialCard>
                )}

                {/* Design Tools Quick Access */}
                {isDesignToolsExpanded && (
                <MaterialCard elevation={1} className="p-6 bg-surface-variant/10 border-dashed border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-medium text-gray-600 tracking-tight">Design Tools</h3>
                    <button
                      onClick={() => setIsDesignToolsExpanded(false)}
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                      aria-label="Collapse"
                    >
                      <ChevronUp className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                  <MaterialButton
                    variant="outlined"
                    fullWidth
                    onClick={() => setShowLibraryModal(true)}
                    startIcon={<FolderOpen className="w-4 h-4" />}
                    className="bg-white"
                  >
                    Import Template
                  </MaterialButton>
                </MaterialCard>
                )}

                {/* Fields Panel - Floating/Sticky */}
                {isFieldsPanelExpanded && (
                <MaterialCard elevation={2} className="p-6 flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary-500" />
                      Fields
                    </h3>
                    <button
                      onClick={() => setIsFieldsPanelExpanded(false)}
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                      aria-label="Collapse"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    </button>
              </div>

                  {/* Fields Panel Content */}
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  {(() => {
                    // Get unique sources and categories (sorted for stable order)
                    const uniqueSources = Array.from(new Set((availableFieldsList || []).map(f => f.source).filter(Boolean)))
                      .sort((a, b) => (a || '').localeCompare(b || ''))
                    const uniqueCategories = Array.from(new Set((availableFieldsList || []).map(f => f.category).filter(Boolean)))
                      .sort((a, b) => (a || '').localeCompare(b || ''))
                    
                    // Filter fields
                    const filteredFields = (availableFieldsList || []).filter(field => {
                      const matchesSearch = field.label?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                        field.field_name?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                        field.description?.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                      const matchesSource = fieldSourceFilter === 'all' || field.source === fieldSourceFilter
                      const matchesCategory = fieldCategoryFilter === 'all' || field.category === fieldCategoryFilter
                      return matchesSearch && matchesSource && matchesCategory
                    })
                    
                    // Group by entity
                    const entityGroups: Record<string, typeof filteredFields> = {}
                    const nonEntityFields: typeof filteredFields = []
                    
                    filteredFields.forEach(field => {
                      const entityName = (field as any).entity_name
                      if (entityName) {
                        if (!entityGroups[entityName]) {
                          entityGroups[entityName] = []
                        }
                        entityGroups[entityName].push(field)
                      } else {
                        nonEntityFields.push(field)
                      }
                    })
                    
                    const handleAddField = (fieldName: string, sectionId: string) => {
                      // Check if field already exists in ANY section (prevent duplicates across all sections)
                      const allFieldsInForm = formsDesignerSections.flatMap(s => s.fields.map((f: any) => f.field_name)) || []
                      if (allFieldsInForm.includes(fieldName)) {
                        const fieldInfo = availableFieldsList.find(f => f.field_name === fieldName)
                        const fieldLabel = fieldInfo ? getFieldDisplayName(fieldInfo) : fieldName
                        // Find which section(s) contain this field
                        const sectionsWithField = formsDesignerSections.filter(s => 
                          s.fields.some((f: any) => f.field_name === fieldName)
                        ) || []
                        const sectionNames = sectionsWithField.map(s => s.title).join(', ')
                        showToast.warning(`Field "${fieldLabel}" is already added to the form${sectionNames ? ` (in section${sectionsWithField.length > 1 ? 's' : ''}: ${sectionNames})` : ''}. Duplicate fields are not allowed.`)
                        return
                      }
                      
                      const updatedSections = formsDesignerSections.map(section =>
                        section.id === sectionId
                          ? {
                              ...section,
                              fields: [
                                ...section.fields,
                                {
                                  id: `field-${Date.now()}-${Math.random()}`,
                                  field_name: fieldName,
                                  field_label: availableFieldsList.find(f => f.field_name === fieldName)?.label || fieldName,
                                  required: false
                                }
                              ]
                            }
                          : section
                      )
                      
                      if (activeTab === 'steps') {
                        const updatedSteps = updatedSections.map((section, idx) => ({
                          id: section.id,
                          step_number: idx + 1,
                          title: section.title,
                          description: section.description,
                          section_ids: [],
                          field_names: section.fields.map((f: any) => f.field_name),
                          required_fields: section.fields.filter((f: any) => f.required).map((f: any) => f.field_name)
                        }))
                        setGuidedSteps(updatedSteps)
                        
                        // Sync with editingLayout
                        const sections: SectionDefinition[] = updatedSteps.map((step) => {
                          const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
                          return {
                            id: step.id,
                            title: cleanTitle,
                            order: step.step_number,
                            fields: step.field_names || [],
                            description: step.description,
                            required_fields: step.required_fields || [],
                          }
                        })
                        setEditingLayout({ ...editingLayout, sections })
                      }
                    }
                    
                    const handleAddEntityGroup = (entityName: string, sectionId: string) => {
                      const entityFields = entityGroups[entityName] || []
                      const section = formsDesignerSections.find(s => s.id === sectionId)
                      if (!section) return
                      
                      // Get fields that are not already in the section
                      const fieldsToAdd = entityFields.filter(field => 
                        !section.fields.some(f => f.field_name === field.field_name)
                      )
                      
                      if (fieldsToAdd.length === 0) return
                      
                      // Add all fields in a single batch update
                      const updatedSections = formsDesignerSections.map(s =>
                        s.id === sectionId
                          ? {
                              ...s,
                              fields: [
                                ...s.fields,
                                ...fieldsToAdd.map(field => ({
                                  id: `field-${Date.now()}-${Math.random()}-${field.field_name}`,
                                  field_name: field.field_name,
                                  field_label: field.label || field.field_name,
                                  required: false
                                }))
                              ]
                            }
                          : s
                      )
                      
                      if (activeTab === 'steps') {
                        const updatedSteps = updatedSections.map((section, idx) => ({
                          id: section.id,
                          step_number: idx + 1,
                          title: section.title,
                          description: section.description,
                          section_ids: [],
                          field_names: section.fields.map((f: any) => f.field_name),
                          required_fields: section.fields.filter((f: any) => f.required).map((f: any) => f.field_name)
                        }))
                        setGuidedSteps(updatedSteps)
                        
                        // Sync with editingLayout
                        const sections: SectionDefinition[] = updatedSteps.map((step) => {
                          const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
                          return {
                            id: step.id,
                            title: cleanTitle,
                            order: step.step_number,
                            fields: step.field_names || [],
                            description: step.description,
                            required_fields: step.required_fields || [],
                          }
                        })
                        setEditingLayout({ ...editingLayout, sections })
                      }
                    }
                    
                    return (
                      <div className="flex flex-col h-full min-h-0 space-y-3">
                        {/* Search */}
                        <div className="relative flex-shrink-0">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={fieldSearchQuery}
                            onChange={(e) => setFieldSearchQuery(e.target.value)}
                            placeholder="Search fields..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        
                        {/* Filters */}
                        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                          <select
                            value={fieldSourceFilter}
                            onChange={(e) => setFieldSourceFilter(e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All Sources</option>
                            {uniqueSources.map(source => (
                              <option key={source} value={source}>{source.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <select
                            value={fieldCategoryFilter}
                            onChange={(e) => setFieldCategoryFilter(e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All Categories</option>
                            {uniqueCategories.map(category => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Section Selector */}
                        <div className="flex-shrink-0">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Add to Section</label>
                          <select
                            value={activeSectionId || ''}
                            onChange={(e) => setActiveSectionId(e.target.value || null)}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Select a section...</option>
                            {[...formsDesignerSections]
                              .sort((a, b) => (a.order || 0) - (b.order || 0))
                              .map(section => (
                              <option key={section.id} value={section.id}>{section.title}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Fields List */}
                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                          {/* Entity Groups */}
                          {Object.entries(entityGroups)
                            .sort(([nameA, fieldsA], [nameB, fieldsB]) => {
                              const labelA = fieldsA?.[0]?.entity_label || nameA
                              const labelB = fieldsB?.[0]?.entity_label || nameB
                              return labelA.localeCompare(labelB)
                            })
                            .map(([entityName, fields]) => {
                            const entityLabel = fields[0]?.entity_label || entityName
                            const isExpanded = expandedEntityGroups.has(entityName)
                            const section = formsDesignerSections.find(s => s.id === activeSectionId)
                            // Check across ALL sections to prevent duplicates
                            const allFieldsInForm = formsDesignerSections.flatMap(s => s.fields.map((f: any) => f.field_name)) || []
                            const fieldsInForm = new Set(allFieldsInForm)
                            const allFieldsInSection = fields.every(field => fieldsInForm.has(field.field_name))
                            
                            return (
                              <div key={entityName} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div
                                  className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedEntityGroups)
                                    if (isExpanded) {
                                      newExpanded.delete(entityName)
                                    } else {
                                      newExpanded.add(entityName)
                                    }
                                    setExpandedEntityGroups(newExpanded)
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    <span className="text-sm font-semibold text-gray-800">{entityLabel}</span>
                                    <span className="text-xs text-gray-500">({fields.length})</span>
                                  </div>
                                  {activeSectionId && section && !allFieldsInSection && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleAddEntityGroup(entityName, activeSectionId)
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded"
                                    >
                                      Add All
                                    </button>
                                  )}
                                </div>
                                {isExpanded && (
                                  <div className="p-2 space-y-1 bg-white">
                                    {[...fields]
                                      .sort((a, b) => (a.label || a.field_name || '').localeCompare(b.label || b.field_name || ''))
                                      .map((field, fieldIndex) => {
                                      // Check if field is already in ANY section (not just current section)
                                      const isInForm = fieldsInForm.has(field.field_name)
                                      return (
                                        <button
                                          key={`${field.field_name}-${fieldIndex}`}
                                          onClick={() => {
                                            if (activeSectionId) {
                                              handleAddField(field.field_name, activeSectionId)
                                            }
                                          }}
                                          disabled={!activeSectionId || isInForm}
                                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                            isInForm
                                              ? 'bg-green-50 text-green-700 cursor-not-allowed'
                                              : activeSectionId
                                              ? 'hover:bg-blue-50 text-gray-700 cursor-pointer'
                                              : 'text-gray-400 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                              <span className="font-medium">{getFieldDisplayName(field)}</span>
                                              {field.label && field.label !== field.field_name && (
                                                <span className="text-xs text-gray-500">{field.label}</span>
                                              )}
                                            </div>
                                            {isInForm && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          
                          {/* Non-Entity Fields */}
                          {nonEntityFields.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2">Other Fields</h4>
                              <div className="space-y-1">
                                {[...nonEntityFields]
                                  .sort((a, b) => (a.label || a.field_name || '').localeCompare(b.label || b.field_name || ''))
                                  .map((field, fieldIndex) => {
                                  // Check across ALL sections to prevent duplicates
                                  const allFieldsInForm = formsDesignerSections.flatMap(s => s.fields.map((f: any) => f.field_name)) || []
                                  const fieldsInForm = new Set(allFieldsInForm)
                                  const isInForm = fieldsInForm.has(field.field_name)
                                  return (
                                    <button
                                      key={`${field.field_name}-${fieldIndex}`}
                                      onClick={() => {
                                        if (activeSectionId) {
                                          handleAddField(field.field_name, activeSectionId)
                                        }
                                      }}
                                      disabled={!activeSectionId || isInForm}
                                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        isInForm
                                          ? 'bg-green-50 text-green-700 cursor-not-allowed'
                                          : activeSectionId
                                          ? 'hover:bg-blue-50 text-gray-700 cursor-pointer'
                                          : 'text-gray-400 cursor-not-allowed'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                          <span className="font-medium">{getFieldDisplayName(field)}</span>
                                          {field.label && field.label !== field.field_name && (
                                            <span className="text-xs text-gray-500">{field.label}</span>
                                          )}
                                        </div>
                                        {isInForm && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  </div>
                </MaterialCard>
                )}
              </div>

              {/* Main Canvas Area - Expands to fill available space */}
              <div className="flex-1 w-full min-w-0 transition-all duration-300">
                <MaterialCard elevation={2} className="overflow-hidden border-none bg-white min-h-[600px] w-full h-full">
                  <div className="p-6">
                    {activeTab === 'steps' && (
                      <FormsDesigner
                        sections={formsDesignerSections}
                        formTitle={editingLayout?.name}
                        formDescription={editingLayout?.description}
                        onFormTitleChange={(title) => {
                          if (editingLayout) {
                            setEditingLayout({ ...editingLayout, name: title })
                          }
                        }}
                        onFormDescriptionChange={(description) => {
                          if (editingLayout) {
                            setEditingLayout({ ...editingLayout, description })
                            }
                        }}
                        showFieldPicker={false}
                        availableFields={availableFieldsList || []}
                        onSectionsChange={(newSections) => {
                          // Convert FormsDesigner sections back to guidedSteps format
                          const updatedSteps = newSections.map((section, idx) => {
                            return {
                              id: section.id,
                              step_number: idx + 1, // Use new index for step number
                              title: section.title,
                              description: section.description,
                              section_ids: [],
                              field_names: section.fields.map(f => f.field_name),
                              required_fields: section.fields.filter(f => f.required).map(f => f.field_name)
                            }
                          })
                          setGuidedSteps(updatedSteps)
                          
                          // Also update editingLayout sections
                          const sections: SectionDefinition[] = updatedSteps.map((step) => {
                            const cleanTitle = step.title?.replace(/^Step \d+:\s*/i, '') || step.title
                            return {
                              id: step.id,
                              title: cleanTitle,
                              order: step.step_number,
                              fields: step.field_names || [],
                              description: step.description,
                              required_fields: step.required_fields || [],
                            }
                          })
                          setEditingLayout({ ...editingLayout, sections })
                        }}
                        onAddField={(fieldName, sectionId) => {
                          // Add field to the step
                          const step = guidedSteps.find(s => s.id === sectionId)
                          if (step) {
                            const fieldNames = step.field_names || []
                            if (!fieldNames.includes(fieldName)) {
                              const updatedSteps = guidedSteps.map(s =>
                                s.id === sectionId ? { ...s, field_names: [...fieldNames, fieldName] } : s
                              )
                              setGuidedSteps(updatedSteps)
                              
                              // Sync sections with editingLayout
                              const sections: SectionDefinition[] = updatedSteps.map((s) => {
                                const cleanTitle = s.title?.replace(/^Step \d+:\s*/i, '') || s.title
                                return {
                                  id: s.id,
                                  title: cleanTitle,
                                  order: s.step_number,
                                  fields: s.field_names || [],
                                  description: s.description,
                                  required_fields: s.required_fields || [],
                                }
                              })
                              setEditingLayout({ ...editingLayout, sections })
                            }
                          }
                        }}
                      />
                    )}
                    {activeTab === 'fields' && (
                      <FieldsTab
                        editingLayout={editingLayout!}
                        setEditingLayout={setEditingLayout}
                        availableFieldsList={availableFieldsList || []}
                        fieldsLoading={fieldsLoading}
                        isEdit={isEdit}
                        handleAddSection={handleAddSection}
                        handleAddFieldToSection={handleAddFieldToSection}
                        handleRemoveFieldFromSection={handleRemoveFieldFromSection}
                        currentStep={currentStep}
                        setCurrentStep={setCurrentStep}
                        guidedSteps={guidedSteps}
                      />
                    )}
                    {activeTab === 'roles' && (
                      <RolesTab
                        editingLayout={editingLayout!}
                        availableFieldsList={availableFieldsList || []}
                        roleMatrix={roleMatrix}
                        handleUpdateRoleMatrix={handleUpdateRoleMatrix}
                        isEdit={isEdit}
                      />
                    )}
                    {activeTab === 'preview' && (
                      <PreviewTab
                        editingLayout={editingLayout}
                        availableFieldsList={availableFieldsList || []}
                        previewFormData={previewFormData}
                        setPreviewFormData={setPreviewFormData}
                      />
                    )}
                  </div>
                </MaterialCard>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 Complete Message - Show when on step 1 */}
        {currentStep === 1 && (isNew || isEdit) && (
          <div className="bg-blue-50 border border-blue-400 rounded-lg p-6 text-center">
            <p className="text-gray-700">
              {isNew 
                ? <>Fill in the layout information above and click <strong>"Next: Design Forms"</strong> to proceed to form design.</>
                : <>Review and update the layout information above, then click <strong>"Next: Design Forms"</strong> to configure the form structure.</>
              }
            </p>
          </div>
        )}

        {/* Step 2: Review & Submit */}
        {currentStep === 2 && (isNew || isEdit) && (
          <ReviewAndSubmitStep
            editingLayout={editingLayout}
            guidedSteps={guidedSteps}
          />
        )}

        {/* View Mode - Show Preview */}
        {viewMode && !isNew && editingLayout && (
          <div className="mb-6">
            <PreviewTab
              editingLayout={editingLayout}
              availableFieldsList={availableFieldsList}
              previewFormData={previewFormData}
              setPreviewFormData={setPreviewFormData}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => navigate(`/admin/form-designer/${id}?mode=edit`)}
                className="shadow-md-elevation-2 rounded-lg px-4 py-2 font-medium text-sm bg-blue-600 text-white hover:bg-primary-700 transition-all flex items-center gap-2 px-md-4 py-md-2"
              >
                Edit Layout
              </button>
              <button
                onClick={() => navigate('/admin/form-designer')}
                className="rounded-lg px-4 py-2 font-medium text-sm text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-2 px-md-4 py-md-2"
              >
                Back to Layouts
              </button>
            </div>
          </div>
        )}

        {/* Form Library Modal */}
        {showLibraryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-md shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FolderOpen className="w-6 h-6 text-blue-600" />
                    Form Library
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Select a template to import its design into your current form</p>
                </div>
                <button 
                  onClick={() => setShowLibraryModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {!library || library.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📚</div>
                    <h3 className="text-lg font-medium text-slate-800">Your Library is Empty</h3>
                    <p className="text-slate-500 mt-2">Mark existing layouts as "Templates" to see them here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {library.map((template) => (
                      <div 
                        key={template.id} 
                        className="border border-slate-200 rounded-md p-4 hover:border-blue-400 hover:shadow-md transition-all group relative"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {template.name}
                          </h4>
                          <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                            {template.request_type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                          {template.description || 'No description provided for this template.'}
                        </p>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex gap-2 text-xs text-slate-400">
                            <span>{template.sections?.length || 0} Sections</span>
                            <span>•</span>
                            <span>{template.sections?.reduce((acc, s) => acc + (s.fields?.length || 0), 0)} Fields</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (template.id) {
                                navigate(`/admin/form-designer/${template.id}?mode=edit`)
                                setShowLibraryModal(false)
                              }
                            }}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-all"
                          >
                            Load Form
                          </button>
                          <button
                            onClick={() => {
                              handleApplyTemplate(template)
                              setShowLibraryModal(false)
                            }}
                            className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 shadow-sm transition-all"
                          >
                            Apply Design
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Close Library
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <DeleteConfirmation
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
        />
      </div>
    </Layout>
  )
}

// Step 2: Review & Submit Component
function ReviewAndSubmitStep({
  editingLayout,
  guidedSteps,
}: {
  editingLayout: Partial<FormLayoutCreate> | null
  guidedSteps: GuidedStep[]
}) {
  return (
    <div className="space-y-4">
      <div className="mb-3 shadow-md-elevation-2 rounded-md border border-gray-100 bg-white p-6 bg-primary-50 border-primary-200">
        <div className="mb-2 pb-2 border-b border-primary-200">
          <h2>Step 2: Review & Submit</h2>
          <p className="text-caption text-gray-700 mt-1">
            Review your form layout configuration and submit to complete the setup.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="shadow-md-elevation-2 rounded-md border border-gray-100 bg-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-label text-gray-900">Screen Layout</h3>
              <p className="text-caption text-gray-500">{editingLayout?.name || 'Unnamed Layout'}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {editingLayout?.layout_type && (
              <div className="flex justify-between text-body">
                <span className="text-gray-600">Layout Type:</span>
                <span className="font-medium text-gray-900 capitalize">
                  {Array.isArray(editingLayout.layout_type) 
                    ? editingLayout.layout_type.join(', ')
                    : editingLayout.layout_type}
                </span>
              </div>
            )}
            {editingLayout?.workflow_stage && (
              <div className="flex justify-between text-body">
                <span className="text-gray-600">Workflow Stage:</span>
                <span className="font-medium text-gray-900">
                  {(() => {
                    const stages = Array.isArray(editingLayout.workflow_stage)
                      ? editingLayout.workflow_stage
                      : [editingLayout.workflow_stage]
                    return (stages as string[]).map((s: string) => s.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())).join(', ')
                  })()}
                </span>
              </div>
            )}
            {editingLayout?.agent_type && (
              <div className="flex justify-between text-body">
                <span className="text-gray-600">Agent Type:</span>
                <span className="font-medium text-gray-900 capitalize">
                  {Array.isArray(editingLayout.agent_type)
                    ? editingLayout.agent_type.join(', ')
                    : editingLayout.agent_type}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="shadow-md-elevation-2 rounded-md border border-gray-100 bg-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-label text-gray-900">Form Steps</h3>
              <p className="text-caption text-gray-500">{totalSteps} steps configured</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-body">
              <span className="text-gray-600">Total Steps:</span>
              <span className="font-medium text-gray-900">{totalSteps}</span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-gray-600">Total Fields:</span>
              <span className="font-medium text-gray-900">{totalFields}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Detailed Summary */}
      <div className="shadow-md-elevation-2 rounded-md border border-gray-100 bg-white p-6">
        <h3 className="text-subheading font-medium text-gray-900 mb-4">Layout Summary</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-label text-gray-700 mb-2">Form Steps:</h4>
            <p className="text-body text-gray-600">{stepNames || 'No steps configured'}</p>
          </div>

          {editingLayout?.description && (
            <div>
              <h4 className="text-label text-gray-700 mb-2">Description:</h4>
              <p className="text-body text-gray-600">{editingLayout.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-md border border-gray-100 bg-white p-6 shadow-sm bg-blue-50 border-blue-400">
        <p className="text-body text-blue-900">
          <span className="font-medium">✓ Ready to Submit:</span> Your form layout is complete. Click "Save & Complete" to finalize the configuration. 
          The form will be available for use in the agent submission process.
        </p>
      </div>
    </div>
  )
}

// Helper function to format field display as entity.fieldname (for designer only)
const getFieldDisplayNameForDesigner = (field: {
  field_name: string
  label?: string
  entity_name?: string
  source?: string
}): string => {
  const entityName = field.entity_name || 
    (field.source?.startsWith('entity:') ? field.source.replace('entity:', '') : null) ||
    (field.source === 'agent' ? 'agents' : null) ||
    (field.source === 'agent_metadata' ? 'agent_metadata' : null) ||
    (field.source === 'custom_field' ? 'custom' : null) ||
    (field.source === 'master_data' ? 'master_data' : null) ||
    (field.source === 'logged_in_user' ? 'users' : null) ||
    (field.source === 'entity_business_owner' ? 'business_owner' : null) ||
    (field.source === 'workflow_ticket' ? 'workflow_ticket' : null) ||
    null
  
  const fieldLabel = field.label || field.field_name
  if (entityName && entityName !== 'custom' && entityName !== 'master_data') {
    return `${entityName}.${field.field_name}`
  }
  return fieldLabel
}

// Fields Tab Component
function FieldsTab({
  editingLayout,
  setEditingLayout,
  availableFieldsList,
  fieldsLoading,
  isEdit,
  handleAddSection,
  handleAddFieldToSection,
  handleRemoveFieldFromSection,
  requirements,
  currentStep,
  setCurrentStep,
  guidedSteps,
  handleAddFieldToStep,
  setExpandedSteps,
}: {
  editingLayout: Partial<FormLayoutCreate>
  setEditingLayout: (layout: any) => void
  availableFieldsList: Array<{ field_name: string; label: string; source: string; description?: string; category?: string; section?: string }>
  fieldsLoading: boolean
  isEdit: boolean
  handleAddSection: () => void
  handleAddFieldToSection: (sectionId: string, fieldName: string) => void
  handleRemoveFieldFromSection: (sectionId: string, fieldName: string) => void
  requirements?: SubmissionRequirement[]
  currentStep?: number
  setCurrentStep?: (step: 1 | 2) => void
  guidedSteps?: GuidedStep[]
  handleAddFieldToStep?: (stepId: string, fieldName: string, showNotification?: boolean) => boolean
  setExpandedSteps?: (val: any) => void
}) {
  const handleFieldClick = (fieldName: string) => {
    if (!isEdit) return
    
    // If we're not on Step 1 (Design Forms), switch to it first
    if (currentStep !== 1) {
      setCurrentStep?.(1)
      // Wait a moment for the step to render, then add the field
      setTimeout(() => {
        handleFieldClick(fieldName)
      }, 100)
      return
    }
    
    // For guided steps mode, add to first step (Step 1 of the form, not guided procedure step)
    if (guidedSteps && guidedSteps.length > 0) {
      const firstStep = guidedSteps[0]
      const firstStepFields = firstStep.field_names || []
      
      // Check if field already exists in first step
      if (firstStepFields.includes(fieldName)) {
        const fieldInfo = (availableFieldsList as any[]).find((f: any) => f.field_name === fieldName)
        const fieldLabel = fieldInfo?.label || fieldName
        showToast.warning(`Field "${fieldLabel}" is already in ${firstStep.title || 'Step 1'}. Cannot add duplicate.`)
        return
      }
      
      // Check if field exists in any other step
      const isInOtherStep = (guidedSteps || []).some((s: GuidedStep) => 
        s.id !== firstStep.id && (s.field_names || []).includes(fieldName)
      )
      
      if (isInOtherStep) {
        const fieldInfo = (availableFieldsList as any[]).find((f: any) => f.field_name === fieldName)
        const fieldLabel = fieldInfo?.label || fieldName
        const otherStep = (guidedSteps || []).find((s: GuidedStep) => 
          s.id !== firstStep.id && (s.field_names || []).includes(fieldName)
        )
        const otherStepTitle = otherStep?.title || `Step ${otherStep?.step_number || ''}`
        showToast.warning(`Field "${fieldLabel}" is already in ${otherStepTitle}. Please remove it from there first, or move it instead of duplicating.`)
        return
      }
      
      // Add to first step and auto-expand it so user can see the field
      const success = handleAddFieldToStep?.(firstStep.id, fieldName, true)
      if (success) {
        // Auto-expand the step so the user can see the field was added
        setExpandedSteps?.((prev: Set<string>) => new Set([...prev, firstStep.id]))
        // Scroll to the step after a brief delay to allow DOM update
        setTimeout(() => {
          const stepElement = document.getElementById(`step-${firstStep.id}`)
          if (stepElement) {
            stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            // Highlight the step briefly
            stepElement.classList.add('ring-2', 'ring-indigo-500')
            setTimeout(() => {
              stepElement.classList.remove('ring-2', 'ring-indigo-500')
            }, 2000)
          }
        }, 100)
      }
      return
    }
    
    // Legacy section-based mode (for backward compatibility)
    // Check if field is already in a section
    const isInLayout = editingLayout.sections?.some((section) => 
      section.fields.includes(fieldName)
    )
    
    if (isInLayout) {
      // Remove from all sections
      const sections = editingLayout.sections?.map((section) => ({
        ...section,
        fields: section.fields.filter((f) => f !== fieldName)
      }))
      setEditingLayout({ ...editingLayout, sections })
    } else {
      // Add to first section or create a new section
      if (editingLayout.sections && editingLayout.sections.length > 0) {
        handleAddFieldToSection(editingLayout.sections[0].id, fieldName)
      } else {
        // Create a new section and add the field
        const newSection: SectionDefinition = {
          id: `section-${Date.now()}`,
          title: 'New Section',
          order: 0,
          fields: [fieldName],
        }
        setEditingLayout({
          ...editingLayout,
          sections: [...(editingLayout.sections || []), newSection],
        })
      }
    }
  }
  // Group fields by screen type (based on category/section or default to current screen type)
  const groupFieldsByScreen = (): Record<string, Array<{ field_name: string; label: string; source: string; description?: string; category?: string; section?: string }>> => {
    const groups: Record<string, Array<{ field_name: string; label: string; source: string; description?: string; category?: string; section?: string }>> = {
      vendor: [],
      admin: [],
      approver: [],
      end_user: [],
      all: [], // Fields that apply to all screens
    }

    availableFieldsList.forEach((field: any) => {
      // Determine which screen(s) this field belongs to
      // For now, we'll categorize based on field source and category
      const category = (field as any).category?.toLowerCase() || ''
      const section = (field as any).section?.toLowerCase() || ''
      
      // Map categories/sections to screen types
      if (category.includes('security') || category.includes('compliance') || section.includes('review')) {
        groups.approver.push(field)
        groups.admin.push(field)
      } else if (category.includes('technical') || section.includes('technical')) {
        groups.vendor.push(field)
        groups.admin.push(field)
      } else if (category.includes('business') || section.includes('business')) {
        groups.end_user.push(field)
        groups.admin.push(field)
      } else {
        // Default: add to all screens
        groups.all.push(field)
      }
    })

    return groups
  }

  const fieldsByScreen = groupFieldsByScreen()
  const requestTypeLabels: Record<string, string> = {
    vendor: 'Vendor Submission',
    admin: 'Admin',
    approver: 'Approver',
    end_user: 'End User',
    all: 'All Screens',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-medium">Autoloaded Fields by Request Type</h2>
            <p className="text-sm text-gray-600 mt-1">
              Fields are grouped by screen type. Pick and choose fields to arrange in your layout.
            </p>
          </div>
        </div>
        
        {/* Grouped Fields by Request Type */}
        <div className="space-y-6">
          {Object.entries(fieldsByScreen)
            .sort(([typeA], [typeB]) => (requestTypeLabels[typeA] || typeA).localeCompare(requestTypeLabels[typeB] || typeB))
            .map(([requestType, fields]) => {
            if (fields.length === 0) return null
            
            return (
              <div key={requestType} className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {requestTypeLabels[requestType] || requestType}
                  <span className="ml-2 text-sm font-normal text-gray-500">({fields.length} fields)</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {fields
                    .sort((a, b) => (a.label || a.field_name || '').localeCompare(b.label || b.field_name || ''))
                    .map((field, idx) => {
                    // Check both editingLayout.sections and guidedSteps for accurate status
                    const isInLayout = 
                      editingLayout.sections?.some((section) => section.fields.includes(field.field_name)) ||
                      (guidedSteps || []).some((step: GuidedStep) => (step.field_names || []).includes(field.field_name))
                    return (
                      <div
                        key={`${field.field_name}-${field.source}-${idx}`}
                        className={`text-xs p-2 border rounded flex items-center justify-between transition-all ${
                          isInLayout
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer'
                        }`}
                        title={field.description}
                        onClick={() => handleFieldClick(field.field_name)}
                      >
                        <span className="font-medium truncate flex-1">{field.label}</span>
                        <span className="text-gray-600 ml-2 text-xs">({field.source})</span>
                        {isInLayout && (
                          <span className="ml-1 text-blue-600 text-xs">✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium">Layout Sections</h2>
          {isEdit && (
            <button
              onClick={handleAddSection}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              + Add Section
            </button>
          )}
        </div>

        <div className="space-y-4">
          {[...(editingLayout.sections || [])]
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((section, idx) => (
            <div key={section.id} className="border rounded p-4">
              <div className="flex justify-between items-start mb-2">
                {isEdit ? (
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => {
                      const sections = [...(editingLayout.sections || [])]
                      sections[idx].title = e.target.value
                      setEditingLayout({ ...editingLayout, sections })
                    }}
                    className="enterprise-input flex-1 mr-2"
                    placeholder="Section Title"
                  />
                ) : (
                  <h3 className="text-lg font-medium">{section.title}</h3>
                )}
              </div>

              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">Fields in this section:</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {section.fields.map((fieldName) => {
                    const fieldInfo = availableFieldsList.find((f) => f.field_name === fieldName)
                    const displayLabel = fieldInfo ? getFieldDisplayNameForDesigner(fieldInfo) : fieldName
                    return (
                      <span
                        key={`${section.id}-${fieldName}`}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1"
                        title={fieldInfo?.label || fieldName}
                      >
                        {displayLabel}
                        {isEdit && (
                          <button
                            onClick={() => handleRemoveFieldFromSection(section.id, fieldName)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    )
                  })}
                </div>
                {isEdit && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddFieldToSection(section.id, e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="enterprise-input text-sm"
                    disabled={fieldsLoading}
                  >
                    <option value="">Add field...</option>
                    {(() => {
                      // Get all fields already in the form (across all sections) to prevent duplicates
                      const allFieldsInForm = editingLayout.sections?.flatMap(s => s.fields) || []
                      return availableFieldsList
                        .filter((f) => !allFieldsInForm.includes(f.field_name))
                        .sort((a, b) => (a.label || a.field_name || '').localeCompare(b.label || b.field_name || ''))
                        .map((field, idx) => (
                        <option key={`${field.field_name}-${field.source}-${idx}`} value={field.field_name}>
                          {field.label} ({field.field_name})
                        </option>
                        ))
                    })()}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Steps Tab Component
// Roles Tab Component
function RolesTab({
  editingLayout,
  availableFieldsList,
  roleMatrix,
  handleUpdateRoleMatrix,
  isEdit,
}: {
  editingLayout: Partial<FormLayoutCreate>
  availableFieldsList: Array<{ field_name: string; label: string; source: string; description?: string }>
  roleMatrix: Record<string, Record<string, { show: boolean; edit: boolean; hide: boolean }>>
  handleUpdateRoleMatrix: (fieldName: string, role: string, permission: 'show' | 'edit' | 'hide', value: boolean) => void
  isEdit: boolean
}) {
  const roles = ['tenant_admin', 'compliance_reviewer'] // Admin and Compliance Manager

  // Get all fields from all sections
  const allFields = editingLayout.sections?.flatMap((section) => section.fields) || []
  const uniqueFields = Array.from(new Set(allFields))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-xl font-medium">Role-Based Field Access Control</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure field visibility and edit permissions for Admin and Compliance Manager roles
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-tight">
                Field
              </th>
              {roles.map((role) => (
                <th key={role} className="px-4 py-3 text-center text-xs font-medium text-gray-500 tracking-tight">
                  {role === 'tenant_admin' ? 'Admin' : 'Compliance Manager'}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {roles.map((role) => (
                <th key={role} className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                  <div className="flex justify-center gap-4">
                    <span>Show</span>
                    <span>Edit</span>
                    <span>Hide</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {uniqueFields.map((fieldName, fieldIdx) => {
              const fieldInfo = availableFieldsList.find((f) => f.field_name === fieldName)
              const displayLabel = fieldInfo?.label || fieldName
              return (
                <tr key={`${fieldName}-${fieldIdx}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{displayLabel}</div>
                    <div className="text-xs text-gray-500">{fieldName}</div>
                  </td>
                  {roles.map((role) => {
                    const perms = roleMatrix[fieldName]?.[role] || { show: true, edit: true, hide: false }
                    return (
                      <td key={role} className="px-4 py-3 whitespace-nowrap">
                        <div className="flex justify-center gap-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={perms.show}
                              onChange={(e) => handleUpdateRoleMatrix(fieldName, role, 'show', e.target.checked)}
                              disabled={!isEdit || perms.hide}
                              className="w-4 h-4"
                            />
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={perms.edit}
                              onChange={(e) => handleUpdateRoleMatrix(fieldName, role, 'edit', e.target.checked)}
                              disabled={!isEdit || !perms.show || perms.hide}
                              className="w-4 h-4"
                            />
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={perms.hide}
                              onChange={(e) => handleUpdateRoleMatrix(fieldName, role, 'hide', e.target.checked)}
                              disabled={!isEdit}
                              className="w-4 h-4"
                            />
                          </label>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Preview Tab Component
function PreviewTab({
  editingLayout,
  availableFieldsList,
  previewFormData,
  setPreviewFormData,
}: {
  editingLayout: Partial<FormLayoutCreate>
  availableFieldsList: Array<{ field_name: string; label: string; source: string; description?: string; field_type?: string; entity_name?: string }>
  previewFormData: Record<string, any>
  setPreviewFormData: (data: Record<string, any>) => void
}) {
  // Helper to format field display as entity.fieldname (for designer preview)
  const getFieldDisplayNameForPreview = (field: {
    field_name: string
    label?: string
    entity_name?: string
    source?: string
  }): string => {
    const entityName = field.entity_name || 
      (field.source?.startsWith('entity:') ? field.source.replace('entity:', '') : null) ||
      (field.source === 'agent' ? 'agents' : null) ||
      (field.source === 'agent_metadata' ? 'agent_metadata' : null) ||
      (field.source === 'custom_field' ? 'custom' : null) ||
      (field.source === 'master_data' ? 'master_data' : null) ||
      (field.source === 'logged_in_user' ? 'users' : null) ||
      (field.source === 'entity_business_owner' ? 'business_owner' : null) ||
      (field.source === 'workflow_ticket' ? 'workflow_ticket' : null) ||
      null
    
    const fieldLabel = field.label || field.field_name
    if (entityName && entityName !== 'custom' && entityName !== 'master_data') {
      return `${entityName}.${field.field_name}`
    }
    return fieldLabel
  }

  if (!editingLayout.sections || editingLayout.sections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">Add sections and fields to see preview</p>
      </div>
    )
  }

  const renderField = (fieldName: string, sectionId: string) => {
    const fieldInfo = availableFieldsList.find((f) => f.field_name === fieldName)
    const value = previewFormData[fieldName] || ''
    const displayLabel = fieldInfo ? getFieldDisplayNameForPreview(fieldInfo) : fieldName.replace(/_/g, ' ')
    
    // Get field_config and field_type_display from fieldInfo
    const fieldConfig = (fieldInfo as any)?.field_config || {}
    const fieldOptions = fieldConfig.options || []
    const fieldType = (fieldInfo as any)?.field_type_display || fieldInfo?.field_type || 'text'
    
    // Normalize field value based on field type
    let fieldValue = value
    if (fieldType === 'multi_select' || (fieldType === 'json' && fieldOptions.length > 0)) {
      if (!Array.isArray(fieldValue)) {
        if (fieldValue && typeof fieldValue === 'string') {
          try {
            const parsed = JSON.parse(fieldValue)
            fieldValue = Array.isArray(parsed) ? parsed : [parsed]
          } catch {
            fieldValue = fieldValue.includes(',') ? fieldValue.split(',').map((v: string) => v.trim()) : [fieldValue]
          }
        } else {
          fieldValue = fieldValue ? [fieldValue] : []
        }
      }
    } else {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        fieldValue = fieldValue[0]
      } else if (Array.isArray(fieldValue)) {
        fieldValue = ''
      }
    }

    // Handle select fields with options (but not dependent fields)
    if (fieldType === 'select' && fieldOptions.length > 0 && !fieldConfig.depends_on) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
          <select
            value={fieldValue || ''}
            onChange={(e) => {
              const updates: any = { [fieldName]: e.target.value }
              // Clear dependent fields when parent field changes (generic approach)
              // Find all fields that depend on this field
              availableFieldsList.forEach((depField: any) => {
                const depConfig = depField.field_config || {}
                if (depConfig.depends_on === fieldName && depConfig.clear_on_parent_change !== false) {
                  updates[depField.field_name] = ''
                }
              })
              setPreviewFormData({ ...previewFormData, ...updates })
            }}
              className="enterprise-input"
          >
            <option value="">Select {displayLabel.toLowerCase()}...</option>
            {fieldOptions.map((opt: any) => {
              const optionValue = typeof opt === 'string' ? opt : opt.value
              const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
              return (
                <option key={optionValue} value={optionValue}>
                  {optionLabel}
                </option>
              )
            })}
          </select>
        </div>
      )
    }
    
    // Handle multi_select fields with options (checkboxes)
    if ((fieldType === 'multi_select' || (fieldType === 'json' && fieldOptions.length > 0)) && fieldOptions.length > 0) {
      const selectedValues = Array.isArray(fieldValue) ? fieldValue : (fieldValue ? [fieldValue] : [])
      return (
        <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
          <label className="enterprise-label">{displayLabel}</label>
          {fieldInfo?.description && (
            <p className="text-xs text-gray-500 mb-3">{fieldInfo.description}</p>
          )}
          <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-lg p-4">
            {fieldOptions.map((opt: any) => {
              const optionValue = typeof opt === 'string' ? opt : opt.value
              const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
              return (
                <label key={optionValue} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(optionValue)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...selectedValues, optionValue]
                        : selectedValues.filter((v: any) => v !== optionValue)
                      setPreviewFormData({ ...previewFormData, [fieldName]: newValues })
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{optionLabel}</span>
                </label>
              )
            })}
          </div>
          {selectedValues.length > 0 && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-400 rounded text-xs">
              <strong>Selected:</strong> {selectedValues.map((v: any) => {
                const opt = fieldOptions.find((o: any) => (typeof o === 'string' ? o : o.value) === v)
                return typeof opt === 'string' ? opt : (opt?.label || v)
              }).join(', ')}
            </div>
          )}
          </div>
        )
    }
    
    // Handle generic dependent_select field type (works for any dependent dropdown)
    if (fieldType === 'dependent_select' || (fieldConfig?.depends_on && fieldConfig?.dependent_options)) {
      const dependsOnField = fieldConfig.depends_on
      const dependsOnValue = previewFormData[dependsOnField] || ''
      const dependentOptions = dependsOnValue && fieldConfig.dependent_options 
        ? (fieldConfig.dependent_options[dependsOnValue] || [])
        : []
      const allowCustom = fieldConfig?.allow_custom || false
      const dependsOnLabel = fieldConfig.depends_on_label || dependsOnField.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // Check if we need custom input (no options for this parent value)
      const needsCustomInput = dependsOnValue && dependentOptions.length === 0 && allowCustom
      
      if (!dependsOnValue) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200">
              Please select {dependsOnLabel} first
            </div>
          </div>
        )
      }
      
      if (needsCustomInput) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="text"
              value={fieldValue || ''}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              placeholder={fieldConfig.placeholder || `Enter ${displayLabel.toLowerCase()}...`}
            />
          </div>
        )
      }
      
      if (dependentOptions.length > 0) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <select
              value={fieldValue || ''}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
            >
              <option value="">Select {displayLabel.toLowerCase()}...</option>
              {dependentOptions.map((opt: any) => {
                const optionValue = typeof opt === 'string' ? opt : opt.value
                const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                return (
                  <option key={optionValue} value={optionValue}>
                    {optionLabel}
                  </option>
                )
              })}
              {allowCustom && (
                <option value="Custom">Custom (specify below)</option>
              )}
            </select>
            {fieldValue === 'Custom' && allowCustom && (
              <input
                type="text"
                value={previewFormData[`${fieldName}_custom`] || ''}
                onChange={(e) => setPreviewFormData({ ...previewFormData, [`${fieldName}_custom`]: e.target.value })}
                className="enterprise-input mt-2"
                placeholder={`Enter custom ${displayLabel.toLowerCase()}...`}
              />
            )}
          </div>
        )
      } else {
        // No predefined options and custom not allowed, show text input
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="text"
              value={fieldValue || ''}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              placeholder={fieldConfig.placeholder || `Enter ${displayLabel.toLowerCase()}...`}
            />
          </div>
        )
      }
    }
    
    // Handle legacy dependent select fields (for backward compatibility)
    if (fieldType === 'select' && fieldConfig.depends_on && !fieldConfig.dependent_options) {
      const dependsOnValue = previewFormData[fieldConfig.depends_on] || ''
      const dependentOptions = dependsOnValue && fieldConfig.dependent_options 
        ? (fieldConfig.dependent_options[dependsOnValue] || [])
        : []
      
      if (!dependsOnValue) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200">
              Please select {fieldConfig.depends_on_label || fieldConfig.depends_on.replace(/_/g, ' ')} first
            </div>
          </div>
        )
      }
      
      if (dependentOptions.length > 0) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <select
              value={fieldValue || ''}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
            >
              <option value="">Select {displayLabel.toLowerCase()}...</option>
              {dependentOptions.map((opt: any) => {
                const optionValue = typeof opt === 'string' ? opt : opt.value
                const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                return (
                  <option key={optionValue} value={optionValue}>
                    {optionLabel}
                  </option>
                )
              })}
            </select>
          </div>
        )
      } else {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="text"
              value={fieldValue || ''}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              placeholder={fieldConfig.placeholder || `Enter ${displayLabel.toLowerCase()}...`}
            />
          </div>
        )
      }
    }

    // Determine input type based on field type
    switch (fieldType) {
      case 'textarea':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <textarea
              value={fieldValue}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              rows={4}
              placeholder={fieldInfo?.description}
            />
          </div>
        )
      case 'checkbox':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.checked })}
                className="mr-2"
              />
              {displayLabel}
            </label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mt-1">{fieldInfo.description}</p>
            )}
          </div>
        )
      case 'json':
        // JSON field - render as structured key-value input
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <JsonFieldInput
              value={fieldValue}
              onChange={(newValue) => {
                setPreviewFormData({ ...previewFormData, [fieldName]: newValue })
              }}
              placeholder={fieldInfo?.description || 'Add items to the list'}
              disabled={false}
              isReadOnly={false}
              useTableMode={true}
              fieldLabel={displayLabel}
            />
          </div>
        )
      case 'rich_text':
        // Rich text field - render with ReactQuill editor
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <div className="rich-text-editor-wrapper">
              <ReactQuillWrapper
                theme="snow"
                value={fieldValue || ''}
                onChange={(content: string) => {
                  setPreviewFormData({ ...previewFormData, [fieldName]: content })
                }}
                placeholder="Enter formatted text..."
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                  ],
                }}
                style={{ minHeight: '200px' }}
              />
            </div>
          </div>
        )
      case 'architecture_diagram':
      case 'mermaid_diagram':
      case 'visualization':
        // Diagram fields - render with DiagramFieldInput
        const diagramFieldConfig = fieldConfig as any || {}
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <DiagramFieldInput
              value={fieldValue}
              onChange={(newValue) => {
                setPreviewFormData({ ...previewFormData, [fieldName]: newValue })
              }}
              fieldType={fieldType as 'architecture_diagram' | 'mermaid_diagram' | 'visualization'}
              fieldConfig={diagramFieldConfig}
              agentData={previewFormData}
              placeholder={fieldInfo?.description}
              disabled={false}
              isReadOnly={false}
            />
          </div>
        )
      case 'number':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="number"
              value={value}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              placeholder={fieldInfo?.description}
            />
          </div>
        )
      case 'email':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="email"
              value={value}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              placeholder={fieldInfo?.description}
            />
          </div>
        )
      case 'date':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="date"
              value={value}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
            />
          </div>
        )
      default:
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <input
              type="text"
              value={value}
              onChange={(e) => setPreviewFormData({ ...previewFormData, [fieldName]: e.target.value })}
              className="enterprise-input"
              placeholder={fieldInfo?.description}
            />
          </div>
        )
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-medium mb-4">Form Preview</h2>
      <p className="text-sm text-gray-600 mb-4">
        {editingLayout.name 
          ? `Preview of the form layout: ${editingLayout.name}`
          : 'Preview how the form will look with the current layout configuration'}
      </p>
      <div className="bg-gray-50 p-4 rounded">
        <form className="space-y-6">
          {editingLayout.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <div key={section.id} className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-medium mb-4">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-gray-600 mb-4">{section.description}</p>
                )}
                <div className="space-y-3">
                  {section.fields.map((fieldName) => renderField(fieldName, section.id))}
                </div>
              </div>
            ))}
        </form>
      </div>
    </div>
  )
}


