import api from './api'

export interface EntityField {
  id: string
  tenant_id?: string | null
  entity_name: string
  entity_label: string
  entity_category?: string | null
  entity_user_level?: 'business' | 'advanced' | null
  field_name: string
  field_label: string
  field_description?: string | null
  field_type: string
  field_type_display: string
  is_nullable: boolean
  is_primary_key: boolean
  is_foreign_key: boolean
  foreign_key_table?: string | null
  max_length?: number | null
  is_enabled: boolean
  is_visible: boolean
  is_editable: boolean
  is_required: boolean
  display_order: number
  is_auto_discovered: boolean
  is_custom: boolean
  is_system: boolean
  field_category?: 'business' | 'advanced' | 'system' | null
  field_config?: Record<string, any> | null
  default_view_roles?: string[] | null
  default_edit_roles?: string[] | null
  created_at: string
  updated_at: string
  last_discovered_at?: string | null
}

export interface EntityTree {
  category: string
  entities: Array<{
    entity_name: string
    entity_label: string
    field_count: number
  }>
}

export const entityFieldsApi = {
  /**
   * Sync entity fields - discovers and registers all fields from all entities
   */
  async sync(entityNames?: string[]): Promise<{
    entities_processed: number
    fields_discovered: number
    fields_created: number
    fields_updated: number
    entities: Record<string, { fields_discovered: number; fields_created: number; fields_updated: number }>
  }> {
    const params: any = {}
    if (entityNames && entityNames.length > 0) {
      params.entity_names = entityNames.join(',')
    }
    const response = await api.post('/entity-fields/sync', null, { params })
    return response.data
  },

  /**
   * Get entity tree (grouped by category)
   */
  async getTree(category?: string): Promise<EntityTree[]> {
    const params: any = {}
    if (category) {
      params.category = category
    }
    const response = await api.get('/entity-fields/tree', { params })
    return response.data
  },

  /**
   * List all entity fields with optional filters
   */
  async list(params?: {
    entity_name?: string
    entity_category?: string
    entity_user_level?: 'business' | 'advanced'
    field_category?: 'business' | 'advanced' | 'system'
    is_enabled?: boolean
    is_visible?: boolean
    is_system?: boolean
  }): Promise<EntityField[]> {
    const response = await api.get('/entity-fields', { params })
    return response.data
  },

  /**
   * Get fields for a specific entity
   */
  async getEntityFields(entityName: string): Promise<EntityField[]> {
    const encodedEntityName = encodeURIComponent(entityName)
    const response = await api.get(`/entity-fields/${encodedEntityName}`)
    return response.data
  },

  /**
   * Get a specific field
   */
  async getField(entityName: string, fieldName: string): Promise<EntityField> {
    const encodedEntityName = encodeURIComponent(entityName)
    const encodedFieldName = encodeURIComponent(fieldName)
    const response = await api.get(`/entity-fields/${encodedEntityName}/${encodedFieldName}`)
    return response.data
  },

  /**
   * Update field configuration
   */
  async updateField(
    entityName: string,
    fieldName: string,
    updates: {
      field_label?: string
      field_description?: string
      is_enabled?: boolean
      is_visible?: boolean
      is_editable?: boolean
      is_required?: boolean
      display_order?: number
      field_config?: Record<string, any>
    }
  ): Promise<EntityField> {
    const encodedEntityName = encodeURIComponent(entityName)
    const encodedFieldName = encodeURIComponent(fieldName)
    const response = await api.patch(`/entity-fields/${encodedEntityName}/${encodedFieldName}`, updates)
    return response.data
  },

  /**
   * Get field permissions (overrides)
   */
  async getFieldPermissions(entityName: string, fieldName: string): Promise<{
    id: string
    tenant_id?: string | null
    entity_name: string
    field_name: string
    role_permissions: Record<string, { view: boolean; edit: boolean }>
    is_active: boolean
    created_at: string
    updated_at: string
  }> {
    try {
      const encodedEntityName = encodeURIComponent(entityName)
      const encodedFieldName = encodeURIComponent(fieldName)
      const response = await api.get(`/entity-fields/${encodedEntityName}/${encodedFieldName}/permissions`)
      return response.data
    } catch (error: any) {
      // If 404, return default structure (no override exists)
      if (error.response?.status === 404) {
        return {
          id: '',
          tenant_id: null,
          entity_name: entityName,
          field_name: fieldName,
          role_permissions: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
      throw error
    }
  },

  /**
   * Update field permissions (create or update override)
   */
  async updateFieldPermissions(
    entityName: string,
    fieldName: string,
    rolePermissions: Record<string, { view: boolean; edit: boolean }>
  ): Promise<{
    id: string
    tenant_id?: string | null
    entity_name: string
    field_name: string
    role_permissions: Record<string, { view: boolean; edit: boolean }>
    is_active: boolean
    created_at: string
    updated_at: string
  }> {
    const encodedEntityName = encodeURIComponent(entityName)
    const encodedFieldName = encodeURIComponent(fieldName)
    const response = await api.put(`/entity-fields/${encodedEntityName}/${encodedFieldName}/permissions`, {
      role_permissions: rolePermissions,
      is_active: true,
    })
    return response.data
  },

  /**
   * Get entity-level permissions (baseline for all fields in entity)
   */
  async getEntityPermission(entityName: string): Promise<{
    id: string
    tenant_id?: string | null
    entity_name: string
    entity_label: string
    entity_category?: string | null
    entity_user_level?: string | null
    role_permissions: Record<string, { view: boolean; edit: boolean }>
    is_active: boolean
    created_at: string
    updated_at: string
  }> {
    try {
      const encodedEntityName = encodeURIComponent(entityName)
      const response = await api.get(`/entity-permissions/${encodedEntityName}`)
      return response.data
    } catch (error: any) {
      // If 404, return default structure (no permission exists)
      if (error.response?.status === 404) {
        return {
          id: '',
          tenant_id: null,
          entity_name: entityName,
          entity_label: entityName,
          entity_category: null,
          entity_user_level: null,
          role_permissions: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
      throw error
    }
  },

  /**
   * Update entity-level permissions (baseline for all fields in entity)
   */
  async updateEntityPermission(
    entityName: string,
    rolePermissions: Record<string, { view: boolean; edit: boolean }>
  ): Promise<{
    id: string
    tenant_id?: string | null
    entity_name: string
    entity_label: string
    entity_category?: string | null
    entity_user_level?: string | null
    role_permissions: Record<string, { view: boolean; edit: boolean }>
    is_active: boolean
    created_at: string
    updated_at: string
  }> {
    const encodedEntityName = encodeURIComponent(entityName)
    const response = await api.put(`/entity-permissions/${encodedEntityName}`, {
      role_permissions: rolePermissions,
      is_active: true,
    })
    return response.data
  },
}

