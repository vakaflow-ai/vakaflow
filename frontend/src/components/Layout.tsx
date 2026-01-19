import React, { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { actionsApi } from '../lib/actions'
import { rolePermissionsApi } from '../lib/rolePermissions'
import { 
  DashboardIcon, CatalogIcon, MarketplaceIcon, PlusIcon, DocumentIcon, 
  TicketIcon, SearchIcon, CheckCircleIcon, ClipboardIcon, ShieldCheckIcon,
  CogIcon, UsersIcon, BuildingIcon, ArrowUpIcon, ChartBarIcon, ArrowDownIcon,
  PlugIcon, LinkIcon, DocumentTextIcon, ChatIcon, LockIcon, AIPostureIcon, EcosystemMapIcon, InboxIcon, BookOpenIcon, DatabaseIcon
} from './Icons'

interface LayoutProps {
  children: ReactNode
  user?: any
}

interface NavGroup {
  title: string
  items: NavItem[]
}

interface NavItem {
  path: string
  label: string
  icon: string | React.ComponentType<{ className?: string }>
  show: boolean
}

export default function Layout({ children, user }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [manuallyCollapsedGroups, setManuallyCollapsedGroups] = useState<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const [tenantBranding, setTenantBranding] = useState<{ 
    logo_url?: string
    tenant_name?: string
    primary_color?: string
    secondary_color?: string
  } | null>(null)
  const [vendorBranding, setVendorBranding] = useState<{
    logo_url?: string
    vendor_name?: string
    branding?: {
      primary_color?: string
      secondary_color?: string
      header_background?: string
      header_text_color?: string
      sidebar_background?: string
      sidebar_text_color?: string
    }
  } | null>(null)

  // Apply simplified two-color system defaults
  useEffect(() => {
    const root = document.documentElement
    
    root.style.setProperty('--primary', '217 91% 60%')
    root.style.setProperty('--primary-foreground', '0 0% 100%')
    root.style.setProperty('--primary-light', '217 91% 96%')
    root.style.setProperty('--primary-dark', '217 91% 50%')
    
    root.style.setProperty('--neutral', '220 13% 18%')
    root.style.setProperty('--neutral-foreground', '0 0% 100%')
    root.style.setProperty('--neutral-light', '220 13% 96%')
    root.style.setProperty('--neutral-dark', '220 13% 10%')
    
    root.style.setProperty('--sidebar-bg', 'hsl(220, 13%, 18%)')
    root.style.setProperty('--sidebar-text', 'hsl(0, 0%, 100%)')
    root.style.setProperty('--sidebar-hover-bg', 'hsl(220, 13%, 25%)')
    
    root.style.setProperty('--header-bg', '#ffffff')
    root.style.setProperty('--header-text', 'hsl(220, 13%, 18%)')
    
    root.style.setProperty('--body-text-color', 'hsl(220, 13%, 18%)')
    root.style.setProperty('--body-text-secondary', 'hsl(220, 13%, 45%)')
    root.style.setProperty('--body-text-muted', 'hsl(220, 13%, 45%)')
  }, [user?.role])

  // Fetch tenant data for logo and name only
  const { data: brandingData } = useQuery({
    queryKey: ['tenant-branding', user?.tenant_id],
    queryFn: async () => {
      const data = await tenantsApi.getBranding()
      return data
    },
    enabled: !!user?.tenant_id && user?.role !== 'vendor_user',
    refetchOnWindowFocus: true,
    staleTime: 300000,
  })

  useEffect(() => {
    if (brandingData) {
      setTenantBranding({
        logo_url: brandingData.custom_branding?.logo_url || (brandingData as any).logo_url,
        tenant_name: brandingData.tenant_name,
      })
    }
  }, [brandingData])

  // Fetch vendor branding if user is vendor
  const { data: vendorBrandingData } = useQuery({
    queryKey: ['vendor-branding'],
    queryFn: async () => {
      const { vendorsApi } = await import('../lib/vendors')
      return await vendorsApi.getMyVendor()
    },
    enabled: !!user && user.role === 'vendor_user',
    retry: false,
  })

  useEffect(() => {
    if (vendorBrandingData) {
      setVendorBranding({
        logo_url: vendorBrandingData.logo_url,
        vendor_name: vendorBrandingData.name,
        branding: vendorBrandingData.branding,
      })
    }
  }, [vendorBrandingData])

  // Fetch action item counts for badge
  const { data: actionCounts } = useQuery({
    queryKey: ['action-item-counts'],
    queryFn: () => actionsApi.getCounts(),
    enabled: !!user?.tenant_id,
    refetchInterval: 30000,
    retry: 2
  })

  // Fetch tenant features for feature gating
  const { data: tenantFeatures = {} } = useQuery({
    queryKey: ['tenant-features', user?.tenant_id],
    queryFn: () => tenantsApi.getMyTenantFeatures(),
    enabled: !!user?.tenant_id,
    staleTime: 300000,
  })

  const canViewCVE = tenantFeatures.cve_tracking === true

  const isVendor = user?.role === 'vendor_user' || user?.role === 'vendor_coordinator'
  const isVendorCoordinator = user?.role === 'vendor_coordinator'
  const isReviewer = ['security_reviewer', 'compliance_reviewer', 'technical_reviewer', 'business_reviewer'].includes(user?.role)
  const isAdmin = ['tenant_admin', 'platform_admin'].includes(user?.role)
  const isApprover = user?.role === 'approver' || user?.role === 'tenant_admin' || user?.role === 'platform_admin'

  const isPolicyAdmin = ['tenant_admin', 'platform_admin', 'policy_admin'].includes(user?.role)
  const canViewPolicies = isPolicyAdmin || isReviewer || isVendor || user?.role === 'approver'
  const canViewAIPosture = ['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer'].includes(user?.role)
  
  // Analytics permissions
  const canViewAnalytics = isAdmin
  const canViewAssessmentAnalytics = isAdmin || isReviewer
  const canViewPredictiveAnalytics = isAdmin || isReviewer || isApprover

  // Fetch user permissions (only for non-admin roles)
  const { data: userPermissions } = useQuery({
    queryKey: ['user-permissions', user?.role, user?.tenant_id],
    queryFn: async () => {
      if (!user?.role) return null
      try {
        const permissions = await rolePermissionsApi.getMyPermissions()
        const permissionMap: Record<string, boolean> = {}
        permissions.forEach(p => {
          permissionMap[p.permission_key] = p.is_enabled
        })
        return permissionMap
      } catch (error) {
        console.error('Error fetching user permissions:', error)
        return {}
      }
    },
    enabled: !!user && !isAdmin,
    staleTime: 5 * 60 * 1000,
  })

  // Map menu paths to permission keys
  const pathToPermissionKey: Record<string, string> = {
    '/my-actions': 'menu.my_actions',
    '/vendor-dashboard': 'menu.vendor_dashboard',
    '/catalog': 'menu.catalog',
    '/marketplace': 'menu.marketplace',
    '/invite-vendor': 'menu.invite_vendor',
    '/my-vendors': 'menu.my_vendors',
    '/analytics': 'menu.analytics',
    '/assessments/analytics': 'menu.assessment_analytics',
    '/ai-posture': 'menu.ai_posture',
    '/ecosystem-map': 'menu.ecosystem_map',
    '/ecosystem-map-v2': 'menu.ecosystem_map_v2',
    '/agents/new': 'menu.submit_agent',
    '/submissions': 'menu.my_submissions',
    '/vendor/trust-center': 'menu.trust_center',
    '/tickets': 'menu.tickets',
    '/reviews': 'menu.reviews',
    '/incident-reports': 'menu.incident_reports',
    '/admin/incident-reports': 'menu.incident_reports',
    '/admin/policies': 'menu.policies',
    '/admin/rules': 'menu.business_rules',
    '/admin/users': 'menu.user_management',
    '/admin/tenants': 'menu.tenant_management',
    '/admin/role-permissions': 'menu.role_permissions',
    '/admin/master-data': 'menu.master_data',
    '/admin/custom-fields': 'menu.custom_fields',
    '/admin/entity-fields': 'menu.entity_fields',
    '/admin/integrations': 'menu.integrations',
    '/admin/platform-config': 'menu.platform_config',
    '/admin/cluster-nodes': 'menu.cluster_nodes',
    '/admin/logs': 'menu.application_logs',
    '/admin/export': 'menu.export_data',
    '/admin/webhooks': 'menu.webhooks',
    '/admin/predictive': 'menu.predictive_analytics',
    '/admin/recommendations': 'menu.recommendations',
    '/admin/audit': 'menu.audit_trail',
    '/admin/cve': 'menu.cve_tracking',
    '/admin/cve/dashboard': 'menu.cve_dashboard',
    '/admin/cve/settings': 'menu.cve_settings',
    '/studio': 'menu.studio',
    '/workflows': 'menu.workflow_management',
    '/workflows/templates': 'menu.workflow_templates',
    '/workflows/analytics': 'menu.workflow_analytics',
    '/form-designer': 'menu.form_designer',
    '/admin/request-types': 'menu.request_types',
    '/admin/forms': 'menu.form_library',
    '/assessments': 'menu.assessments',
    '/question-library': 'menu.question_library',
    '/submission-requirements': 'menu.submission_requirements',
    '/compliance': 'menu.compliance_checks',
    '/frameworks': 'menu.compliance_frameworks',
    '/agent-connections': 'menu.agent_connections',
    '/messages': 'menu.messages',
    '/profile': 'menu.profile',
    '/mfa': 'menu.mfa_settings',
    '/suppliers-master': 'menu.suppliers_master',
    '/products': 'menu.products',
    '/services': 'menu.services',
    // Workflow individual routes (used internally)
    '/workflow': 'menu.workflow_access',
  }

  const checkPermission = useCallback((path: string): boolean => {
    if (isAdmin) return true
    if (!userPermissions) return false
    const permissionKey = pathToPermissionKey[path]
    if (!permissionKey) return true // Allow if no permission key defined
    // For suppliers-master, also allow reviewers
    if (path === '/suppliers-master' && isReviewer) return true
    return userPermissions[permissionKey] === true
  }, [isAdmin, isReviewer, userPermissions])

  const handleLogout = async () => {
    try {
      await authApi.logout()
      localStorage.removeItem('access_token')
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      localStorage.removeItem('access_token')
      navigate('/login')
    }
  }

  const toggleGroup = useCallback((groupTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupTitle)) {
        newSet.delete(groupTitle)
        setManuallyCollapsedGroups(prev => new Set(prev).add(groupTitle))
      } else {
        newSet.add(groupTitle)
        setManuallyCollapsedGroups(prev => {
          const newSet = new Set(prev)
          newSet.delete(groupTitle)
          return newSet
        })
      }
      return newSet
    })
  }, [])

  // Define visibleGroups BEFORE useEffect that uses it
  const visibleGroups = useMemo(() => {
    const groups: NavGroup[] = []

    // Quick Access Section
    const quickAccessItems: NavItem[] = []
    if (checkPermission('/my-actions')) {
      quickAccessItems.push({ path: '/my-actions', label: 'My Actions', icon: InboxIcon, show: true })
    }
    if (isVendor && checkPermission('/vendor-dashboard')) {
      quickAccessItems.push({ path: '/vendor-dashboard', label: 'Vendor Dashboard', icon: DashboardIcon, show: true })
    }
    if (quickAccessItems.length > 0) {
      groups.push({ title: 'Quick Access', items: quickAccessItems })
    }

    // Discover & Browse Section
    const discoverItems: NavItem[] = []
    if (checkPermission('/catalog')) {
      discoverItems.push({ path: '/catalog', label: 'Agent Catalog', icon: CatalogIcon, show: true })
    }
    if (checkPermission('/marketplace')) {
      discoverItems.push({ path: '/marketplace', label: 'Marketplace', icon: MarketplaceIcon, show: true })
    }
    if (discoverItems.length > 0) {
      groups.push({ title: 'Discover & Browse', items: discoverItems })
    }

    // Create & Manage Section
    const createItems: NavItem[] = []
    if ((isAdmin || isVendor) && checkPermission('/onboarding')) {
      createItems.push({ path: '/onboarding', label: 'Onboarding Hub', icon: PlusIcon, show: true })
    }
    if (checkPermission('/agents/new')) {
      createItems.push({ path: '/agents/new', label: 'Submit Agent', icon: PlusIcon, show: true })
    }
    if (checkPermission('/submissions')) {
      createItems.push({ path: '/submissions', label: 'My Submissions', icon: DocumentIcon, show: true })
    }
    if (isAdmin && checkPermission('/products')) {
      createItems.push({ path: '/products', label: 'Products', icon: DocumentIcon, show: true })
    }
    if (isAdmin && checkPermission('/services')) {
      createItems.push({ path: '/services', label: 'Services', icon: DocumentIcon, show: true })
    }
    if (createItems.length > 0) {
      groups.push({ title: 'Create & Manage', items: createItems })
    }

    // Vendor Management Section
    const vendorItems: NavItem[] = []
    if (isAdmin && checkPermission('/invite-vendor')) {
      vendorItems.push({ path: '/invite-vendor', label: 'Invite Vendor', icon: PlusIcon, show: true })
    }
    if (isAdmin && checkPermission('/my-vendors')) {
      vendorItems.push({ path: '/my-vendors', label: 'My Vendors', icon: BuildingIcon, show: true })
    }
    if (isVendor && checkPermission('/vendor/trust-center')) {
      vendorItems.push({ path: '/vendor/trust-center', label: 'Trust Center', icon: ShieldCheckIcon, show: true })
    }
    if (vendorItems.length > 0) {
      groups.push({ title: 'Vendor Management', items: vendorItems })
    }

    // Assessments & Compliance Section
    const assessmentItems: NavItem[] = []
    if (checkPermission('/assessments')) {
      assessmentItems.push({ path: '/assessments', label: 'Assessments', icon: ClipboardIcon, show: true })
    }
    if (checkPermission('/question-library')) {
      assessmentItems.push({ path: '/question-library', label: 'Question Library', icon: BookOpenIcon, show: true })
    }
    if (checkPermission('/submission-requirements')) {
      assessmentItems.push({ path: '/submission-requirements', label: 'Submission Requirements', icon: DocumentIcon, show: true })
    }
    if (checkPermission('/compliance')) {
      assessmentItems.push({ path: '/compliance', label: 'Compliance Checks', icon: ShieldCheckIcon, show: true })
    }
    if (checkPermission('/frameworks')) {
      assessmentItems.push({ path: '/frameworks', label: 'Compliance Frameworks', icon: ShieldCheckIcon, show: true })
    }
    if (assessmentItems.length > 0) {
      groups.push({ title: 'Assessments & Compliance', items: assessmentItems })
    }

    // Workflows & Configuration Section
    const workflowItems: NavItem[] = []
    if (isAdmin && checkPermission('/workflows')) {
      workflowItems.push({ path: '/workflows', label: 'Workflow Management', icon: DocumentIcon, show: true })
    }
    if (isAdmin && checkPermission('/workflows/templates')) {
      workflowItems.push({ path: '/workflows/templates', label: 'Workflow Templates', icon: BookOpenIcon, show: true })
    }
    if (isAdmin && checkPermission('/workflows/analytics')) {
      workflowItems.push({ path: '/workflows/analytics', label: 'Workflow Analytics', icon: ChartBarIcon, show: true })
    }
    if (isAdmin && checkPermission('/form-designer')) {
      workflowItems.push({ path: '/form-designer', label: 'Form Designer', icon: DocumentTextIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/request-types')) {
      workflowItems.push({ path: '/admin/request-types', label: 'Request Types', icon: DocumentTextIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/forms')) {
      workflowItems.push({ path: '/admin/forms', label: 'Form Library', icon: DocumentIcon, show: true })
    }
    if (isAdmin && checkPermission('/studio')) {
      workflowItems.push({ path: '/studio', label: 'Studio', icon: CogIcon, show: true })
    }
    if (isAdmin && checkPermission('/agent-studio')) {
      workflowItems.push({ path: '/agent-studio', label: 'Agent Studio', icon: CogIcon, show: true })
    }
    if (workflowItems.length > 0) {
      groups.push({ title: 'Workflows & Configuration', items: workflowItems })
    }

    // Analytics Section
    const analyticsItems: NavItem[] = []
    if (canViewAnalytics && checkPermission('/analytics')) {
      analyticsItems.push({ path: '/analytics', label: 'Analytics Dashboard', icon: ChartBarIcon, show: true })
    }
    if (canViewAssessmentAnalytics && checkPermission('/assessments/analytics')) {
      analyticsItems.push({ path: '/assessments/analytics', label: 'Assessment Analytics', icon: ChartBarIcon, show: true })
    }
    if (canViewAIPosture && checkPermission('/ai-posture')) {
      analyticsItems.push({ path: '/ai-posture', label: 'AI Posture', icon: AIPostureIcon, show: true })
    }
    if (isAdmin && checkPermission('/ecosystem-map')) {
      analyticsItems.push({ path: '/ecosystem-map', label: 'Ecosystem Map (AI)', icon: EcosystemMapIcon, show: true })
    }
    if (isAdmin && checkPermission('/ecosystem-map-v2')) {
      analyticsItems.push({ path: '/ecosystem-map-v2', label: 'Ecosystem Map (Multi-View)', icon: EcosystemMapIcon, show: true })
    }
    if (analyticsItems.length > 0) {
      groups.push({ title: 'Analytics', items: analyticsItems })
    }

    // Operations Section
    const operationsItems: NavItem[] = []
    if (checkPermission('/tickets')) {
      operationsItems.push({ path: '/tickets', label: 'Tickets', icon: TicketIcon, show: true })
    }
    if (checkPermission('/reviews')) {
      operationsItems.push({ path: '/reviews', label: 'Reviews', icon: ClipboardIcon, show: true })
    }
    if (isAdmin && checkPermission('/incident-reports')) {
      operationsItems.push({ path: '/incident-reports', label: 'Incident Reports', icon: ShieldCheckIcon, show: true })
    }
    if (operationsItems.length > 0) {
      groups.push({ title: 'Operations', items: operationsItems })
    }

    // Integrations & Connections Section
    const integrationItems: NavItem[] = []
    if (isAdmin && checkPermission('/admin/integrations')) {
      integrationItems.push({ path: '/admin/integrations', label: 'Integrations', icon: PlugIcon, show: true })
    }
    if (checkPermission('/agent-connections')) {
      integrationItems.push({ path: '/agent-connections', label: 'Agent Connections', icon: LinkIcon, show: true })
    }
    if (integrationItems.length > 0) {
      groups.push({ title: 'Integrations & Connections', items: integrationItems })
    }

    // System Administration Section
    const systemItems: NavItem[] = []
    if (isAdmin && checkPermission('/admin/users')) {
      systemItems.push({ path: '/admin/users', label: 'User Management', icon: UsersIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/tenants')) {
      systemItems.push({ path: '/admin/tenants', label: 'Tenant Management', icon: BuildingIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/role-permissions')) {
      systemItems.push({ path: '/admin/role-permissions', label: 'Role Permissions', icon: LockIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/master-data')) {
      systemItems.push({ path: '/admin/master-data', label: 'Master Data', icon: DatabaseIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/custom-fields')) {
      systemItems.push({ path: '/admin/custom-fields', label: 'Custom Fields', icon: DocumentTextIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/entity-fields')) {
      systemItems.push({ path: '/admin/entity-fields', label: 'Entity Fields', icon: DocumentTextIcon, show: true })
    }
    if (canViewCVE && checkPermission('/admin/cve/dashboard')) {
      systemItems.push({ path: '/admin/cve/dashboard', label: 'CVE Dashboard', icon: ShieldCheckIcon, show: true })
    }
    if (canViewCVE && checkPermission('/admin/cve/settings')) {
      systemItems.push({ path: '/admin/cve/settings', label: 'CVE Settings', icon: CogIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/platform-config')) {
      systemItems.push({ path: '/admin/platform-config', label: 'Platform Config', icon: CogIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/cluster-nodes')) {
      systemItems.push({ path: '/admin/cluster-nodes', label: 'Cluster Nodes', icon: CogIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/webhooks')) {
      systemItems.push({ path: '/admin/webhooks', label: 'Webhooks', icon: LinkIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/predictive')) {
      systemItems.push({ path: '/admin/predictive', label: 'Predictive Analytics', icon: ChartBarIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/recommendations')) {
      systemItems.push({ path: '/admin/recommendations', label: 'Recommendations', icon: ArrowDownIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/audit')) {
      systemItems.push({ path: '/admin/audit', label: 'Audit Trail', icon: DocumentIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/logs')) {
      systemItems.push({ path: '/admin/logs', label: 'Application Logs', icon: DocumentIcon, show: true })
    }
    if (isAdmin && checkPermission('/admin/export')) {
      systemItems.push({ path: '/admin/export', label: 'Export Data', icon: ArrowUpIcon, show: true })
    }
    if (systemItems.length > 0) {
      groups.push({ title: 'System Administration', items: systemItems })
    }

    // Messages Section
    const messageItems: NavItem[] = []
    if (checkPermission('/messages')) {
      messageItems.push({ path: '/messages', label: 'Messages', icon: ChatIcon, show: true })
    }
    if (messageItems.length > 0) {
      groups.push({ title: 'Messages', items: messageItems })
    }

    return groups
  }, [user, isVendor, isAdmin, isReviewer, canViewAnalytics, canViewAssessmentAnalytics, canViewAIPosture, canViewCVE, checkPermission])

  // Initialize expanded groups based on current path - MUST be after visibleGroups definition
  useEffect(() => {
    if (!initializedRef.current && visibleGroups.length > 0) {
      const currentGroup = visibleGroups.find(group => 
        group.items.some(item => 
          location.pathname === item.path || 
          (item.path !== '/' && location.pathname.startsWith(item.path))
        )
      )
      if (currentGroup) {
        setExpandedGroups(new Set([currentGroup.title]))
      }
      initializedRef.current = true
    }
  }, [location.pathname, visibleGroups])

  const getRoleBadge = (role: string) => {
    const roleInfo: Record<string, { label: string; color: string }> = {
      platform_admin: { label: 'Platform Admin', color: 'bg-purple-100 text-purple-700 border border-purple-200' },
      tenant_admin: { label: 'Tenant Admin', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
      vendor_user: { label: 'Vendor', color: 'bg-green-100 text-green-700 border border-green-200' },
      vendor_coordinator: { label: 'Vendor Coordinator', color: 'bg-teal-100 text-teal-700 border border-teal-200' },
      security_reviewer: { label: 'Security Reviewer', color: 'bg-red-100 text-red-700 border border-red-200' },
      compliance_reviewer: { label: 'Compliance Reviewer', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
      technical_reviewer: { label: 'Technical Reviewer', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
      business_reviewer: { label: 'Business Reviewer', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
      approver: { label: 'Approver', color: 'bg-pink-100 text-pink-700 border border-pink-200' },
    }
    const info = roleInfo[role] || { label: role, color: 'bg-gray-100 text-gray-700 border border-gray-200' }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Sidebar */}
      {(() => {
        const root = document.documentElement
        const computedStyle = getComputedStyle(root)
        const sidebarBg = computedStyle.getPropertyValue('--sidebar-bg').trim() || '#1a1c1e'
        const sidebarHeaderBg = computedStyle.getPropertyValue('--sidebar-header-bg').trim() || '#1a1c1e'
        const sidebarText = computedStyle.getPropertyValue('--sidebar-text').trim() || '#e2e2e6'
        const sidebarHoverBg = computedStyle.getPropertyValue('--sidebar-hover-bg').trim() || '#2f3033'
        const sidebarBorder = computedStyle.getPropertyValue('--sidebar-border').trim() || '#44474e'
        
        return (
          <aside 
            key={`sidebar-${sidebarBg}-${sidebarText}`}
            className={`${sidebarOpen ? 'w-72' : 'w-20'} transition-all duration-300 flex-shrink-0 sticky top-0 h-screen flex flex-col border-r`}
            style={{
              backgroundColor: sidebarBg,
              color: sidebarText,
              borderColor: '#e5e7eb',
            }}
          >
            {/* Sidebar Header */}
            <div 
              className="h-16 flex items-center justify-between px-5 border-b flex-shrink-0"
              style={{
                backgroundColor: sidebarBg,
                borderColor: '#e5e7eb',
              }}
            >
              {sidebarOpen && (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {(user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url)) ? (
                    <img 
                      src={user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url)} 
                      alt={user?.role === 'vendor_user' ? vendorBranding?.vendor_name || 'Logo' : tenantBranding?.tenant_name || 'Logo'} 
                      className="h-8 w-8 object-contain flex-shrink-0 rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">V</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h1 
                      className="text-[15px] font-semibold truncate leading-tight"
                      style={{ 
                        color: sidebarText
                      }}
                      title={user?.role === 'vendor_user' ? (vendorBranding?.vendor_name || 'Vendor Portal') : (tenantBranding?.tenant_name || 'VAKA')}
                    >
                      {user?.role === 'vendor_user' ? (vendorBranding?.vendor_name || 'Vendor Portal') : (tenantBranding?.tenant_name || 'VAKA')}
                    </h1>
                    <p 
                      className="text-xs font-medium truncate leading-tight mt-0.5 opacity-75"
                      style={{ color: sidebarText }}
                    >
                      Agent Platform
                    </p>
                  </div>
                </div>
              )}
              {!sidebarOpen && (
                <div className="flex items-center justify-center w-full">
                  {(user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url || (brandingData as any)?.logo_url)) ? (
                    <img 
                      src={user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url || (brandingData as any)?.logo_url)} 
                      alt={user?.role === 'vendor_user' ? vendorBranding?.vendor_name || 'Logo' : tenantBranding?.tenant_name || 'Logo'} 
                      className="h-10 w-10 object-contain rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
                      <span className="text-white text-lg font-bold">V</span>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-md transition-colors shrink-0 ml-2 hover:bg-white/10"
                style={{
                  color: sidebarText,
                }}
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  )}
                </svg>
              </button>
            </div>

            {/* Navigation Groups - Pure Tree Structure */}
            <nav className="flex-1 overflow-y-auto py-4 px-5 sidebar-scrollbar">
              {visibleGroups.map((group, groupIndex) => {
                const isExpanded = expandedGroups.has(group.title)
                return (
                  <div key={groupIndex} className="mb-4">
                    {sidebarOpen && (
                      <div
                        onClick={(e) => toggleGroup(group.title, e)}
                        className="flex items-center justify-between py-1.5 cursor-pointer select-none transition-opacity duration-150"
                        style={{
                          color: sidebarText,
                          opacity: 0.85,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.85'
                        }}
                      >
                        <span className="text-[15px] font-semibold tracking-tight">
                          {group.title}
                        </span>
                        <span className="text-[10px] leading-none" style={{ opacity: 0.4 }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    )}
                    {(!sidebarOpen || isExpanded) && (
                      <div className="mt-0.5 space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.path || 
                            (item.path !== '/' && location.pathname.startsWith(item.path))
                          const badgeCount = item.path === '/my-actions' ? (actionCounts?.pending || 0) : null
                          
                          return (
                            <div
                              key={item.path}
                              onClick={() => navigate(item.path)}
                              className="py-1 cursor-pointer select-none transition-all duration-150"
                              style={{
                                color: isActive ? 'hsl(var(--primary))' : sidebarText,
                                opacity: isActive ? 1 : 0.65,
                                paddingLeft: sidebarOpen ? '1.5rem' : '0',
                                fontSize: sidebarOpen ? '14px' : '14px',
                                fontWeight: isActive ? 500 : 400,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1'
                                if (!isActive) {
                                  e.currentTarget.style.color = sidebarText
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.opacity = '0.65'
                                  e.currentTarget.style.color = sidebarText
                                }
                              }}
                              title={!sidebarOpen ? item.label : undefined}
                            >
                              {sidebarOpen ? (
                                <span className="flex items-center gap-2.5">
                                  <span className="truncate">{item.label}</span>
                                  {badgeCount !== null && badgeCount > 0 && (
                                    <span 
                                      className="text-xs font-medium flex-shrink-0"
                                      style={{ 
                                        color: 'hsl(var(--destructive))',
                                        opacity: 1
                                      }}
                                    >
                                      {badgeCount > 99 ? '99+' : badgeCount}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="flex items-center justify-center">
                                  {typeof item.icon === 'string' ? (
                                    <span className="text-lg">{item.icon}</span>
                                  ) : (
                                    React.createElement(item.icon, { className: "w-4 h-4" })
                                  )}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </aside>
        )
      })()}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header 
          className="h-16 border-b flex-shrink-0 z-40 relative bg-white"
          style={{
            borderBottomColor: '#e5e7eb',
          }}
        >
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-slate-800">
                {visibleGroups
                  .flatMap(g => g.items)
                  .find(item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)))?.label || 'Dashboard'}
              </h2>
            </div>
            
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                    <div className="text-xs text-slate-600">{getRoleBadge(user.role)}</div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                        style={{
                          background: 'hsl(var(--primary))'
                        }}
                      >
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showUserMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowUserMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                          <div className="px-4 py-3 border-b border-slate-200">
                            <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-600 mt-1">{user.email}</div>
                            <div className="mt-2">{getRoleBadge(user.role)}</div>
                          </div>
                          <div className="py-2">
                            <button
                              onClick={() => {
                                setShowUserMenu(false)
                                navigate('/profile')
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Profile Settings
                            </button>
                            <button
                              onClick={handleLogout}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              Logout
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50" style={{ height: 'calc(100vh - 64px)' }}>
          <div className="p-6">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="h-12 border-t border-slate-200 bg-white flex-shrink-0">
          <div className="h-full px-6 flex items-center justify-between">
            <div className="text-xs text-slate-600">
              © 2024 VAKA Agent Platform. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-600">
              <a href="#" className="hover:text-slate-900 transition-colors">Documentation</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Support</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
