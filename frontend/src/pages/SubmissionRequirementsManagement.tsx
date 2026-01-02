import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialInput, MaterialCard, MaterialChip } from '../components/material'
import { authApi, User } from '../lib/auth'
import { submissionRequirementsApi, SubmissionRequirement } from '../lib/submissionRequirements'
import Layout from '../components/Layout'
import * as XLSX from 'xlsx'
import { 
  BookOpen, Building2, AlertTriangle, FolderOpen, FileText, 
  Shield, CheckCircle2, Filter, FileQuestion, 
  Edit, Trash2, ToggleLeft, ToggleRight, Download, Upload, Settings, Eye, EyeOff,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, GripVertical, X, Plus
} from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableColumnHeader } from '../components/SortableColumnHeader'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox Group' },
  { value: 'radio', label: 'Radio Group' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File Upload' },
]

const CATEGORIES = [
  { value: 'security', label: 'Security' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'technical', label: 'Technical' },
  { value: 'business', label: 'Business' },
  { value: 'general', label: 'General' },
]

export default function SubmissionRequirementsManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showReadonlyModal, setShowReadonlyModal] = useState(false)
  const [selectedRequirement, setSelectedRequirement] = useState<SubmissionRequirement | null>(null)
  const [filterSourceType, setFilterSourceType] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterSection, setFilterSection] = useState<string>('')
  const [filterEnabled, setFilterEnabled] = useState<string>('all') // 'all', 'enabled', 'disabled'
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterRequirementType, setFilterRequirementType] = useState<'compliance' | 'risk' | 'questionnaires' | ''>('') // Filter by Requirement Type (MANDATORY)
  const [filterByRisk, setFilterByRisk] = useState<boolean>(false) // Filter by Risks (for Risk type)
  const [filterByComplianceFramework, setFilterByComplianceFramework] = useState<string>('') // Filter by specific Compliance Framework (for Compliance type)
  const [filterByFunctionalArea, setFilterByFunctionalArea] = useState<string>('') // Filter by Functional Area
  const [filterQuestionnaireType, setFilterQuestionnaireType] = useState<string>('') // Filter by Questionnaire Type/Package (for Questionnaires type)
  const [showUnmapped, setShowUnmapped] = useState<boolean>(true) // Show all requirements including unmapped ones
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    label: '',
    field_name: '',
    field_type: 'text',
    requirement_type: 'compliance' as 'compliance' | 'risk' | 'questionnaires', // MANDATORY
    description: '',
    placeholder: '',
    is_required: false,
    min_length: undefined as number | undefined,
    max_length: undefined as number | undefined,
    min_value: undefined as number | undefined,
    max_value: undefined as number | undefined,
    pattern: '',
    category: 'general',
    section: '',
    questionnaire_type: '',
    order: 0,
    allowed_response_types: [] as string[], // Questionnaire-style: multiple response types
    filter_conditions: {} as Record<string, any>, // Filter by agent category/type
  })
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([{ value: '', label: '' }])
  const [selectedResponseTypes, setSelectedResponseTypes] = useState<string[]>(['text'])
  const [filterAgentCategory, setFilterAgentCategory] = useState<string>('')
  const [filterAgentType, setFilterAgentType] = useState<string>('')
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState<boolean>(false)
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('requirements-column-order')
    return saved ? JSON.parse(saved) : ['catalogId', 'requirementType', 'label', 'description', 'metadata', 'status', 'type']
  })
  const [activeColumnFilter, setActiveColumnFilter] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'requirement_type' | 'category' | 'section' | 'questionnaire_type' | 'none'>('none')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()) // Track which groups are expanded

  // Column visibility configuration with default visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    // Load saved preferences from localStorage
    const saved = localStorage.getItem('requirements-grid-columns')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Migrate old 'id' key to 'catalogId' if present
        if (parsed.id !== undefined) {
          parsed.catalogId = parsed.id
          delete parsed.id
        }
        // Ensure all required columns exist with defaults
        // Force 'type' to false - it should only be in edit/view modals, not in base grid
        // Use saved preferences if they exist, otherwise use defaults
        return {
          catalogId: parsed.catalogId ?? false, // Hidden by default
          requirementType: parsed.requirementType ?? false, // Hidden by default
          label: parsed.label ?? true,
          type: false, // Always hidden in base grid - only shown in edit/view modals
          description: parsed.description ?? true,
          metadata: parsed.metadata ?? true,
          status: parsed.status ?? true,
          actions: true, // Always visible
        }
      } catch {
        // If parsing fails, use defaults
      }
    }
    // Default: Label, Description, Metadata, Status visible; Catalog ID, Requirement Type hidden
    return {
      catalogId: false, // Hidden by default
      requirementType: false, // Hidden by default
      label: true,
      type: false, // Hidden by default - only shown in edit/view modals
      description: true,
      metadata: true,
      status: true,
      actions: true, // Always visible
    }
  })

  // Save column preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('requirements-grid-columns', JSON.stringify(columnVisibility))
  }, [columnVisibility])

  // Save column order to localStorage
  useEffect(() => {
    localStorage.setItem('requirements-column-order', JSON.stringify(columnOrder))
  }, [columnOrder])

  const toggleColumn = (columnKey: string) => {
    // Don't allow hiding actions column
    if (columnKey === 'actions') return
    // Don't allow showing 'type' column in base grid - it's only in edit/view modals
    if (columnKey === 'type') return

    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  // Handle column sorting
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Handle column filtering
  const handleColumnFilterChange = (columnKey: string, value: string) => {
    setColumnFilters(prev => {
      const updated = { ...prev }
      if (value) {
        updated[columnKey] = value
      } else {
        delete updated[columnKey]
      }
      return updated
    })
  }

  // Handle column reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const resetColumns = () => {
    setColumnVisibility({
      catalogId: false, // Hidden by default
      requirementType: false, // Hidden by default
      label: true,
      type: false, // Always hidden in base grid - only shown in edit/view modals
      description: true,
      metadata: true,
      status: true,
      actions: true,
    })
  }

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: requirements, isLoading, refetch } = useQuery({
    queryKey: ['submission-requirements', filterSourceType, filterCategory, filterSection, filterEnabled, filterQuestionnaireType, filterRequirementType],
    queryFn: () => submissionRequirementsApi.list(
      filterCategory || undefined,
      filterSection || undefined,
      filterSourceType || undefined,
      filterEnabled === 'all' ? undefined : filterEnabled === 'enabled',
      undefined, // agentCategory
      undefined, // agentType
      filterQuestionnaireType || undefined,
      filterRequirementType || undefined
    ),
    enabled: !!user && ['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer', 'policy_admin'].includes(user?.role),
  })

  // Extract unique filter values from requirements (for dropdowns) - calculate early
  const complianceFrameworks = Array.from(new Set(
    requirements?.filter(req => req.section === 'Compliance Frameworks' && req.source_name)
      .map(req => req.source_name!)
      .sort() || []
  ))

  const functionalAreas = Array.from(new Set(
    requirements?.filter(req => req.section?.startsWith('Functional Areas - '))
      .map(req => req.section!.replace('Functional Areas - ', ''))
      .sort() || []
  ))

  // Filter requirements based on selected filters - MUST be defined before functions/hooks that use it
  const filteredRequirements = (requirements || []).filter(req => {
    // Filter by Requirement Type (MANDATORY - primary filter)
    if (filterRequirementType && req.requirement_type !== filterRequirementType) {
      return false
    }

    // Filter by Compliance Framework (only for Compliance type)
    if (filterByComplianceFramework) {
      if (req.requirement_type !== 'compliance' || req.section !== 'Compliance Frameworks' || req.source_name !== filterByComplianceFramework) {
        return false
      }
    }

    // Filter by Risk (only for Risk type)
    if (filterByRisk) {
      if (req.requirement_type !== 'risk' || req.section !== 'Risks') {
        return false
      }
    }

    // Filter by Functional Area
    if (filterByFunctionalArea) {
      if (req.section !== `Functional Areas - ${filterByFunctionalArea}`) {
        return false
      }
    }

    // Filter by Questionnaire Type/Package (only for Questionnaires type)
    if (filterQuestionnaireType) {
      if (req.requirement_type !== 'questionnaires' || req.questionnaire_type !== filterQuestionnaireType) {
        return false
      }
    }

    // Filter by existing filters
    if (filterCategory && req.category !== filterCategory) return false
    if (filterSection && req.section !== filterSection) return false
    if (filterSourceType && req.source_type !== filterSourceType) return false
    if (filterEnabled === 'enabled' && !req.is_enabled) return false
    if (filterEnabled === 'disabled' && req.is_enabled) return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        req.label.toLowerCase().includes(query) ||
        (req.catalog_id && req.catalog_id.toLowerCase().includes(query)) ||
        (req.description && req.description.toLowerCase().includes(query)) ||
        (req.section && req.section.toLowerCase().includes(query)) ||
        (req.source_name && req.source_name.toLowerCase().includes(query))
      if (!matchesSearch) return false
    }

    // Column-level filters
    if (columnFilters.catalogId && req.catalog_id && !req.catalog_id.toLowerCase().includes(columnFilters.catalogId.toLowerCase())) {
      return false
    }
    if (columnFilters.label && !req.label.toLowerCase().includes(columnFilters.label.toLowerCase())) {
      return false
    }
    if (columnFilters.description && req.description && !req.description.toLowerCase().includes(columnFilters.description.toLowerCase())) {
      return false
    }
    if (columnFilters.type && req.field_type && !req.field_type.toLowerCase().includes(columnFilters.type.toLowerCase())) {
      return false
    }
    if (columnFilters.requirementType && req.requirement_type && !req.requirement_type.toLowerCase().includes(columnFilters.requirementType.toLowerCase())) {
      return false
    }

    // Show all requirements by default, or filter by mapping status
    if (!showUnmapped) {
      // Only show properly mapped requirements
      // A requirement is considered "mapped" if it has:
      // 1. A section mapping (Risks, Compliance Frameworks, or Functional Areas)
      // 2. A category (Security, Compliance, Technical, Business)
      // 3. A questionnaire_type (for questionnaire requirements)
      const isProperlyMapped = 
        req.section === 'Risks' ||
        req.section === 'Compliance Frameworks' ||
        (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ') ||
        (req.category && ['security', 'compliance', 'technical', 'business'].includes(req.category.toLowerCase())) ||
        (req.questionnaire_type && req.requirement_type === 'questionnaires')
      if (!isProperlyMapped) return false
    }

    return true
  })

  // Selection handlers - MUST be defined after filteredRequirements
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredRequirements.map(req => req.id))
      setSelectedRequirements(allIds)
      setSelectAll(true)
    } else {
      setSelectedRequirements(new Set())
      setSelectAll(false)
    }
  }

  const handleSelectRequirement = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRequirements)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedRequirements(newSelected)
    setSelectAll(newSelected.size === filteredRequirements.length && filteredRequirements.length > 0)
  }

  const handleBulkDelete = async () => {
    if (selectedRequirements.size === 0) return
    
    // Allow deletion of all requirements, including auto-generated ones
    const deletableRequirements = filteredRequirements.filter(
      req => selectedRequirements.has(req.id)
    )
    
    if (deletableRequirements.length === 0) {
      return
    }
    
    const confirmMessage = `Are you sure you want to delete ${deletableRequirements.length} requirement${deletableRequirements.length !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`
    
    if (window.confirm(confirmMessage)) {
      try {
        // Delete all selected requirements sequentially to avoid overwhelming the server
        const deletePromises = deletableRequirements.map(req => 
          deleteMutation.mutateAsync(req.id)
        )
        await Promise.all(deletePromises)
        setSelectedRequirements(new Set())
        setSelectAll(false)
      } catch (error) {
        console.error('Error deleting requirements:', error)
        alert('Some requirements could not be deleted. Please try again.')
      }
    }
  }

  // Update select all state when filtered requirements change
  useEffect(() => {
    if (filteredRequirements.length > 0) {
      const allSelected = filteredRequirements.every(req => selectedRequirements.has(req.id))
      setSelectAll(allSelected)
    } else {
      setSelectAll(false)
    }
  }, [filteredRequirements, selectedRequirements])

  // Clear selection when filters change significantly (only if no selected items are in filtered results)
  useEffect(() => {
    if (selectedRequirements.size > 0 && filteredRequirements.length > 0) {
      const hasSelectedInFiltered = Array.from(selectedRequirements).some(id => 
        filteredRequirements.some(req => req.id === id)
      )
      if (!hasSelectedInFiltered) {
        // Selection is completely outside filtered results, clear it
        setSelectedRequirements(new Set())
        setSelectAll(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRequirements.length])

  const toggleMutation = useMutation({
    mutationFn: (id: string) => submissionRequirementsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
    },
  })


  const createMutation = useMutation({
    mutationFn: (data: Partial<SubmissionRequirement>) => submissionRequirementsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
      setShowCreateModal(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; requirement: Partial<SubmissionRequirement> }) =>
      submissionRequirementsApi.update(data.id, data.requirement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
      setShowEditModal(false)
      setSelectedRequirement(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => submissionRequirementsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: async (reqs: any[]) => {
      const results = []
      for (const req of reqs) {
        try {
          const result = await submissionRequirementsApi.create(req)
          results.push({ success: true, data: result })
        } catch (error: any) {
          results.push({ success: false, error: error.message, data: req })
        }
      }
      return results
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      alert(`Import completed: ${successCount} succeeded, ${failCount} failed`)
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
      setShowImportModal(false)
      setImportFile(null)
    },
    onError: (error: any) => {
      alert(`Import failed: ${error.message}`)
    }
  })

  const resetForm = () => {
    setFormData({
      label: '',
      field_name: '',
      field_type: 'text',
      requirement_type: 'compliance',
      description: '',
      placeholder: '',
      is_required: false,
      min_length: undefined,
      max_length: undefined,
      min_value: undefined,
      max_value: undefined,
      pattern: '',
      category: 'general',
      section: '',
      questionnaire_type: '',
      order: 0,
      allowed_response_types: [],
      filter_conditions: {},
    })
    setOptions([{ value: '', label: '' }])
    setSelectedResponseTypes(['text'])
    setFilterAgentCategory('')
    setFilterAgentType('')
  }

  const handleCreateClick = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const handleEditClick = (requirement: SubmissionRequirement) => {
    setSelectedRequirement(requirement)
    setFormData({
      label: requirement.label,
      field_name: requirement.field_name,
      field_type: requirement.field_type,
      requirement_type: requirement.requirement_type || 'compliance',
      description: requirement.description || '',
      placeholder: requirement.placeholder || '',
      is_required: requirement.is_required,
      min_length: requirement.min_length,
      max_length: requirement.max_length,
      min_value: requirement.min_value,
      max_value: requirement.max_value,
      pattern: requirement.pattern || '',
      category: requirement.category || 'general',
      section: requirement.section || '',
      questionnaire_type: requirement.questionnaire_type || '',
      order: requirement.order,
      allowed_response_types: requirement.allowed_response_types || [],
      filter_conditions: requirement.filter_conditions || {},
    })
    // Set response types
    setSelectedResponseTypes(requirement.allowed_response_types || [requirement.field_type])
    // Set filter conditions
    if (requirement.filter_conditions) {
      setFilterAgentCategory(Array.isArray(requirement.filter_conditions.agent_category) 
        ? requirement.filter_conditions.agent_category[0] || ''
        : requirement.filter_conditions.agent_category || '')
      setFilterAgentType(Array.isArray(requirement.filter_conditions.agent_type)
        ? requirement.filter_conditions.agent_type[0] || ''
        : requirement.filter_conditions.agent_type || '')
    }
    // Parse options - handle both string array and object array
    const reqOptions = (requirement.options || []) as any[]
    if (reqOptions.length > 0 && typeof reqOptions[0] === 'string') {
      setOptions(reqOptions.map((opt: string) => ({ value: opt, label: opt })))
    } else {
      setOptions(reqOptions.length > 0 ? reqOptions : [{ value: '', label: '' }])
    }
    setShowEditModal(true)
  }

  const handleAddOption = () => {
    setOptions([...options, { value: '', label: '' }])
  }

  const handleOptionChange = (index: number, field: 'value' | 'label', value: string) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    setOptions(newOptions)
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // field_name should be generated from catalog_id on backend, not from label
    // Entity design: Entity has Title (label) and Description, field_name is a short code
    // If field_name is provided and valid, use it; otherwise backend will generate from catalog_id
    let fieldName = formData.field_name
    if (!fieldName || !/^[a-z][a-z0-9_]*$/.test(fieldName)) {
      // Don't auto-generate from label - backend will generate from catalog_id
      // Just ensure it's a valid format for now, backend will override
      fieldName = `req_${Date.now()}`
    }

    // Build filter conditions
    const filterConditions: Record<string, any> = {}
    if (filterAgentCategory) {
      filterConditions.agent_category = [filterAgentCategory]
    }
    if (filterAgentType) {
      filterConditions.agent_type = [filterAgentType]
    }

    const requirementData: any = {
      ...formData,
      field_name: fieldName, // Use auto-generated field name
      options: ['select', 'multi_select', 'checkbox', 'radio'].includes(formData.field_type)
        ? options.filter(opt => opt.value && opt.label).map(opt => ({ value: opt.value, label: opt.label }))
        : undefined,
      // Questionnaire-style: Set allowed response types (if multiple selected, enable questionnaire mode)
      allowed_response_types: selectedResponseTypes.length > 1 ? selectedResponseTypes : undefined,
      // Filter conditions
      filter_conditions: Object.keys(filterConditions).length > 0 ? filterConditions : undefined,
    }

    if (selectedRequirement) {
      updateMutation.mutate({ id: selectedRequirement.id, requirement: requirementData })
    } else {
      createMutation.mutate(requirementData)
    }
  }

  if (!user || !['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer', 'policy_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Requirement management access required.</div>
        </div>
      </Layout>
    )
  }

  // Get unique values for filter dropdowns
  const uniqueSections = Array.from(new Set(requirements?.map(r => r.section).filter(Boolean) || []))
  const uniqueCategories = Array.from(new Set(requirements?.map(r => r.category).filter(Boolean) || []))

  return (
    <Layout user={user}>
      <div className="space-y-6 relative">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-medium mb-2">Submission Requirements</h1>
            <p className="text-sm text-muted-foreground">
              Define organization-specific requirements that vendors must complete when submitting agents
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <MaterialButton
              variant={showFilters ? 'contained' : 'outlined'}
              color={showFilters ? 'primary' : 'gray'}
              onClick={() => setShowFilters(!showFilters)}
              startIcon={<Filter className="w-4 h-4" />}
              title="Toggle filters"
            >
              Filters
            </MaterialButton>
            <MaterialButton
              variant="outlined"
              color="gray"
              onClick={() => setShowExportModal(true)}
              startIcon={<Download className="w-4 h-4" />}
            >
              Export
            </MaterialButton>
            <MaterialButton
              variant="outlined"
              color="gray"
              onClick={() => setShowImportModal(true)}
              startIcon={<Upload className="w-4 h-4" />}
            >
              Import
            </MaterialButton>
            <MaterialButton
              onClick={handleCreateClick}
              disabled={createMutation.isPending}
              loading={createMutation.isPending}
              startIcon={<Plus className="w-4 h-4" />}
            >
              Add Requirement
            </MaterialButton>
          </div>
        </div>
        
        {/* Column Selector and Group By - Compact Bar */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-gray-700 tracking-tight">Columns:</span>
              {[
                { key: 'catalogId', label: 'Catalog ID' },
                { key: 'requirementType', label: 'Requirement Type' },
                { key: 'label', label: 'Label' },
                { key: 'description', label: 'Description' },
                { key: 'metadata', label: 'Metadata' },
                { key: 'status', label: 'Status' },
              ].map(col => (
                <label
                  key={col.key}
                  className="flex items-center gap-1.5 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={columnVisibility[col.key] !== false}
                    onChange={() => toggleColumn(col.key)}
                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-700 group-hover:text-gray-900">{col.label}</span>
                </label>
              ))}
              <button
                onClick={resetColumns}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 hover:bg-indigo-50 rounded transition-colors"
              >
                Reset
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 tracking-tight">Group By:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="requirement_type">Requirement Type</option>
                  <option value="category">Category</option>
                  <option value="section">Section</option>
                  <option value="questionnaire_type">Questionnaire Type</option>
                  <option value="none">None</option>
                </select>
              </label>
              <div className="text-xs text-gray-500 font-medium">
                {Object.entries(columnVisibility).filter(([key, value]) => key !== 'actions' && value).length} of {Object.keys(columnVisibility).filter(key => key !== 'actions').length} visible
              </div>
            </div>
          </div>
        </div>


        {/* Bulk Actions Bar */}
        {selectedRequirements.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-900">
                {selectedRequirements.size} requirement{selectedRequirements.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedRequirements(new Set())
                  setSelectAll(false)
                }}
                className="px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-300 transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin">⏳</span>
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedRequirements.size})
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Comprehensive Filters - Collapsible */}
        {showFilters && (
          <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Filter Requirements</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-600 hover:text-gray-600 text-sm"
              >
                Hide Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              {/* Requirement Type Filter (MANDATORY - Primary Filter) */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Requirement Type *</label>
                <select
                  value={filterRequirementType}
                  onChange={(e) => {
                    const newType = e.target.value as 'compliance' | 'risk' | 'questionnaires' | ''
                    setFilterRequirementType(newType)
                    // Reset sub-filters when type changes
                    setFilterByRisk(false)
                    setFilterByComplianceFramework('')
                    setFilterQuestionnaireType('')
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">All Types</option>
                  <option value="compliance">Compliance</option>
                  <option value="risk">Risk</option>
                  <option value="questionnaires">Questionnaires</option>
                </select>
              </div>

              {/* Compliance Framework Filter (only shown when Compliance type is selected) */}
              {filterRequirementType === 'compliance' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700">By Compliance Framework</label>
                  <select
                    value={filterByComplianceFramework}
                    onChange={(e) => {
                      setFilterByComplianceFramework(e.target.value)
                      setFilterByRisk(false)
                      setFilterByFunctionalArea('')
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">All Frameworks</option>
                    {complianceFrameworks.map((framework) => (
                      <option key={framework} value={framework}>
                        {framework}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Risk Filter (only shown when Risk type is selected) */}
              {filterRequirementType === 'risk' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700">By Risk</label>
                  <button
                    onClick={() => {
                      setFilterByRisk(!filterByRisk)
                      setFilterByComplianceFramework('')
                      setFilterByFunctionalArea('')
                    }}
                    className={`w-full px-3 py-2 text-sm rounded-lg border transition-all flex items-center justify-center gap-2 ${
                      filterByRisk
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 ${filterByRisk ? 'text-orange-600' : 'text-gray-600'}`} />
                    <span>Show Risks</span>
                  </button>
                </div>
              )}

              {/* Questionnaire Package Filter (only shown when Questionnaires type is selected) */}
              {filterRequirementType === 'questionnaires' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700">By Questionnaire Package</label>
                  <select
                    value={filterQuestionnaireType}
                    onChange={(e) => {
                      setFilterQuestionnaireType(e.target.value)
                      setFilterByRisk(false)
                      setFilterByComplianceFramework('')
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">All Packages</option>
                    <option value="TPRM- Questionnaire">TPRM- Questionnaire</option>
                    <option value="Vendor Security Questionnaire">Vendor Security Questionnaire</option>
                    <option value="Sub Contractor Questionnaire">Sub Contractor Questionnaire</option>
                    <option value="Vendor Qualification">Vendor Qualification</option>
                  </select>
                </div>
              )}

              {/* Functional Area Filter */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">By Functional Area</label>
                <select
                  value={filterByFunctionalArea}
                  onChange={(e) => {
                    setFilterByFunctionalArea(e.target.value)
                    setFilterByRisk(false)
                    setFilterByComplianceFramework('')
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">All Areas</option>
                  {functionalAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search requirements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Additional Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Source Type Filter */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Source</label>
          <select
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Sources</option>
            <option value="library">Library</option>
            <option value="framework">Framework</option>
            <option value="risk">Risk</option>
            <option value="category">Category</option>
            <option value="manual">Manual</option>
          </select>
              </div>

              {/* Enabled Status Filter */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Status</label>
                <select
                  value={filterEnabled}
                  onChange={(e) => setFilterEnabled(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Questionnaire Type Filter */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Questionnaire Type</label>
                <select
                  value={filterQuestionnaireType}
                  onChange={(e) => setFilterQuestionnaireType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Types</option>
                  <option value="TPRM- Questionnaire">TPRM- Questionnaire</option>
                  <option value="Vendor Security Questionnaire">Vendor Security Questionnaire</option>
                  <option value="Sub Contractor Questionnaire">Sub Contractor Questionnaire</option>
                  <option value="Vendor Qualification">Vendor Qualification</option>
                </select>
              </div>

              {/* Show Unmapped Toggle - More Prominent */}
              <div className="flex items-end">
                <label className={`flex items-center gap-2 cursor-pointer w-full px-3 py-2 text-sm border rounded-lg transition-all ${
                  showUnmapped 
                    ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={showUnmapped}
                    onChange={(e) => setShowUnmapped(e.target.checked)}
                    className={`w-4 h-4 rounded focus:ring-2 focus:ring-offset-1 ${
                      showUnmapped 
                        ? 'text-orange-600 border-orange-400 focus:ring-orange-500' 
                        : 'text-indigo-600 border-gray-300 focus:ring-indigo-500'
                    }`}
                  />
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${
                    showUnmapped ? 'text-orange-700' : 'text-gray-700'
                  }`}>
                    {showUnmapped && <AlertTriangle className="w-3.5 h-3.5" />}
                    Show Unmapped
                  </span>
                </label>
              </div>
            </div>

            {/* Clear Filters Row */}
            <div className="mt-2">
              {(filterRequirementType || filterByRisk || filterByComplianceFramework || filterByFunctionalArea || filterQuestionnaireType || searchQuery || filterCategory || filterSourceType || filterEnabled !== 'all' || !showUnmapped) && (
                <button
                  onClick={() => {
                    setFilterRequirementType('')
                    setFilterByRisk(false)
                    setFilterByComplianceFramework('')
                    setFilterByFunctionalArea('')
                    setFilterQuestionnaireType('')
                    setSearchQuery('')
                    setFilterCategory('')
                    setFilterSourceType('')
                    setFilterEnabled('all')
                    setShowUnmapped(true)
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Clear All Filters
                </button>
              )}
            </div>
          </div>

        {/* Unmapped Requirements Alert Banner - Only show when filters are visible or unmapped items exist */}
        {showFilters && (() => {
            const unmappedCount = requirements?.filter(req => {
              // A requirement is considered "mapped" if it has:
              // 1. A section mapping (Risks, Compliance Frameworks, or Functional Areas)
              // 2. A category (Security, Compliance, Technical, Business)
              // 3. A questionnaire_type (for questionnaire requirements)
              const isMapped = 
                req.section === 'Risks' ||
                req.section === 'Compliance Frameworks' ||
                (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ') ||
                (req.category && ['security', 'compliance', 'technical', 'business'].includes(req.category.toLowerCase())) ||
                (req.questionnaire_type && req.requirement_type === 'questionnaires')
              return !isMapped
            }).length || 0
            
            if (unmappedCount > 0) {
              return (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4 rounded-r-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <div>
                        <h3 className="text-sm font-medium text-orange-900">
                          {unmappedCount} Unmapped Requirement{unmappedCount !== 1 ? 's' : ''} Need Attention
                        </h3>
                        <p className="text-xs text-orange-700 mt-0.5">
                          These requirements are not mapped to Risks, Compliance Frameworks, or Functional Areas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowUnmapped(true)
                          // Clear other filters to show only unmapped
                          setFilterRequirementType('')
                          setFilterByRisk(false)
                          setFilterByComplianceFramework('')
                          setFilterByFunctionalArea('')
                          setFilterQuestionnaireType('')
                          setSearchQuery('')
                          setFilterCategory('')
                          setFilterSourceType('')
                          setFilterEnabled('all')
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center gap-1.5"
                      >
                        <Filter className="w-3 h-3" />
                        Show Only Unmapped
                      </button>
                      {!showUnmapped && (
                        <button
                          onClick={() => setShowUnmapped(false)}
                          className="px-3 py-1.5 text-xs font-medium bg-white text-orange-700 border border-orange-300 rounded-md hover:bg-orange-50 transition-colors"
                        >
                          Hide Unmapped
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

        {/* Filter Summary with Mapping Status - Always visible but compact */}
        <div className="mb-4 flex items-center justify-between text-sm">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium text-gray-900">{filteredRequirements.length}</span> of <span className="font-medium">{requirements?.length || 0}</span> requirements
              {(filterRequirementType || filterByRisk || filterByComplianceFramework || filterByFunctionalArea || filterQuestionnaireType || searchQuery || filterCategory || filterSourceType || filterEnabled !== 'all' || !showUnmapped) && (
                <span className="ml-2 text-xs text-indigo-600">(filtered)</span>
              )}
            </div>
            {requirements && requirements.length > 0 && (
              <div className="text-xs text-gray-500 flex items-center gap-3">
                {(() => {
                  const mappedCount = requirements.filter(req => {
                    return req.section === 'Risks' ||
                      req.section === 'Compliance Frameworks' ||
                      (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ')
                  }).length
                  const unmappedCount = requirements.length - mappedCount
                  const questionnaireCounts = {
                    'TPRM- Questionnaire': requirements.filter(r => r.questionnaire_type === 'TPRM- Questionnaire').length,
                    'Vendor Security Questionnaire': requirements.filter(r => r.questionnaire_type === 'Vendor Security Questionnaire').length,
                    'Sub Contractor Questionnaire': requirements.filter(r => r.questionnaire_type === 'Sub Contractor Questionnaire').length,
                    'Vendor Qualification': requirements.filter(r => r.questionnaire_type === 'Vendor Qualification').length,
                  }
                  return (
                    <>
                      <span>
                        <span className="text-green-600 font-medium">{mappedCount} mapped</span>
                        {unmappedCount > 0 && (
                          <button
                            onClick={() => {
                              setShowUnmapped(true)
                              setFilterRequirementType('')
                              setFilterByRisk(false)
                              setFilterByComplianceFramework('')
                              setFilterByFunctionalArea('')
                              setFilterQuestionnaireType('')
                              setSearchQuery('')
                              setFilterCategory('')
                              setFilterSourceType('')
                              setFilterEnabled('all')
                            }}
                            className="ml-2 text-orange-600 font-medium hover:text-orange-700 hover:underline cursor-pointer"
                          >
                            {unmappedCount} unmapped
                          </button>
                        )}
                      </span>
                      {Object.values(questionnaireCounts).some(count => count > 0) && (
                        <span className="text-indigo-600">
                          • {questionnaireCounts['TPRM- Questionnaire']} TPRM • {questionnaireCounts['Vendor Security Questionnaire']} Security • {questionnaireCounts['Sub Contractor Questionnaire']} Sub-Contractor • {questionnaireCounts['Vendor Qualification']} Qualification
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading requirements...</div>
        ) : filteredRequirements.length === 0 ? (
          <div className="bg-white border rounded-lg text-center py-12">
            <div className="text-muted-foreground mb-4">
              {filterRequirementType || filterByRisk || filterByComplianceFramework || filterByFunctionalArea || searchQuery || filterCategory || filterSourceType || filterEnabled !== 'all'
                ? 'No requirements match your filters'
                : 'No requirements defined yet'}
            </div>
            {!filterRequirementType && !filterByRisk && !filterByComplianceFramework && !filterByFunctionalArea && !searchQuery && !filterCategory && !filterSourceType && filterEnabled === 'all' && (
            <MaterialButton 
              onClick={handleCreateClick} 
              variant="contained" 
              color="primary"
              className="rounded-md shadow-lg shadow-primary-500/20"
              startIcon={<Plus className="w-4 h-4" />}
            >
              Create First Requirement
            </MaterialButton>
            )}
          </div>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm">
            {/* Table Layout - Rows */}
            <div className="w-full overflow-hidden hide-scrollbar border border-gray-200 rounded-lg">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="border-collapse w-full table-fixed">
                  <thead>
                    {/* Main Header Row with Sorting, Filtering, and Reordering */}
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300">
                      {/* Selection Checkbox Column */}
                      <th className="px-4 py-3 text-left w-[4%]">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                          title="Select all"
                        />
                      </th>
                      
                      <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                        {columnOrder.map((colKey) => {
                          if (!columnVisibility[colKey]) return null
                          
                          const columnConfigs: Record<string, { label: string; width: string }> = {
                            catalogId: { label: 'Catalog ID', width: '10%' },
                            requirementType: { label: 'Requirement Type *', width: '12%' },
                            label: { label: 'Label', width: '18%' },
                            type: { label: 'Type', width: '8%' },
                            description: { label: 'Description', width: '20%' },
                            metadata: { label: 'Metadata', width: '15%' },
                            status: { label: 'Status', width: '8%' },
                          }
                          
                          const config = columnConfigs[colKey]
                          if (!config) return null
                          
                          return (
                            <SortableColumnHeader
                              key={colKey}
                              id={colKey}
                              label={config.label}
                              width={config.width}
                              sortable={true}
                              filterable={true}
                              isSorting={sortColumn === colKey}
                              sortDirection={sortColumn === colKey ? sortDirection : null}
                              onSort={() => handleSort(colKey)}
                              filterValue={columnFilters[colKey] || ''}
                              onFilterChange={(value) => handleColumnFilterChange(colKey, value)}
                              showFilter={activeColumnFilter === colKey}
                              onToggleFilter={() => setActiveColumnFilter(activeColumnFilter === colKey ? null : colKey)}
                            />
                          )
                        })}
                      </SortableContext>
                      
                      {/* Actions Column - Always Visible */}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-[15%]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Helper function to render a requirement cell
                    const renderCell = (req: SubmissionRequirement, colKey: string, isUnmapped: boolean) => {
                      switch (colKey) {
                        case 'catalogId':
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '140px' }}>
                              <code 
                                className="text-xs font-medium text-indigo-700 font-mono bg-indigo-50 px-2 py-1 rounded border border-indigo-200 whitespace-nowrap" 
                                title={req.catalog_id || 'Catalog ID not assigned'}
                              >
                                {req.catalog_id || 'N/A'}
                              </code>
                            </td>
                          )
                        case 'requirementType':
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '160px' }}>
                              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border whitespace-nowrap ${
                                req.requirement_type === 'compliance' 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                  : req.requirement_type === 'risk'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {req.requirement_type === 'compliance' ? 'Compliance' : 
                                 req.requirement_type === 'risk' ? 'Risk' : 'Questionnaires'}
                              </span>
                            </td>
                          )
                        case 'label':
                          const displayLabel = req.label && typeof req.label === 'string' 
                            ? req.label.trim() 
                            : 'No label'
                          const isLikelyResponse = displayLabel.length > 150
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '280px' }}>
                              <div 
                                className={`font-medium text-gray-900 text-sm ${isLikelyResponse ? 'text-orange-600' : ''}`}
                                title={displayLabel}
                              >
                                {isLikelyResponse ? (
                                  <span className="flex items-start gap-1">
                                    <AlertTriangle className="w-3 h-3 text-orange-600 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{displayLabel.substring(0, 150)}...</span>
                                  </span>
                                ) : (
                                  <span className="line-clamp-2">{displayLabel}</span>
                                )}
                              </div>
                              {req.is_required && (
                                <span className="inline-flex items-center gap-1 mt-1 text-xs text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                                  Required
                                </span>
                              )}
                            </td>
                          )
                        case 'type':
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '120px' }}>
                              <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md border border-blue-400 font-medium whitespace-nowrap">
                                {req.field_type}
                              </span>
                            </td>
                          )
                        case 'description':
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '320px' }}>
                              <div className="text-xs text-gray-600 line-clamp-2" title={req.description || ''}>
                                {req.description || <span className="text-gray-600 italic">No description</span>}
                              </div>
                            </td>
                          )
                        case 'metadata':
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '280px' }}>
                              <div className="flex flex-wrap gap-1.5">
                                {req.category && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-slate-50 text-slate-700 rounded border border-slate-200 capitalize font-medium whitespace-nowrap">
                                    {req.category}
                                  </span>
                                )}
                                {req.questionnaire_type && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-medium">
                                    <FileQuestion className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate max-w-[150px]">{req.questionnaire_type}</span>
                                  </span>
                                )}
                                {isUnmapped && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded border-2 border-orange-400 font-medium shadow-sm whitespace-nowrap" title="This requirement is not mapped to Risks, Compliance Frameworks, Functional Areas, or has no category/questionnaire type. Click to edit and map it.">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    Unmapped
                                  </span>
                                )}
                                {req.section === 'Risks' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-orange-50 text-orange-700 rounded border border-orange-200 font-medium whitespace-nowrap" title="Risk Assessment">
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                    Risk
                                  </span>
                                )}
                                {req.section === 'Compliance Frameworks' && req.source_name && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-medium whitespace-nowrap" title={`Compliance Framework: ${req.source_name}`}>
                                    <Shield className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate max-w-[120px]">{req.source_name}</span>
                                  </span>
                                )}
                                {req.section?.startsWith('Functional Areas - ') && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded border border-blue-400 font-medium whitespace-nowrap" title={`Functional Area: ${req.section.replace('Functional Areas - ', '')}`}>
                                    <FolderOpen className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate max-w-[120px]">{req.section.replace('Functional Areas - ', '')}</span>
                                  </span>
                                )}
                                {req.is_auto_generated && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-purple-50 text-purple-700 rounded border border-purple-200 font-medium whitespace-nowrap" title={`Source: ${req.source_name || req.source_type || 'Auto-generated'}`}>
                                    {req.source_type === 'library' ? <BookOpen className="w-3 h-3 flex-shrink-0" /> : 
                                     req.source_type === 'framework' ? <Building2 className="w-3 h-3 flex-shrink-0" /> :
                                     req.source_type === 'risk' ? <AlertTriangle className="w-3 h-3 flex-shrink-0" /> :
                                     req.source_type === 'category' ? <FolderOpen className="w-3 h-3 flex-shrink-0" /> : 
                                     <FileText className="w-3 h-3 flex-shrink-0" />}
                                  </span>
                                )}
                                {req.allowed_response_types && req.allowed_response_types.length > 1 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-50 text-green-700 rounded border border-green-200 font-medium whitespace-nowrap" title="Multiple response types allowed">
                                    Multi-Response
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        case 'status':
                          return (
                            <td key={colKey} className="px-4 py-3" style={{ width: '100px' }} onClick={(e) => e.stopPropagation()}>
                              <label 
                                className="flex items-center gap-1.5 cursor-pointer group"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleMutation.mutate(req.id)
                                }}
                                title={req.is_enabled !== false ? 'Click to disable' : 'Click to enable'}
                              >
                                {req.is_enabled !== false ? (
                                  <ToggleRight className="w-5 h-5 text-green-600 group-hover:text-green-700" />
                                ) : (
                                  <ToggleLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-600" />
                                )}
                              </label>
                            </td>
                          )
                        default:
                          return null
                      }
                    }
                    
                    // Group requirements based on selected grouping option
                    let grouped: Record<string, SubmissionRequirement[]> = {}
                    
                    if (groupBy === 'none') {
                      // No grouping - single group
                      grouped = { 'all': filteredRequirements }
                    } else if (groupBy === 'requirement_type') {
                      // Group by requirement type (default)
                      grouped = filteredRequirements.reduce((acc, req) => {
                        const type = req.requirement_type || 'compliance'
                        if (!acc[type]) {
                          acc[type] = []
                        }
                        acc[type].push(req)
                        return acc
                      }, {} as Record<string, SubmissionRequirement[]>)
                    } else if (groupBy === 'category') {
                      // Group by category
                      grouped = filteredRequirements.reduce((acc, req) => {
                        const category = req.category || 'Uncategorized'
                        if (!acc[category]) {
                          acc[category] = []
                        }
                        acc[category].push(req)
                        return acc
                      }, {} as Record<string, SubmissionRequirement[]>)
                    } else if (groupBy === 'section') {
                      // Group by section
                      grouped = filteredRequirements.reduce((acc, req) => {
                        const section = req.section || 'Uncategorized'
                        if (!acc[section]) {
                          acc[section] = []
                        }
                        acc[section].push(req)
                        return acc
                      }, {} as Record<string, SubmissionRequirement[]>)
                    } else if (groupBy === 'questionnaire_type') {
                      // Group by questionnaire type
                      grouped = filteredRequirements.reduce((acc, req) => {
                        const qType = req.questionnaire_type || 'Other'
                        if (!acc[qType]) {
                          acc[qType] = []
                        }
                        acc[qType].push(req)
                        return acc
                      }, {} as Record<string, SubmissionRequirement[]>)
                    }
                    
                    // Sort within each group
                    const sortGroup = (group: SubmissionRequirement[]) => {
                      return group.sort((a, b) => {
                        // Apply column-level sorting if set
                        if (sortColumn) {
                          let aVal: any
                          let bVal: any
                          
                          switch (sortColumn) {
                            case 'catalogId':
                              aVal = a.catalog_id || ''
                              bVal = b.catalog_id || ''
                              break
                            case 'requirementType':
                              aVal = a.requirement_type || ''
                              bVal = b.requirement_type || ''
                              break
                            case 'label':
                              aVal = a.label || ''
                              bVal = b.label || ''
                              break
                            case 'type':
                              aVal = a.field_type || ''
                              bVal = b.field_type || ''
                              break
                            case 'description':
                              aVal = a.description || ''
                              bVal = b.description || ''
                              break
                            case 'status':
                              aVal = a.is_enabled ? 1 : 0
                              bVal = b.is_enabled ? 1 : 0
                              break
                            default:
                              aVal = a.order || 0
                              bVal = b.order || 0
                          }
                          
                          // Compare values
                          if (typeof aVal === 'string' && typeof bVal === 'string') {
                            const comparison = aVal.localeCompare(bVal)
                            return sortDirection === 'asc' ? comparison : -comparison
                          } else {
                            const comparison = (aVal || 0) - (bVal || 0)
                            return sortDirection === 'asc' ? comparison : -comparison
                          }
                        }
                        
                        // Default sorting: Check if items are unmapped
                        const aIsMapped = 
                          a.section === 'Risks' ||
                          a.section === 'Compliance Frameworks' ||
                          (a.section?.startsWith('Functional Areas - ') && a.section !== 'Functional Areas - ') ||
                          (a.category && ['security', 'compliance', 'technical', 'business'].includes(a.category.toLowerCase())) ||
                          (a.questionnaire_type && a.requirement_type === 'questionnaires')
                        const bIsMapped = 
                          b.section === 'Risks' ||
                          b.section === 'Compliance Frameworks' ||
                          (b.section?.startsWith('Functional Areas - ') && b.section !== 'Functional Areas - ') ||
                          (b.category && ['security', 'compliance', 'technical', 'business'].includes(b.category.toLowerCase())) ||
                          (b.questionnaire_type && b.requirement_type === 'questionnaires')
                        
                        // Sort unmapped items first if showUnmapped is true
                        if (showUnmapped) {
                          if (!aIsMapped && bIsMapped) return -1
                          if (aIsMapped && !bIsMapped) return 1
                        }
                        
                        // Finally by order
                        return a.order - b.order
                      })
                    }
                    
                    // Render groups or flat list
                    const rows: JSX.Element[] = []
                    
                    if (groupBy === 'none') {
                      // No grouping - render all rows directly
                      const sortedRequirements = sortGroup(filteredRequirements)
                      sortedRequirements.forEach((req) => {
                        const isMapped = 
                          req.section === 'Risks' ||
                          req.section === 'Compliance Frameworks' ||
                          (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ') ||
                          (req.category && ['security', 'compliance', 'technical', 'business'].includes(req.category.toLowerCase())) ||
                          (req.questionnaire_type && req.requirement_type === 'questionnaires')
                        const isUnmapped = !isMapped
                        const isSelected = selectedRequirements.has(req.id)
                        
                        rows.push(
                          <tr 
                            key={req.id} 
                            className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${
                              isUnmapped ? 'bg-orange-50/50 border-l-4 border-orange-400' : ''
                            } ${isSelected ? 'bg-indigo-100/50' : ''}`}
                            onClick={() => {
                              setSelectedRequirement(req)
                              setShowReadonlyModal(true)
                            }}
                          >
                            {/* Selection Checkbox */}
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleSelectRequirement(req.id, e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            {/* Render columns */}
                            {columnOrder.map((colKey) => {
                              if (!columnVisibility[colKey]) return null
                              return renderCell(req, colKey, isUnmapped)
                            })}
                            {/* Actions Column */}
                            <td className="px-4 py-2.5" style={{ width: '180px', minWidth: '180px' }} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <MaterialButton
                                  variant="text"
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditClick(req)
                                  }}
                                  startIcon={<Edit className="w-3 h-3" />}
                                  title="Edit requirement"
                                >
                                  Edit
                                </MaterialButton>
                                <MaterialButton
                                  variant="text"
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (window.confirm('Are you sure you want to delete this requirement?')) {
                                      deleteMutation.mutate(req.id)
                                    }
                                  }}
                                  startIcon={<Trash2 className="w-3 h-3" />}
                                  title="Delete requirement"
                                >
                                  Delete
                                </MaterialButton>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    } else {
                      // Grouped view
                      const groupKeys = Object.keys(grouped).sort()
                      
                      groupKeys.forEach((groupKey) => {
                        if (grouped[groupKey] && grouped[groupKey].length > 0) {
                          const sortedGroup = sortGroup(grouped[groupKey])
                          const groupId = `${groupBy}-${groupKey}`
                          const isExpanded = expandedGroups.has(groupId)
                          
                          // Get group display name and styling
                          let groupLabel = groupKey
                          let groupColorClass = 'bg-gray-100 text-gray-800 border-gray-400'
                          
                          if (groupBy === 'requirement_type') {
                            if (groupKey === 'compliance') {
                              groupLabel = 'Compliance Requirements'
                              groupColorClass = 'bg-indigo-100 text-indigo-800 border-indigo-400'
                            } else if (groupKey === 'risk') {
                              groupLabel = 'Risk Requirements'
                              groupColorClass = 'bg-orange-100 text-orange-800 border-orange-400'
                            } else if (groupKey === 'questionnaires') {
                              groupLabel = 'Questionnaire Requirements'
                              groupColorClass = 'bg-purple-100 text-purple-800 border-purple-400'
                            }
                          } else if (groupBy === 'category') {
                            groupLabel = groupKey.charAt(0).toUpperCase() + groupKey.slice(1) + ' Requirements'
                          } else if (groupBy === 'section') {
                            groupLabel = groupKey
                          } else if (groupBy === 'questionnaire_type') {
                            groupLabel = groupKey
                          }
                          
                          // Add group header with collapse/expand
                          rows.push(
                            <tr key={`group-${groupId}`} className="bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-400">
                              <td colSpan={columnOrder.filter(col => columnVisibility[col]).length + 2} className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <MaterialButton
                                    variant="text"
                                    size="small"
                                    color="gray"
                                    onClick={() => {
                                      setExpandedGroups(prev => {
                                        const next = new Set(prev)
                                        if (next.has(groupId)) {
                                          next.delete(groupId)
                                        } else {
                                          next.add(groupId)
                                        }
                                        return next
                                      })
                                    }}
                                    className="!p-1"
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </MaterialButton>
                                  <span className={`inline-flex items-center px-3 py-1.5 text-sm font-bold rounded-md border-2 ${groupColorClass}`}>
                                    {groupLabel}
                                  </span>
                                  <span className="text-xs text-gray-600 font-medium">
                                    ({sortedGroup.length} {sortedGroup.length === 1 ? 'requirement' : 'requirements'})
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                          
                          // Add rows for this group (only if expanded)
                          if (isExpanded) {
                            sortedGroup.forEach((req) => {
                              const isMapped = 
                                req.section === 'Risks' ||
                                req.section === 'Compliance Frameworks' ||
                                (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ') ||
                                (req.category && ['security', 'compliance', 'technical', 'business'].includes(req.category.toLowerCase())) ||
                                (req.questionnaire_type && req.requirement_type === 'questionnaires')
                              const isUnmapped = !isMapped
                              const isSelected = selectedRequirements.has(req.id)
                              
                              rows.push(
                                <tr 
                                  key={req.id} 
                                  className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${
                                    isUnmapped ? 'bg-orange-50/50 border-l-4 border-orange-400' : ''
                                  } ${isSelected ? 'bg-indigo-100/50' : ''}`}
                                  onClick={() => {
                                    setSelectedRequirement(req)
                                    setShowReadonlyModal(true)
                                  }}
                                >
                                  {/* Selection Checkbox */}
                                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => handleSelectRequirement(req.id, e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  {/* Render columns in the specified order */}
                                  {columnOrder.map((colKey) => {
                                    if (!columnVisibility[colKey]) return null
                                    return renderCell(req, colKey, isUnmapped)
                                  })}
                                  {/* Actions Column - Always Visible */}
                                  <td className="px-4 py-2.5" style={{ width: '180px', minWidth: '180px' }} onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEditClick(req)
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                        title="Edit requirement"
                                      >
                                        <Edit className="w-3 h-3" />
                                        Edit
                                      </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (window.confirm('Are you sure you want to delete this requirement?')) {
                                        deleteMutation.mutate(req.id)
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                                    title="Delete requirement"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          }
                        }
                      })
                    }
                    
                    return rows
                  })()}
                      </tbody>
                    </table>
                </DndContext>
                </div>
          </div>
        )}

        {/* Readonly Modal */}
        {showReadonlyModal && selectedRequirement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <MaterialCard elevation={4} className="bg-white max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 rounded-lg border-none">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-medium">Requirement Details</h2>
                <button
                  onClick={() => {
                    setShowReadonlyModal(false)
                    setSelectedRequirement(null)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catalog ID</label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                      {selectedRequirement.catalog_id || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Type</label>
                    <div className="text-sm">
                      <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-md border ${
                        selectedRequirement.requirement_type === 'compliance' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : selectedRequirement.requirement_type === 'risk'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {selectedRequirement.requirement_type === 'compliance' ? 'Compliance' : 
                         selectedRequirement.requirement_type === 'risk' ? 'Risk' : 'Questionnaires'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                    {selectedRequirement.label}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                    <div className="text-sm">
                      <span className="inline-flex items-center px-2 py-1 text-sm bg-blue-50 text-blue-600 rounded-md border border-blue-400 font-medium">
                        {selectedRequirement.field_type}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="text-sm">
                      {selectedRequirement.is_enabled !== false ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                          <ToggleRight className="w-5 h-5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                          <ToggleLeft className="w-5 h-5" />
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {selectedRequirement.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border whitespace-pre-wrap">
                      {selectedRequirement.description}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {selectedRequirement.category && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <div className="text-sm">
                        <span className="inline-flex items-center px-2 py-1 text-sm bg-slate-50 text-slate-700 rounded border border-slate-200 capitalize font-medium">
                          {selectedRequirement.category}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedRequirement.questionnaire_type && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Questionnaire Type</label>
                      <div className="text-sm">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-medium">
                          <FileQuestion className="w-4 h-4" />
                          {selectedRequirement.questionnaire_type}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {selectedRequirement.section && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                      {selectedRequirement.section}
                    </div>
                  </div>
                )}
                
                {selectedRequirement.is_required && (
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 font-medium bg-red-50 rounded border border-red-200">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      Required Field
                    </span>
                  </div>
                )}
                
                {selectedRequirement.allowed_response_types && selectedRequirement.allowed_response_types.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Response Types</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedRequirement.allowed_response_types.map((type) => (
                        <span key={type} className="inline-flex items-center px-2 py-1 text-sm bg-green-50 text-green-700 rounded border border-green-200 font-medium capitalize">
                          {type === 'text' ? 'Text' : type === 'file' ? 'File' : 'URL'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedRequirement.options && selectedRequirement.options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                    <div className="space-y-1">
                      {selectedRequirement.options.map((opt: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                          {typeof opt === 'string' ? opt : `${opt.label || opt.value} (${opt.value})`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4 border-t">
                  <MaterialButton
                    onClick={() => {
                      setShowReadonlyModal(false)
                      handleEditClick(selectedRequirement)
                    }}
                    startIcon={<Edit className="w-4 h-4" />}
                  >
                    Edit
                  </MaterialButton>
                  <MaterialButton
                    onClick={() => {
                      setShowReadonlyModal(false)
                      setSelectedRequirement(null)
                    }}
                    variant="outlined"
                    color="gray"
                  >
                    Close
                  </MaterialButton>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <MaterialCard elevation={4} className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 rounded-lg border-none">
              <div className="mb-4">
                <h2 className="text-xl font-medium">{selectedRequirement ? 'Edit Requirement' : 'Create Requirement'}</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="label" className="block text-sm font-medium mb-1">Label *</label>
                    <input
                      id="label"
                      type="text"
                      className="w-full h-11 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      required
                    />
                  <p className="text-xs text-muted-foreground mt-1">Field name will be auto-generated from label</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="requirement_type" className="block text-sm font-medium mb-1">Requirement Type *</label>
                    <select
                      id="requirement_type"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.requirement_type}
                      onChange={(e) => setFormData({ ...formData, requirement_type: e.target.value as 'compliance' | 'risk' | 'questionnaires' })}
                      required
                    >
                      <option value="compliance">Compliance</option>
                      <option value="risk">Risk</option>
                      <option value="questionnaires">Questionnaires</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">MANDATORY: Classifies requirement as Compliance, Risk, or Questionnaires</p>
                  </div>
                  <div>
                    <label htmlFor="field_type" className="block text-sm font-medium mb-1">Field Type *</label>
                    <select
                      id="field_type"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.field_type}
                      onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                      required
                    >
                      {FIELD_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium mb-1">Category</label>
                    <select
                      id="category"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="section" className="block text-sm font-medium mb-1">Section</label>
                    <input
                      id="section"
                      type="text"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      placeholder="e.g., Data Privacy, Security Controls"
                    />
                  </div>
                  <div>
                    <label htmlFor="questionnaire_type" className="block text-sm font-medium mb-1">Questionnaire Type</label>
                    <select
                      id="questionnaire_type"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.questionnaire_type}
                      onChange={(e) => setFormData({ ...formData, questionnaire_type: e.target.value })}
                    >
                      <option value="">None</option>
                      <option value="TPRM- Questionnaire">TPRM- Questionnaire</option>
                      <option value="Vendor Security Questionnaire">Vendor Security Questionnaire</option>
                      <option value="Sub Contractor Questionnaire">Sub Contractor Questionnaire</option>
                      <option value="Vendor Qualification">Vendor Qualification</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    id="description"
                    className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700 min-h-[80px]"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Help text for users"
                  />
                </div>

                <div>
                  <label htmlFor="placeholder" className="block text-sm font-medium mb-1">Placeholder</label>
                  <input
                    id="placeholder"
                    type="text"
                    className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  />
                </div>

                {['select', 'multi_select', 'checkbox', 'radio'].includes(formData.field_type) && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Options</label>
                    <div className="space-y-2">
                      {options.map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700 flex-1"
                            placeholder="Value"
                            value={opt.value}
                            onChange={(e) => handleOptionChange(idx, 'value', e.target.value)}
                          />
                          <input
                            type="text"
                            className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700 flex-1"
                            placeholder="Label"
                            value={opt.label}
                            onChange={(e) => handleOptionChange(idx, 'label', e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="rounded-lg border border-gray-200 text-sm h-[42px] px-3 bg-white hover:bg-gray-50 transition-all font-medium text-gray-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={handleAddOption} className="text-sm font-bold text-blue-600 hover:text-blue-600 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors">
                        + Add Option
                      </button>
                    </div>
                  </div>
                )}

                {/* Questionnaire-Style: Multiple Response Types */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium mb-2">Response Types (Questionnaire Mode)</label>
                  <p className="text-xs text-gray-600 mb-3">
                    Allow vendors to respond with multiple types: text explanation, file attachments, or external links
                  </p>
                  <div className="space-y-2">
                    {['text', 'file', 'url'].map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedResponseTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedResponseTypes([...selectedResponseTypes, type])
                            } else {
                              setSelectedResponseTypes(selectedResponseTypes.filter(t => t !== type))
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm capitalize">
                          {type === 'text' ? 'Text Explanation' : type === 'file' ? 'File Attachments (PDF, Images, Documents)' : 'External Links (Google Drive, SharePoint, etc.)'}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedResponseTypes.length > 1 && (
                    <p className="text-xs text-blue-600 mt-2">
                      ✓ Questionnaire mode enabled: Vendors can provide text, upload files, or provide links
                    </p>
                  )}
                </div>

                {/* Filter Conditions: Show requirement based on agent metadata */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium mb-2">Filter Conditions</label>
                  <p className="text-xs text-gray-600 mb-3">
                    Show this requirement only for specific agent categories or types
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="filter_category" className="block text-xs font-medium mb-1">Agent Category</label>
                      <input
                        id="filter_category"
                        type="text"
                        className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700 text-sm"
                        value={filterAgentCategory}
                        onChange={(e) => setFilterAgentCategory(e.target.value)}
                        placeholder="e.g., Security & Compliance"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to show for all categories</p>
                    </div>
                    <div>
                      <label htmlFor="filter_type" className="block text-xs font-medium mb-1">Agent Type</label>
                      <select
                        id="filter_type"
                        className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700 text-sm"
                        value={filterAgentType}
                        onChange={(e) => setFilterAgentType(e.target.value)}
                      >
                        <option value="">All Types</option>
                        <option value="AI_AGENT">AI Agent</option>
                        <option value="BOT">Bot</option>
                        <option value="AUTOMATION">Automation</option>
                        <option value="API_SERVICE">API Service</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="order" className="block text-sm font-medium mb-1">Display Order</label>
                    <input
                      id="order"
                      type="number"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="is_required"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_required" className="text-sm font-medium">Required Field</label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="min_length" className="block text-sm font-medium mb-1">Min Length</label>
                    <input
                      id="min_length"
                      type="number"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.min_length || ''}
                      onChange={(e) => setFormData({ ...formData, min_length: e.target.value ? parseInt(e.target.value) : undefined })}
                    />
                  </div>
                  <div>
                    <label htmlFor="max_length" className="block text-sm font-medium mb-1">Max Length</label>
                    <input
                      id="max_length"
                      type="number"
                      className="shadow-sm rounded-md border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                      value={formData.max_length || ''}
                      onChange={(e) => setFormData({ ...formData, max_length: e.target.value ? parseInt(e.target.value) : undefined })}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <MaterialButton
                    variant="text"
                    onClick={() => {
                      setShowCreateModal(false)
                      setShowEditModal(false)
                      resetForm()
                    }}
                    className="text-gray-500"
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {selectedRequirement ? 'Update' : 'Create'}
                  </MaterialButton>
                </div>
              </form>
            </MaterialCard>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="mb-4">
                <h2 className="text-xl font-medium mb-2">Import Requirements</h2>
                <p className="text-sm text-gray-600">
                  Import requirements from an Excel, CSV, or JSON file. Download the template first to see the required format.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select File</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Download Excel template
                      const headers = ['label', 'field_name', 'field_type', 'requirement_type', 'description', 'category', 'section', 'is_required', 'order', 'placeholder', 'min_length', 'max_length', 'min_value', 'max_value', 'pattern', 'questionnaire_type', 'source_type', 'is_enabled']
                      const exampleRow = [
                        'Example Requirement',
                        'example_field',
                        'textarea',
                        'compliance',
                        'Example description',
                        'security',
                        'Access Control',
                        true,
                        0,
                        'Enter value...',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        'manual',
                        true
                      ]
                      
                      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
                      const wb = XLSX.utils.book_new()
                      XLSX.utils.book_append_sheet(wb, ws, 'Requirements')
                      
                      // Auto-size columns
                      const colWidths = headers.map((_, colIndex) => {
                        const maxLength = Math.max(
                          headers[colIndex].length,
                          String(exampleRow[colIndex] || '').length
                        )
                        return { wch: Math.min(maxLength + 2, 50) }
                      })
                      ws['!cols'] = colWidths
                      
                      XLSX.writeFile(wb, 'requirements_template.xlsx')
                    }}
                    className="flex items-center gap-2 flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!importFile) {
                        alert('Please select a file')
                        return
                      }
                      try {
                        const fileExtension = importFile.name.split('.').pop()?.toLowerCase()
                        let requirements: any[] = []
                        
                        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                          // Read Excel file
                          const arrayBuffer = await importFile.arrayBuffer()
                          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
                          const sheetName = workbook.SheetNames[0]
                          const worksheet = workbook.Sheets[sheetName]
                          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
                          
                          if (jsonData.length < 2) {
                            alert('Excel file must have at least a header row and one data row')
                            return
                          }
                          
                          const headers = jsonData[0] as string[]
                          requirements = (jsonData.slice(1) as any[]).map(row => {
                            const requirement: any = {}
                            headers.forEach((header, index) => {
                              const value = row[index]
                              if (value !== undefined && value !== null && value !== '') {
                                // Convert string booleans to actual booleans
                                if (header === 'is_required' || header === 'is_enabled') {
                                  requirement[header] = value === true || value === 'true' || value === 'TRUE' || value === '1' || value === 1
                                } else if (header === 'order' || header === 'min_length' || header === 'max_length' || header === 'min_value' || header === 'max_value') {
                                  requirement[header] = value === '' ? undefined : Number(value)
                                } else {
                                  requirement[header] = value
                                }
                              }
                            })
                            return requirement
                          }).filter(req => req.label && req.field_name) // Filter out empty rows
                        } else if (fileExtension === 'csv') {
                          // Read CSV file
                          const text = await importFile.text()
                          const lines = text.split('\n').filter(line => line.trim())
                          if (lines.length < 2) {
                            alert('CSV file must have at least a header row and one data row')
                            return
                          }
                          
                          const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
                          requirements = lines.slice(1).map(line => {
                            const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
                            const requirement: any = {}
                            headers.forEach((header, index) => {
                              const value = values[index]
                              if (value !== undefined && value !== null && value !== '') {
                                if (header === 'is_required' || header === 'is_enabled') {
                                  requirement[header] = value === 'true' || value === 'TRUE' || value === '1'
                                } else if (header === 'order' || header === 'min_length' || header === 'max_length' || header === 'min_value' || header === 'max_value') {
                                  requirement[header] = value === '' ? undefined : Number(value)
                                } else {
                                  requirement[header] = value
                                }
                              }
                            })
                            return requirement
                          }).filter(req => req.label && req.field_name)
                        } else if (fileExtension === 'json') {
                          // Read JSON file
                          const text = await importFile.text()
                          const parsed = JSON.parse(text)
                          requirements = Array.isArray(parsed) ? parsed : [parsed]
                        } else {
                          alert('Unsupported file format. Please use Excel (.xlsx), CSV (.csv), or JSON (.json)')
                          return
                        }
                        
                        if (requirements.length === 0) {
                          alert('No valid requirements found in the file')
                          return
                        }
                        
                        // Import requirements via API
                        importMutation.mutate(requirements)
                      } catch (error: any) {
                        alert(`Import failed: ${error.message}`)
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="mb-4">
                <h2 className="text-xl font-medium mb-2">Export Requirements</h2>
                <p className="text-sm text-gray-600">
                  Export requirements to Excel, CSV, or JSON format
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Export Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        if (!requirements || requirements.length === 0) {
                          alert('No requirements to export')
                          return
                        }
                        // Export as Excel
                        const headers = ['label', 'field_name', 'field_type', 'requirement_type', 'description', 'category', 'section', 'is_required', 'order', 'placeholder', 'min_length', 'max_length', 'min_value', 'max_value', 'pattern', 'questionnaire_type', 'source_type', 'is_enabled']
                        const data = requirements.map(req => [
                          req.label || '',
                          req.field_name || '',
                          req.field_type || '',
                          req.requirement_type || '',
                          req.description || '',
                          req.category || '',
                          req.section || '',
                          req.is_required || false,
                          req.order || 0,
                          req.placeholder || '',
                          req.min_length || '',
                          req.max_length || '',
                          req.min_value || '',
                          req.max_value || '',
                          req.pattern || '',
                          req.questionnaire_type || '',
                          req.source_type || 'manual',
                          req.is_enabled !== false
                        ])
                        
                        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
                        const wb = XLSX.utils.book_new()
                        XLSX.utils.book_append_sheet(wb, ws, 'Requirements')
                        
                        // Auto-size columns
                        const colWidths = headers.map((_, colIndex) => {
                          const maxLength = Math.max(
                            headers[colIndex].length,
                            ...data.map(row => String(row[colIndex] || '').length)
                          )
                          return { wch: Math.min(maxLength + 2, 50) }
                        })
                        ws['!cols'] = colWidths
                        
                        XLSX.writeFile(wb, `requirements_export_${new Date().toISOString().split('T')[0]}.xlsx`)
                        setShowExportModal(false)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={() => {
                        if (!requirements || requirements.length === 0) {
                          alert('No requirements to export')
                          return
                        }
                        // Export as CSV
                        const headers = ['label', 'field_name', 'field_type', 'requirement_type', 'description', 'category', 'section', 'is_required', 'order', 'placeholder', 'min_length', 'max_length', 'source_type']
                        const csvRows = [
                          headers.join(','),
                          ...requirements.map(req => [
                            `"${req.label}"`,
                            req.field_name,
                            req.field_type,
                            req.requirement_type || '',
                            `"${req.description || ''}"`,
                            req.category || '',
                            `"${req.section || ''}"`,
                            req.is_required,
                            req.order,
                            `"${req.placeholder || ''}"`,
                            req.min_length || '',
                            req.max_length || '',
                            req.source_type || 'manual'
                          ].join(','))
                        ]
                        const csv = csvRows.join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `requirements_export_${new Date().toISOString().split('T')[0]}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowExportModal(false)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => {
                        if (!requirements || requirements.length === 0) {
                          alert('No requirements to export')
                          return
                        }
                        // Export as JSON
                        const json = JSON.stringify(requirements, null, 2)
                        const blob = new Blob([json], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `requirements_export_${new Date().toISOString().split('T')[0]}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowExportModal(false)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowExportModal(false)}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
