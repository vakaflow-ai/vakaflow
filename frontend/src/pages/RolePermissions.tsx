import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { rolePermissionsApi, type RolePermission } from '../lib/rolePermissions'
import { roleConfigurationsApi } from '../lib/roleConfigurations'
import { usersApi, type User } from '../lib/users'
import { businessRulesApi } from '../lib/businessRules'
import { masterDataListsApi } from '../lib/masterDataLists'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { USER_ROLES } from '../lib/users'
import { ChevronRightIcon, ChevronDownIcon, XIcon, RefreshCwIcon, SaveIcon, EyeIcon, PencilIcon, UserPlusIcon, SearchIcon } from '../components/Icons'
import { showToast } from '../utils/toast'

interface PermissionTreeNode {
  permission: RolePermission
  children?: PermissionTreeNode[]
}

interface CategoryGroup {
  category: string
  categoryLabel: string
  roles: {
    role: string
    roleLabel: string
    permissions: RolePermission[]
  }[]
}

export default function RolePermissions() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set()) // Format: "category:role"
  const [viewMode, setViewMode] = useState<'grid' | 'permissions' | 'matrix'>('matrix') // 'grid', 'permissions', or 'matrix'
  const [visibleRoles, setVisibleRoles] = useState<string[]>(['tenant_admin', 'security_reviewer', 'approver', 'vendor_user'])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [assignUsersModalOpen, setAssignUsersModalOpen] = useState(false)
  const [selectedRoleForAssign, setSelectedRoleForAssign] = useState<string>('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [filterRole, setFilterRole] = useState<string>('')
  const [sortBy, setSortBy] = useState<'role' | 'users' | 'permissions'>('role')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map()) // permissionId -> is_enabled
  const [pendingRuleChanges, setPendingRuleChanges] = useState<Map<string, Array<{ id: string; type: string; name?: string }>>>(new Map()) // permissionId -> [{ id, type, name }]
  const [pendingRoleRuleChanges, setPendingRoleRuleChanges] = useState<Map<string, Array<{ id: string; type: string; name?: string }>>>(new Map()) // role -> [{ id, type, name }]
  const [searchTerm, setSearchTerm] = useState<string>('') // Search by permission name or category
  const [ruleLookupModalOpen, setRuleLookupModalOpen] = useState<boolean>(false)
  const [ruleLookupPermission, setRuleLookupPermission] = useState<RolePermission | null>(null)
  const [ruleLookupRole, setRuleLookupRole] = useState<string | null>(null) // For role-level rule lookup
  const [ruleLookupSearchTerm, setRuleLookupSearchTerm] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch all users to get role counts - TENANT ISOLATED
  const { data: allUsers } = useQuery({
    queryKey: ['users', user?.tenant_id],
    queryFn: () => {
      if (!user?.tenant_id && user?.role !== 'platform_admin') {
        throw new Error('Tenant ID required')
      }
      return usersApi.list(user?.tenant_id)
    },
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  // Calculate user counts per role - TENANT ISOLATED
  // Only count users from the current tenant
  const roleUserCounts = USER_ROLES.reduce((acc, role) => {
    const count = allUsers?.filter(u => 
      u.role === role.value && 
      u.is_active && 
      (user?.role === 'platform_admin' || u.tenant_id === user?.tenant_id) // Tenant isolation
    ).length || 0
    acc[role.value] = count
    return acc
  }, {} as Record<string, number>)

  // Fetch permissions grouped by category (always load for both views)
  // CRITICAL: Include tenant_id in query key to ensure tenant isolation and proper caching
  const { data: permissionsByCategory, isLoading, error, refetch } = useQuery({
    queryKey: ['role-permissions-by-category', user?.tenant_id, selectedRole],
    queryFn: async () => {
      const result = await rolePermissionsApi.getByCategory({ 
        role: selectedRole || undefined,
        tenant_id: user?.tenant_id // Explicitly pass tenant_id for tenant isolation
      })
      console.log('Permissions loaded:', result)
      return result
    },
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
    staleTime: 0,
    retry: 1,
  })

  // Fetch users for assign modal - TENANT ISOLATED
  const { data: usersForAssign } = useQuery({
    queryKey: ['users-for-assign', user?.tenant_id],
    queryFn: () => {
      if (!user?.tenant_id && user?.role !== 'platform_admin') {
        throw new Error('Tenant ID required')
      }
      return usersApi.list(user?.tenant_id) // Backend filters by tenant_id
    },
    enabled: !!user && assignUsersModalOpen && (!!user?.tenant_id || user?.role === 'platform_admin'),
  })

  // Fetch business rules for data filter rule selector
  const { data: businessRules } = useQuery({
    queryKey: ['business-rules', user?.tenant_id],
    queryFn: () => businessRulesApi.list({ is_active: true }),
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  // Fetch master data lists for data filter rule selector
  const { data: masterDataLists } = useQuery({
    queryKey: ['master-data-lists', user?.tenant_id],
    queryFn: () => masterDataListsApi.list(undefined, true),
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  // Fetch role configurations for role-level rules
  const { data: roleConfigurations } = useQuery({
    queryKey: ['role-configurations', user?.tenant_id],
    queryFn: () => roleConfigurationsApi.list(user?.tenant_id ? { tenant_id: user.tenant_id } : undefined),
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  // Toggle permission mutation
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ permissionId, enabled, ...otherUpdates }: { permissionId: string; enabled: boolean; [key: string]: any }) => {
      // Build the update payload properly
      const updatePayload: any = { is_enabled: enabled }
      
      // Add rule fields if present
      if (otherUpdates.data_filter_rule_id !== undefined) {
        updatePayload.data_filter_rule_id = otherUpdates.data_filter_rule_id
      }
      if (otherUpdates.data_filter_rule_config !== undefined) {
        updatePayload.data_filter_rule_config = otherUpdates.data_filter_rule_config
      }
      
      return rolePermissionsApi.update(permissionId, updatePayload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
    },
    onError: (error: any) => {
      console.error('Permission update error:', error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to save permission'
      showToast.error(errorMessage)
    },
  })

  // Bulk toggle mutation
  const bulkToggleMutation = useMutation({
    mutationFn: async ({ permissionIds, enabled }: { permissionIds: string[]; enabled: boolean }) => {
      return rolePermissionsApi.bulkToggle({ permission_ids: permissionIds, is_enabled: enabled })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
      showToast.success(`Updated ${data.updated} permission(s)`)
    },
  })

  // Seed defaults mutation (Platform Admin only)
  const seedDefaultsMutation = useMutation({
    mutationFn: () => rolePermissionsApi.seedDefaults(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
      showToast.success(`Seeded ${data.created} new permissions and updated ${data.updated} existing ones`)
    },
  })

  // Auto-seed permissions if none exist (only for platform admin, only once)
  // NOTE: Must be after seedDefaultsMutation declaration
  // Note: Backend now auto-seeds on startup and when fetching permissions,
  // so this is mainly a fallback for platform admins
  const hasAutoSeededRef = useRef(false)
  useEffect(() => {
    // Use a function to avoid referencing seedDefaultsMutation in dependency array
    const shouldAutoSeed = 
      user?.role === 'platform_admin' &&
      !isLoading &&
      permissionsByCategory &&
      Object.keys(permissionsByCategory).length === 0 &&
      !hasAutoSeededRef.current &&
      !error

    if (shouldAutoSeed && !seedDefaultsMutation.isPending) {
      // Auto-seed defaults if no permissions exist (only once)
      hasAutoSeededRef.current = true
      console.log("Auto-seeding permissions from frontend (fallback)")
      seedDefaultsMutation.mutate()
    }
  }, [user?.role, isLoading, permissionsByCategory, error])

  // Assign users to role mutation - TENANT ISOLATED
  // Backend validates tenant_id, but we add frontend validation for better UX
  const assignUsersMutation = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: string }) => {
      // Validate all users belong to the same tenant (frontend check)
      if (user?.role !== 'platform_admin' && user?.tenant_id) {
        const usersToAssign = usersForAssign?.filter(u => userIds.includes(u.id)) || []
        const invalidUsers = usersToAssign.filter(u => u.tenant_id !== user.tenant_id)
        if (invalidUsers.length > 0) {
          throw new Error('Cannot assign users from different tenants')
        }
      }
      
      const updates = await Promise.all(
        userIds.map(userId => usersApi.update(userId, { role }))
      )
      return updates
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users-for-assign'] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
      setAssignUsersModalOpen(false)
      setSelectedUserIds(new Set())
      showToast.success('Users assigned to role successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || error?.message || 'Failed to assign users to role')
    },
  })

  // Open assign users modal
  const handleAssignUsers = (role: string) => {
    setSelectedRoleForAssign(role)
    setAssignUsersModalOpen(true)
    // Pre-select users with this role
    const usersWithRole = usersForAssign?.filter(u => u.role === role).map(u => u.id) || []
    setSelectedUserIds(new Set(usersWithRole))
  }

  // Handle user selection toggle
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  // Handle assign users
  const handleAssignUsersSubmit = () => {
    if (selectedUserIds.size === 0) {
      showToast.error('Please select at least one user')
      return
    }
    assignUsersMutation.mutate({
      userIds: Array.from(selectedUserIds),
      role: selectedRoleForAssign,
    })
  }

  // Category labels mapping
  const categoryLabels: Record<string, string> = {
    agent_management: 'Agent Management',
    review_approval: 'Review & Approval',
    compliance: 'Compliance',
    administration: 'Administration',
    analytics: 'Analytics',
    integrations: 'Integrations',
    vendor_management: 'Vendor Management',
    forms_and_data_fields: 'Forms & Field Access',
    menu: 'Menu Access',
  }

  // Role labels mapping
  const roleLabels: Record<string, string> = {
    platform_admin: 'Platform Admin',
    tenant_admin: 'Tenant Admin',
    policy_admin: 'Policy Admin',
    integration_admin: 'Integration Admin',
    user_admin: 'User Admin',
    security_reviewer: 'Security Reviewer',
    compliance_reviewer: 'Compliance Reviewer',
    technical_reviewer: 'Technical Reviewer',
    business_reviewer: 'Business Reviewer',
    approver: 'Approver',
    vendor_user: 'Vendor User',
    end_user: 'End User',
  }

  // Transform permissions data into category groups
  const categoryGroups: CategoryGroup[] = permissionsByCategory
    ? Object.entries(permissionsByCategory).map(([category, rolesData]) => ({
        category,
        categoryLabel: categoryLabels[category] || category,
        roles: Object.entries(rolesData).map(([role, permissions]) => ({
          role,
          roleLabel: roleLabels[role] || role,
          permissions: permissions as RolePermission[],
        })),
      }))
    : []

  // Group permissions by base key (e.g., "agents", "settings") for table view
  // This groups "agents.view" and "agents.edit" together across all roles
  interface PermissionGroup {
    baseKey: string
    label: string
    description: string
    permissions: Map<string, RolePermission> // Map of role -> permission (for view/edit)
    category: string
  }

  const getPermissionGroupsForCategory = (category: string): PermissionGroup[] => {
    const categoryData = permissionsByCategory?.[category] || {}
    const grouped = new Map<string, PermissionGroup>()

    // Iterate through all roles in this category
    Object.entries(categoryData).forEach(([role, permissions]: [string, any[]]) => {
      permissions.forEach((perm: RolePermission) => {
        // Extract base key (e.g., "agents" from "agents.view" or "agents.edit")
        const parts = perm.permission_key.split('.')
        const lastPart = parts[parts.length - 1]
        // Define standard actions that we want to group together as View/Edit
        const isStandardAction = ['view', 'edit', 'create', 'delete', 'approve', 'reject', 'view_all', 'manage_all'].includes(lastPart.toLowerCase())

        if (parts.length >= 2 && isStandardAction) {
          const baseKey = parts.slice(0, -1).join('.') // Everything except the last part
          const action = lastPart.toLowerCase()

          if (!grouped.has(baseKey)) {
            grouped.set(baseKey, {
              baseKey,
              label: perm.permission_label.replace(/\s+(View|Edit|Create|Delete|Approve|Reject|View All|Manage All)$/i, ''), // Remove action suffix
              description: perm.permission_description || '',
              category,
              permissions: new Map(),
            })
          }

          const group = grouped.get(baseKey)!
          // Map standard actions to view/edit columns
          // view, view_all -> view
          // edit, manage_all, create, delete, approve, reject -> edit
          let actionColumn = action
          if (['view', 'view_all'].includes(action)) actionColumn = 'view'
          else if (['edit', 'manage_all', 'create', 'delete', 'approve', 'reject'].includes(action)) actionColumn = 'edit'
          
          const permKey = `${role}:${actionColumn}`
          group.permissions.set(permKey, perm)
        } else {
          // If no dot separator or not a standard action, treat as standalone permission
          // This handles "menu.*" and "submission.field.*" better
          if (!grouped.has(perm.permission_key)) {
            grouped.set(perm.permission_key, {
              baseKey: perm.permission_key,
              label: perm.permission_label,
              description: perm.permission_description || '',
              category,
              permissions: new Map(),
            })
          }
          const group = grouped.get(perm.permission_key)!
          // Use 'view' as the default action column for standalone permissions
          group.permissions.set(`${role}:view`, perm)
        }
      })
    })

    return Array.from(grouped.values())
  }

  // Debug logging for permissions loading
  useEffect(() => {
    if (user) {
      console.log('RolePermissions Debug:', {
        userRole: user?.role,
        tenantId: user?.tenant_id,
        isLoading,
        hasError: !!error,
        errorMessage: error?.message,
        permissionsByCategoryKeys: permissionsByCategory ? Object.keys(permissionsByCategory) : [],
        categoryGroupsCount: categoryGroups.length,
        queryEnabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role),
      })
    }
  }, [user, isLoading, error, permissionsByCategory, categoryGroups.length])

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
        // Collapse all roles in this category when collapsing category
        setExpandedRoles((prevRoles) => {
          const nextRoles = new Set(prevRoles)
          categoryGroups
            .find(g => g.category === category)
            ?.roles.forEach(roleGroup => {
              nextRoles.delete(`${category}:${roleGroup.role}`)
            })
          return nextRoles
        })
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Toggle role expansion
  const toggleRole = (category: string, role: string) => {
    const key = `${category}:${role}`
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Expand all categories and roles
  const expandAll = () => {
    const allCategories = new Set(categoryGroups.map((g) => g.category))
    setExpandedCategories(allCategories)
    const allRoles = new Set<string>()
    categoryGroups.forEach(group => {
      group.roles.forEach(roleGroup => {
        allRoles.add(`${group.category}:${roleGroup.role}`)
      })
    })
    setExpandedRoles(allRoles)
  }

  // Collapse all categories and roles
  const collapseAll = () => {
    setExpandedCategories(new Set())
    setExpandedRoles(new Set())
  }

  // Handle permission toggle (store in pending changes)
  const handleTogglePermission = (permission: RolePermission) => {
    setPendingChanges((prev) => {
      const next = new Map(prev)
      const currentValue = next.has(permission.id) 
        ? next.get(permission.id)! 
        : permission.is_enabled
      next.set(permission.id, !currentValue)
      return next
    })
  }

  // Open rule lookup modal for permission
  const handleOpenRuleLookup = (permission: RolePermission) => {
    setRuleLookupPermission(permission)
    setRuleLookupRole(null)
    setRuleLookupModalOpen(true)
    // Initialize with current rules
    const currentRules = pendingRuleChanges.get(permission.id) || 
      ((permission as any).data_filter_rule_ids || [])
    setPendingRuleChanges((prev) => {
      const next = new Map(prev)
      if (!next.has(permission.id)) {
        next.set(permission.id, currentRules)
      }
      return next
    })
  }

  // Open rule lookup modal for role
  const handleOpenRoleRuleLookup = (role: string) => {
    setRuleLookupPermission(null)
    setRuleLookupRole(role)
    setRuleLookupModalOpen(true)
    // Initialize with current rules from role configuration
    const roleConfig = roleConfigurations?.find(rc => rc.role === role)
    const currentRules = pendingRoleRuleChanges.get(role) || 
      (roleConfig?.data_filter_rule_ids || [])
    setPendingRoleRuleChanges((prev) => {
      const next = new Map(prev)
      if (!next.has(role)) {
        next.set(role, currentRules)
      }
      return next
    })
  }

  // Handle rule selection in lookup modal
  const handleRuleSelect = (ruleId: string, ruleType: string, ruleName: string, isSelected: boolean) => {
    if (ruleLookupPermission) {
      // Permission-level rule
      setPendingRuleChanges((prev) => {
        const next = new Map(prev)
        const currentRules = next.get(ruleLookupPermission.id) || []
        
        if (isSelected) {
          // Add rule if not already present
          if (!currentRules.some((r: any) => r.id === ruleId)) {
            next.set(ruleLookupPermission.id, [...currentRules, { id: ruleId, type: ruleType, name: ruleName }])
          }
        } else {
          // Remove rule
          next.set(ruleLookupPermission.id, currentRules.filter((r: any) => r.id !== ruleId))
        }
        return next
      })
    } else if (ruleLookupRole) {
      // Role-level rule
      setPendingRoleRuleChanges((prev) => {
        const next = new Map(prev)
        const currentRules = next.get(ruleLookupRole) || []
        
        if (isSelected) {
          // Add rule if not already present
          if (!currentRules.some((r: any) => r.id === ruleId)) {
            next.set(ruleLookupRole, [...currentRules, { id: ruleId, type: ruleType, name: ruleName }])
          }
        } else {
          // Remove rule
          next.set(ruleLookupRole, currentRules.filter((r: any) => r.id !== ruleId))
        }
        return next
      })
    }
  }

  // Global save mutation for all pending changes
  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissionIds = new Set([
        ...Array.from(pendingChanges.keys()),
        ...Array.from(pendingRuleChanges.keys())
      ])
      
      const updates: Promise<any>[] = []
      
      // Handle permission updates
      permissionIds.forEach(id => {
        const updateData: any = {}
        if (pendingChanges.has(id)) {
          updateData.is_enabled = pendingChanges.get(id)
        }
        if (pendingRuleChanges.has(id)) {
          const rules = pendingRuleChanges.get(id)!
          updateData.data_filter_rule_ids = rules.map(r => ({ id: r.id, type: r.type }))
        }
        updates.push(rolePermissionsApi.update(id, updateData))
      })
      
      // Handle role configuration updates
      pendingRoleRuleChanges.forEach((rules, role) => {
        updates.push(roleConfigurationsApi.update(role, {
          data_filter_rule_ids: rules.map(r => ({ id: r.id, type: r.type }))
        }))
      })
      
      return Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
      queryClient.invalidateQueries({ queryKey: ['role-configurations'] })
      setPendingChanges(new Map())
      setPendingRuleChanges(new Map())
      setPendingRoleRuleChanges(new Map())
      showToast.success('All changes saved successfully')
    },
    onError: (error: any) => {
      console.error('Save error:', error)
      showToast.error(error?.response?.data?.detail || 'Failed to save changes')
    }
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  // Save selected rules from lookup modal
  const handleSaveRules = () => {
    if (ruleLookupPermission) {
      // Permission-level rules are saved when permission is saved
      setRuleLookupModalOpen(false)
      setRuleLookupSearchTerm('')
    } else if (ruleLookupRole) {
      // Save role-level rules immediately
      const rules = pendingRoleRuleChanges.get(ruleLookupRole) || []
      roleConfigurationsApi.update(ruleLookupRole, {
        data_filter_rule_ids: rules.length > 0 ? rules.map(r => ({ id: r.id, type: r.type })) : []
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['role-configurations'] })
        showToast.success('Role rules saved successfully')
        setRuleLookupModalOpen(false)
        setRuleLookupSearchTerm('')
      }).catch((error) => {
        showToast.error('Failed to save role rules')
        console.error('Save role rules error:', error)
      })
    }
  }

  // Save a single permission
  const handleSavePermission = (permission: RolePermission) => {
    const pendingValue = pendingChanges.get(permission.id)
    const pendingRules = pendingRuleChanges.get(permission.id)
    
    const updateData: any = {}
    if (pendingValue !== undefined) {
      updateData.is_enabled = pendingValue
    }
    if (pendingRules !== undefined) {
      if (pendingRules && pendingRules.length > 0) {
        updateData.data_filter_rule_ids = pendingRules.map((r: any) => ({ id: r.id, type: r.type }))
      } else {
        updateData.data_filter_rule_ids = []
      }
    }

    if (Object.keys(updateData).length > 0 || pendingValue !== undefined) {
      togglePermissionMutation.mutate({
        permissionId: permission.id,
        enabled: pendingValue !== undefined ? pendingValue : permission.is_enabled,
        ...updateData
      }, {
        onSuccess: () => {
          setPendingChanges((prev) => {
            const next = new Map(prev)
            next.delete(permission.id)
            return next
          })
          setPendingRuleChanges((prev) => {
            const next = new Map(prev)
            next.delete(permission.id)
            return next
          })
          queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
          showToast.success('Permission saved successfully')
        },
        onError: (error: any) => {
          console.error('Permission update error:', error)
          const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to save permission'
          showToast.error(errorMessage)
        }
      })
    }
  }

  // Save all pending changes for a category
  const handleSaveAllCategory = (category: string) => {
    const categoryData = permissionsByCategory?.[category] || {}
    const updates: { permissionId: string; enabled: boolean }[] = []

    Object.values(categoryData).forEach((permissions: RolePermission[]) => {
      permissions.forEach((perm: RolePermission) => {
        const pendingValue = pendingChanges.get(perm.id)
        if (pendingValue !== undefined && pendingValue !== perm.is_enabled) {
          updates.push({ permissionId: perm.id, enabled: pendingValue })
        }
      })
    })

    if (updates.length > 0) {
      // Batch update all permissions
      Promise.all(
        updates.map(({ permissionId, enabled }) =>
          rolePermissionsApi.update(permissionId, { is_enabled: enabled })
        )
      ).then(() => {
        // Clear pending changes for this category
        setPendingChanges((prev) => {
          const next = new Map(prev)
          updates.forEach(({ permissionId }) => next.delete(permissionId))
          return next
        })
        queryClient.invalidateQueries({ queryKey: ['role-permissions-by-category'] })
        showToast.success(`Saved ${updates.length} permission(s)`)
      }).catch((error) => {
        showToast.error('Failed to save permissions')
        console.error('Save error:', error)
      })
    } else {
      showToast.info('No changes to save')
    }
  }

  // Handle bulk toggle for a category
  const handleBulkToggleCategory = (category: string, enabled: boolean) => {
    const categoryData = permissionsByCategory?.[category]
    if (!categoryData) return

    const allPermissionIds: string[] = []
    Object.values(categoryData).forEach((permissions) => {
      permissions.forEach((perm) => {
        if (perm.is_enabled !== enabled) {
          allPermissionIds.push(perm.id)
        }
      })
    })

    if (allPermissionIds.length > 0) {
      bulkToggleMutation.mutate({ permissionIds: allPermissionIds, enabled })
    }
  }

  // Handle bulk toggle for a role in a category
  const handleBulkToggleRole = (category: string, role: string, enabled: boolean) => {
    const categoryData = permissionsByCategory?.[category]
    if (!categoryData || !categoryData[role]) return

    const permissionIds = categoryData[role]
      .filter((perm) => perm.is_enabled !== enabled)
      .map((perm) => perm.id)

    if (permissionIds.length > 0) {
      bulkToggleMutation.mutate({ permissionIds, enabled })
    }
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

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium mb-2 text-gray-900">Role & Permission Management</h1>
            <p className="text-sm text-gray-600">
              {user?.role === 'platform_admin' 
                ? 'Manage global role permissions and access control'
                : `Manage permissions for ${user?.tenant_name || 'your tenant'}`}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-gray-100/80 p-1 rounded-md flex shadow-sm border border-gray-200">
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Matrix View
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Role Overview
              </button>
              <button
                onClick={() => setViewMode('permissions')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  viewMode === 'permissions'
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Classical List
              </button>
            </div>
            
            <MaterialButton
              variant="outlined"
              size="small"
              onClick={() => refetch()}
              disabled={isLoading}
              startIcon={<RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </MaterialButton>
            
            {(pendingChanges.size > 0 || pendingRuleChanges.size > 0 || pendingRoleRuleChanges.size > 0) && (
              <MaterialButton
                onClick={handleSave}
                disabled={saveMutation.isPending}
                startIcon={<SaveIcon className="w-4 h-4" />}
                className="shadow-md-elevation-4"
              >
                {saveMutation.isPending ? 'Saving...' : `Save ${pendingChanges.size + pendingRuleChanges.size + pendingRoleRuleChanges.size} Changes`}
              </MaterialButton>
            )}
          </div>
        </div>

        {/* Matrix View - Material Design */}
        {viewMode === 'matrix' && (
          <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[600px] -mt-2">
            {/* Sidebar Nodes */}
            <MaterialCard elevation={1} className="w-64 flex-shrink-0 overflow-hidden flex flex-col border-none">
              <div className="p-4 border-b bg-surface-variant/30">
                <h3 className="text-xs font-medium text-gray-500 tracking-tight">Permission areas</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                <MaterialButton
                  variant={activeCategory === 'all' ? 'contained' : 'text'}
                  fullWidth
                  onClick={() => setActiveCategory('all')}
                  className={`justify-start px-4 py-2.5 ${activeCategory === 'all' ? 'shadow-md-elevation-3' : 'text-gray-600'}`}
                >
                  All Categories
                </MaterialButton>
                <div className="my-2 border-t border-gray-100" />
                {categoryGroups.map(group => (
                  <MaterialButton
                    key={group.category}
                    variant={activeCategory === group.category ? 'contained' : 'text'}
                    color={activeCategory === group.category ? 'primary' : 'secondary'}
                    fullWidth
                    onClick={() => setActiveCategory(group.category)}
                    className={`justify-start px-4 py-2.5 ${activeCategory === group.category ? 'bg-primary-50 text-primary-700 shadow-none border border-primary-200' : 'text-gray-500'}`}
                  >
                    {group.categoryLabel}
                  </MaterialButton>
                ))}
              </div>
            </MaterialCard>

            {/* Matrix Content Area */}
            <MaterialCard elevation={2} className="flex-1 overflow-hidden flex flex-col border-none">
              {/* Matrix Toolbar */}
              <div className="p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-surface-variant/20">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="compact-input pl-10"
                  />
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                   <div className="flex items-center gap-1 bg-surface-variant/30 rounded-md p-1 border border-outline/5">
                     {USER_ROLES.map(role => (
                       <MaterialButton
                         key={role.value}
                         variant={visibleRoles.includes(role.value) ? 'contained' : 'text'}
                         size="small"
                         onClick={() => {
                           setVisibleRoles(prev => 
                             prev.includes(role.value) 
                               ? prev.filter(v => v !== role.value)
                               : [...prev, role.value]
                           )
                         }}
                         className={`whitespace-nowrap ${visibleRoles.includes(role.value) ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
                       >
                         {role.label}
                       </MaterialButton>
                     ))}
                   </div>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="flex-1 overflow-auto relative custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-white z-20">
                    <tr className="border-b border-gray-100">
                      <th className="p-4 text-left text-xs font-medium text-gray-500 tracking-tight bg-white/95 backdrop-blur-sm sticky left-0 z-30 min-w-[280px]">
                        Permission node
                      </th>
                      {visibleRoles.map(roleCode => (
                        <th key={roleCode} className="p-4 text-center text-xs font-medium text-gray-500 tracking-tight bg-white/95 backdrop-blur-sm min-w-[130px]">
                          {roleLabels[roleCode] || roleCode}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {categoryGroups
                      .filter(g => activeCategory === 'all' || g.category === activeCategory)
                      .map(group => {
                        let pgGroups = getPermissionGroupsForCategory(group.category)
                        
                        // Apply Search
                        if (searchTerm.trim()) {
                          const s = searchTerm.toLowerCase()
                          pgGroups = pgGroups.filter(pg => 
                            pg.label.toLowerCase().includes(s) || 
                            pg.baseKey.toLowerCase().includes(s) ||
                            pg.description.toLowerCase().includes(s)
                          )
                        }

                        if (pgGroups.length === 0) return null

                        return (
                          <React.Fragment key={group.category}>
                            {activeCategory === 'all' && (
                              <tr className="bg-gray-50/30">
                                <td 
                                  colSpan={visibleRoles.length + 1}
                                  className="px-4 py-2.5 text-sm font-medium text-blue-600 tracking-tight sticky left-0 z-10"
                                >
                                  {group.categoryLabel}
                                </td>
                              </tr>
                            )}
                            {pgGroups.map(pg => (
                              <tr key={pg.baseKey} className="group hover:bg-blue-50/30 transition-all">
                                <td className="p-4 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 transition-colors border-r border-gray-50">
                                  <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 opacity-0 group-hover:opacity-100 transition-all" />
                                    <div>
                                      <div className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">{pg.label}</div>
                                      <div className="text-xs text-gray-500 font-mono mt-0.5 tracking-tight">{pg.baseKey}</div>
                                      {pg.description && (
                                        <div className="text-sm text-gray-500 mt-1 leading-relaxed opacity-70 group-hover:opacity-100 transition-all">
                                          {pg.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {visibleRoles.map(roleCode => {
                                  const vPerm = pg.permissions.get(`${roleCode}:view`)
                                  const ePerm = pg.permissions.get(`${roleCode}:edit`)
                                  const sPerm = pg.permissions.get(roleCode) // Single perm
                                  
                                  const hasView = vPerm ? (pendingChanges.has(vPerm.id) ? pendingChanges.get(vPerm.id) : vPerm.is_enabled) : false
                                  const hasEdit = ePerm ? (pendingChanges.has(ePerm.id) ? pendingChanges.get(ePerm.id) : ePerm.is_enabled) : false
                                  const hasSingle = sPerm ? (pendingChanges.has(sPerm.id) ? pendingChanges.get(sPerm.id) : sPerm.is_enabled) : false

                                  return (
                                    <td key={roleCode} className="p-4 text-center">
                                      <div className="flex items-center justify-center gap-4">
                                        {(vPerm || sPerm) && (
                                          <MaterialButton
                                            variant={ (vPerm ? hasView : hasSingle) ? 'contained' : 'outlined' }
                                            color="primary"
                                            onClick={() => handleTogglePermission(vPerm || sPerm!)}
                                            className={`w-9 h-9 !p-0 rounded-md transition-all ${
                                              (vPerm ? hasView : hasSingle)
                                                ? 'shadow-md-elevation-3 scale-110'
                                                : 'bg-surface-variant/20 border-outline/10 text-gray-600'
                                            }`}
                                            title={vPerm ? "View Access" : "Full Access"}
                                          >
                                            <EyeIcon className="w-4 h-4" />
                                          </MaterialButton>
                                        )}
                                        {ePerm && (
                                          <MaterialButton
                                            variant={ hasEdit ? 'contained' : 'outlined' }
                                            color="secondary"
                                            onClick={() => handleTogglePermission(ePerm)}
                                            className={`w-9 h-9 !p-0 rounded-md transition-all ${
                                              hasEdit
                                                ? 'shadow-md-elevation-3 scale-110'
                                                : 'bg-surface-variant/20 border-outline/10 text-gray-600'
                                            }`}
                                            title="Edit Access"
                                          >
                                            <PencilIcon className="w-4 h-4" />
                                          </MaterialButton>
                                        )}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </MaterialCard>
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {USER_ROLES.map(role => {
              const userCount = roleUserCounts[role.value] || 0;
              const rolePermissions = permissionsByCategory
                ? Object.values(permissionsByCategory)
                    .flatMap(cat => Object.values(cat).flat())
                    .filter(p => p.role === role.value)
                : [];
              const totalPerms = rolePermissions.length;
              const enabledPerms = rolePermissions.filter(p => p.is_enabled).length;
              const permissionsPercentage = totalPerms > 0 ? Math.round((enabledPerms / totalPerms) * 100) : 0;
              
              return (
                <MaterialCard 
                  key={role.value}
                  elevation={2}
                  hover
                  className="p-6 cursor-pointer border-t-4 transition-all"
                  style={{ borderTopColor: role.value === selectedRole ? '#3b82f6' : '#e5e7eb' }}
                  onClick={() => {
                    setSelectedRole(role.value);
                    setViewMode('matrix');
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{role.label}</h3>
                      <div className="text-sm text-gray-500 font-mono mt-0.5 tracking-tight">{role.value}</div>
                    </div>
                    <MaterialChip 
                      label={`${userCount} users`} 
                      variant="outlined"
                      size="small"
                      color={userCount > 0 ? 'primary' : 'default'}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-gray-600 mb-1.5">
                        <span>Permission Coverage</span>
                        <span className={permissionsPercentage > 70 ? 'text-green-600' : permissionsPercentage > 30 ? 'text-blue-600' : 'text-gray-600'}>
                          {permissionsPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            permissionsPercentage > 70 ? 'bg-green-500' : permissionsPercentage > 30 ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${permissionsPercentage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                            {String.fromCharCode(64 + i)}
                          </div>
                        ))}
                        {userCount > 3 && (
                          <div className="w-7 h-7 rounded-full bg-primary-50 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-600">
                            +{userCount - 3}
                          </div>
                        )}
                      </div>
                      
                      <MaterialButton
                        variant="text"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignUsers(role.value);
                        }}
                        startIcon={<UserPlusIcon className="w-3.5 h-3.5" />}
                        className="text-sm font-bold"
                      >
                        Assign
                      </MaterialButton>
                    </div>
                  </div>
                </MaterialCard>
              );
            })}
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="mt-8 space-y-4">
            {/* Compact Filters */}
            <MaterialCard elevation={1} className="flex items-center justify-between gap-4 mb-6 p-4 border-none">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="compact-input pl-9 pr-8 appearance-none cursor-pointer font-medium text-gray-700"
                  >
                    <option value="">Filter by Role: All</option>
                    {USER_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center bg-surface-variant/30 rounded-lg p-1 border border-outline/5 shadow-sm">
                  <MaterialButton
                    variant={sortBy === 'role' ? 'contained' : 'text'}
                    size="small"
                    onClick={() => {
                      setSortBy('role')
                      setSortOrder(sortBy === 'role' && sortOrder === 'asc' ? 'desc' : 'asc')
                    }}
                    className={sortBy === 'role' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}
                  >
                    Sort: Name {sortBy === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </MaterialButton>
                  <MaterialButton
                    variant={sortBy === 'users' ? 'contained' : 'text'}
                    size="small"
                    onClick={() => {
                      setSortBy('users')
                      setSortOrder(sortBy === 'users' && sortOrder === 'asc' ? 'desc' : 'asc')
                    }}
                    className={sortBy === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}
                  >
                    Sort: Users {sortBy === 'users' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </MaterialButton>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                 <span className="text-xs font-medium text-gray-500 tracking-tight mr-2">Quick filters:</span>
                 <MaterialButton 
                   variant="text" 
                   size="small" 
                   onClick={() => setFilterRole('')} 
                   className="text-gray-500 hover:bg-gray-100"
                 >
                   Clear all
                 </MaterialButton>
              </div>
            </MaterialCard>

            {/* Roles Table */}
            <MaterialCard elevation={2} className="overflow-hidden border-none">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-surface-variant/30">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">
                        Role Identity
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">
                        Associated Users
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">
                        Permission Coverage
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">
                        Access Policy Rules
                      </th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 tracking-tight">
                        Quick Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-50">
                    {(() => {
                      // Filter roles
                      let filteredRoles = USER_ROLES
                      if (filterRole) {
                        filteredRoles = filteredRoles.filter(r => r.value === filterRole)
                      }

                      // Sort roles
                      const sortedRoles = [...filteredRoles].sort((a, b) => {
                        const aUserCount = roleUserCounts[a.value] || 0
                        const bUserCount = roleUserCounts[b.value] || 0
                        const aPermissions = permissionsByCategory
                          ? Object.values(permissionsByCategory)
                              .flatMap(cat => Object.values(cat).flat())
                              .filter(p => p.role === a.value).length
                          : 0
                        const bPermissions = permissionsByCategory
                          ? Object.values(permissionsByCategory)
                              .flatMap(cat => Object.values(cat).flat())
                              .filter(p => p.role === b.value).length
                          : 0

                        let comparison = 0
                        if (sortBy === 'role') {
                          comparison = a.label.localeCompare(b.label)
                        } else if (sortBy === 'users') {
                          comparison = aUserCount - bUserCount
                        } else if (sortBy === 'permissions') {
                          comparison = aPermissions - bPermissions
                        }

                        return sortOrder === 'asc' ? comparison : -comparison
                      })

                      return sortedRoles.map((role) => {
                        const userCount = roleUserCounts[role.value] || 0;
                        const rolePermissions = permissionsByCategory
                          ? Object.values(permissionsByCategory)
                              .flatMap(cat => Object.values(cat).flat())
                              .filter(p => p.role === role.value)
                          : [];
                        const enabledPermissions = rolePermissions.filter(p => p.is_enabled).length;
                        const totalPermissions = rolePermissions.length;
                        const permissionsPercentage = totalPermissions > 0 
                          ? Math.round((enabledPermissions / totalPermissions) * 100) 
                          : 0;
  
                        return (
                          <tr key={role.value} className="hover:bg-blue-50/20 transition-all group">
                            <td className="px-6 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">{role.label}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5 tracking-tight">{role.value}</div>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-medium text-xs border border-blue-300">
                              {userCount}
                            </div>
                            <span className="text-xs font-medium text-gray-500 tracking-tight">Active Members</span>
                          </div>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          {totalPermissions > 0 ? (
                            <div className="flex flex-col gap-1.5 w-40">
                              <div className="flex items-center justify-between text-sm font-medium tracking-tight text-gray-500">
                                <span>{enabledPermissions}/{totalPermissions} Active</span>
                                <span>{permissionsPercentage}%</span>
                              </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden border border-gray-50">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        permissionsPercentage === 100 ? 'bg-green-500' : 
                                        permissionsPercentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                      }`}
                                      style={{ width: `${permissionsPercentage}%` }}
                                    />
                                  </div>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-gray-600 tracking-tight">No coverage defined</span>
                          )}
                        </td>
                        <td className="px-6 py-2">
                          {(() => {
                            const roleConfig = roleConfigurations?.find(rc => rc.role === role.value);
                            const currentRules = pendingRoleRuleChanges.has(role.value)
                              ? pendingRoleRuleChanges.get(role.value)!
                              : (roleConfig?.data_filter_rule_ids || []);
                            
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {currentRules.length > 0 ? (
                                  currentRules.slice(0, 2).map((rule: any, idx: number) => (
                                    <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium border border-indigo-100 tracking-tight">
                                      {rule.name || (businessRules?.find(r => r.id === rule.id)?.name) || rule.id}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm font-medium text-gray-600 tracking-tight italic">Global access</span>
                                )}
                                    {currentRules.length > 2 && (
                                      <span className="text-sm font-medium text-indigo-400">+{currentRules.length - 2} more</span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-2 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <MaterialButton
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRole(role.value);
                                    setVisibleRoles([role.value]);
                                    setViewMode('matrix');
                                  }}
                                  className="!p-2 text-blue-600 border-outline/10 hover:bg-primary-50"
                                  title="Analyze in Matrix"
                                >
                                  <EyeIcon className="w-5 h-5" />
                                </MaterialButton>
                                <MaterialButton
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignUsers(role.value);
                                  }}
                                  className="!p-2 text-gray-600 border-outline/10 hover:bg-gray-50"
                                  title="Manage Users"
                                >
                                  <UserPlusIcon className="w-5 h-5" />
                                </MaterialButton>
                              </div>
                            </td>
                          </tr>
                      );
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </MaterialCard>
        </div>
      )}

        {/* Classic Permissions List View - Material Design */}
        {viewMode === 'permissions' && (
          <div className="space-y-4">
            {/* Compact Filters */}
            <MaterialCard elevation={1} className="flex flex-col md:flex-row gap-4 items-center p-4 border-none">
              <div className="relative flex-1 w-full">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by permission name or category..."
                  className="compact-input pl-10"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="compact-input min-w-[200px] font-medium text-gray-700"
                >
                  <option value="">All Roles</option>
                  {USER_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <MaterialButton 
                    variant="text" 
                    size="small" 
                    onClick={expandAll} 
                    className="!p-2 text-gray-600 hover:text-gray-600 hover:bg-gray-100" 
                    title="Expand All"
                  >
                    <ChevronDownIcon className="w-5 h-5" />
                  </MaterialButton>
                  <MaterialButton 
                    variant="text" 
                    size="small" 
                    onClick={collapseAll} 
                    className="!p-2 text-gray-600 hover:text-gray-600 hover:bg-gray-100" 
                    title="Collapse All"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </MaterialButton>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Permissions by Category - Simple Grouped View */}
        {viewMode === 'permissions' && (
          <>
            {isLoading && (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Loading permissions...</div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-800">
                  Error loading permissions: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              </div>
            )}

            {!isLoading && !error && categoryGroups.length === 0 && (
              <MaterialCard elevation={1} className="p-12 text-center border-none">
                <div className="text-gray-500 mb-6 text-lg">
                  {user?.role === 'platform_admin' 
                    ? 'No permissions found. Click below to seed default permissions.'
                    : 'No permissions found. Please contact your platform administrator to seed default permissions.'}
                </div>
                {user?.role === 'platform_admin' && (
                  <MaterialButton
                    onClick={() => seedDefaultsMutation.mutate()}
                    disabled={seedDefaultsMutation.isPending}
                    size="large"
                    className="shadow-md-elevation-4"
                  >
                    {seedDefaultsMutation.isPending ? 'Seeding...' : 'Seed Default Permissions'}
                  </MaterialButton>
                )}
              </MaterialCard>
            )}

            {!isLoading && !error && categoryGroups.length > 0 && (
              <div className="space-y-6">
                {categoryGroups.map((group) => {
                  const isCategoryExpanded = expandedCategories.has(group.category)
                  let permissionGroups = getPermissionGroupsForCategory(group.category)
                  
                  // Filter by search term (permission name, key, or category)
                  if (searchTerm.trim()) {
                    const searchLower = searchTerm.toLowerCase()
                    permissionGroups = permissionGroups.filter((pg) => {
                      const matchesLabel = pg.label.toLowerCase().includes(searchLower)
                      const matchesKey = pg.baseKey.toLowerCase().includes(searchLower)
                      const matchesCategory = group.categoryLabel.toLowerCase().includes(searchLower)
                      const matchesDescription = pg.description.toLowerCase().includes(searchLower)
                      return matchesLabel || matchesKey || matchesCategory || matchesDescription
                    })
                  }
                  
                  // Filter by role if selected
                  if (selectedRole) {
                    permissionGroups = permissionGroups.filter((pg) => {
                      // Check if any permission in this group belongs to the selected role
                      return Array.from(pg.permissions.keys()).some(key => key.startsWith(`${selectedRole}:`))
                    })
                  }
                  
                  // Don't show category if no permissions match filters
                  if (permissionGroups.length === 0) return null
                  
                  return (
                    <MaterialCard key={group.category} elevation={1} className="overflow-hidden border-none transition-all">
                      {/* Category Header */}
                      <div
                        className={`px-6 py-2 cursor-pointer flex items-center justify-between transition-all ${
                          isCategoryExpanded ? 'bg-primary-50/30 border-b border-primary-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleCategory(group.category)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg transition-all ${isCategoryExpanded ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
                            {isCategoryExpanded ? (
                              <ChevronDownIcon className="w-4 h-4" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h3 className={`text-base font-medium transition-all ${isCategoryExpanded ? 'text-primary-700' : 'text-gray-700'}`}>
                              {group.categoryLabel}
                            </h3>
                            <span className="text-sm font-medium text-gray-500 tracking-tight">
                              {permissionGroups.length} active nodes
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MaterialButton
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBulkToggleCategory(group.category, true)
                            }}
                            className="bg-primary-50 text-blue-600 hover:bg-primary-100"
                          >
                            Enable all
                          </MaterialButton>
                          <MaterialButton
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBulkToggleCategory(group.category, false)
                            }}
                            className="bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            Disable all
                          </MaterialButton>
                        </div>
                      </div>

                      {/* Permissions Table */}
                      {isCategoryExpanded && permissionGroups.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-surface-variant/30">
                              <tr>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 tracking-tight w-1/4">
                                  Permission Node
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 tracking-tight w-1/4">
                                  Description
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 tracking-tight w-1/4">
                                  Access States
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 tracking-tight w-1/4">
                                  Advanced Filtering
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-50">
                              {permissionGroups.map((permGroup) => {
                                // Use selectedRole if available, otherwise find first available role's permission
                                // If multiple roles have this permission, they are all in the map as role:view/edit
                                const availableRoles = Array.from(new Set(Array.from(permGroup.permissions.keys()).map(k => k.split(':')[0])))
                                const roleToUse = (selectedRole && availableRoles.includes(selectedRole)) 
                                  ? selectedRole 
                                  : availableRoles[0]
                                
                                const viewPermission = permGroup.permissions.get(`${roleToUse}:view`)
                                const editPermission = permGroup.permissions.get(`${roleToUse}:edit`)
                                const rulePermission = viewPermission || editPermission

                                // Determine labels for checkboxes
                                let viewLabel = 'View'
                                let editLabel = 'Edit'
                                
                                if (permGroup.category === 'forms_and_data_fields') {
                                  viewLabel = 'Enabled'
                                } else if (permGroup.category === 'menu') {
                                  viewLabel = 'Show'
                                }

                                return (
                                  <tr key={permGroup.baseKey} className="hover:bg-blue-50/10 transition-all group">
                                    <td className="px-6 py-2 align-top">
                                      <div className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                                        {permGroup.label}
                                      </div>
                                      <div className="text-sm text-gray-500 font-mono mt-1 tracking-tight">
                                        {permGroup.baseKey}
                                      </div>
                                    </td>
                                    <td className="px-6 py-2 align-top">
                                      <div className="text-sm text-gray-500 leading-relaxed group-hover:text-gray-700 transition-colors">
                                        {permGroup.description || <span className="text-gray-600 italic">No documentation provided</span>}
                                      </div>
                                    </td>
                                    <td className="px-6 py-2 align-top">
                                      <div className="flex items-center gap-4">
                                        {/* View Checkbox */}
                                        {viewPermission && (
                                          <label className="flex items-center gap-2 cursor-pointer group/item">
                                            <div 
                                              onClick={() => handleTogglePermission(viewPermission)}
                                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                                (pendingChanges.has(viewPermission.id) ? pendingChanges.get(viewPermission.id)! : viewPermission.is_enabled)
                                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                                  : 'bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-200'
                                              }`}
                                            >
                                              {permGroup.category === 'menu' ? <SearchIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                            </div>
                                            <span className="text-sm font-medium tracking-tight text-gray-500 group-hover/item:text-blue-600 transition-colors">{viewLabel}</span>
                                          </label>
                                        )}
                                        {/* Edit Checkbox */}
                                        {editPermission && (
                                          <label className="flex items-center gap-2 cursor-pointer group/item">
                                            <div 
                                              onClick={() => handleTogglePermission(editPermission)}
                                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                                (pendingChanges.has(editPermission.id) ? pendingChanges.get(editPermission.id)! : editPermission.is_enabled)
                                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                                  : 'bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-200'
                                              }`}
                                            >
                                              <PencilIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium tracking-tight text-gray-500 group-hover/item:text-indigo-600 transition-colors">{editLabel}</span>
                                          </label>
                                        )}
                                        {/* Save Button */}
                                        {((viewPermission && (pendingChanges.has(viewPermission.id) || pendingRuleChanges.has(viewPermission.id))) || 
                                          (editPermission && (pendingChanges.has(editPermission.id) || pendingRuleChanges.has(editPermission.id)))) && (
                                          <MaterialButton
                                            onClick={() => {
                                              if (viewPermission && (pendingChanges.has(viewPermission.id) || pendingRuleChanges.has(viewPermission.id))) {
                                                handleSavePermission(viewPermission)
                                              }
                                              if (editPermission && (pendingChanges.has(editPermission.id) || pendingRuleChanges.has(editPermission.id))) {
                                                handleSavePermission(editPermission)
                                              }
                                            }}
                                            disabled={togglePermissionMutation.isPending}
                                            size="small"
                                            className="ml-2 !p-1.5 bg-primary-50 text-blue-600 border border-primary-100"
                                            title="Save node changes"
                                          >
                                            <SaveIcon className="w-4 h-4" />
                                          </MaterialButton>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-2 align-top">
                                      {rulePermission && (
                                        <div className="space-y-2">
                                          <MaterialButton
                                            variant="outlined"
                                            size="small"
                                            onClick={() => handleOpenRuleLookup(rulePermission)}
                                            startIcon={<SearchIcon className="w-3 h-3" />}
                                            className="bg-gray-50 text-gray-600 border border-gray-200 w-full justify-center"
                                          >
                                            Attach rules
                                          </MaterialButton>
                                          {/* Display selected rules */}
                                          {(() => {
                                            const selectedRules = pendingRuleChanges.get(rulePermission.id) || 
                                              ((rulePermission as any).data_filter_rule_ids || [])
                                            if (selectedRules.length > 0) {
                                              return (
                                                <div className="flex flex-wrap gap-1">
                                                  {selectedRules.map((rule: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 text-sm font-medium tracking-tight">
                                                      <span className="truncate max-w-[100px]">{rule.name || (businessRules?.find(r => r.id === rule.id)?.name) || rule.id}</span>
                                                      <button
                                                        onClick={() => {
                                                          setPendingRuleChanges((prev) => {
                                                            const next = new Map(prev)
                                                            const current = next.get(rulePermission.id) || []
                                                            next.set(rulePermission.id, current.filter((r: any) => r.id !== rule.id))
                                                            return next
                                                          })
                                                        }}
                                                        className="hover:text-indigo-800"
                                                      >
                                                        <XIcon className="w-2.5 h-2.5" />
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )
                                            }
                                            return null
                                          })()}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </MaterialCard>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Assign Users Modal - Material Design */}
        {assignUsersModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-md w-full mx-4 overflow-hidden border-none">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Assign Users</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Select users to assign to the <span className="font-bold text-blue-600">
                    {USER_ROLES.find(r => r.value === selectedRoleForAssign)?.label || selectedRoleForAssign}
                  </span> role.
                </p>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {usersForAssign?.map(u => (
                    <label 
                      key={u.id} 
                      className={`flex items-center gap-4 p-3 rounded-md border-2 transition-all cursor-pointer ${
                        selectedUserIds.has(u.id) 
                          ? 'border-primary-200 bg-primary-50 shadow-sm' 
                          : 'border-gray-50 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.id)}
                        onChange={(e) => {
                          const next = new Set(selectedUserIds)
                          if (e.target.checked) next.add(u.id)
                          else next.delete(u.id)
                          setSelectedUserIds(next)
                        }}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{u.name}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                      <MaterialChip label={u.role.replace('_', ' ')} size="small" variant="outlined" className="capitalize text-xs" />
                    </label>
                  ))}
                  {(!usersForAssign || usersForAssign.length === 0) && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <p className="text-sm text-gray-500">No available users found</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end mt-8">
                  <MaterialButton
                    variant="text"
                    onClick={() => {
                      setAssignUsersModalOpen(false)
                      setSelectedUserIds(new Set())
                    }}
                    className="text-gray-600"
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    onClick={handleAssignUsersSubmit}
                    disabled={assignUsersMutation.isPending || selectedUserIds.size === 0}
                    className="shadow-md-elevation-4"
                  >
                    {assignUsersMutation.isPending ? 'Assigning...' : 'Assign Users'}
                  </MaterialButton>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Rule Lookup Modal - Material Design */}
        {ruleLookupModalOpen && (ruleLookupPermission || ruleLookupRole) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border-none overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-2 border-b bg-surface-variant/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Select Data Filter Rules</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {ruleLookupPermission 
                      ? `${ruleLookupPermission.permission_label} - Select multiple rules to filter data`
                      : `Role: ${USER_ROLES.find(r => r.value === ruleLookupRole)?.label || ruleLookupRole} - Select multiple rules to filter data at role level`
                    }
                  </p>
                </div>
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => {
                    setRuleLookupModalOpen(false)
                    setRuleLookupPermission(null)
                    setRuleLookupRole(null)
                    setRuleLookupSearchTerm('')
                  }}
                  className="!p-2 text-gray-600 hover:text-gray-600"
                >
                  <XIcon className="w-5 h-5" />
                </MaterialButton>
              </div>

              {/* Search Bar */}
              <div className="px-6 py-2 border-b bg-background">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600" />
                  <input
                    type="text"
                    value={ruleLookupSearchTerm}
                    onChange={(e) => setRuleLookupSearchTerm(e.target.value)}
                    placeholder="Search rules by name, type, or ID..."
                    className="compact-input pl-10"
                  />
                </div>
              </div>

              {/* Rules List */}
              <div className="flex-1 overflow-y-auto px-6 py-2 bg-background">
                <div className="space-y-4">
                  {/* Business Rules */}
                  {businessRules && businessRules.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Business Rules</h4>
                      <div className="space-y-2">
                        {businessRules
                          .filter(r => r.is_active)
                          .filter(r => !ruleLookupSearchTerm || 
                            r.name.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase()) ||
                            r.rule_id.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase()) ||
                            r.description?.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase()) ||
                            r.condition_expression?.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase()) ||
                            r.action_expression?.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase())
                          )
                          .map((rule) => {
                            const selectedRules = ruleLookupPermission
                              ? (pendingRuleChanges.get(ruleLookupPermission.id) || [])
                              : (ruleLookupRole ? (pendingRoleRuleChanges.get(ruleLookupRole) || []) : [])
                            const isSelected = selectedRules.some((r: any) => r.id === rule.id)
                            return (
                              <label
                                key={rule.id}
                                className={`flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                                  isSelected ? 'bg-primary-50 border-primary-300 shadow-sm' : 'bg-white border-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleRuleSelect(rule.id, 'business_rule', rule.name, e.target.checked)}
                                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                                  <div className="text-xs text-gray-500 font-mono mt-0.5">ID: {rule.rule_id}</div>
                                  {rule.description && (
                                    <div className="text-sm text-gray-700 mt-2 font-medium">{rule.description}</div>
                                  )}
                                  {(rule.condition_expression || rule.action_expression) && (
                                    <div className="mt-2 space-y-1">
                                      {rule.condition_expression && (
                                        <div className="text-xs text-gray-600 bg-surface-variant/20 p-1.5 rounded-lg border border-outline/5">
                                          <span className="font-medium text-primary-700">Condition:</span> <span className="font-mono text-gray-700">{rule.condition_expression}</span>
                                        </div>
                                      )}
                                      {rule.action_expression && (
                                        <div className="text-xs text-gray-600 bg-surface-variant/20 p-1.5 rounded-lg border border-outline/5">
                                          <span className="font-medium text-secondary-700">Action:</span> <span className="font-mono text-gray-700">{rule.action_expression}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {rule.rule_type && (
                                    <div className="mt-2">
                                      <MaterialChip label={rule.rule_type} color="primary" size="small" variant="outlined" />
                                    </div>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Master Data Lists */}
                  {masterDataLists && masterDataLists.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Master Data Lists</h4>
                      <p className="text-xs text-gray-500 mb-2">Reference lists for attribute-based filtering</p>
                      <div className="space-y-2">
                        {masterDataLists
                          .filter(l => l.is_active)
                          .filter(l => !ruleLookupSearchTerm ||
                            l.name.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase()) ||
                            l.list_type.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase()) ||
                            l.description?.toLowerCase().includes(ruleLookupSearchTerm.toLowerCase())
                          )
                          .map((list) => {
                            const selectedRules = ruleLookupPermission
                              ? (pendingRuleChanges.get(ruleLookupPermission.id) || [])
                              : (ruleLookupRole ? (pendingRoleRuleChanges.get(ruleLookupRole) || []) : [])
                            const isSelected = selectedRules.some((r: any) => r.id === list.id)
                            return (
                              <label
                                key={list.id}
                                className={`flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                                  isSelected ? 'bg-primary-50 border-primary-300 shadow-sm' : 'bg-white border-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleRuleSelect(list.id, 'master_data', list.name, e.target.checked)}
                                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900">{list.name}</div>
                                  <div className="text-xs text-gray-500 font-mono mt-0.5">Type: {list.list_type}</div>
                                  {list.description && (
                                    <div className="text-sm text-gray-700 mt-2 font-medium">{list.description}</div>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {(!businessRules || businessRules.length === 0) && (!masterDataLists || masterDataLists.length === 0) && (
                    <div className="text-center py-12 bg-surface-variant/10 rounded-md border border-dashed border-gray-200">
                      <div className="text-gray-500">No rules available. Please create business rules or master data lists first.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-2 border-t flex items-center justify-between bg-surface-variant/5">
                <div className="text-sm text-gray-600 font-medium">
                  {(() => {
                    const selectedRules = ruleLookupPermission
                      ? (pendingRuleChanges.get(ruleLookupPermission.id) || [])
                      : (ruleLookupRole ? (pendingRoleRuleChanges.get(ruleLookupRole) || []) : [])
                    return `${selectedRules.length} rule${selectedRules.length !== 1 ? 's' : ''} selected`
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <MaterialButton
                    variant="text"
                    onClick={() => {
                      setRuleLookupModalOpen(false)
                      setRuleLookupSearchTerm('')
                    }}
                    className="text-gray-600"
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    onClick={handleSaveRules}
                    className="shadow-md-elevation-4"
                  >
                    Save Rules
                  </MaterialButton>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}
      </div>
    </Layout>
  )
}

