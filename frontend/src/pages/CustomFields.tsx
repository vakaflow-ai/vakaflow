import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialInput, MaterialCard, MaterialChip } from '../components/material'
import { authApi } from '../lib/auth'
import { CustomField } from '../lib/formLayouts'
import { customFieldsApi, CustomFieldCatalog } from '../lib/customFields'
import { entityFieldsApi, EntityField } from '../lib/entityFields'
import { masterDataListsApi, MasterDataList } from '../lib/masterDataLists'
import { USER_ROLES } from '../lib/users'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import { Search, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight, Eye, Pencil, Shield, ToggleLeft, ToggleRight, RefreshCw, Database } from 'lucide-react'
import CustomFieldFormModal from './CustomFieldFormModal'
import EntityFieldEditModal from './EntityFieldEditModal'

export default function CustomFields() {
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingField, setEditingField] = useState<any | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())
  const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false)
  const [selectedFieldForPermissions, setSelectedFieldForPermissions] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [viewMode, setViewMode] = useState<'all' | 'custom' | 'entities'>('all')
  const [entityUserLevelFilter, setEntityUserLevelFilter] = useState<'all' | 'business' | 'advanced'>('all')
  const [selectedEntity, setSelectedEntity] = useState<string>('all')
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [fieldTypeFilter, setFieldTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'entity' | 'created'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [entityFieldPermissions, setEntityFieldPermissions] = useState<Record<string, { view: boolean; edit: boolean }> | null>(null)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [selectedEntityForPermissions, setSelectedEntityForPermissions] = useState<string | null>(null)
  const [entityLevelPermissions, setEntityLevelPermissions] = useState<Record<string, { view: boolean; edit: boolean }> | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])

  // Fetch custom fields from API (only user-created reusable fields)
  const { data: fieldsData, isLoading: customFieldsLoading, error: customFieldsError, refetch: refetchCustomFields } = useQuery({
    queryKey: ['custom-fields', user?.tenant_id, page, limit],
    queryFn: () => customFieldsApi.list(page, limit, undefined, undefined),
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  // Fetch entity fields from EntityFieldRegistry
  const { data: entityFieldsData, isLoading: entityFieldsLoading, error: entityFieldsError, refetch: refetchEntityFields } = useQuery({
    queryKey: ['entity-fields', user?.tenant_id, entityUserLevelFilter],
    queryFn: () => entityFieldsApi.list({ 
      is_system: false,
      is_enabled: true, // Only fetch enabled fields
      entity_user_level: entityUserLevelFilter === 'all' ? undefined : entityUserLevelFilter
    }), // Exclude system fields like id, created_at
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  // Debug logging
  useEffect(() => {
    if (fieldsData) {
      console.log('Custom Fields API Response:', fieldsData)
      console.log('Custom Fields count:', fieldsData.fields?.length || 0)
    }
    if (entityFieldsData) {
      console.log('Entity Fields API Response:', entityFieldsData)
      console.log('Entity Fields count:', entityFieldsData?.length || 0)
    }
    if (customFieldsError) {
      console.error('Custom Fields API Error:', customFieldsError)
    }
    if (entityFieldsError) {
      console.error('Entity Fields API Error:', entityFieldsError)
    }
  }, [fieldsData, entityFieldsData, customFieldsError, entityFieldsError])

  const customFields = fieldsData?.fields || []
  const entityFields = entityFieldsData || []
  const isLoading = customFieldsLoading || entityFieldsLoading
  const error = customFieldsError || entityFieldsError

  // Combine and transform fields for display
  const allFields: Array<{
    id: string
    field_name: string
    label: string
    description?: string
    field_type: string
    is_required: boolean
    is_enabled: boolean
    is_standard?: boolean
    source: 'custom' | 'entity'
    entity_name?: string
    entity_label?: string
    role_permissions?: Record<string, { view: boolean; edit: boolean }>
    [key: string]: any
  }> = [
    // Custom fields (user-created)
    ...customFields.map(f => ({
      ...f,
      source: 'custom' as const,
      description: f.description ?? undefined,
      is_required: f.is_required ?? false // Ensure is_required is always boolean
    })),
    // Entity fields (auto-discovered)
    ...entityFields.map(f => ({
      ...f,
      source: 'entity' as const,
      label: f.field_label,
      description: f.field_description ?? undefined,
      field_type: f.field_type_display,
      is_required: f.is_required, // Explicitly set is_required to ensure boolean type
      is_standard: !f.is_custom,
      entity_user_level: f.entity_user_level || 'business',
      role_permissions: {},
      field_config: f.field_config || null
    }))
  ]
  
  // Sort entities: business entities first, then advanced, then by display_order
  allFields.sort((a, b) => {
    // First sort by entity user level (if entity field)
    if (a.source === 'entity' && b.source === 'entity') {
      const levelOrder = { 'business': 0, 'advanced': 1 }
      const aLevel = (a.entity_user_level || 'business') as keyof typeof levelOrder
      const bLevel = (b.entity_user_level || 'business') as keyof typeof levelOrder
      if (levelOrder[aLevel] !== levelOrder[bLevel]) {
        return levelOrder[aLevel] - levelOrder[bLevel]
      }
    }
    return (a.display_order || 0) - (b.display_order || 0)
  })

  // Filter by view mode
  const filteredByMode = allFields.filter(field => {
    if (viewMode === 'custom') return field.source === 'custom'
    if (viewMode === 'entities') return field.source === 'entity'
    return true // 'all'
  })

  // Group fields by entity
  const fieldsByEntity: Record<string, { entity_name: string; entity_label: string; fields: typeof allFields }> = filteredByMode.reduce((acc, field) => {
    const entityKey = field.entity_name || 'custom_fields'
    const entityLabel = field.entity_label || 'Custom Fields'
    
    if (!acc[entityKey]) {
      acc[entityKey] = {
        entity_name: entityKey,
        entity_label: entityLabel,
        fields: []
      }
    }
    acc[entityKey].fields.push(field)
    return acc
  }, {} as Record<string, { entity_name: string; entity_label: string; fields: typeof allFields }>)

  // Get unique entities for filter dropdown with Entity|Metadata distinction
  const entities = Object.values(fieldsByEntity)
    .map(e => {
      // Check if entity has metadata fields (fields with entity_name ending in _metadata or containing 'metadata')
      const hasMetadata = e.fields.some(f => 
        f.entity_name?.toLowerCase().includes('metadata') || 
        f.field_name?.toLowerCase().includes('metadata')
      )
      const isMetadata = e.entity_name?.toLowerCase().includes('metadata')
      
      return { 
        name: e.entity_name, 
        label: e.entity_label,
        isMetadata: isMetadata || hasMetadata,
        category: isMetadata ? 'Metadata' : 'Entity'
      }
    })
    .sort((a, b) => {
      // Sort: Entities first, then Metadata, then alphabetically
      if (a.category !== b.category) {
        return a.category === 'Entity' ? -1 : 1
      }
      return a.label.localeCompare(b.label)
    })

  // Filter by selected entity
  const filteredEntities: Array<{ entity_name: string; entity_label: string; fields: typeof allFields }> = selectedEntity === 'all' 
    ? Object.values(fieldsByEntity)
    : fieldsByEntity[selectedEntity] ? [fieldsByEntity[selectedEntity]] : []

  // Fetch master data lists for dropdown options
  const { data: masterDataLists } = useQuery({
    queryKey: ['master-data-lists'],
    queryFn: () => masterDataListsApi.list(undefined, true),
    enabled: !!user,
  })

  // Filter entities by entity_user_level (entity-level categorization)
  // Note: The API already filters by entity_user_level, but we also filter here for client-side consistency
  const filteredEntitiesByLevel = (filteredEntities || []).filter(entity => {
    if (entityUserLevelFilter === 'all') return true
    // Get entity_user_level from first field (all fields in entity have same entity_user_level)
    const entityLevel = entity.fields[0]?.entity_user_level || 'business'
    return entityLevel === entityUserLevelFilter
  })
  
  // Get unique field types for filter
  const uniqueFieldTypes = Array.from(new Set(allFields.map(f => f.field_type).filter(Boolean))).sort()
  
  // Helper function to convert wildcard pattern to regex
  const wildcardToRegex = (pattern: string): RegExp => {
    // Escape special regex characters except * and ?
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(escaped, 'i')
  }
  
  // Helper function to calculate field relevance score
  const calculateFieldRelevance = (field: any, searchPattern: RegExp, searchLower: string): number => {
    let score = 0
    const fieldName = (field.field_name || '').toLowerCase()
    const fieldLabel = (field.label || '').toLowerCase()
    const fieldDesc = (field.description || '').toLowerCase()
    
    // Exact match in field name gets highest score
    if (fieldName === searchLower) score += 100
    // Starts with search term in field name
    else if (fieldName.startsWith(searchLower)) score += 50
    // Contains search term in field name
    else if (fieldName.includes(searchLower)) score += 30
    // Pattern match in field name
    else if (searchPattern.test(field.field_name)) score += 25
    
    // Exact match in label
    if (fieldLabel === searchLower) score += 80
    // Starts with search term in label
    else if (fieldLabel.startsWith(searchLower)) score += 40
    // Contains search term in label
    else if (fieldLabel.includes(searchLower)) score += 20
    // Pattern match in label
    else if (searchPattern.test(field.label)) score += 15
    
    // Pattern match in description
    if (field.description && searchPattern.test(field.description)) score += 10
    
    return score
  }
  
  // Helper function to check if entity matches search
  const entityMatchesSearch = (entity: any, searchPattern: RegExp, searchLower: string): boolean => {
    return searchPattern.test(entity.entity_name) || 
           searchPattern.test(entity.entity_label) ||
           entity.entity_name?.toLowerCase().includes(searchLower) ||
           entity.entity_label?.toLowerCase().includes(searchLower)
  }
  
  // Apply search filter with wildcard support and relevance ranking
  let filteredEntitiesWithSearch = filteredEntitiesByLevel.map(entity => {
    let filteredFields = entity.fields
    
    // Apply search filter with wildcard support
    if (searchTerm) {
      const searchPattern = wildcardToRegex(searchTerm)
      const searchLower = searchTerm.toLowerCase().trim()
      const entityMatches = entityMatchesSearch(entity, searchPattern, searchLower)
      
      if (entityMatches) {
        // Entity name matches - show all fields from this entity, but rank them
        filteredFields = entity.fields.map(field => ({
          ...field,
          _relevanceScore: calculateFieldRelevance(field, searchPattern, searchLower) + 1000 // Boost for entity match
        }))
      } else {
        // Entity name doesn't match - only show fields that match the search
        filteredFields = entity.fields
          .filter(field => 
            searchPattern.test(field.field_name) ||
            searchPattern.test(field.label) ||
            (field.description && searchPattern.test(field.description)) ||
            searchPattern.test(field.field_type || '')
          )
          .map(field => ({
            ...field,
            _relevanceScore: calculateFieldRelevance(field, searchPattern, searchLower)
          }))
      }
    } else {
      // No search term - add default relevance score
      filteredFields = entity.fields.map(field => ({
        ...field,
        _relevanceScore: 0
      }))
    }
    
    // Apply field type filter
    if (fieldTypeFilter !== 'all') {
      filteredFields = filteredFields.filter(field => field.field_type === fieldTypeFilter)
    }
    
    // Sort fields by relevance first, then by selected sort criteria
    filteredFields.sort((a, b) => {
      // First sort by relevance (if search term exists)
      if (searchTerm && a._relevanceScore !== b._relevanceScore) {
        return b._relevanceScore - a._relevanceScore // Higher relevance first
      }
      
      // Then sort by selected criteria
      let comparison = 0
      const aName = (a.label || a.field_name || '').toLowerCase().trim()
      const bName = (b.label || b.field_name || '').toLowerCase().trim()
      
      switch (sortBy) {
        case 'name':
          comparison = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' })
          break
        case 'type':
          const aType = (a.field_type || '').toLowerCase().trim()
          const bType = (b.field_type || '').toLowerCase().trim()
          comparison = aType.localeCompare(bType, undefined, { numeric: true, sensitivity: 'base' })
          // Secondary sort by name
          if (comparison === 0) {
            comparison = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' })
          }
          break
        case 'created':
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
          comparison = aDate - bDate
          // Secondary sort by name
          if (comparison === 0) {
            comparison = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' })
          }
          break
        default:
          // Default: sort by name
          comparison = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' })
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    // Remove relevance score from fields before returning
    const cleanedFields = filteredFields.map(({ _relevanceScore, ...field }) => field)
    
    return {
      ...entity,
      fields: cleanedFields,
      _entityRelevanceScore: searchTerm ? (entityMatchesSearch(entity, wildcardToRegex(searchTerm), searchTerm.toLowerCase().trim()) ? 1000 : 0) : 0
    }
  }).filter(entity => entity.fields.length > 0) // Remove empty entities
  
  // Sort entities by relevance first (matching entities on top), then alphabetically
  filteredEntitiesWithSearch.sort((a, b) => {
    // If search term exists, prioritize entities that match
    if (searchTerm) {
      const aRelevance = a._entityRelevanceScore || 0
      const bRelevance = b._entityRelevanceScore || 0
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance // Higher relevance first
      }
    }
    
    // Then sort alphabetically by entity name
    const aEntityName = (a.entity_label || a.entity_name || '').toLowerCase().trim()
    const bEntityName = (b.entity_label || b.entity_name || '').toLowerCase().trim()
    return aEntityName.localeCompare(bEntityName, undefined, { numeric: true, sensitivity: 'base' })
  })
  
  // Clean up relevance scores from entities
  const cleanedEntities = filteredEntitiesWithSearch.map(({ _entityRelevanceScore, ...entity }) => entity);
  // Reassign to maintain the variable name for downstream usage
  filteredEntitiesWithSearch = cleanedEntities;

  const total = filteredEntitiesWithSearch.reduce((sum, entity) => sum + entity.fields.length, 0)

  // Reset to page 1 when filters change
  useEffect(() => {
    if (searchTerm || viewMode || selectedEntity || entityUserLevelFilter || fieldTypeFilter || sortBy || sortOrder) {
      setPage(1)
    }
  }, [searchTerm, viewMode, selectedEntity, entityUserLevelFilter, fieldTypeFilter, sortBy, sortOrder])

  // Toggle entity expansion
  const toggleEntity = (entityName: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev)
      if (next.has(entityName)) {
        next.delete(entityName)
      } else {
        next.add(entityName)
      }
      return next
    })
  }

  // Sync entity fields mutation
  const syncEntityFieldsMutation = useMutation({
    mutationFn: () => entityFieldsApi.sync(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity-fields'] })
      const fieldsTotal = (data.fields_created || 0) + (data.fields_updated || 0)
      const entitiesCount = data.entities_processed || 0
      showToast.success(
        `Synced ${fieldsTotal} fields (${data.fields_created || 0} created, ${data.fields_updated || 0} updated) from ${entitiesCount} entities`
      )
      setSyncing(false)
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to sync entity fields')
      setSyncing(false)
    },
  })

  const handleSyncEntityFields = () => {
    setSyncing(true)
    syncEntityFieldsMutation.mutate()
  }

  // Toggle field expansion
  const toggleField = (fieldName: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldName)) {
        next.delete(fieldName)
      } else {
        next.add(fieldName)
      }
      return next
    })
  }

  // Auto-expand entities when filtered to a single entity
  useEffect(() => {
    if (selectedEntity !== 'all' && filteredEntitiesWithSearch.length === 1) {
      const entityName = filteredEntitiesWithSearch[0].entity_name
      if (!expandedEntities.has(entityName)) {
        setExpandedEntities(prev => new Set([...prev, entityName]))
      }
    }
  }, [selectedEntity, filteredEntitiesWithSearch.length])

  // Load permissions when modal opens (for both entity-level and field-level)
  useEffect(() => {
    if (!showPermissionsMatrix) {
      setEntityFieldPermissions(null)
      setEntityLevelPermissions(null)
      setLoadingPermissions(false)
      return
    }

    const loadPermissions = async () => {
      setLoadingPermissions(true)
      try {
        // Handle entity-level permissions
        if (selectedEntityForPermissions) {
          try {
            const permissions = await entityFieldsApi.getEntityPermission(selectedEntityForPermissions)
            const defaults = getDefaultPermissions()
            const actual = permissions.role_permissions || {}
            const merged = { ...defaults, ...actual }
            setEntityLevelPermissions(merged)
          } catch (error: any) {
            console.error('Error loading entity-level permissions:', error)
            setEntityLevelPermissions(getDefaultPermissions())
          }
          setLoadingPermissions(false)
          return
        }

        // Handle field-level permissions
        if (!selectedFieldForPermissions) {
          setLoadingPermissions(false)
          return
        }

        const field = allFields.find((f) => f.id === selectedFieldForPermissions || f.field_name === selectedFieldForPermissions)
        
        if (!field) {
          setLoadingPermissions(false)
          return
        }

        if (field.source === 'entity') {
          try {
            const permissions = await entityFieldsApi.getFieldPermissions(field.entity_name!, field.field_name)
            const defaults = getDefaultPermissions()
            const actual = permissions.role_permissions || {}
            const merged = { ...defaults, ...actual }
            setEntityFieldPermissions(merged)
          } catch (error: any) {
            console.error('Error loading entity field permissions:', error)
            setEntityFieldPermissions(getDefaultPermissions())
          }
        } else if (field.source === 'custom') {
          const defaults = getDefaultPermissions()
          const actual = field.role_permissions || {}
          setEntityFieldPermissions({ ...defaults, ...actual })
        }
      } catch (error) {
        console.error('Error loading permissions:', error)
        setEntityFieldPermissions(null)
        setEntityLevelPermissions(null)
      } finally {
        setLoadingPermissions(false)
      }
    }

    loadPermissions()
    // Only depend on showPermissionsMatrix, selectedFieldForPermissions, and selectedEntityForPermissions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPermissionsMatrix, selectedFieldForPermissions, selectedEntityForPermissions])

  // Create field mutation
  const createFieldMutation = useMutation({
    mutationFn: customFieldsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      setShowAddModal(false)
      showToast.success('Field created successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to create field')
    },
  })

  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: any }) => customFieldsApi.update(fieldId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      setEditingField(null)
      showToast.success('Field updated successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update field')
    },
  })

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: customFieldsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      showToast.success('Field deleted successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to delete field')
    },
  })

  // Toggle enable/disable mutation
  const toggleEnableMutation = useMutation({
    mutationFn: ({ fieldId, isEnabled }: { fieldId: string; isEnabled: boolean }) =>
      customFieldsApi.update(fieldId, { is_enabled: isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      showToast.success('Field status updated')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update field status')
    },
  })

  // Update entity field mutation
  const updateEntityFieldMutation = useMutation({
    mutationFn: ({ entityName, fieldName, data }: { entityName: string; fieldName: string; data: any }) =>
      entityFieldsApi.updateField(entityName, fieldName, data),
    onSuccess: (updatedField, variables) => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['entity-fields'] })
      queryClient.invalidateQueries({ queryKey: ['entity-field', variables.entityName, variables.fieldName] })
      queryClient.invalidateQueries({ queryKey: ['entity-fields-for-dependency', variables.entityName] })
      setEditingField(null)
      showToast.success('Entity field updated successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update entity field')
    },
  })

  // Handle field update (works for both custom and entity fields)
  const handleUpdateField = (field: any, updates: any) => {
    if (field.source === 'custom') {
      // Custom fields - use custom fields API
      if (!field.id) {
        showToast.error('Invalid field: missing ID')
        return
      }
      
      // If updates is the full object from modal, extract what's needed
      const updateData = {
        label: updates.label,
        description: updates.description,
        placeholder: updates.placeholder,
        is_required: updates.is_required,
        is_enabled: updates.is_enabled,
        accepted_file_types: updates.accepted_file_types,
        link_text: updates.link_text,
        master_data_list_id: updates.master_data_list_id,
        options: updates.options,
        role_permissions: updates.role_permissions,
      }
      
      updateFieldMutation.mutate({
        fieldId: field.id,
        data: updateData,
      })
    } else {
      // Entity fields - use entity fields API
      if (!field.entity_name || !field.field_name) {
        showToast.error('Invalid entity field: missing entity or field name')
        return
      }

      // Map updates to entity field API format
      const entityUpdates: any = {}
      if (updates.label !== undefined) entityUpdates.field_label = updates.label
      if (updates.field_label !== undefined) entityUpdates.field_label = updates.field_label
      if (updates.description !== undefined) entityUpdates.field_description = updates.description
      if (updates.field_description !== undefined) entityUpdates.field_description = updates.field_description
      if (updates.is_enabled !== undefined) entityUpdates.is_enabled = updates.is_enabled
      if (updates.is_required !== undefined) entityUpdates.is_required = updates.is_required
      if (updates.field_config !== undefined) entityUpdates.field_config = updates.field_config
      if (updates.field_type_display !== undefined) entityUpdates.field_type_display = updates.field_type_display
      
      updateEntityFieldMutation.mutate({
        entityName: field.entity_name,
        fieldName: field.field_name,
        data: entityUpdates,
      })
    }
  }

  // Handle field deletion
  const handleDeleteField = (field: any) => {
    if (field.is_standard) {
      showToast.error('Cannot delete standard fields')
      return
    }
    if (confirm(`Delete field "${field.label}"?`)) {
      deleteFieldMutation.mutate(field.id)
    }
  }

  // Handle add new field
  const handleAddField = (field: CustomField) => {
    // Initialize default role permissions
    const role_permissions: Record<string, { view: boolean; edit: boolean }> = {}
    USER_ROLES.forEach((role) => {
      if (role.value === 'tenant_admin' || role.value === 'platform_admin') {
        role_permissions[role.value] = { view: true, edit: true }
      } else {
        role_permissions[role.value] = { view: true, edit: false }
      }
    })

    createFieldMutation.mutate({
      ...field,
      role_permissions,
    })
  }

  // Handle permission update
  const handleUpdatePermission = async (
    field: any,
    role: string,
    permission: 'view' | 'edit',
    value: boolean
  ) => {
    if (field.source === 'custom') {
      // Custom fields - use custom fields API
      if (!field.id) {
        showToast.error('Invalid field: missing ID')
        return
      }
      
      const updatedPermissions = { ...(field.role_permissions || {}) }
      if (!updatedPermissions[role]) {
        updatedPermissions[role] = { view: false, edit: false }
      }
      updatedPermissions[role] = {
        ...updatedPermissions[role],
        [permission]: value,
        // If view is disabled, edit must also be disabled
        edit: permission === 'view' && !value ? false : updatedPermissions[role].edit,
      }

      updateFieldMutation.mutate({
        fieldId: field.id,
        data: { role_permissions: updatedPermissions },
      })
    } else {
      // Entity fields - use entity fields API
      if (!field.entity_name || !field.field_name) {
        showToast.error('Invalid entity field: missing entity or field name')
        return
      }

      try {
        // Get current permissions or create new
        const currentPermissions = await entityFieldsApi.getFieldPermissions(
          field.entity_name,
          field.field_name
        )
        
        const updatedPermissions = { ...(currentPermissions.role_permissions || {}) }
        if (!updatedPermissions[role]) {
          updatedPermissions[role] = { view: false, edit: false }
        }
        updatedPermissions[role] = {
          ...updatedPermissions[role],
          [permission]: value,
          edit: permission === 'view' && !value ? false : updatedPermissions[role].edit,
        }

        await entityFieldsApi.updateFieldPermissions(
          field.entity_name,
          field.field_name,
          updatedPermissions
        )
        
        // Update local state immediately instead of invalidating queries (which causes refresh loop)
        setEntityFieldPermissions(updatedPermissions)
        showToast.success('Entity field permissions updated')
      } catch (error: any) {
        showToast.error(error?.response?.data?.detail || 'Failed to update entity field permissions')
      }
    }
  }

  // Handle bulk permission update
  const handleBulkPermissionUpdate = async (
    field: any,
    role: string,
    view: boolean,
    edit: boolean
  ) => {
    if (field.source === 'custom') {
      // Custom fields - use custom fields API
      if (!field.id) {
        showToast.error('Invalid field: missing ID')
        return
      }
      
      const updatedPermissions = { ...(field.role_permissions || {}) }
      updatedPermissions[role] = { view, edit: view ? edit : false }

      updateFieldMutation.mutate({
        fieldId: field.id,
        data: { role_permissions: updatedPermissions },
      })
    } else {
      // Entity fields - use entity fields API
      if (!field.entity_name || !field.field_name) {
        showToast.error('Invalid entity field: missing entity or field name')
        return
      }

      try {
        const currentPermissions = await entityFieldsApi.getFieldPermissions(
          field.entity_name,
          field.field_name
        )
        
        const updatedPermissions = { ...(currentPermissions.role_permissions || {}) }
        updatedPermissions[role] = { view, edit: view ? edit : false }

        await entityFieldsApi.updateFieldPermissions(
          field.entity_name,
          field.field_name,
          updatedPermissions
        )
        
        // Update local state immediately instead of invalidating queries (which causes refresh loop)
        setEntityFieldPermissions(updatedPermissions)
        showToast.success('Entity field permissions updated')
      } catch (error: any) {
        showToast.error(error?.response?.data?.detail || 'Failed to update entity field permissions')
      }
    }
  }

  // Handle entity-level permission update
  const handleUpdateEntityPermission = async (
    entityName: string,
    role: string,
    permission: 'view' | 'edit',
    value: boolean
  ) => {
    try {
      const currentPermissions = await entityFieldsApi.getEntityPermission(entityName)
      const updatedPermissions = { ...(currentPermissions.role_permissions || {}) }
      
      if (!updatedPermissions[role]) {
        updatedPermissions[role] = { view: false, edit: false }
      }
      
      updatedPermissions[role] = {
        ...updatedPermissions[role],
        [permission]: value,
        edit: permission === 'view' && !value ? false : updatedPermissions[role].edit,
      }

      await entityFieldsApi.updateEntityPermission(entityName, updatedPermissions)
      setEntityLevelPermissions(updatedPermissions)
      showToast.success(`Entity permissions for ${entityName} updated`)
    } catch (error: any) {
      showToast.error(error?.response?.data?.detail || 'Failed to update entity permissions')
    }
  }

  // Handle bulk entity-level permission update
  const handleBulkEntityPermissionUpdate = async (
    entityName: string,
    role: string,
    view: boolean,
    edit: boolean
  ) => {
    try {
      const currentPermissions = await entityFieldsApi.getEntityPermission(entityName)
      const updatedPermissions = { ...(currentPermissions.role_permissions || {}) }
      
      updatedPermissions[role] = { view, edit: view ? edit : false }

      await entityFieldsApi.updateEntityPermission(entityName, updatedPermissions)
      setEntityLevelPermissions(updatedPermissions)
      showToast.success(`Entity permissions for ${entityName} updated`)
    } catch (error: any) {
      showToast.error(error?.response?.data?.detail || 'Failed to update entity permissions')
    }
  }

  // Helper function to get default permissions for all roles
  const getDefaultPermissions = (): Record<string, { view: boolean; edit: boolean }> => {
    const defaults: Record<string, { view: boolean; edit: boolean }> = {}
    USER_ROLES.forEach((role) => {
      // Admins get view + edit by default, others get view only
      if (role.value === 'tenant_admin' || role.value === 'platform_admin' || 
          role.value === 'policy_admin' || role.value === 'integration_admin' || 
          role.value === 'user_admin') {
        defaults[role.value] = { view: true, edit: true }
      } else {
        defaults[role.value] = { view: true, edit: false }
      }
    })
    return defaults
  }


  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Admin access required.</div>
        </div>
      </Layout>
    )
  }

  const selectedField = selectedFieldForPermissions
    ? allFields.find((f) => f.id === selectedFieldForPermissions || f.field_name === selectedFieldForPermissions)
    : null

  // Find selected entity info
  const selectedEntityInfo = selectedEntityForPermissions
    ? filteredEntitiesWithSearch.find((e) => e.entity_name === selectedEntityForPermissions)
    : null

  return (
    <Layout user={user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium mb-2">Field Definitions</h1>
            <p className="text-sm text-gray-600">
              Create and manage all custom fields and view system-discovered fields for use in Form Designer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MaterialButton
              variant="outlined"
              color="secondary"
              onClick={handleSyncEntityFields}
              disabled={syncing}
              loading={syncing}
              startIcon={<RefreshCw className="w-4 h-4" />}
              title="Discover and sync all system fields from all entities (agents, vendors, metadata, etc.) including JSON fields, diagrams, and other field types"
            >
              Sync System Fields
            </MaterialButton>
            <MaterialButton
              onClick={() => setShowAddModal(true)}
              startIcon={<Plus className="w-4 h-4" />}
            >
              New Custom Field
            </MaterialButton>
          </div>
        </div>

        {/* Search, Filters, and Sorting - All in One Row */}
        <MaterialCard elevation={1} className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <MaterialInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search (* and ? wildcards)..."
                startAdornment={<Search className="w-4 h-4" />}
              />
            </div>
            
            {/* Entity|Metadata Filter */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Entity|Metadata</span>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="enterprise-input w-[180px]"
              >
                <option value="all">All Entities</option>
                <optgroup label="Entities">
                  {entities.filter(e => !e.isMetadata).map(entity => (
                    <option key={entity.name} value={entity.name}>
                      {entity.label} ({fieldsByEntity[entity.name]?.fields.length || 0})
                    </option>
                  ))}
                </optgroup>
                {entities.some(e => e.isMetadata) && (
                  <optgroup label="Metadata">
                    {entities.filter(e => e.isMetadata).map(entity => (
                      <option key={entity.name} value={entity.name}>
                        {entity.label} ({fieldsByEntity[entity.name]?.fields.length || 0})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            
            {/* Source Filter */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Source</span>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'all' | 'custom' | 'entities')}
                className="enterprise-input w-[120px]"
              >
                <option value="custom">Custom Only</option>
                <option value="entities">System Only</option>
                <option value="all">All Fields</option>
              </select>
            </div>
            
            {/* Category Filter */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Category</span>
              <select
                value={entityUserLevelFilter}
                onChange={(e) => setEntityUserLevelFilter(e.target.value as 'all' | 'business' | 'advanced')}
                className="enterprise-input w-[100px]"
              >
                <option value="all">All</option>
                <option value="business">Business</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            {/* Field Type Filter */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Field Type</span>
              <select
                value={fieldTypeFilter}
                onChange={(e) => setFieldTypeFilter(e.target.value)}
                className="enterprise-input w-[130px]"
              >
                <option value="all">All Types</option>
                {uniqueFieldTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* Sort By */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'type' | 'entity' | 'created')}
                className="enterprise-input w-[110px]"
              >
                <option value="name">Name</option>
                <option value="type">Type</option>
                <option value="entity">Entity</option>
                <option value="created">Created</option>
              </select>
            </div>
            
            {/* Sort Order */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Order</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="enterprise-input w-[100px]"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
            
            {/* Result Count */}
            <div className="flex items-center border-l border-gray-200 pl-3">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {total} field{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {searchTerm && (
            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              Wildcard help: Use <code className="bg-gray-100 px-1 rounded">*</code> for multiple characters, <code className="bg-gray-100 px-1 rounded">?</code> for single character (e.g., "llm*", "reg?on")
            </div>
          )}
        </MaterialCard>

        {/* Fields Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading field definitions...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800">Error loading field definitions: {error instanceof Error ? error.message : 'Unknown error'}</div>
          </div>
        ) : filteredEntitiesWithSearch.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-gray-500 mb-4">
              {searchTerm ? 'No field definitions match your search' : 'No field definitions found'}
            </div>
            {!searchTerm && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  {entityUserLevelFilter === 'business' 
                    ? 'No business-level fields found. Try selecting "All" or "Advanced" to see metadata fields (use_cases, architecture_info, etc.) from all entities.'
                    : 'Fields may need to be synced from the database. Click "Sync System Fields" to discover all entity fields from agents, vendors, and other entities.'}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleSyncEntityFields}
                    disabled={syncing}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
                  >
                    {syncing ? 'Syncing...' : 'Sync System Fields'}
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Create Your First Custom Field
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntitiesWithSearch.map((entity) => {
              // For custom fields in custom mode, we don't need the header if it's the only one
              const isCustomGroup = entity.entity_name === 'custom_fields'
              const showHeader = !isCustomGroup || viewMode !== 'custom' || filteredEntitiesWithSearch.length > 1
              const isEntityExpanded = expandedEntities.has(entity.entity_name) || (isCustomGroup && viewMode === 'custom')
              const entityFieldCount = entity.fields.length
              
              return (
                <div key={entity.entity_name} className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${isCustomGroup && viewMode === 'custom' ? 'border-blue-400 ring-1 ring-blue-50' : ''}`}>
                  {/* Entity Header */}
                  {showHeader && (
                    <div 
                      className={`${isCustomGroup ? 'bg-blue-50' : 'bg-gray-50'} px-4 py-3 border-b border-gray-200 hover:bg-opacity-80`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => toggleEntity(entity.entity_name)}
                        >
                          <button className="text-gray-600 hover:text-gray-600">
                            {isEntityExpanded ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            {isCustomGroup ? (
                              <Plus className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Database className="w-5 h-5 text-gray-600" />
                            )}
                            <h3 className="text-lg font-medium text-gray-900">
                              {isCustomGroup ? 'Custom Field Definitions' : entity.entity_label}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${isCustomGroup ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                              {entityFieldCount} {entityFieldCount === 1 ? 'field' : 'fields'}
                            </span>
                          </div>
                        </div>
                        <div 
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isCustomGroup && (
                            <button
                              onClick={() => {
                                setSelectedEntityForPermissions(entity.entity_name)
                                setSelectedFieldForPermissions(null)
                                setShowPermissionsMatrix(true)
                              }}
                              className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Configure entity-level permissions"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fields Table */}
                  {isEntityExpanded && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-1/4">
                              Field Name & Label
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-1/6">
                              Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-1/4">
                              Description
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-1/6">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-1/6">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {entity.fields.map((field, idx) => {
                            const isExpanded = expandedFields.has(field.id || field.field_name)

                            return (
                              <React.Fragment key={`${field.id || field.field_name}-${idx}`}>
                                <tr className={`hover:bg-gray-50 ${field.source === 'custom' ? 'bg-blue-50 bg-opacity-10' : ''}`}>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleField(field.id || field.field_name)}
                                        className="text-gray-600 hover:text-gray-600"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-4 h-4" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4" />
                                        )}
                                      </button>
                                      <div className="flex flex-col">
                                        <div
                                          className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 flex items-center gap-1"
                                          onClick={() => setEditingField(field)}
                                        >
                                          {field.label}
                                          {field.field_config && (field.field_config.options || field.field_config.depends_on) && (
                                            <span className="text-purple-500" title="Special field with configuration">⭐</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-xs text-gray-500 font-mono">{field.field_name}</span>
                                          {field.source === 'custom' ? (
                                            <span className="px-1.5 py-0.25 text-xs font-bold bg-blue-100 text-blue-600 rounded">Custom</span>
                                          ) : (
                                            <span className="px-1.5 py-0.25 text-xs font-bold bg-gray-100 text-gray-600 rounded">System</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded border border-blue-300 tracking-tighter">
                                      {field.field_type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="text-sm text-gray-600 truncate max-w-[200px]" title={field.description}>
                                      {field.description || <span className="text-gray-600 italic">No description</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        {field.is_required ? (
                                          <span className="px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded">Required</span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-500 rounded">Optional</span>
                                        )}
                                        {field.is_enabled ? (
                                          <span className="px-1.5 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded tracking-tight">Active</span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-600 rounded tracking-tight">Disabled</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1">
                                      <MaterialButton
                                        variant="text"
                                        size="small"
                                        color="secondary"
                                        onClick={() => {
                                          setSelectedFieldForPermissions(field.id)
                                          setShowPermissionsMatrix(true)
                                        }}
                                        className="!p-1.5"
                                        title="Configure permissions"
                                      >
                                        <Shield className="w-4 h-4" />
                                      </MaterialButton>
                                      <MaterialButton
                                        variant="text"
                                        size="small"
                                        color="primary"
                                        onClick={() => setEditingField(field)}
                                        className="!p-1.5"
                                        title={field.source === 'custom' ? "Edit field" : "Edit system field metadata"}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </MaterialButton>
                                      {field.source === 'custom' && !field.is_standard && (
                                        <MaterialButton
                                          variant="text"
                                          size="small"
                                          color="error"
                                          onClick={() => handleDeleteField(field)}
                                          className="!p-1.5"
                                          title="Delete field"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </MaterialButton>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-3 bg-gray-50">
                                      {/* Options Section - Full Width, Prominent */}
                                      {(() => {
                                        // Collect all options from both sources
                                        const allOptions: Array<{ value: string; label: string }> = []
                                        
                                        // From field.options (custom fields)
                                        if (field.options && Array.isArray(field.options) && field.options.length > 0) {
                                          field.options.forEach((opt: any) => {
                                            if (typeof opt === 'string') {
                                              allOptions.push({ value: opt, label: opt })
                                            } else if (opt && typeof opt === 'object') {
                                              allOptions.push({ 
                                                value: opt.value || opt.label || String(opt), 
                                                label: opt.label || opt.value || String(opt) 
                                              })
                                            }
                                          })
                                        }
                                        
                                        // From field.field_config.options (entity fields)
                                        if (field.field_config?.options && Array.isArray(field.field_config.options) && field.field_config.options.length > 0) {
                                          field.field_config.options.forEach((opt: any) => {
                                            if (typeof opt === 'string') {
                                              allOptions.push({ value: opt, label: opt })
                                            } else if (opt && typeof opt === 'object') {
                                              allOptions.push({ 
                                                value: opt.value || opt.label || String(opt), 
                                                label: opt.label || opt.value || String(opt) 
                                              })
                                            }
                                          })
                                        }
                                        
                                        if (allOptions.length > 0) {
                                          return (
                                            <div className="space-y-3 mb-4">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-gray-700">Options:</span>
                                                  <span className="text-xs text-gray-500">({allOptions.length} {allOptions.length === 1 ? 'option' : 'options'})</span>
                                                </div>
                                                <MaterialButton
                                                  variant="text"
                                                  color="primary"
                                                  size="small"
                                                  onClick={() => setEditingField(field)}
                                                  className="text-xs"
                                                  title="Edit field options and configuration"
                                                >
                                                  <Pencil className="w-3 h-3 mr-1" />
                                                  Edit Options
                                                </MaterialButton>
                                              </div>
                                              <div className="flex flex-wrap gap-1.5 p-3 bg-white border border-gray-200 rounded-lg">
                                                {allOptions.map((opt, idx) => (
                                                  <span 
                                                    key={idx} 
                                                    className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium border border-blue-200"
                                                  >
                                                    {opt.label}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )
                                        }
                                        return null
                                      })()}
                                      
                                      {/* Two Column Layout for Other Details */}
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-2">
                                          {/* Placeholder */}
                                          {(field.placeholder || field.field_config?.placeholder) && (
                                            <div>
                                              <span className="font-medium text-gray-700">Placeholder:</span>
                                              <span className="ml-2 text-gray-600">{field.placeholder || field.field_config?.placeholder}</span>
                                            </div>
                                          )}
                                          
                                          {/* Simple dependency indicator - details are in edit modal */}
                                          {field.field_config?.depends_on && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-purple-500">⭐</span>
                                              <span className="font-medium text-gray-700 text-xs">Depends on:</span>
                                              <span className="text-gray-600 text-xs">{field.field_config.depends_on_label || field.field_config.depends_on}</span>
                                            </div>
                                          )}
                                          
                                          {field.source === 'entity' && (
                                            <div>
                                              <span className="font-medium text-gray-700">System Entity:</span>
                                              <span className="ml-2 text-gray-600">{field.entity_label} ({field.entity_name})</span>
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Role Permissions Summary:</span>
                                          <div className="mt-1 flex flex-wrap gap-2">
                                            {Object.entries(field.role_permissions || {}).slice(0, 4).map(([role, perms]) => {
                                              const roleLabel = USER_ROLES.find(r => r.value === role)?.label || role
                                              if (!perms.view && !perms.edit) return null
                                              return (
                                                <span key={role} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded text-xs font-medium">
                                                  {roleLabel}: {perms.edit ? 'Edit' : 'View'}
                                                </span>
                                              )
                                            })}
                                            {(field.role_permissions && Object.keys(field.role_permissions).length > 4) && (
                                              <span className="text-xs text-gray-600">+{Object.keys(field.role_permissions).length - 4} more</span>
                                            )}
                                            {(!field.role_permissions || Object.keys(field.role_permissions).length === 0) && (
                                              <span className="text-xs text-gray-600 italic">Inherited from entity baseline</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Permissions Matrix Modal */}
        {showPermissionsMatrix && (selectedField || selectedEntityInfo) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium mb-1">
                      Role Permissions: {selectedEntityInfo ? selectedEntityInfo.entity_label : selectedField?.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedEntityInfo 
                        ? `Configure entity-level permissions for all fields in ${selectedEntityInfo.entity_label}. These permissions serve as the baseline for all fields in this entity.`
                        : 'Configure which roles can view and edit this field. Fields can then be used in Process Designer.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPermissionsMatrix(false)
                      setSelectedFieldForPermissions(null)
                      setSelectedEntityForPermissions(null)
                    }}
                    className="text-gray-600 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                          Role
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 tracking-tight">
                          View
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 tracking-tight">
                          Edit
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 tracking-tight">
                          Quick Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loadingPermissions ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            Loading permissions...
                          </td>
                        </tr>
                      ) : (
                        USER_ROLES.map((role) => {
                          // Get default permissions for this role
                          const defaults = getDefaultPermissions()
                          const defaultPerms = defaults[role.value] || { view: true, edit: false }
                          
                          // Determine permissions based on whether it's entity-level or field-level
                          let permissions
                          if (selectedEntityInfo && entityLevelPermissions) {
                            // Entity-level permissions
                            permissions = entityLevelPermissions[role.value] || defaultPerms
                          } else if (selectedField) {
                            // Field-level permissions
                            if (selectedField.source === 'entity' && entityFieldPermissions) {
                              permissions = entityFieldPermissions[role.value] || defaultPerms
                            } else if (selectedField.source === 'custom' && selectedField.role_permissions) {
                              permissions = selectedField.role_permissions[role.value] || defaultPerms
                            } else {
                              permissions = defaultPerms
                            }
                          } else {
                            permissions = defaultPerms
                          }
                          
                          return (
                          <tr key={role.value} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="text-sm font-medium text-gray-900">{role.label}</div>
                              <div className="text-xs text-gray-500 font-mono">{role.value}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={permissions.view}
                                  onChange={(e) => {
                                    if (selectedEntityInfo) {
                                      handleUpdateEntityPermission(selectedEntityInfo.entity_name, role.value, 'view', e.target.checked)
                                    } else if (selectedField) {
                                      handleUpdatePermission(selectedField, role.value, 'view', e.target.checked)
                                    }
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                {permissions.view && <Eye className="w-4 h-4 ml-2 text-green-600" />}
                              </label>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={permissions.edit}
                                  disabled={!permissions.view}
                                  onChange={(e) => {
                                    if (selectedEntityInfo) {
                                      handleUpdateEntityPermission(selectedEntityInfo.entity_name, role.value, 'edit', e.target.checked)
                                    } else if (selectedField) {
                                      handleUpdatePermission(selectedField, role.value, 'edit', e.target.checked)
                                    }
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                                />
                                {permissions.edit && <Pencil className="w-4 h-4 ml-2 text-blue-600" />}
                              </label>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    if (selectedEntityInfo) {
                                      handleBulkEntityPermissionUpdate(selectedEntityInfo.entity_name, role.value, true, true)
                                    } else if (selectedField) {
                                      handleBulkPermissionUpdate(selectedField, role.value, true, true)
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                  title="Enable view and edit"
                                >
                                  View + Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedEntityInfo) {
                                      handleBulkEntityPermissionUpdate(selectedEntityInfo.entity_name, role.value, true, false)
                                    } else if (selectedField) {
                                      handleBulkPermissionUpdate(selectedField, role.value, true, false)
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                                  title="View only"
                                >
                                  View Only
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedEntityInfo) {
                                      handleBulkEntityPermissionUpdate(selectedEntityInfo.entity_name, role.value, false, false)
                                    } else if (selectedField) {
                                      handleBulkPermissionUpdate(selectedField, role.value, false, false)
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                  title="Hide"
                                >
                                  Hide
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => {
                    setShowPermissionsMatrix(false)
                    setSelectedFieldForPermissions(null)
                    setSelectedEntityForPermissions(null)
                    setEntityFieldPermissions(null)
                    setEntityLevelPermissions(null)
                    // Don't show "saved" message here - it's shown when individual permissions are updated
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Field Modal */}
        {(showAddModal || (editingField && editingField.source === 'custom')) && (
          <CustomFieldFormModal
            initialData={editingField || undefined}
            onSave={(data) => {
              if (editingField) {
                handleUpdateField(editingField, data)
              } else {
                handleAddField(data)
              }
            }}
            onCancel={() => {
              setShowAddModal(false)
              setEditingField(null)
            }}
            masterDataLists={masterDataLists || []}
          />
        )}
        
        {/* Entity Field Edit Modal */}
        {editingField && editingField.source === 'entity' && (
          <EntityFieldEditModal
            field={editingField}
            onSave={(updates) => {
              handleUpdateField(editingField, updates)
            }}
            onCancel={() => {
              setEditingField(null)
            }}
          />
        )}
      </div>
    </Layout>
  )
}
