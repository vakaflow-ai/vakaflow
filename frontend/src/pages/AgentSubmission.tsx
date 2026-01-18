import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactQuillWrapper from '../components/ReactQuillWrapper'
import JsonFieldInput from '../components/JsonFieldInput'
import DiagramFieldInput from '../components/DiagramFieldInput'
import { agentsApi } from '../lib/agents'
import { authApi } from '../lib/auth'
import { submissionRequirementsApi, SubmissionRequirement } from '../lib/submissionRequirements'
import { frameworksApi, RequirementTree, RequirementResponse } from '../lib/frameworks'
import { agentConnectionsApi, ConnectionCreate } from '../lib/agentConnections'
import { formLayoutsApi, FormLayout, CustomField, SectionDefinition } from '../lib/formLayouts'
import { masterDataListsApi, MasterDataList } from '../lib/masterDataLists'
import RequirementTreeComponent from '../components/RequirementTree'
import Layout from '../components/Layout'
import PageContainer, { PageHeader } from '../components/PageContainer'
import OnboardingSidebar from '../components/OnboardingSidebar'
import OnboardingWorkflowPanel from '../components/OnboardingWorkflowPanel'
import MermaidDiagram from '../components/MermaidDiagram'
import { showToast } from '../utils/toast'
import SearchableSelect, { SearchableSelectOption } from '../components/material/SearchableSelect'
import { 
  DEFAULT_VENDOR_STEPS, 
  getBasicInformationStepNumber,
  getStandardFieldsForStep 
} from '../config/formLayoutConfig'

// Mapping of LLM vendors to their available models
const VENDOR_MODELS: Record<string, string[]> = {
  'OpenAI': ['GPT-4', 'GPT-4 Turbo', 'GPT-3.5-turbo', 'GPT-4o'],
  'Anthropic': ['Claude-3-Opus', 'Claude-3-Sonnet', 'Claude-3-Haiku'],
  'Google': ['Gemini-Pro', 'Gemini-Ultra', 'Gemini-1.5-Pro'],
  'Microsoft': ['Azure OpenAI'],
  'Meta': ['Llama-3', 'Llama-2'],
  'Amazon': ['Bedrock'],
  'Cohere': ['Command'],
  'Mistral AI': ['Mistral Large'],
  'Customer Choice': [], // Customer's own LLM - no predefined models
  'Other': [], // Other vendor - no predefined models
}

export default function AgentSubmission() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [user, setUser] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(params.id || null)
  const [requirementResponses, setRequirementResponses] = useState<Record<string, any>>({})
  const [frameworkResponses, setFrameworkResponses] = useState<Record<string, RequirementResponse>>({})

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Initialize agentId from URL params if editing existing agent
  useEffect(() => {
    if (params.id) {
      setAgentId(params.id)
    }
  }, [params.id])

  // Simplified form data structure - removed redundant fields
  const [formData, setFormData] = useState({
    // Agent Details
    name: '',
    type: '',
    category: '',
    description: '',
    version: '',
    
    // AI Configuration
    llm_vendor: '',
    llm_model: '', // Simplified to single model
    llm_model_custom: '', // Custom model name when "Custom" is selected
    deployment_type: '',
    
    // Data & Operations
    data_types: [] as string[], // Consolidated: includes PII, PHI, Financial, etc.
    capabilities: '', // What the agent does (rich text)
    regions: [] as string[], // Operational regions
    
    // Integrations
    connections: [] as ConnectionCreate[],
    mermaid_diagram: '', // Architecture diagram
    
    // Rich text fields
    use_cases: '', // Use cases (rich text)
    personas: '', // Target personas (rich text)
    features: '', // Features (rich text)
    version_info: {
      release_notes: '',
      changelog: '',
      compatibility: '',
      known_issues: ''
    },
    
    // Additional fields
    subcategory: '',
    data_sharing_scope: {
      shares_pii: false,
      shares_phi: false,
      shares_financial_data: false,
      shares_biometric_data: false,
      data_retention_period: '',
      data_processing_location: [] as string[]
    },
    data_usage_purpose: ''
  })

  // Removed capabilityInput, useCaseInput, featureInput, personaInput - now using rich text editors directly
  const [dataTypeInput, setDataTypeInput] = useState('')
  const [regionInput, setRegionInput] = useState('')
  
  // Connection state
  const [connectionInput, setConnectionInput] = useState<ConnectionCreate>({
    name: '',
    app_name: '',
    app_type: '',
    connection_type: 'cloud',
    protocol: '',
    endpoint_url: '',
    authentication_method: '',
    description: '',
    data_types_exchanged: [],
    data_flow_direction: 'bidirectional',
    source_system: 'Agent',
    destination_system: '',
    data_classification: '',
    is_encrypted: true,
    is_required: true,
  })
  // State for mermaid diagram fields (supports multiple diagram fields)
  const [editingMermaidDiagrams, setEditingMermaidDiagrams] = useState<Record<string, boolean>>({})
  const [editedMermaidDiagrams, setEditedMermaidDiagrams] = useState<Record<string, string>>({})
  const [frameworkRecommendations, setFrameworkRecommendations] = useState<any>(null)
  const [editingConnectionIndex, setEditingConnectionIndex] = useState<number | null>(null)
  const [connectionDiagram, setConnectionDiagram] = useState<string>('')
  const [isEditingConnectionDiagram, setIsEditingConnectionDiagram] = useState(false)
  const [editedConnectionDiagram, setEditedConnectionDiagram] = useState<string>('')
  
  // Predefined options for multiselect
  const dataTypeOptions = [
    'PII', 'PHI', 'Financial Data', 'Payment Card Data', 'Biometric Data',
    'Location Data', 'Behavioral Data', 'Health Data', 'Educational Records',
    'Employment Records', 'Government ID', 'Social Security Number', 'Credit Information'
  ]
  
  const regionOptions = [
    'US', 'EU', 'UK', 'APAC', 'Canada', 'Australia', 'Brazil', 'Mexico',
    'India', 'China', 'Japan', 'South Korea', 'Singapore', 'Global'
  ]
  
  // Agent category options with subcategories
  const categoryOptions: Record<string, string[]> = {
    'Security & Compliance': [
      'IT Security',
      'OT Security',
      'Physical Security',
      'Information Security',
      'Cybersecurity',
      'Network Security',
      'Cloud Security',
      'Application Security',
      'Data Security',
      'Compliance Management',
      'Risk Management',
      'Audit & Assessment',
      'Identity & Access Management',
      'Security Operations',
      'Other'
    ],
    'Financial Trading': [
      'Algorithmic Trading',
      'High-Frequency Trading',
      'Risk Management',
      'Portfolio Management',
      'Market Analysis',
      'Trade Execution',
      'Regulatory Compliance',
      'Other'
    ],
    'Healthcare': [
      'Clinical Decision Support',
      'Patient Care',
      'Medical Records',
      'Telemedicine',
      'Medical Imaging',
      'Pharmacy Management',
      'Health Data Analytics',
      'Regulatory Compliance',
      'Other'
    ],
    'Customer Support': [
      'Help Desk',
      'Live Chat',
      'Ticket Management',
      'Customer Service',
      'FAQ Management',
      'Customer Feedback',
      'Other'
    ],
    'Sales & Marketing': [
      'Lead Generation',
      'CRM',
      'Email Marketing',
      'Social Media Marketing',
      'Content Marketing',
      'Sales Automation',
      'Market Research',
      'Other'
    ],
    'Human Resources': [
      'Recruitment',
      'Talent Management',
      'Performance Management',
      'Payroll',
      'Benefits Administration',
      'Employee Engagement',
      'Learning & Development',
      'Other'
    ],
    'IT Operations': [
      'Infrastructure Management',
      'DevOps',
      'Cloud Operations',
      'Monitoring & Alerting',
      'Incident Management',
      'Configuration Management',
      'Automation',
      'Other'
    ],
    'Data Analytics': [
      'Business Intelligence',
      'Data Visualization',
      'Predictive Analytics',
      'Machine Learning',
      'Data Warehousing',
      'ETL',
      'Reporting',
      'Other'
    ],
    'E-commerce': [
      'Online Store',
      'Payment Processing',
      'Inventory Management',
      'Order Management',
      'Shipping & Logistics',
      'Product Recommendations',
      'Other'
    ],
    'Education': [
      'Learning Management',
      'Student Information Systems',
      'Online Learning',
      'Assessment & Testing',
      'Curriculum Management',
      'Other'
    ],
    'Legal': [
      'Contract Management',
      'Document Review',
      'Case Management',
      'Compliance',
      'Legal Research',
      'Other'
    ],
    'Real Estate': [
      'Property Management',
      'Real Estate Listings',
      'Transaction Management',
      'Market Analysis',
      'Other'
    ],
    'Manufacturing': [
      'Production Planning',
      'Quality Control',
      'Supply Chain',
      'Inventory Management',
      'Equipment Management',
      'Other'
    ],
    'Supply Chain': [
      'Logistics',
      'Warehouse Management',
      'Transportation',
      'Procurement',
      'Demand Planning',
      'Other'
    ],
    'Energy & Utilities': [
      'Grid Management',
      'Energy Trading',
      'Renewable Energy',
      'Smart Metering',
      'Other'
    ],
    'Telecommunications': [
      'Network Management',
      'Service Provisioning',
      'Customer Management',
      'Billing',
      'Other'
    ],
    'Transportation': [
      'Fleet Management',
      'Route Optimization',
      'Logistics',
      'Public Transit',
      'Other'
    ],
    'Government': [
      'Citizen Services',
      'Public Safety',
      'Administration',
      'Regulatory',
      'Other'
    ],
    'Non-Profit': [
      'Donor Management',
      'Volunteer Management',
      'Program Management',
      'Fundraising',
      'Other'
    ],
    'Research & Development': [
      'Research Management',
      'Innovation',
      'Product Development',
      'Other'
    ],
    'Entertainment': [
      'Content Management',
      'Streaming',
      'Gaming',
      'Other'
    ],
    'Media & Publishing': [
      'Content Management',
      'Digital Publishing',
      'Media Production',
      'Other'
    ],
    'Insurance': [
      'Claims Processing',
      'Underwriting',
      'Policy Management',
      'Risk Assessment',
      'Other'
    ],
    'Banking': [
      'Core Banking',
      'Digital Banking',
      'Loan Management',
      'Fraud Detection',
      'Other'
    ],
    'Retail': [
      'Point of Sale',
      'Inventory Management',
      'Customer Management',
      'Other'
    ],
    'Hospitality': [
      'Hotel Management',
      'Restaurant Management',
      'Booking Systems',
      'Other'
    ],
    'Agriculture': [
      'Farm Management',
      'Crop Monitoring',
      'Livestock Management',
      'Other'
    ],
    'Construction': [
      'Project Management',
      'Resource Planning',
      'Safety Management',
      'Other'
    ],
    'Aerospace': [
      'Flight Operations',
      'Maintenance',
      'Safety',
      'Other'
    ],
    'Defense': [
      'Command & Control',
      'Intelligence',
      'Logistics',
      'Other'
    ],
    'Automotive': [
      'Manufacturing',
      'Supply Chain',
      'Quality Control',
      'Other'
    ],
    'Pharmaceuticals': [
      'Research',
      'Manufacturing',
      'Regulatory Compliance',
      'Other'
    ],
    'Biotechnology': [
      'Research',
      'Development',
      'Manufacturing',
      'Other'
    ],
    'Other': []
  }
  
  // Note: categorySearch, subcategorySearch, and dropdown states removed
  // SearchableSelect component now manages its own internal state
  
  // Get subcategories for selected category from field_config
  const getSubcategories = () => {
    if (!formData.category) {
      return []
    }
    // Get subcategory field from available fields
    const subcategoryField = availableFieldsMap.get('subcategory')
    const fieldConfig = (subcategoryField as any)?.field_config || {}
    const dependentOptions = fieldConfig.dependent_options || {}
    const subcategories = dependentOptions[formData.category] || []
    
    // Convert to array of strings
    return subcategories.map((opt: any) => typeof opt === 'string' ? opt : (opt.value || opt.label))
  }
  
  // Generate diagram and framework recommendations
  const generateDiagramPreview = useCallback(async (connections: any[]) => {
    if (connections.length === 0) {
      setConnectionDiagram('')
      return
    }

    try {
      // Generate diagram preview
      const diagramResult = await agentConnectionsApi.generateDiagram(
        formData.name || 'Agent',
        connections
      )
      setConnectionDiagram(diagramResult.mermaid_diagram)
    } catch (error) {
      console.error('Failed to generate diagram preview:', error)
    }
  }, [formData.name])

  const generateDiagramAndRecommendations = async () => {
    if (formData.connections.length === 0) {
      setConnectionDiagram('')
      setFrameworkRecommendations(null)
      return
    }
    
    try {
      // Generate diagram
      const diagramResult = await agentConnectionsApi.generateDiagram(
        formData.name || 'Agent',
        formData.connections
      )
      setConnectionDiagram(diagramResult.mermaid_diagram)
      
      // Get framework recommendations
      const recommendations = await agentConnectionsApi.getFrameworkRecommendations(
        formData.connections,
        formData.category,
        undefined // Removed subcategory
      )
      setFrameworkRecommendations(recommendations)
    } catch (error) {
      console.error('Failed to generate diagram/recommendations:', error)
    }
  }

  // Generate comprehensive Mermaid diagram from all agent data
  const generateComprehensiveMermaidDiagram = (fieldName: string): string => {
    const agentName = formData.name || 'Agent'
    const agentType = formData.type || 'AI_AGENT'
    const agentCategory = formData.category || 'General'
    
    // Helper to sanitize node IDs
    const sanitizeId = (name: string): string => {
      if (!name) return 'UNKNOWN'
      return name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toUpperCase() || 'UNKNOWN'
    }
    
    // Helper to escape labels
    const escapeLabel = (text: string): string => {
      return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    
    const agentId = sanitizeId(agentName)
    const lines: string[] = ['graph TB']
    
    // Add agent as central node
    lines.push(`    ${agentId}["🤖 ${escapeLabel(agentName)}<br/>Type: ${escapeLabel(agentType)}<br/>Category: ${escapeLabel(agentCategory)}"]`)
    
    // Add LLM vendor and model information
    if (formData.llm_vendor) {
      const llmId = sanitizeId(`LLM_${formData.llm_vendor}`)
      const llmLabel = `LLM Provider<br/>${escapeLabel(formData.llm_vendor)}`
      if (formData.llm_model) {
        lines.push(`    ${llmId}["${llmLabel}<br/>Model: ${escapeLabel(formData.llm_model)}"]`)
        lines.push(`    ${llmId} -->|uses| ${agentId}`)
      } else {
        lines.push(`    ${llmId}["${llmLabel}"]`)
        lines.push(`    ${llmId} -->|uses| ${agentId}`)
      }
    }
    
    // Add deployment information
    if (formData.deployment_type) {
      const deployId = sanitizeId(`DEPLOY_${formData.deployment_type}`)
      lines.push(`    ${deployId}["Deployment<br/>${escapeLabel(formData.deployment_type)}"]`)
      lines.push(`    ${deployId} -->|hosts| ${agentId}`)
    }
    
    // Add connections and integrations
    if (formData.connections && formData.connections.length > 0) {
      formData.connections.forEach((conn: any, idx: number) => {
        const connName = conn.app_name || conn.name || `Connection_${idx + 1}`
        const connId = sanitizeId(`CONN_${connName}_${idx}`)
        const connLabel = `${escapeLabel(connName)}<br/>${conn.app_type ? escapeLabel(conn.app_type) : ''}<br/>${conn.connection_type ? escapeLabel(conn.connection_type) : ''}`
        
        lines.push(`    ${connId}["${connLabel}"]`)
        
        const direction = conn.data_flow_direction || 'bidirectional'
        if (direction === 'inbound' || direction === 'bidirectional') {
          lines.push(`    ${connId} -->|inbound| ${agentId}`)
        }
        if (direction === 'outbound' || direction === 'bidirectional') {
          lines.push(`    ${agentId} -->|outbound| ${connId}`)
        }
      })
    }
    
    // Add data types
    if (formData.data_types && formData.data_types.length > 0) {
      const dataTypesId = sanitizeId('DATA_TYPES')
      const dataTypesLabel = `Data Types<br/>${escapeLabel(formData.data_types.join(', '))}`
      lines.push(`    ${dataTypesId}["${dataTypesLabel}"]`)
      lines.push(`    ${agentId} -->|processes| ${dataTypesId}`)
    }
    
    // Add regions
    if (formData.regions && formData.regions.length > 0) {
      const regionsId = sanitizeId('REGIONS')
      const regionsLabel = `Regions<br/>${escapeLabel(formData.regions.join(', '))}`
      lines.push(`    ${regionsId}["${regionsLabel}"]`)
      lines.push(`    ${agentId} -->|operates in| ${regionsId}`)
    }
    
    // Data types already included above - no need for separate data_sharing_scope
    
    return lines.join('\n')
  }
  
  // Auto-generate diagram when connections change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.connections.length > 0 && currentStep === 5) {
        generateDiagramAndRecommendations()
      } else if (formData.connections.length === 0 && currentStep === 5) {
        setConnectionDiagram('')
        setFrameworkRecommendations(null)
      }
    }, 500) // Debounce by 500ms
    
    return () => clearTimeout(timer)
  }, [formData.connections, currentStep])

  // Fetch existing agent data if agentId is present (loading draft)
  const { data: existingAgent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId && !!user,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  })

  // Load existing agent data into form when available
  useEffect(() => {
    if (existingAgent && !agentLoading) {
      const connectionDiagramValue = (existingAgent as any).architecture_info?.connection_diagram || ''
      setFormData(prev => ({
        ...prev,
        name: existingAgent.name || '',
        type: existingAgent.type || '',
        category: existingAgent.category || '',
        description: existingAgent.description || '',
        version: existingAgent.version || '',
        llm_vendor: existingAgent.llm_vendor || '',
        llm_model: typeof existingAgent.llm_model === 'string' ? existingAgent.llm_model : '',
        deployment_type: existingAgent.deployment_type || '',
        data_types: Array.isArray((existingAgent as any).data_types) ? (existingAgent as any).data_types : [],
        capabilities: typeof (existingAgent as any).capabilities === 'string' 
          ? (existingAgent as any).capabilities 
          : Array.isArray((existingAgent as any).capabilities) 
            ? (existingAgent as any).capabilities.join('\n') 
            : '',
        regions: Array.isArray((existingAgent as any).regions) ? (existingAgent as any).regions : [],
        connections: Array.isArray((existingAgent as any).connections) ? (existingAgent as any).connections : [],
        mermaid_diagram: (existingAgent as any).mermaid_diagram || '',
        connection_diagram: connectionDiagramValue,
      }))
      // Sync connectionDiagram state with loaded value
      setConnectionDiagram(connectionDiagramValue)
    }
  }, [existingAgent, agentLoading])

  // Fetch active screen layout for vendor submissions
  const queryClient = useQueryClient()
  const layoutPopulatedRef = useRef(false) // Prevent multiple auto-population attempts
  const singleSectionWarningLoggedRef = useRef<string | null>(null) // Track if single-section warning has been logged for this layout
  const layoutSectionsProcessedRef = useRef<string | null>(null) // Track if layout sections processing has been logged for this layout
  const fieldRenderingDebugLoggedRef = useRef<string | null>(null) // Track if field rendering debug has been logged for this layout+step
  const finalRenderedFieldsLoggedRef = useRef<string | null>(null) // Track if final rendered fields has been logged for this layout+step
  
  const { data: formLayout, isLoading: layoutLoading, error: layoutError, refetch: refetchLayout } = useQuery({
    queryKey: ['form-layout', 'vendor_submission_workflow', 'new', 'active'],
    queryFn: async () => {
      const layout = await formLayoutsApi.getActiveForScreen('vendor_submission_workflow', 'new')
      // Debug: Log the full layout response (commented out to reduce console noise)
      // console.log('🔍 Layout fetched from API (getActiveForScreen):', {
      //   id: layout.id,
      //   name: layout.name,
      //   sectionsCount: layout.sections?.length || 0,
      //   sections: layout.sections,
      //   sectionsDetail: layout.sections?.map((s: any) => ({
      //     id: s.id,
      //     title: s.title,
      //     order: s.order,
      //     fieldsCount: (s.fields || []).length,
      //     fields: s.fields
      //   })) || [],
      //   fullLayout: JSON.stringify(layout, null, 2)
      // })
      
      // If layout has only 1 section but we expect more, try fetching directly by ID to verify
      if (layout.sections && layout.sections.length === 1) {
        // console.warn('⚠️ Layout has only 1 section. Fetching directly by ID to verify...', layout.id)
        try {
          const directLayout = await formLayoutsApi.get(layout.id)
          // console.log('🔍 Layout fetched directly by ID:', {
          //   id: directLayout.id,
          //   name: directLayout.name,
          //   sectionsCount: directLayout.sections?.length || 0,
          //   sections: directLayout.sections,
          //   sectionsDetail: directLayout.sections?.map((s: any) => ({
          //     id: s.id,
          //     title: s.title,
          //     order: s.order,
          //     fieldsCount: (s.fields || []).length,
          //     fields: s.fields
          //   })) || []
          // })
          // If direct fetch has more sections, use that instead
          if (directLayout.sections && directLayout.sections.length > layout.sections.length) {
            console.warn('⚠️ Direct fetch returned more sections! Using direct fetch result.')
            return directLayout
          }
        } catch (error) {
          console.error('Failed to fetch layout directly by ID:', error)
        }
      }
      
      return layout
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data to ensure we get the latest layout with all sections
    gcTime: 0, // Don't cache to ensure we always get the latest from server
    // Note: onError is deprecated in newer versions of react-query, errors are handled via error state
  })

  // Mutation to update layout with default sections if it's empty
  const updateLayoutMutation = useMutation({
    mutationFn: (layoutUpdate: { id: string; sections: SectionDefinition[] }) => 
      formLayoutsApi.update(layoutUpdate.id, { sections: layoutUpdate.sections }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-layout', 'vendor_submission_workflow', 'new', 'active'] })
    },
    onError: (error: any) => {
      console.error('Failed to update layout:', error)
      if (error?.response?.status === 403) {
        const errorDetail = error?.response?.data?.detail || 'Access denied'
        console.warn('Access denied to update layout. It may belong to a different tenant.', {
          layoutId: formLayout?.id,
          layoutTenantId: formLayout?.tenant_id,
          userTenantId: user?.tenant_id,
          errorDetail
        })
        // Don't retry - mark as populated to prevent infinite loops
        layoutPopulatedRef.current = true
      } else {
        console.error('Layout update error details:', {
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message
        })
      }
    },
  })

  // Auto-populate sections for empty default layouts
  useEffect(() => {
    if (!formLayout || layoutLoading) return
    if (layoutPopulatedRef.current) return // Already attempted population
    if (formLayout.sections && formLayout.sections.length > 0) {
      layoutPopulatedRef.current = true // Mark as populated
      return // Already has sections
    }
    
    // Check user role - only tenant_admin and platform_admin can update layouts
    const allowedRoles = ['tenant_admin', 'platform_admin']
    if (!user?.role || !allowedRoles.includes(user.role)) {
      // Expected behavior: vendor users don't have permission to update layouts
      // Silently skip auto-population - this is normal, not an error
      layoutPopulatedRef.current = true // Mark as attempted to prevent retries
      return
    }
    
    // Check tenant_id match before attempting update
    if (user?.tenant_id && formLayout.tenant_id) {
      const userTenantStr = String(user.tenant_id)
      const layoutTenantStr = String(formLayout.tenant_id)
      
      if (userTenantStr !== layoutTenantStr) {
        // Tenant mismatch - skip auto-population to prevent 403 error
        // This is expected when layouts belong to different tenants
        layoutPopulatedRef.current = true // Mark as attempted to prevent retries
        return
      }
    }
    
    // Check by is_default flag OR by name (for backward compatibility)
    const isDefaultLayout = formLayout.is_default || 
      formLayout.name === 'Vendor Submission Layout (Default)-External'
    if (!isDefaultLayout) return // Only auto-populate default layouts
    if (updateLayoutMutation.isPending) return // Already updating
    
    // Mark as attempted to prevent re-runs
    layoutPopulatedRef.current = true
    
    // Create default sections from DEFAULT_VENDOR_STEPS
    const defaultSections: SectionDefinition[] = DEFAULT_VENDOR_STEPS.map((step) => ({
      id: `step-${step.id}`,
      title: step.title,
      description: step.description || '',
      order: step.id,
      fields: step.standardFields || [],
    }))
    
    // Update the layout in the database
    updateLayoutMutation.mutate({
      id: formLayout.id,
      sections: defaultSections,
    })
  }, [formLayout, layoutLoading, updateLayoutMutation, user?.tenant_id]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Reset ref when layout changes (new layout loaded)
  useEffect(() => {
    if (formLayout?.id) {
      // Reset ref if layout has sections (means it was successfully populated or already had sections)
      if (formLayout.sections && formLayout.sections.length > 0) {
        layoutPopulatedRef.current = true
      } else {
        layoutPopulatedRef.current = false
      }
    }
  }, [formLayout?.id])

  // Fetch submission requirements for tenant, filtered by agent category and type
  const { data: requirements, isLoading: requirementsLoading } = useQuery({
    queryKey: ['submission-requirements', formData.category, formData.type],
    queryFn: () => submissionRequirementsApi.list(
      undefined, // category filter
      undefined, // section filter
      undefined, // sourceType filter
      true, // isEnabled = true (only enabled requirements)
      formData.category || undefined, // Filter by agent category
      formData.type || undefined // Filter by agent type
    ),
    enabled: !!user,
  })
  
  // Fetch master data lists for dropdown binding
  const { data: masterDataLists } = useQuery({
    queryKey: ['master-data-lists'],
    queryFn: () => masterDataListsApi.list(undefined, true),
    enabled: !!user,
  })

  // Fetch available fields to render standard fields from layout
  const { data: availableFieldsData } = useQuery({
    queryKey: ['available-fields'],
    queryFn: async () => {
      const data = await formLayoutsApi.getAvailableFields()
      // Debug: Log type field from API response (commented out to reduce console noise)
      // if (data?.agent) {
      //   const typeField = data.agent.find((f: any) => f.field_name === 'type')
      //   if (typeField) {
      //     console.log('🔍 API Response - Type field:')
      //     console.log('  field_name:', typeField.field_name)
      //     console.log('  field_type:', typeField.field_type)
      //     console.log('  field_config:', typeField.field_config)
      //     console.log('  field_config.options:', typeField.field_config?.options)
      //     console.log('  field_config.options.length:', typeField.field_config?.options?.length)
      //     console.log('  Full field object:', typeField)
      //   } else {
      //     console.warn('⚠️ Type field not found in API response agent array')
      //     console.log('Available fields:', data.agent.map((f: any) => f.field_name))
      //   }
      // } else {
      //   console.warn('⚠️ API response has no agent array')
      //   console.log('Available data keys:', Object.keys(data || {}))
      // }
      return data
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data to get updated field_config
  })

  // Create a map of custom fields from the layout
  const customFieldsMap = new Map<string, CustomField>()
  if (formLayout?.custom_fields) {
    formLayout.custom_fields.forEach((cf: CustomField) => {
      customFieldsMap.set(cf.field_name, cf)
    })
  }
  
  // Create a map of master data lists by ID
  const masterDataListsMap = new Map<string, MasterDataList>()
  if (masterDataLists) {
    masterDataLists.forEach((list) => {
      masterDataListsMap.set(list.id, list)
    })
  }

  // Create a map of available fields by field_name for rendering standard fields
  const availableFieldsMap = new Map<string, any>()
  if (availableFieldsData) {
    // IMPORTANT: Process 'agent' array FIRST to ensure fields with field_config are prioritized
    // The agent array from API has the correct field_type='select' and field_config with options
    if (availableFieldsData.agent && Array.isArray(availableFieldsData.agent)) {
      availableFieldsData.agent.forEach((field: any) => {
        if (field && field.field_name) {
          availableFieldsMap.set(field.field_name, field)
        }
      })
    }
    
    // Then process other field sources, but don't overwrite if field already exists with field_config
    Object.entries(availableFieldsData).forEach(([sourceKey, fieldSource]: [string, any]) => {
      // Skip agent array as we already processed it
      if (sourceKey === 'agent') return
      
      if (Array.isArray(fieldSource)) {
        // Direct array of fields (submission_requirements, agent_metadata, custom_fields, master_data, etc.)
        fieldSource.forEach((field: any) => {
          if (field && field.field_name) {
            const existing = availableFieldsMap.get(field.field_name)
            // Only add if field doesn't exist, or if existing doesn't have field_config but this one does
            if (!existing || (!existing.field_config && field.field_config)) {
              availableFieldsMap.set(field.field_name, field)
            }
          }
        })
      } else if (fieldSource && typeof fieldSource === 'object') {
        // Nested object structure (like entity_fields: { "vendors": [...], "users": [...] })
        Object.values(fieldSource).forEach((entityFieldArray: any) => {
          if (Array.isArray(entityFieldArray)) {
            entityFieldArray.forEach((field: any) => {
              if (field && field.field_name) {
                const existing = availableFieldsMap.get(field.field_name)
                // Only add if field doesn't exist, or if existing doesn't have field_config but this one does
                if (!existing || (!existing.field_config && field.field_config)) {
                  availableFieldsMap.set(field.field_name, field)
                }
              }
            })
          }
        })
      }
    })
    
    // Debug: Log what's in the map for type and category fields (commented out to reduce console noise)
    // const typeFieldInMap = availableFieldsMap.get('type')
    // const categoryFieldInMap = availableFieldsMap.get('category')
    // if (typeFieldInMap) {
    //   console.log('🔍 Type field in availableFieldsMap:', {
    //     field_name: typeFieldInMap.field_name,
    //     field_type: typeFieldInMap.field_type,
    //     field_config: typeFieldInMap.field_config,
    //     field_config_options: typeFieldInMap.field_config?.options,
    //     field_config_options_length: typeFieldInMap.field_config?.options?.length
    //   })
    // } else {
    //   console.warn('⚠️ Type field NOT found in availableFieldsMap')
    // }
    // if (categoryFieldInMap) {
    //   console.log('🔍 Category field in availableFieldsMap:', {
    //     field_name: categoryFieldInMap.field_name,
    //     field_type: categoryFieldInMap.field_type,
    //     field_config: categoryFieldInMap.field_config,
    //     field_config_options: categoryFieldInMap.field_config?.options,
    //     field_config_options_length: categoryFieldInMap.field_config?.options?.length
    //   })
    // }
  }

  // Fetch framework requirements (only after agent is created)
  const { data: frameworkRequirements, isLoading: frameworkLoading } = useQuery({
    queryKey: ['framework-requirements', agentId],
    queryFn: () => frameworksApi.getAgentRequirements(agentId!),
    enabled: !!agentId && !!user,
  })

  // Fetch existing framework responses
  const { data: existingResponses } = useQuery({
    queryKey: ['framework-responses', agentId],
    queryFn: () => frameworksApi.getResponses(agentId!),
    enabled: !!agentId && !!user,
  })

  // Fetch existing requirement responses for draft
  const { data: existingRequirementResponses } = useQuery({
    queryKey: ['requirement-responses', agentId],
    queryFn: () => submissionRequirementsApi.getResponses(agentId!),
    enabled: !!agentId && !!user,
  })

  // Initialize framework responses from existing data
  useEffect(() => {
    if (existingResponses) {
      const responsesMap: Record<string, RequirementResponse> = {}
      existingResponses.forEach((resp) => {
        if (resp.rule_id) {
          responsesMap[resp.rule_id] = resp
        }
      })
      setFrameworkResponses(responsesMap)
    }
  }, [existingResponses])

  // Initialize requirement responses from existing data
  useEffect(() => {
    if (existingRequirementResponses && agentId) {
      const responsesMap: Record<string, any> = {}
      existingRequirementResponses.forEach((resp: any) => {
        if (resp.requirement_id) {
          responsesMap[resp.requirement_id] = resp.value
        }
      })
      setRequirementResponses(responsesMap)
    }
  }, [existingRequirementResponses, agentId])
  
  // Use steps from screen layout ONLY - no hardcoded fallback
  // If layout has no sections, show empty state or error message
  const layoutSections = (formLayout?.sections && formLayout.sections.length > 0)
    ? formLayout.sections 
    : []
  
  // Debug: Log sections to verify they're being loaded correctly - only log once per layout (commented out to reduce console noise)
  // if (formLayout && layoutSectionsProcessedRef.current !== formLayout.id) {
  //   layoutSectionsProcessedRef.current = formLayout.id
  //   console.log('📋 Processing layout sections:', {
  //     layoutId: formLayout.id,
  //     layoutName: formLayout.name,
  //     rawSectionsFromAPI: formLayout.sections,
  //     sectionsCount: formLayout.sections?.length || 0,
  //     layoutSectionsCount: layoutSections.length,
  //     layoutSections: layoutSections
  //   })
  // }
  
  // Sort sections by order
  const sortedLayoutSections = [...layoutSections].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  
  // Debug: Log layout sections to ensure all are loaded (only once when layout changes) - commented out to reduce console noise
  // useEffect(() => {
  //   if (formLayout && sortedLayoutSections.length > 0) {
  //     // Only log in development and use a ref to prevent duplicate logs
  //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //     // @ts-ignore - import.meta.env is a Vite feature
  //     // if ((import.meta as any).env?.DEV) {
  //     //   const sectionsDetail = sortedLayoutSections.map((s: any) => ({ 
  //     //     id: s.id, 
  //     //     title: s.title, 
  //     //     order: s.order, 
  //     //     fieldsCount: (s.fields || []).length,
  //     //     fields: s.fields || [],
  //     //     fieldsList: (s.fields || []).join(', ') || '(empty)'
  //     //   }))
  //     //   console.log('Layout sections loaded:', {
  //     //     layoutId: formLayout.id,
  //     //     layoutName: formLayout.name,
  //     //     sectionsCount: sortedLayoutSections.length,
  //     //     sections: sectionsDetail
  //     //   })
  //     //   console.log('Full layout sections (raw from API):', JSON.stringify(formLayout.sections, null, 2))
  //     // }
  //   }
  // }, [formLayout?.id, sortedLayoutSections.length]) // Only depend on ID and length, not the full array
  
  // Build STEPS array from configured sections
  // Use ONLY configured fields from the layout - respect what's configured
  const STEPS = sortedLayoutSections.map((section: any, idx: number) => {
    const stepNumber = idx + 1
    const configuredFields = Array.isArray(section.fields) ? section.fields : []
    
    // Use configured fields directly - no mixing with defaults
    // If a section has no fields configured, that's intentional (e.g., Compliance & Review uses submission requirements)
    return {
      id: stepNumber,
      title: section.title || (stepNumber === 1 ? 'Basic Information' : `Step ${stepNumber}`),
      description: section.description || '',
      fields: configuredFields,
      required_fields: Array.isArray(section.required_fields) ? section.required_fields : [],
    }
  })
  
  // Debug: Log STEPS to ensure all are created (only once when steps change)
  const prevStepsLengthRef = useRef<number>(0)
  useEffect(() => {
    if (STEPS.length > 0 && STEPS.length !== prevStepsLengthRef.current) {
      prevStepsLengthRef.current = STEPS.length
      // Only log in development
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - import.meta.env is a Vite feature
      // if ((import.meta as any).env?.DEV) {
      //   console.log('STEPS array created:', {
      //     totalSteps: STEPS.length,
      //     steps: STEPS.map((s: any) => ({ id: s.id, title: s.title, fieldsCount: (s.fields || []).length }))
      //   })
      // }
    }
  }, [STEPS.length])

  // Restore current step from draft after STEPS are available
  useEffect(() => {
    if (existingAgent && !agentLoading && STEPS.length > 0 && existingAgent.workflow_current_step) {
      const savedStep = existingAgent.workflow_current_step
      // Ensure saved step is within valid range
      if (savedStep >= 1 && savedStep <= STEPS.length) {
        setCurrentStep(savedStep)
      } else {
        // If saved step is out of bounds, set to last step
        console.warn(`Saved step ${savedStep} is out of bounds (1-${STEPS.length}), setting to step ${STEPS.length}`)
        setCurrentStep(STEPS.length)
      }
    }
  }, [existingAgent, agentLoading, STEPS.length])

  // Debug: Log step changes (only in development with verbose flag)
  const lastLoggedStepRef = useRef<{ step: number; layoutId?: string }>({ step: 0 })
  useEffect(() => {
    // Only log in development with verbose flag enabled
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta.env is a Vite feature
    const env = (import.meta as any).env
    if (env?.DEV && env?.VITE_VERBOSE_LOGS === 'true' && STEPS.length > 0) {
      const currentStepSection = STEPS[currentStep - 1]
      const stepLogKey = { step: currentStep, layoutId: formLayout?.id }
      const lastKey = lastLoggedStepRef.current
      
      // Only log if step or layout changed
      if (lastKey.step !== stepLogKey.step || lastKey.layoutId !== stepLogKey.layoutId) {
        lastLoggedStepRef.current = stepLogKey
        if (currentStepSection) {
          const fields = currentStepSection.fields || []
          console.log(`[AgentSubmission] Step ${currentStep} (${currentStepSection.title}):`, {
            totalFields: fields.length,
            layoutId: formLayout?.id?.substring(0, 8),
            layoutName: formLayout?.name,
            source: formLayout ? 'form_layout' : 'default_steps'
          })
        }
      }
    }
  }, [currentStep, formLayout?.id, STEPS])
  
  // If no sections configured, don't create hardcoded steps
  // Show error message instead - layout must be configured in Process Designer
  // Removed hardcoded fallback to force use of form designer layout

  // Requirements are now handled by backend service - no frontend grouping needed
  
  // Create a map of fields by step for efficient lookup
  const fieldsByStep = new Map<number, string[]>()
  STEPS.forEach((step: any) => {
    if (step.fields && Array.isArray(step.fields)) {
      fieldsByStep.set(step.id, step.fields)
    }
  })
  
  // Create requirements map for quick lookup
  const requirementsMap = new Map<string, SubmissionRequirement>()
  requirements?.forEach((req) => {
    requirementsMap.set(req.field_name, req)
  })

  const handleRequirementChange = (requirementId: string, value: any) => {
    setRequirementResponses(prev => ({
      ...prev,
      [requirementId]: value
    }))
  }

  const handleFrameworkResponseChange = (ruleId: string, response: RequirementResponse) => {
    setFrameworkResponses(prev => ({
      ...prev,
      [ruleId]: response
    }))
  }

  const getMissingFields = (step: number): string[] => {
    const missing: string[] = []
    switch (step) {
      case 1:
        if (!formData.name) missing.push('Name')
        if (!formData.type) missing.push('Type')
        if (!formData.version) missing.push('Version')
        break
      case 2:
        if (!formData.llm_vendor) {
          missing.push('LLM Vendor')
        } else {
          if (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') {
            if (!formData.llm_model) {
              missing.push('LLM Model')
            }
          } else {
            if (!formData.llm_model) {
              missing.push('LLM Model')
            } else if (formData.llm_model === 'Custom' && !formData.llm_model_custom) {
              missing.push('Custom LLM Model Name')
            }
          }
        }
        break
      case 8:
        if (requirements) {
          const requiredReqs = requirements.filter(r => r.is_required)
          requiredReqs.forEach(req => {
            const value = requirementResponses[req.id]
            if (value === undefined || value === null || value === '') {
              missing.push(req.label || req.id)
            }
          })
        }
        break
      default:
        break
    }
    return missing
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.name && formData.type && formData.version)
      case 2:
        // Validate LLM model based on vendor selection
        if (formData.llm_vendor) {
          // For Customer Choice or Other, require llm_model (which is now a text input)
          if (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') {
            return !!formData.llm_model
          }
          // For other vendors, require a model selected
          if (!formData.llm_model) {
            return false
          }
          // If Custom is selected, custom model name must be provided
          if (formData.llm_model === 'Custom' && !formData.llm_model_custom) {
            return false
          }
        }
        return true
      case 3:
        return true // Optional fields
      case 4:
        return true // Optional fields
      case 5:
        return true // Connections - optional
      case 6:
        return true // Optional fields
      case 7:
        // Framework requirements - optional for now
        return true
      case 8:
        // Check required requirements
        if (!requirements) return true
        const requiredReqs = requirements.filter(r => r.is_required)
        return requiredReqs.every(req => {
          const value = requirementResponses[req.id]
          return value !== undefined && value !== null && value !== ''
        })
      default:
        return true
    }
  }

  const saveDraft = async () => {
    setLoading(true)
    try {
      // Determine the final model value
      let llmModels: string
      if (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') {
        // For "Other" and "Customer Choice", llm_model is now a text input
        llmModels = formData.llm_model || ''
      } else if (formData.llm_model === 'Custom' && (formData as any).llm_model_custom) {
        llmModels = (formData as any).llm_model_custom
      } else {
        llmModels = formData.llm_model || ''
      }
      
      let agent
      if (agentId) {
        // Update existing draft agent
        agent = await agentsApi.update(agentId, {
          ...formData,
          llm_model: formData.llm_model, // String
          capabilities: formData.capabilities, // Rich text string
          data_types: formData.data_types,
          regions: formData.regions,
          connection_diagram: formData.mermaid_diagram,
          workflow_current_step: currentStep,
        } as any) // Type assertion needed for status and workflow_current_step
      } else {
        // Create new draft agent
        agent = await agentsApi.create({
          ...formData,
          llm_model: formData.llm_model, // String
          capabilities: formData.capabilities, // Rich text string
          data_types: formData.data_types,
          regions: formData.regions,
          connection_diagram: formData.mermaid_diagram,
          workflow_current_step: currentStep,
        } as any) // Type assertion needed for status and workflow_current_step
        setAgentId(agent.id)
        // Update URL to include agent ID for draft continuation
        navigate(`/agents/${agent.id}`, { replace: true })
      }
      
      // Save framework requirement responses if available
      if (agent.id && Object.keys(frameworkResponses).length > 0) {
        try {
          const responses = Object.values(frameworkResponses).filter(r => r.response_text || r.compliance_status)
          if (responses.length > 0) {
            await frameworksApi.submitResponses(agent.id, responses)
          }
        } catch (error) {
          console.error('Failed to save framework responses:', error)
        }
      }
      
      // Save connections in parallel for better performance
      if (formData.connections.length > 0) {
        try {
          await Promise.all(
            formData.connections.map(conn => agentConnectionsApi.create(agent.id, conn))
          )
        } catch (error) {
          console.error('Failed to save connections:', error)
        }
      }
      
      // Diagram is already saved as part of formData.mermaid_diagram
      
      showToast.success('Draft saved successfully!')
    } catch (error: any) {
      console.error('Failed to save draft:', error)
      let errorMessage = 'Failed to save draft. Please try again.'
      
      // Extract detailed error message from backend
      if (error?.response?.data) {
        const errorData = error.response.data
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // Pydantic validation errors
            const validationErrors = errorData.detail.map((err: any) => {
              const field = err.loc?.join('.') || 'unknown'
              return `${field}: ${err.msg}`
            }).join(', ')
            errorMessage = `Validation errors: ${validationErrors}`
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail
          }
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      console.error('Draft save error details:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: errorMessage
      })
      
      showToast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      // Create agent as draft when moving to step 8 (framework requirements)
      if (currentStep === 7 && !agentId) {
        setLoading(true)
        
        // Quick backend health check before attempting creation
        try {
          const healthResponse = await fetch('http://localhost:8000/health', { 
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout for health check
          })
          if (!healthResponse.ok) {
            throw new Error('Backend health check failed')
          }
        } catch (healthError) {
          setLoading(false)
          showToast.error('Backend server is not responding. Please ensure the backend is running on port 8000.')
          return
        }
        
        try {
          // Determine the final model value
          let llmModels: string
          if (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') {
            // For "Other" and "Customer Choice", llm_model is now a text input
            llmModels = formData.llm_model || ''
          } else if (formData.llm_model === 'Custom' && formData.llm_model_custom) {
            llmModels = formData.llm_model_custom
          } else {
            llmModels = formData.llm_model || ''
          }
          
          // Prepare agent data with proper type conversions
          const agentData: any = {
            ...formData,
            llm_model: llmModels, // String
            capabilities: formData.capabilities, // Rich text string
            data_types: Array.isArray(formData.data_types) ? formData.data_types : [],
            regions: Array.isArray(formData.regions) ? formData.regions : [],
            mermaid_diagram: formData.mermaid_diagram,
          }
          
          agentData.status = 'draft' // Create as draft
          
          console.log('Creating agent with data:', JSON.stringify(agentData, null, 2))
          
          const agent = await agentsApi.create(agentData)
          setAgentId(agent.id)
        } catch (error: any) {
          console.error('Failed to create agent:', error)
          let errorMessage = 'Failed to create agent. Please try again.'
          
          // Extract detailed error message from backend
          if (error?.response?.data) {
            const errorData = error.response.data
            if (errorData.detail) {
              if (Array.isArray(errorData.detail)) {
                // Pydantic validation errors
                const validationErrors = errorData.detail.map((err: any) => {
                  const field = err.loc?.join('.') || 'unknown'
                  return `${field}: ${err.msg}`
                }).join('\n')
                errorMessage = `Validation errors:\n${validationErrors}`
              } else if (typeof errorData.detail === 'string') {
                errorMessage = errorData.detail
              } else if (typeof errorData.detail === 'object') {
                errorMessage = JSON.stringify(errorData.detail, null, 2)
              }
            } else if (errorData.message) {
              errorMessage = errorData.message
            }
          } else if (error?.message) {
            errorMessage = error.message
          }
          
          console.error('Agent creation error details:', {
            status: error?.response?.status,
            data: error?.response?.data,
            message: errorMessage
          })
          
          showToast.error(errorMessage)
          setLoading(false)
          return
        }
        setLoading(false)
      }
      
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
      }
    } else {
      const missingFields = getMissingFields(currentStep)
      if (missingFields.length > 0) {
        showToast.warning(`Please fill in all required fields before proceeding. Missing: ${missingFields.join(', ')}`)
      } else {
        showToast.warning('Please fill in all required fields before proceeding.')
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepClick = (step: number) => {
    // Allow going back to previous steps, but validate before going forward
    if (step < currentStep || validateStep(currentStep)) {
      setCurrentStep(step)
    } else {
      const missingFields = getMissingFields(currentStep)
      if (missingFields.length > 0) {
        showToast.warning(`Please complete the current step before proceeding. Missing: ${missingFields.join(', ')}`)
      } else {
        showToast.warning('Please complete the current step before proceeding.')
      }
    }
  }

  // Helper function to convert rich text HTML to array format for backend API
  // Backend expects: capabilities/use_cases as List[str], personas as List[dict]
  const convertRichTextToBackendFormat = (
    value: string | string[] | Array<{ name: string; description: string }>,
    fieldType: 'capabilities' | 'use_cases' | 'personas'
  ): string[] | Array<{ name: string; description: string }> => {
    // If already an array, return as-is (backward compatibility)
    if (Array.isArray(value)) {
      if (fieldType === 'personas' && value.length > 0 && typeof value[0] === 'object' && 'name' in value[0]) {
        return value as Array<{ name: string; description: string }>
      }
      return value as string[]
    }
    
    // If string (rich text HTML), convert to array format
    if (typeof value === 'string' && value.trim()) {
      if (fieldType === 'personas') {
        // For personas, try to parse HTML and extract name/description pairs
        // Simple parsing: look for <p><strong>Name:</strong> Description</p> patterns
        const parser = new DOMParser()
        const doc = parser.parseFromString(value, 'text/html')
        const paragraphs = doc.querySelectorAll('p')
        const personas: Array<{ name: string; description: string }> = []
        
        paragraphs.forEach(p => {
          const text = p.textContent || ''
          const strongMatch = p.querySelector('strong')
          if (strongMatch) {
            const name = strongMatch.textContent?.trim() || ''
            const description = text.replace(name, '').replace(':', '').trim()
            if (name) {
              personas.push({ name, description })
            }
          } else if (text.trim()) {
            // If no strong tag, treat entire text as description with generic name
            personas.push({ name: 'Persona', description: text.trim() })
          }
        })
        
        return personas.length > 0 ? personas : [{ name: 'Persona', description: value }]
      } else {
        // For capabilities and use_cases, extract text from HTML paragraphs
        const parser = new DOMParser()
        const doc = parser.parseFromString(value, 'text/html')
        const paragraphs = doc.querySelectorAll('p')
        const items: string[] = []
        
        paragraphs.forEach(p => {
          const text = p.textContent?.trim()
          if (text) {
            items.push(text)
          }
        })
        
        // If no paragraphs found, try to extract from list items or plain text
        if (items.length === 0) {
          const listItems = doc.querySelectorAll('li')
          listItems.forEach(li => {
            const text = li.textContent?.trim()
            if (text) {
              items.push(text)
            }
          })
        }
        
        // If still no items, try splitting by newlines or use the plain text
        if (items.length === 0) {
          const plainText = doc.body.textContent?.trim() || value.trim()
          if (plainText) {
            // Split by newlines or use as single item
            const lines = plainText.split(/\n+/).filter(line => line.trim())
            items.push(...lines.length > 0 ? lines : [plainText])
          }
        }
        
        // If no paragraphs found, use the raw text (strip HTML tags)
        if (items.length === 0) {
          const text = doc.body.textContent?.trim()
          if (text) {
            items.push(text)
          }
        }
        
        return items.length > 0 ? items : []
      }
    }
    
    // Return empty array for empty values
    return fieldType === 'personas' ? [] as Array<{ name: string; description: string }> : [] as string[]
  }

  const handleSubmit = async () => {
    // Debug logging commented out to reduce console noise
    // console.log('🚀 handleSubmit called', {
    //   currentStep,
    //   formData: {
    //     name: formData.name,
    //     type: formData.type,
    //     version: formData.version,
    //     llm_vendor: formData.llm_vendor,
    //     llm_model: formData.llm_model,
    //     llm_model_custom: formData.llm_model_custom,
    //   }
    // })
    
    // Validate all required steps before submission
    const step1Valid = validateStep(1)
    const step2Valid = validateStep(2)
    
    // console.log('✅ Validation results:', {
    //   step1Valid,
    //   step2Valid,
    //   step1Details: {
    //     hasName: !!formData.name,
    //     hasType: !!formData.type,
    //     hasVersion: !!formData.version,
    //   },
    //   step2Details: {
    //     hasVendor: !!formData.llm_vendor,
    //     hasModel: !!formData.llm_model,
    //     hasCustomModel: !!formData.llm_model_custom,
    //     vendor: formData.llm_vendor,
    //     model: formData.llm_model,
    //   }
    // })
    
    if (!step1Valid || !step2Valid) {
      const missingFields = []
      if (!formData.name) missingFields.push('Name')
      if (!formData.type) missingFields.push('Type')
      if (!formData.version) missingFields.push('Version')
      if (!formData.llm_vendor) missingFields.push('LLM Vendor')
      if (!formData.llm_model && formData.llm_vendor !== 'Customer Choice' && formData.llm_vendor !== 'Other') {
        missingFields.push('LLM Model')
      }
      if (formData.llm_model === 'Custom' && !formData.llm_model_custom) {
        missingFields.push('Custom LLM Model Name')
      }
      
      console.error('❌ Validation failed:', { step1Valid, step2Valid, missingFields })
      showToast.warning(`Please complete all required fields before submitting. Missing: ${missingFields.join(', ')}`)
      return
    }

    // console.log('✅ Validation passed, starting submission...')
    setLoading(true)

    try {
      // Ensure diagram is generated if we have connections but no diagram
      // Use connectionDiagram state, or formData.connection_diagram, or generate new one
      let finalDiagram = connectionDiagram || (formData as any).connection_diagram || ''
      if (formData.connections.length > 0 && !finalDiagram) {
        try {
          const diagramResult = await agentConnectionsApi.generateDiagram(
            formData.name || 'Agent',
            formData.connections
          )
          finalDiagram = diagramResult.mermaid_diagram
          setConnectionDiagram(finalDiagram)
          // Also sync to formData
          setFormData(prev => ({ ...prev, connection_diagram: finalDiagram }))
        } catch (error) {
          console.error('Failed to generate diagram before submission:', error)
        }
      }

      // Determine the final model value
      let llmModels: string
      if (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') {
        // For "Other" and "Customer Choice", llm_model is now a text input
        llmModels = formData.llm_model || ''
      } else if (formData.llm_model === 'Custom' && formData.llm_model_custom) {
        llmModels = formData.llm_model_custom
      } else {
        llmModels = formData.llm_model || ''
      }
      
      let agent
      if (agentId) {
        // Update existing draft agent first (without submitting)
        // Split into smaller updates to avoid timeout
        try {
          agent = await agentsApi.update(agentId, {
            ...formData,
            llm_model: llmModels,
            capabilities: convertRichTextToBackendFormat(formData.capabilities, 'capabilities') as string[],
            data_types: formData.data_types,
            regions: formData.regions,
            use_cases: convertRichTextToBackendFormat(formData.use_cases, 'use_cases') as string[],
            personas: convertRichTextToBackendFormat(formData.personas, 'personas') as Array<{ name: string; description: string }>,
            connection_diagram: finalDiagram,
          } as any) // Type assertion needed for connections
        } catch (updateError: any) {
          console.error('Failed to update agent:', updateError)
          // If update fails, try to get the existing agent
          try {
            agent = await agentsApi.get(agentId)
          } catch (getError) {
            throw new Error(`Failed to update agent and could not retrieve existing agent: ${updateError.message || 'Unknown error'}`)
          }
        }
      } else {
        // Create new agent as draft first with minimal data to avoid timeout
        // Then update with full data in a separate call
        try {
          // console.log('📝 Creating agent with minimal data:', {
          //   name: formData.name,
          //   type: formData.type,
          //   version: formData.version
          // })
          
          // First, create with absolute minimal required fields only
          // Use a longer timeout for the initial creation since backend does multiple DB operations
          const createStartTime = Date.now()
          agent = await agentsApi.create({
            name: formData.name || 'Untitled Agent',
            type: formData.type || 'general',
            version: formData.version || '1.0.0',
            status: 'draft',
          } as any)
          
          const createDuration = Date.now() - createStartTime
          // console.log(`✅ Agent created in ${createDuration}ms:`, agent.id)
          setAgentId(agent.id)
          
          // Then update with all other fields in smaller batches to avoid timeout
          // console.log('📝 Updating agent with full data...')
          const updateStartTime = Date.now()
          
          // Update in batches - first batch: basic fields
          await agentsApi.update(agent.id, {
            ...formData,
            llm_model: Array.isArray(llmModels) ? llmModels.join(', ') : llmModels,
          } as any)
          
          // Second batch: complex fields (if they exist)
          if (formData.capabilities || formData.data_types || formData.regions) {
            await agentsApi.update(agent.id, {
              capabilities: convertRichTextToBackendFormat(formData.capabilities, 'capabilities') as string[],
              data_types: formData.data_types,
              regions: formData.regions,
            } as any)
          }
          
          // Third batch: rich text fields (if they exist)
          if (formData.use_cases || formData.personas) {
            await agentsApi.update(agent.id, {
              use_cases: convertRichTextToBackendFormat(formData.use_cases, 'use_cases') as string[],
              personas: convertRichTextToBackendFormat(formData.personas, 'personas') as Array<{ name: string; description: string }>,
            } as any)
          }
          
          // Fourth batch: diagram (if exists)
          if (finalDiagram) {
            await agentsApi.update(agent.id, {
              connection_diagram: finalDiagram,
            } as any)
          }
          
          const updateDuration = Date.now() - updateStartTime
          console.log(`✅ Agent updated in ${updateDuration}ms`)
          
          // Refresh agent data
          agent = await agentsApi.get(agent.id)
        } catch (createError: any) {
          console.error('❌ Failed to create agent:', createError)
          
          // Check if it's a timeout error
          if (createError?.code === 'ECONNABORTED' || createError?.message?.includes('timeout')) {
            throw new Error(`Request timed out. The backend is processing your request but it's taking longer than expected. This might be due to:
1. Database operations taking longer than usual
2. Backend server being under heavy load
3. Network connectivity issues

Please try:
- Waiting a moment and checking if the agent was created (refresh the page)
- Trying again in a few moments
- Contacting support if the issue persists`)
          }
          
          // Check for duplicate name error
          if (createError?.response?.status === 400 && createError?.response?.data?.detail?.includes('already exists')) {
            throw new Error(`An agent with the name "${formData.name}" already exists. Please choose a different name.`)
          }
          
          throw new Error(`Failed to create agent: ${createError?.response?.data?.detail || createError?.message || 'Unknown error'}. Please try again.`)
        }
      }
      
      // Save framework requirement responses BEFORE submitting
      if (agent.id && Object.keys(frameworkResponses).length > 0) {
        try {
          const responses = Object.values(frameworkResponses).filter(r => r.response_text || r.compliance_status)
          if (responses.length > 0) {
            await frameworksApi.submitResponses(agent.id, responses)
          }
        } catch (error) {
          console.error('Failed to save framework responses:', error)
        }
      }
      
      // Save requirement responses
      if (requirements && requirements.length > 0 && Object.keys(requirementResponses).length > 0) {
        try {
          await submissionRequirementsApi.saveResponses(agent.id, requirementResponses)
        } catch (error) {
          console.error('Failed to save requirement responses:', error)
        }
      }
      
      // Save connections BEFORE submitting
      if (agent.id && formData.connections.length > 0) {
        try {
          // Save each connection
          for (const conn of formData.connections) {
            await agentConnectionsApi.create(agent.id, conn)
          }
        } catch (error) {
          console.error('Failed to save connections:', error)
        }
      }
      
      // Diagram is already saved in the initial create/update call above
      // Now submit the agent using the submit endpoint (this triggers workflow)
      if (agent.id) {
        try {
          // console.log('📤 Calling agentsApi.submit for agent:', agent.id)
          agent = await agentsApi.submit(agent.id)
          // console.log('✅ Agent submitted successfully, workflow triggered:', {
          //   onboarding_request_id: agent.onboarding_request_id,
          //   workflow_status: agent.workflow_status,
          //   workflow_current_step: agent.workflow_current_step
          // })
        } catch (submitError: any) {
          console.error('❌ Failed to submit agent:', submitError)
          let errorDetail = 'Unknown error'
          
          // Extract detailed error message from backend
          if (submitError?.response?.data) {
            const errorData = submitError.response.data
            if (errorData.detail) {
              if (Array.isArray(errorData.detail)) {
                // Pydantic validation errors
                errorDetail = errorData.detail.map((err: any) => {
                  const field = err.loc?.join('.') || 'unknown'
                  return `${field}: ${err.msg}`
                }).join('\n')
              } else if (typeof errorData.detail === 'string') {
                errorDetail = errorData.detail
              } else if (typeof errorData.detail === 'object') {
                errorDetail = JSON.stringify(errorData.detail, null, 2)
              }
            } else if (errorData.message) {
              errorDetail = errorData.message
            }
          } else if (submitError?.message) {
            errorDetail = submitError.message
          }
          
          showToast.error(`Agent saved but submission failed: ${errorDetail}. Please try submitting again from the agent detail page.`)
          navigate(`/agents/${agent.id}`)
          setLoading(false)
          return
        }
      }
      
      // Show success message with workflow info
      if (agent.onboarding_request_id) {
        let message = 'Agent submitted successfully!'
        message += ` Request ID: ${agent.onboarding_request_id}`
        if (agent.workflow_status) {
          message += ` | Status: ${agent.workflow_status}`
        }
        if (agent.workflow_current_step !== null && agent.workflow_current_step !== undefined) {
          message += ` | Step: ${agent.workflow_current_step}`
        }
        showToast.success(message)
      } else {
        showToast.warning('Agent submitted successfully! Note: No workflow request was created. Please check workflow configuration for your tenant.')
      }
      
      navigate(`/agents/${agent.id}`)
    } catch (error: any) {
      console.error('Failed to submit agent:', error)
      
      // Extract detailed error message from backend
      let errorMessage = 'Failed to submit agent. Please try again.'
      
      if (error?.response?.data) {
        const errorData = error.response.data
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // Pydantic validation errors
            const validationErrors = errorData.detail.map((err: any) => {
              const field = err.loc?.join('.') || 'unknown'
              return `${field}: ${err.msg}`
            }).join(', ')
            errorMessage = `Validation errors: ${validationErrors}`
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail
          } else if (typeof errorData.detail === 'object') {
            errorMessage = JSON.stringify(errorData.detail)
          }
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      showToast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const addDataType = () => {
    if (dataTypeInput.trim()) {
      setFormData({
        ...formData,
        data_types: [...formData.data_types, dataTypeInput.trim()],
      })
      setDataTypeInput('')
    }
  }

  const addRegion = () => {
    if (regionInput.trim()) {
      setFormData({
        ...formData,
        regions: [...formData.regions, regionInput.trim()],
      })
      setRegionInput('')
    }
  }


  const renderRequirementField = (requirement: SubmissionRequirement) => {
    const rawValue = requirementResponses[requirement.id]
    const fieldId = `req_${requirement.id}`

    // Check if this is a questionnaire-style requirement with multiple response types
    const allowedTypes = requirement.allowed_response_types || [requirement.field_type]
    const isQuestionnaire = allowedTypes.length > 1 || (allowedTypes.includes('text') && allowedTypes.includes('file'))
    
    // Parse value: can be string (legacy) or object {text, files, links}
    let responseValue: any = {}
    if (typeof rawValue === 'string') {
      // Legacy: single string value
      if (isQuestionnaire && allowedTypes.includes('text')) {
        responseValue = { text: rawValue, files: [], links: [] }
      } else {
        responseValue = rawValue
      }
    } else if (rawValue && typeof rawValue === 'object') {
      responseValue = rawValue
    } else {
      responseValue = { text: '', files: [], links: [] }
    }

    // Questionnaire-style: Multiple response types
    if (isQuestionnaire) {
      return (
        <div className="space-y-3">
          {/* Text Response */}
          {(allowedTypes.includes('text') || allowedTypes.includes('textarea')) && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Text Explanation</label>
              <textarea
                id={`${fieldId}_text`}
                className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-xs"
                rows={4}
                value={responseValue.text || ''}
                onChange={(e) => {
                  handleRequirementChange(requirement.id, {
                    ...responseValue,
                    text: e.target.value
                  })
                }}
                placeholder={requirement.placeholder || "Provide a text-based explanation..."}
                required={requirement.is_required && (!responseValue.files?.length && !responseValue.links?.length)}
                minLength={requirement.min_length}
                maxLength={requirement.max_length}
              />
            </div>
          )}
          
          {/* File Upload */}
          {allowedTypes.includes('file') && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Attach Documents (PDF, Images, etc.)</label>
              <input
                type="file"
                id={`${fieldId}_file`}
                className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-xs"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  const fileData = files.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file: file // Store file object for upload
                  }))
                  handleRequirementChange(requirement.id, {
                    ...responseValue,
                    files: [...(responseValue.files || []), ...fileData]
                  })
                }}
              />
              {responseValue.files && responseValue.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {responseValue.files.map((file: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-1.5 rounded text-xs">
                      <span>{file.name || file.file?.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newFiles = responseValue.files.filter((_: any, i: number) => i !== idx)
                          handleRequirementChange(requirement.id, {
                            ...responseValue,
                            files: newFiles
                          })
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* External Link */}
          {allowedTypes.includes('url') && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">External Link (Google Drive, SharePoint, etc.)</label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  id={`${fieldId}_url`}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={responseValue.links?.join(', ') || ''}
                  onChange={(e) => {
                    const links = e.target.value.split(',').map(l => l.trim()).filter(l => l)
                    handleRequirementChange(requirement.id, {
                      ...responseValue,
                      links: links
                    })
                  }}
                  placeholder="https://drive.google.com/... or https://sharepoint.com/..."
                  required={requirement.is_required && (!responseValue.text && !responseValue.files?.length)}
                />
              </div>
              {responseValue.links && responseValue.links.length > 0 && (
                <div className="mt-2 space-y-1">
                  {responseValue.links.map((link: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-1.5 rounded text-xs">
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                        {link}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = responseValue.links.filter((_: string, i: number) => i !== idx)
                          handleRequirementChange(requirement.id, {
                            ...responseValue,
                            links: newLinks
                          })
                        }}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    // Standard single-type fields
    switch (requirement.field_type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <input
            type={requirement.field_type}
            id={fieldId}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            value={typeof responseValue === 'string' ? responseValue : ''}
            onChange={(e) => handleRequirementChange(requirement.id, e.target.value)}
            placeholder={requirement.placeholder}
            required={requirement.is_required}
            minLength={requirement.min_length}
            maxLength={requirement.max_length}
            pattern={requirement.pattern}
          />
        )
      
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all min-h-[100px]"
            value={typeof responseValue === 'string' ? responseValue : ''}
            onChange={(e) => handleRequirementChange(requirement.id, e.target.value)}
            placeholder={requirement.placeholder}
            required={requirement.is_required}
            minLength={requirement.min_length}
            maxLength={requirement.max_length}
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            id={fieldId}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            value={typeof responseValue === 'number' ? responseValue : (typeof responseValue === 'string' ? responseValue : '')}
            onChange={(e) => handleRequirementChange(requirement.id, e.target.value ? Number(e.target.value) : '')}
            placeholder={requirement.placeholder}
            required={requirement.is_required}
            min={requirement.min_value}
            max={requirement.max_value}
          />
        )
      
      case 'select':
      case 'radio':
        return (
          <select
            id={fieldId}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            value={typeof responseValue === 'string' ? responseValue : ''}
            onChange={(e) => handleRequirementChange(requirement.id, e.target.value)}
            required={requirement.is_required}
          >
            <option value="">Select an option</option>
            {requirement.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </option>
            ))}
          </select>
        )
      
      case 'multi_select':
      case 'checkbox':
        const selectedValues = Array.isArray(responseValue) ? responseValue : []
        return (
          <div className="space-y-2">
            {requirement.options?.map((opt: any) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, opt.value]
                      : selectedValues.filter((v: string) => v !== opt.value)
                    handleRequirementChange(requirement.id, newValues)
                  }}
                  className="w-4 h-4"
                />
                <span className="text-xs">{opt.label || opt.value}</span>
              </label>
            ))}
          </div>
        )
      
      case 'date':
        return (
          <input
            type="date"
            id={fieldId}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            value={typeof responseValue === 'string' ? responseValue : ''}
            onChange={(e) => handleRequirementChange(requirement.id, e.target.value)}
            required={requirement.is_required}
          />
        )
      
      case 'file':
        return (
          <div>
          <input
            type="file"
            id={fieldId}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
            onChange={(e) => {
                const files = Array.from(e.target.files || [])
                const fileData = files.map(file => ({
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  file: file
                }))
                handleRequirementChange(requirement.id, { files: fileData })
            }}
            required={requirement.is_required}
          />
            {responseValue.files && responseValue.files.length > 0 && (
              <div className="mt-2 space-y-1">
                {responseValue.files.map((file: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded text-xs">
                    <span>{file.name || file.file?.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newFiles = responseValue.files.filter((_: any, i: number) => i !== idx)
                        handleRequirementChange(requirement.id, { files: newFiles })
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
        )
      
      default:
        return (
          <input
            type="text"
            id={fieldId}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            value={typeof responseValue === 'string' ? responseValue : ''}
            onChange={(e) => handleRequirementChange(requirement.id, e.target.value)}
            placeholder={requirement.placeholder}
            required={requirement.is_required}
          />
        )
    }
  }

  // Render a field based on its type from layout configuration
  // Simple logic: Get field type from requirements/available fields/custom fields -> Render accordingly
  const renderFieldFromLayout = (fieldName: string, stepNumber: number, isReadOnly: boolean = false, fieldIndex: number = 0, isRequiredOverride?: boolean) => {
    // Declare fieldValue early to ensure availability in all scopes
    const fieldValue = formData && typeof formData === 'object' ? ((formData as any)[fieldName] || '') : ''
    
    try {
      // Safety check: ensure fieldName is a valid string
      if (!fieldName || typeof fieldName !== 'string') {
        console.error('Invalid fieldName passed to renderFieldFromLayout:', fieldName)
        return (
          <div key={`invalid-${fieldIndex}`} className="space-y-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-600">Invalid field name: {String(fieldName)}</p>
          </div>
        )
      }
      
      // Check field definitions in order: custom field -> requirement -> available field
      const customField = customFieldsMap.get(fieldName)
      const requirement = requirementsMap.get(fieldName)
      const availableField = availableFieldsMap.get(fieldName)
      
      // Determine field definition and type
      const fieldDef = customField || requirement || availableField
      const fieldType = fieldDef?.field_type || 'text'
      const fieldLabel = fieldDef?.label || (fieldName ? fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Field')
      const fieldDescription = fieldDef?.description
      
      // Use override if provided, otherwise fall back to field definition
      const isRequired = isRequiredOverride !== undefined ? isRequiredOverride : (fieldDef?.is_required || false)
      
      // Declare fieldValue early to ensure availability in all scopes
      const fieldValue = formData && typeof formData === 'object' ? ((formData as any)[fieldName] || '') : ''
    
    // For special fields that need custom UI, use renderSpecialField
    // Only if it's actually a special field that needs custom handling
    // Note: 'type' is now handled through normal field rendering with field_config options
    if (['category', 'subcategory', 'llm_vendor', 'llm_model', 'llm_model_custom'].includes(fieldName)) {
      const specialField = renderSpecialField(fieldName, fieldValue, fieldIndex)
      if (specialField) {
        return isReadOnly ? (
          <div className="opacity-75 pointer-events-none">{specialField}</div>
        ) : specialField
      }
    }
    
    // Check if it's a custom field
    if (customField) {
      switch (customField.field_type) {
        case 'file_upload':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setFormData((prev: any) => ({
                      ...prev,
                      [fieldName]: file.name,
                    }))
                  }
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                accept={customField.accepted_file_types || '*'}
                required={isRequired}
              />
              {customField.accepted_file_types && (
                <p className="text-xs text-gray-500 mt-1">
                  Accepted: {customField.accepted_file_types}
                </p>
              )}
            </div>
          )
        case 'external_link':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={(formData as any)[fieldName] || ''}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                  className="compact-input flex-1"
                  placeholder={customField.placeholder || 'https://...'}
                  required={isRequired}
                />
                {(formData as any)[fieldName] && (
                  <a
                    href={(formData as any)[fieldName]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs whitespace-nowrap"
                  >
                    {customField.link_text || 'Open Link'}
                  </a>
                )}
              </div>
            </div>
          )
        case 'textarea':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              {isReadOnly ? (
                <div 
                  className="compact-input min-h-[150px] p-2 bg-gray-50 border border-gray-200 rounded text-xs"
                  dangerouslySetInnerHTML={{ __html: fieldValue || '' }}
                />
              ) : (
                <div className="rich-text-editor-wrapper">
                  <ReactQuillWrapper
                    theme="snow"
                    value={fieldValue || ''}
                    onChange={(content: string) => {
                      setFormData((prev: any) => ({ ...prev, [fieldName]: content }))
                    }}
                    placeholder={customField.placeholder || 'Enter formatted text...'}
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
              )}
            </div>
          )
        case 'select':
        case 'multi_select':
          // Get options from master data list or static options
          let selectOptions: Array<{ value: string; label: string }> = []
          if (customField.master_data_list_id) {
            const masterList = masterDataListsMap.get(customField.master_data_list_id)
            if (masterList) {
              selectOptions = masterList.values
                .filter(v => v.is_active)
                .sort((a, b) => a.order - b.order)
                .map(v => ({ value: v.value, label: v.label }))
            }
          } else if (customField.options) {
            selectOptions = customField.options
          }
          
          if (customField.field_type === 'multi_select') {
            const selectedValues = Array.isArray((formData as any)[fieldName]) ? (formData as any)[fieldName] : []
            return (
              <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
                <label className="text-xs font-medium mb-0.5 block">
                  {customField.label}
                  {isRequired && <span className="text-red-600 ml-1">*</span>}
                </label>
                {customField.description && (
                  <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
                )}
                <div className="space-y-2">
                  {selectOptions.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(opt.value)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newValues = e.target.checked
                            ? [...selectedValues, opt.value]
                            : selectedValues.filter((v: string) => v !== opt.value)
                          setFormData((prev: any) => ({ ...prev, [fieldName]: newValues }))
                        }}
                        className="w-4 h-4"
                        disabled={isReadOnly}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          } else {
            return (
              <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
                <label className="text-xs font-medium mb-0.5 block">
                  {customField.label}
                  {isRequired && <span className="text-red-600 ml-1">*</span>}
                </label>
                {customField.description && (
                  <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
                )}
                <select
                  value={(formData as any)[fieldName] || ''}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  required={isRequired}
                  disabled={isReadOnly}
                >
                  <option value="">Select...</option>
                  {selectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          }
        case 'number':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <input
                type="number"
                value={(formData as any)[fieldName] || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value ? Number(e.target.value) : '' }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder={customField.placeholder}
                required={isRequired}
                disabled={isReadOnly}
              />
            </div>
          )
        case 'date':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <input
                type="date"
                value={(formData as any)[fieldName] || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                required={isRequired}
                disabled={isReadOnly}
              />
            </div>
          )
        case 'email':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <input
                type="email"
                value={(formData as any)[fieldName] || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder={customField.placeholder}
                required={isRequired}
                disabled={isReadOnly}
              />
            </div>
          )
        case 'url':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <input
                type="url"
                value={(formData as any)[fieldName] || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder={customField.placeholder || 'https://...'}
                required={isRequired}
                disabled={isReadOnly}
              />
            </div>
          )
        case 'json':
          // JSON field - render as structured key-value input
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <JsonFieldInput
                value={fieldValue}
                onChange={(newValue) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: newValue }))
                  }
                }}
                placeholder={customField.placeholder || 'Add items to the list'}
                disabled={isReadOnly}
                isReadOnly={isReadOnly}
                useTableMode={true}
                fieldLabel={customField.label}
              />
            </div>
          )
        case 'rich_text':
          // Rich text field - render with ReactQuill editor
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              {isReadOnly ? (
                <div 
                  className="compact-input min-h-[150px] p-2 bg-gray-50 border border-gray-200 rounded text-xs"
                  dangerouslySetInnerHTML={{ __html: fieldValue || '' }}
                />
              ) : (
                <div className="rich-text-editor-wrapper">
                  <ReactQuillWrapper
                    theme="snow"
                    value={fieldValue || ''}
                    onChange={(content: string) => {
                      setFormData((prev: any) => ({ ...prev, [fieldName]: content }))
                    }}
                    placeholder={customField.placeholder || 'Enter formatted text...'}
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
              )}
            </div>
          )
        case 'mermaid_diagram':
        case 'architecture_diagram':
        case 'visualization':
          // Use new DiagramFieldInput component
          const diagramFieldConfig = (customField as any).field_config || {}
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <DiagramFieldInput
                value={(formData as any)[fieldName]}
                onChange={(newValue) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: newValue }))
                  }
                }}
                fieldType={customField.field_type as 'architecture_diagram' | 'mermaid_diagram' | 'visualization'}
                fieldConfig={diagramFieldConfig}
                agentData={formData}
                placeholder={customField.placeholder}
                disabled={isReadOnly}
                isReadOnly={isReadOnly}
              />
            </div>
          )
        default:
          return (
            <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
              <label className="text-xs font-medium mb-0.5 block">
                {customField.label}
                {customField.is_required && <span className="text-red-600 ml-1">*</span>}
              </label>
              {customField.description && (
                <p className="text-xs text-gray-500 mb-0.5">{customField.description}</p>
              )}
              <input
                type="text"
                value={(formData as any)[fieldName] || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder={customField.placeholder}
                required={customField.is_required}
              />
            </div>
          )
      }
    }
    
    // Priority: Available Field -> Requirement -> Custom Field -> Fallback
    // Available fields are prioritized since layout is driven by available fields
    // (availableField and requirement already declared at top of function)
    
    // Render from available field first (layout-driven)
    if (availableField) {
      // fieldValue already declared at top of function
      // Always use label from availableField if available, otherwise generate from field_name
      // Ensure label is never empty
      const availableFieldLabel = availableField.label?.trim() || (fieldName ? fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Field')
      
      // Get field_config early so it can be used in diagram field handling
      const fieldConfig = (availableField as any).field_config || {}
      
      // Get field value early for use in diagram field handling
      let fieldValue = (formData as any)[fieldName]
      
      // Handle diagram field types from available fields (mermaid_diagram, architecture_diagram, visualization)
      if (fieldName === 'mermaid_diagram' || fieldName === 'architecture_diagram' || fieldName === 'visualization' ||
          availableField.field_type === 'mermaid_diagram' || availableField.field_type === 'architecture_diagram' || availableField.field_type === 'visualization') {
        const diagramFieldType = availableField.field_type as 'architecture_diagram' | 'mermaid_diagram' | 'visualization' || 'mermaid_diagram'
        const diagramFieldConfig = fieldConfig as any || {}
        return (
          <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
            <label className="text-xs font-medium text-gray-900 mb-0.5 block">
              {availableFieldLabel}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            {availableField.description && (
              <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
            )}
            <DiagramFieldInput
              value={fieldValue}
              onChange={(newValue) => {
                if (!isReadOnly) {
                  setFormData((prev: any) => ({ ...prev, [fieldName]: newValue }))
                }
              }}
              fieldType={diagramFieldType}
              fieldConfig={diagramFieldConfig}
              agentData={formData}
              placeholder={fieldConfig.placeholder || availableField.description}
              disabled={isReadOnly}
              isReadOnly={isReadOnly}
            />
          </div>
        )
      }
      
      // Legacy mermaid_diagram handling (for backward compatibility)
      if (fieldName === 'mermaid_diagram' || availableField.field_type === 'mermaid_diagram') {
        const currentDiagramValue = (formData as any)[fieldName] || ''
        const isEditing = editingMermaidDiagrams[fieldName] || false
        const editedDiagram = editedMermaidDiagrams[fieldName] || currentDiagramValue
        
        // Auto-generate diagram if empty and form has data
        const shouldAutoGenerate = !currentDiagramValue && (
          formData.name || 
          formData.connections?.length > 0 || 
          formData.llm_vendor ||
          formData.deployment_type
        )
        
        const handleStartEdit = () => {
          // Generate diagram if needed
          let diagramToEdit = currentDiagramValue
          if (!diagramToEdit && shouldAutoGenerate) {
            diagramToEdit = generateComprehensiveMermaidDiagram(fieldName)
          }
          setEditedMermaidDiagrams(prev => ({ ...prev, [fieldName]: diagramToEdit }))
          setEditingMermaidDiagrams(prev => ({ ...prev, [fieldName]: true }))
        }
        
        const handleSave = () => {
          setFormData((prev: any) => ({ ...prev, [fieldName]: editedDiagram }))
          setEditingMermaidDiagrams(prev => ({ ...prev, [fieldName]: false }))
        }
        
        const handleCancel = () => {
          setEditedMermaidDiagrams(prev => ({ ...prev, [fieldName]: currentDiagramValue }))
          setEditingMermaidDiagrams(prev => ({ ...prev, [fieldName]: false }))
        }
        
        const handleAutoGenerate = () => {
          const generated = generateComprehensiveMermaidDiagram(fieldName)
          setEditedMermaidDiagrams(prev => ({ ...prev, [fieldName]: generated }))
          setEditingMermaidDiagrams(prev => ({ ...prev, [fieldName]: true }))
        }
        
        // Use generated or saved diagram for display
        const displayDiagram = isEditing ? editedDiagram : (currentDiagramValue || (shouldAutoGenerate ? generateComprehensiveMermaidDiagram(fieldName) : ''))
        
        return (
              <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium mb-0.5 block">
                {availableFieldLabel}
              </label>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                >
                  Regenerate
                </button>
              )}
            </div>
            {availableField.description && (
                <p className="text-xs text-gray-500 mb-1.5">{availableField.description}</p>
            )}
            {isEditing ? (
              <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                <textarea
                  value={editedDiagram}
                  onChange={(e) => setEditedMermaidDiagrams(prev => ({ ...prev, [fieldName]: e.target.value }))}
                  placeholder="Enter Mermaid diagram code or use 'Regenerate' to auto-generate from form data..."
                  className="w-full min-h-[300px] p-3 border rounded font-mono text-sm"
                  style={{ fontFamily: 'monospace' }}
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="compact-button-primary"
                  >
                    Save Diagram
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="compact-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Regenerate from Form Data
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter Mermaid diagram syntax. The diagram will be rendered automatically. You can also regenerate it from your form data.
                </p>
                {editedDiagram && (
                  <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Preview:</p>
                    <MermaidDiagram diagram={editedDiagram} id={`mermaid-diagram-preview-${fieldName}`} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                {displayDiagram ? (
                  <>
                    <MermaidDiagram diagram={displayDiagram} id={`mermaid-diagram-${fieldName}`} />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="compact-button-secondary"
                      >
                        Edit Diagram
                      </button>
                      {shouldAutoGenerate && (
                        <button
                          type="button"
                          onClick={handleAutoGenerate}
                          className="text-xs px-3 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                        >
                          Generate from Form Data
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm mb-4">No diagram yet</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="compact-button-primary"
                      >
                        + Add Diagram Manually
                      </button>
                      {shouldAutoGenerate && (
                        <button
                          type="button"
                          onClick={handleAutoGenerate}
                          className="compact-button-secondary"
                        >
                          Generate from Form Data
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      }
      
      // Generic field rendering based on field_type_display and field_config
      // This works for any entity, not just agent_metadata
      // fieldConfig already defined earlier in the function (line 2398)
      // IMPORTANT: Re-read fieldConfig from availableField to ensure we have the latest from API
      // The API returns field_config directly on the field object
      const apiFieldConfig = (availableField as any)?.field_config || fieldConfig || {}
      
      // Get options from field_config (should be synced with master data on backend)
      // Try multiple sources: field_config.options, or direct options property
      const fieldOptions = apiFieldConfig.options || fieldConfig.options || []
      
      // Use field_type_display if available, otherwise fall back to field_type
      // The API should return field_type='select' for type and category fields
      const fieldType = (availableField as any).field_type_display || availableField.field_type || 'text'
      
      // Debug logging for type and category fields (commented out to reduce console noise)
      // if (fieldName === 'type' || fieldName === 'category') {
      //   console.log(`🔍 ${fieldName} field debug:`)
      //   console.log('  fieldName:', fieldName)
      //   console.log('  fieldType:', fieldType)
      //   console.log('  fieldOptions.length:', fieldOptions.length)
      //   console.log('  fieldOptions:', fieldOptions)
      //   console.log('  apiFieldConfig:', apiFieldConfig)
      //   console.log('  apiFieldConfig.options:', apiFieldConfig.options)
      //   console.log('  fieldConfig.options:', fieldConfig.options)
      //   console.log('  availableField.field_type:', availableField?.field_type)
      //   console.log('  availableField.field_config:', (availableField as any)?.field_config)
      //   console.log('  Will render as select?', fieldType === 'select' && fieldOptions.length > 0 && !apiFieldConfig.depends_on)
      //   console.log('  Condition check:', {
      //     fieldTypeIsSelect: fieldType === 'select',
      //     hasOptions: fieldOptions.length > 0,
      //     noDependsOn: !apiFieldConfig.depends_on,
      //     allTrue: fieldType === 'select' && fieldOptions.length > 0 && !apiFieldConfig.depends_on
      //   })
      // }
      
      // Get field value - handle arrays properly for multi-select fields
      // fieldValue already declared earlier for diagram field handling
      // let fieldValue = (formData as any)[fieldName]
      
      // Normalize field value based on field type
      if (fieldType === 'multi_select' || (fieldType === 'json' && fieldOptions.length > 0)) {
        // For multi-select, ensure it's an array
        if (!Array.isArray(fieldValue)) {
          if (fieldValue && typeof fieldValue === 'string') {
            // Try to parse as JSON array
            try {
              const parsed = JSON.parse(fieldValue)
              fieldValue = Array.isArray(parsed) ? parsed : [parsed]
            } catch {
              // If comma-separated, split it
              fieldValue = fieldValue.includes(',') ? fieldValue.split(',').map((v: string) => v.trim()) : [fieldValue]
            }
          } else {
            fieldValue = fieldValue ? [fieldValue] : []
          }
        }
      } else {
        // For single values, ensure it's not an array
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          fieldValue = fieldValue[0]
        } else if (Array.isArray(fieldValue)) {
          fieldValue = ''
        }
      }
      
      // Handle select fields with options (but not dependent fields - those are handled below)
      if (fieldType === 'select' && fieldOptions.length > 0 && !apiFieldConfig.depends_on) {
        return (
          <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
            <label className="text-xs font-medium text-gray-900 mb-0.5 block">
              {availableFieldLabel}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            {availableField.description && (
              <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
            )}
            <select
              value={fieldValue || ''}
              onChange={(e) => {
                if (!isReadOnly) {
                  const newValue = e.target.value
                  const updates: any = { [fieldName]: newValue }
                  
                  // Reset dependent fields when parent field changes (generic approach)
                  // Find all fields that depend on this field
                  if (availableFieldsData) {
                    const allFields: any[] = [
                      ...(availableFieldsData.agent || []),
                      ...(availableFieldsData.agent_metadata || []),
                      ...(availableFieldsData.custom_fields || []),
                      ...(availableFieldsData.submission_requirements || []),
                      ...Object.values(availableFieldsData.entity_fields || {}).flat()
                    ]
                    
                    allFields.forEach((depField: any) => {
                      const depConfig = depField.field_config || {}
                      if (depConfig.depends_on === fieldName && depConfig.clear_on_parent_change !== false) {
                        updates[depField.field_name] = ''
                      }
                    })
                  }
                  
                  setFormData((prev: any) => ({ ...prev, ...updates }))
                }
              }}
              className="compact-input"
              disabled={isReadOnly}
              required={isRequired}
            >
              <option value="">Select {availableFieldLabel}...</option>
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
          <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
            <label className="text-xs font-medium text-gray-900 mb-0.5 block">
              {availableFieldLabel}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            {availableField.description && (
                <p className="text-xs text-gray-500 mb-1.5">{availableField.description}</p>
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
                        if (!isReadOnly) {
                          const newValues = e.target.checked
                            ? [...selectedValues, optionValue]
                            : selectedValues.filter((v: any) => v !== optionValue)
                          setFormData((prev: any) => ({ ...prev, [fieldName]: newValues }))
                        }
                      }}
                      className="w-4 h-4"
                      disabled={isReadOnly}
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
        const dependsOnValue = (formData as any)[dependsOnField] || ''
        const dependentOptions = dependsOnValue && fieldConfig.dependent_options 
          ? (fieldConfig.dependent_options[dependsOnValue] || [])
          : []
        const allowCustom = fieldConfig?.allow_custom || false
        const clearOnParentChange = fieldConfig?.clear_on_parent_change !== false // Default to true
        const dependsOnLabel = fieldConfig.depends_on_label || (dependsOnField ? dependsOnField.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Field')
        
        // Check if we need custom input (no options for this parent value)
        const needsCustomInput = dependsOnValue && dependentOptions.length === 0 && allowCustom
        
        if (!dependsOnValue) {
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200">
                Please select {dependsOnLabel} first
              </div>
            </div>
          )
        }
        
        if (needsCustomInput) {
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`enterprise-form-field ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="enterprise-label">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <input
                type="text"
                value={fieldValue || ''}
                onChange={(e) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))
                  }
                }}
                className="enterprise-input"
                placeholder={fieldConfig.placeholder || `Enter ${availableFieldLabel.toLowerCase()}...`}
                disabled={isReadOnly}
                required={isRequired}
              />
            </div>
          )
        }
        
        if (dependentOptions.length > 0) {
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <select
                value={fieldValue || ''}
                onChange={(e) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))
                  }
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                disabled={isReadOnly}
                required={isRequired}
              >
                <option value="">Select {availableFieldLabel}...</option>
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
                  value={(formData as any)[`${fieldName}_custom`] || ''}
                  onChange={(e) => {
                    if (!isReadOnly) {
                      setFormData((prev: any) => ({ ...prev, [`${fieldName}_custom`]: e.target.value }))
                    }
                  }}
                  className="compact-input mt-2"
                  placeholder={`Enter custom ${availableFieldLabel.toLowerCase()}...`}
                  disabled={isReadOnly}
                />
              )}
            </div>
          )
        } else {
          // No predefined options and custom not allowed, show text input
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`enterprise-form-field ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="enterprise-label">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <input
                type="text"
                value={fieldValue || ''}
                onChange={(e) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))
                  }
                }}
                className="enterprise-input"
                placeholder={fieldConfig.placeholder || `Enter ${availableFieldLabel.toLowerCase()}...`}
                disabled={isReadOnly}
                required={isRequired}
              />
            </div>
          )
        }
      }
      
      // Handle legacy dependent select fields (for backward compatibility)
      if (fieldType === 'select' && fieldConfig.depends_on && !fieldConfig.dependent_options) {
        const dependsOnValue = (formData as any)[fieldConfig.depends_on] || ''
        const dependentOptions = dependsOnValue && fieldConfig.dependent_options 
          ? (fieldConfig.dependent_options[dependsOnValue] || [])
          : []
        
        if (!dependsOnValue) {
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200">
                Please select {fieldConfig.depends_on_label || (fieldConfig.depends_on ? fieldConfig.depends_on.replace(/_/g, ' ') : 'the parent field')} first
              </div>
            </div>
          )
        }
        
        if (dependentOptions.length > 0) {
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <select
                value={fieldValue || ''}
                onChange={(e) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))
                  }
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                disabled={isReadOnly}
                required={isRequired}
              >
                <option value="">Select {availableFieldLabel}...</option>
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
            <div key={`${fieldName}-${fieldIndex}`} className={`enterprise-form-field ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="enterprise-label">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <input
                type="text"
                value={fieldValue || ''}
                onChange={(e) => {
                  if (!isReadOnly) {
                    setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))
                  }
                }}
                className="enterprise-input"
                placeholder={fieldConfig.placeholder || `Enter ${availableFieldLabel.toLowerCase()}...`}
                disabled={isReadOnly}
                required={isRequired}
              />
            </div>
          )
        }
      }
      
      // Handle JSON fields without options (structured key-value input)
      if (fieldType === 'json' && fieldOptions.length === 0) {
        return (
          <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
            <label className="text-xs font-medium text-gray-900 mb-0.5 block">
              {availableFieldLabel}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            {availableField.description && (
              <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
            )}
            <JsonFieldInput
              value={fieldValue}
              onChange={(newValue) => {
                if (!isReadOnly) {
                  setFormData((prev: any) => ({ ...prev, [fieldName]: newValue }))
                }
              }}
              placeholder={fieldConfig.placeholder || availableField.description || 'Add items to the list'}
              disabled={isReadOnly}
              isReadOnly={isReadOnly}
              useTableMode={true}
              fieldLabel={availableFieldLabel}
            />
          </div>
        )
      }
      
      // Render based on field type from available field
      switch (fieldType) {
        case 'textarea':
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              {isReadOnly ? (
                <div 
                  className="compact-input min-h-[150px] p-2 bg-gray-50 border border-gray-200 rounded text-xs"
                  dangerouslySetInnerHTML={{ __html: fieldValue || '' }}
                />
              ) : (
                <div className="rich-text-editor-wrapper">
                  <ReactQuillWrapper
                    theme="snow"
                    value={fieldValue || ''}
                    onChange={(content: string) => {
                      if (!isReadOnly) {
                        setFormData((prev: any) => ({ ...prev, [fieldName]: content }))
                      }
                    }}
                    placeholder={fieldConfig.placeholder || availableField.description || 'Enter formatted text...'}
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
              )}
            </div>
          )
        case 'select':
        case 'multi_select':
          // Select/multi_select without options - render as text input
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <input
                type="text"
                value={fieldValue || ''}
                onChange={(e) => !isReadOnly && setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder={fieldConfig.placeholder || `Enter ${availableFieldLabel.toLowerCase()}...`}
                disabled={isReadOnly}
              />
            </div>
          )
        default:
          return (
            <div key={`${fieldName}-${fieldIndex}`} className={`space-y-2 ${isReadOnly ? 'opacity-75' : ''}`}>
              <label className="text-xs font-medium text-gray-900 mb-0.5 block">
                {availableFieldLabel}
              </label>
              {availableField.description && (
                <p className="text-xs text-gray-500 mb-1">{availableField.description}</p>
              )}
              <input
                type="text"
                value={fieldValue || ''}
                onChange={(e) => !isReadOnly && setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder={availableField.placeholder || `Enter ${availableFieldLabel.toLowerCase()}...`}
                disabled={isReadOnly}
              />
            </div>
          )
      }
    }
    
    // If not in available fields, check requirements
    if (requirement) {
      return (
              <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
          <label className="text-sm font-medium text-gray-900 mb-1 block">
            {requirement.label || (fieldName ? fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Field')}
            {requirement.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {requirement.description && (
            <p className="text-xs text-gray-600 mb-2">{requirement.description}</p>
          )}
          <div className={isReadOnly ? 'opacity-75 pointer-events-none' : ''}>
            {renderRequirementField(requirement)}
          </div>
        </div>
      )
    }
    
    // Fallback: render as generic text field
    // fieldValue and fieldLabel already declared at top of function
    
    return (
              <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
        <label className="text-sm font-medium text-gray-900 mb-1 block">{fieldLabel}</label>
        <input
          type="text"
          value={fieldValue || ''}
          onChange={(e) => !isReadOnly && setFormData((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
          className="compact-input"
          placeholder={`Enter ${fieldLabel.toLowerCase()}`}
          disabled={isReadOnly}
        />
      </div>
    )
    } catch (error) {
      console.error(`Error in renderFieldFromLayout for field ${fieldName}:`, error)
      // Return a simple error placeholder
      return (
        <div key={`${fieldName}-${fieldIndex}-error`} className="space-y-2 p-2 bg-red-50 border border-red-200 rounded">
          <label className="text-sm font-medium text-red-600 mb-1 block">Error rendering field: {fieldName}</label>
          <p className="text-xs text-red-500">{String(error)}</p>
        </div>
      )
    }
  }

  // Fetch field access for current user role (optional - if fails, allow all fields)
  const { data: fieldAccess } = useQuery({
    queryKey: ['field-access', 'vendor_submission_workflow', user?.role, formData.type, 'new'],
    queryFn: () => formLayoutsApi.getFieldsWithAccessForRole('vendor_submission_workflow', user?.role || '', formData.type, 'new').catch((error) => {
      // If field access API fails (400, 422, etc.), return empty array - fields will be visible by default
      if (error?.response?.status === 400 || error?.response?.status === 422 || error?.response?.status === 404) {
        console.warn('Field access API returned error, allowing all fields by default:', error?.response?.status)
        return []
      }
      throw error
    }),
    enabled: !!user && !!user?.role,
    retry: false, // Don't retry on validation errors
  })

  // Create field access map for permission checks (empty if API fails - allows all fields)
  const fieldAccessMap = new Map<string, any>()
  fieldAccess?.forEach((access: any) => {
    fieldAccessMap.set(access.field_name, access)
  })

  const renderStepContent = () => {
    // Wait for layout to load
    if (layoutLoading || (agentId && agentLoading)) {
      return <div className="text-center py-8 text-gray-500">Loading form...</div>
    }
    
    // Show API error if there is one
    if (layoutError) {
      const errorMessage = (layoutError as any)?.response?.data?.detail || 
                          (layoutError as any)?.message || 
                          'Unknown error loading screen layout'
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800 mb-2">
            <strong>Error loading screen layout:</strong> {errorMessage}
          </p>
          <p className="text-sm text-red-700">
            Please contact your administrator or configure a screen layout in the Process Designer.
          </p>
        </div>
      )
    }
    
    // Show error if no layout configured
    if (!formLayout || !formLayout.sections || formLayout.sections.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800 mb-2">
          <strong>No screen layout configured.</strong>
        </p>
        <p className="text-sm text-yellow-700 mb-2">
          A screen layout is required before submitting agents. The system should auto-create a default layout, but it appears none was created.
        </p>
        <p className="text-sm text-yellow-700">
          Please ask your administrator to configure a screen layout in the Process Designer, or refresh the page to trigger auto-creation.
        </p>
      </div>
      )
    }
    
    // Warn if layout has very few sections (might be incomplete) - only log once per layout
    if (formLayout.sections.length === 1 && singleSectionWarningLoggedRef.current !== formLayout.id) {
      singleSectionWarningLoggedRef.current = formLayout.id
      console.warn('Layout has only 1 section. Expected multiple sections for vendor submission workflow.', {
        layoutId: formLayout.id,
        layoutName: formLayout.name,
        sections: formLayout.sections.map((s: any) => ({ id: s.id, title: s.title, fieldsCount: (s.fields || []).length }))
      })
    }
    
    // Get current step section from layout
    const stepIndex = currentStep - 1
    const currentStepSection = STEPS[stepIndex]
    
    if (!currentStepSection) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">Step {currentStep} not found in screen layout.</p>
          <p className="text-sm">Please configure this step in the Process Designer.</p>
        </div>
      )
    }
    
    // Get fields from layout configuration
    const fieldsFromLayout = currentStepSection.fields || []
    
    if (fieldsFromLayout.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No fields configured for this step.</p>
          <p className="text-sm">Please configure fields in the Process Designer.</p>
        </div>
      )
    }
    
    // Filter fields based on role permissions (can_view)
    // For vendor_submission_workflow, ignore permissions - show all fields from layout
    // The form is controlled by tenant admin, vendors should fill all fields as asked
    // First, filter out any invalid field names (null, undefined, empty, or not strings)
    const validFields = fieldsFromLayout.filter((fieldName: any) => {
      return fieldName && typeof fieldName === 'string' && fieldName.trim().length > 0
    })
    
    const visibleFields = validFields.filter((fieldName: string) => {
      // For vendor submissions, always show all fields from layout (permissions don't matter)
      if (formLayout?.request_type === 'vendor_submission_workflow') {
        return true
      }
      // For other workflows, check permissions
      // If no field access data, allow all fields
      if (!fieldAccess || fieldAccess.length === 0) {
        return true
      }
      const access = fieldAccessMap.get(fieldName)
      // If no access defined for this field, allow by default
      return !access || access.can_view !== false
    })
    
    // Debug: Log field rendering - only log once per layout+step combination
    const fieldDebugKey = `${formLayout?.id}-${currentStep}`
    // Debug logging commented out to reduce console noise
    // if (fieldRenderingDebugLoggedRef.current !== fieldDebugKey) {
    //   fieldRenderingDebugLoggedRef.current = fieldDebugKey
    //   console.log('Field rendering debug:', {
    //     totalFieldsInLayout: fieldsFromLayout.length,
    //     visibleFieldsCount: visibleFields.length,
    //     fieldNames: visibleFields,
    //     availableFieldsMapSize: availableFieldsMap.size,
    //     requirementsMapSize: requirementsMap.size,
    //     customFieldsMapSize: customFieldsMap.size,
    //     fieldAccessMapSize: fieldAccessMap.size
    //   })
    // }
    
    // Render fields with permissions
    const renderedFields = visibleFields
      .map((fieldName: string, idx: number) => {
        try {
          const access = fieldAccessMap.get(fieldName)
          // For vendor submissions, ignore edit permissions - allow editing all fields
          // For other workflows, check edit permissions
          const isReadOnly = formLayout?.request_type === 'vendor_submission_workflow'
            ? false // Always allow editing for vendor submissions
            : (fieldAccess && fieldAccess.length > 0 && access && !access.can_edit)
          
          // Check for required override from layout section
          const isRequiredOverride = currentStepSection.required_fields?.includes(fieldName)
          
          // Render field
          const fieldElement = renderFieldFromLayout(fieldName, currentStep, isReadOnly, idx, isRequiredOverride)
          
          if (!fieldElement) return null

          // Wrap in a div with a unique key to avoid duplicate key warnings
          return (
            <div key={`${fieldName}-${idx}`} className="w-full enterprise-form-field-wrapper">
              {fieldElement}
            </div>
          )
        } catch (error) {
          console.error(`Error rendering field ${fieldName}:`, error)
          // Return a placeholder div to prevent the entire form from breaking
          return (
            <div key={`${fieldName}-${idx}-error`} className="w-full p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">Error rendering field: {fieldName}</p>
              <p className="text-xs text-red-500">{String(error)}</p>
            </div>
          )
        }
      })
      .filter((f: any) => {
        const isFiltered = f === null || f === undefined
        if (isFiltered) {
          console.warn('Filtered out field element:', f)
        }
        return !isFiltered
      })
    
    // Debug: Log final rendered fields count - only log once per layout+step combination (commented out to reduce console noise)
    // const finalFieldsDebugKey = `${formLayout?.id}-${currentStep}`
    // if (finalRenderedFieldsLoggedRef.current !== finalFieldsDebugKey) {
    //   finalRenderedFieldsLoggedRef.current = finalFieldsDebugKey
    //   console.log('Final rendered fields:', {
    //     totalVisibleFields: visibleFields.length,
    //     totalRenderedFields: renderedFields.length,
    //     renderedFieldKeys: renderedFields.map((f: any) => f?.key || 'no-key')
    //   })
    // }
    
    if (renderedFields.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No fields available for your role.</p>
        </div>
      )
    }
    
    return (
      <div className="space-y-6">
        {renderedFields}
      </div>
    )
  }
    
  // Constants for data processing categories and regions
  const DATA_PROCESSING_CATEGORIES = [
    'PII (Personally Identifiable Information)',
    'PHI (Protected Health Information)',
    'Credit Cards',
    'Financial Data',
    'Users',
    'Employee Data',
    'Customer Data',
    'Transactional Data',
    'Biometric Data',
    'Location Data',
    'Behavioral Data',
    'Analytical Data',
    'Logs & Metrics',
    'Configuration Data',
    'Credentials & Secrets',
    'Documents & Files',
    'Media (Images, Video, Audio)',
    'Other'
  ]

  const WORLD_REGIONS = [
    'US',
    'EU',
    'UK',
    'APAC',
    'Canada',
    'Australia',
    'Latin America',
    'Middle East',
    'Africa',
    'Global'
  ]

  // Helper function to render special field types that need custom UI (like category/subcategory dropdowns)
  const renderSpecialField = (fieldName: string, fieldValue: any, idx?: number) => {
    // Get label from available fields if configured in form designer
    const availableField = availableFieldsMap.get(fieldName)
    
    const elementKey = idx !== undefined ? `${fieldName}-${idx}` : fieldName

    // Handle category field with dropdown - use options from field_config
    if (fieldName === 'category') {
      const label = availableField?.label?.trim() || 'Category'
      const fieldConfig = (availableField as any)?.field_config || {}
      const options = fieldConfig.options || []
      
      // Convert options to SearchableSelectOption format
      const categoryOptions: SearchableSelectOption[] = options.map((opt: any) => {
        if (typeof opt === 'string') {
          return { value: opt, label: opt }
        }
        return { value: opt.value || opt.label, label: opt.label || opt.value }
      })
      
      return (
        <SearchableSelect
          key={elementKey}
          label={label}
          value={formData.category || null}
          onChange={(value) => {
            setFormData({ ...formData, category: value as string, subcategory: '' })
          }}
          options={categoryOptions}
          placeholder="Search or select category..."
          searchPlaceholder="Search or select category..."
          emptyMessage="No categories found"
          required={availableField?.is_required || false}
        />
      )
    }

    // Handle subcategory field with dropdown - use dependent_options from field_config
    if (fieldName === 'subcategory' && formData.category) {
      const label = availableField?.label?.trim() || 'Subcategory'
      const fieldConfig = (availableField as any)?.field_config || {}
      const dependentOptions = fieldConfig.dependent_options || {}
      const subcategories = dependentOptions[formData.category] || []
      
      if (subcategories.length === 0) {
        return null
      }
      
      // Convert to SearchableSelectOption format
      const subcategoryOptions: SearchableSelectOption[] = subcategories.map((opt: any) => {
        if (typeof opt === 'string') {
          return { value: opt, label: opt }
        }
        return { value: opt.value || opt.label, label: opt.label || opt.value }
      })
      
      return (
        <SearchableSelect
          key={elementKey}
          label={label}
          value={formData.subcategory || null}
          onChange={(value) => {
            setFormData({ ...formData, subcategory: value as string })
          }}
          options={subcategoryOptions}
          placeholder="Search or select subcategory..."
          searchPlaceholder="Search or select subcategory..."
          emptyMessage="No subcategories found"
          required={availableField?.is_required || false}
        />
      )
    }

    // Note: 'type' field is now handled through normal field rendering path
    // It should have field_type='select' and field_config.options populated

    // Handle LLM vendor field
    if (fieldName === 'llm_vendor') {
      return (
        <div key={elementKey}>
          <label className="text-sm font-medium mb-1 block">LLM Vendor *</label>
          <select
            className="compact-input"
            value={formData.llm_vendor}
            onChange={(e) => {
              const newVendor = e.target.value
              // Reset model when vendor changes (unless it's a custom model)
              const availableModels = VENDOR_MODELS[newVendor] || []
              const currentModel = formData.llm_model || ''
              // Keep model only if it's still valid for the new vendor
              const keepModel = availableModels.includes(currentModel) || currentModel === 'Custom'
              setFormData({ 
                ...formData, 
                llm_vendor: newVendor,
                llm_model: keepModel ? currentModel : ''
              })
            }}
            required
          >
            <option value="">Select vendor</option>
            <option value="OpenAI">OpenAI</option>
            <option value="Anthropic">Anthropic</option>
            <option value="Google">Google</option>
            <option value="Microsoft">Microsoft</option>
            <option value="Meta">Meta</option>
            <option value="Amazon">Amazon (AWS)</option>
            <option value="Cohere">Cohere</option>
            <option value="Mistral AI">Mistral AI</option>
            <option value="Customer Choice">Customer Choice (Customer's own LLM)</option>
            <option value="Other">Other</option>
          </select>
          {formData.llm_vendor === 'Customer Choice' && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-400 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> When using the customer's own LLM, please specify the model name below and ensure 
                data sharing and usage policies are clearly documented.
              </p>
            </div>
          )}
        </div>
      )
    }

    // Handle LLM model field
    if (fieldName === 'llm_model') {
      const label = availableField?.label?.trim() || 'LLM Model'
      
      if (!formData.llm_vendor) {
        return (
          <div key={elementKey} className="border border-gray-200 rounded-lg p-4 text-center text-sm text-muted-foreground">
            Please select an LLM vendor first
          </div>
        )
      }
      
      // For "Other" vendor, show a text input for custom model
      if (formData.llm_vendor === 'Other') {
        return (
          <div key={elementKey}>
            <label className="text-sm font-medium mb-1 block">{label} *</label>
            <input
              type="text"
              className="compact-input"
              value={formData.llm_model || ''}
              onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
              placeholder="e.g., custom-llm-v2, internal-model-1.0, vendor-specific-model"
              required
            />
          </div>
        )
      }
      
      // For "Customer Choice", show a text input for custom model
      if (formData.llm_vendor === 'Customer Choice') {
        return (
          <div key={elementKey}>
            <label className="text-sm font-medium mb-1 block">{label} *</label>
            <input
              type="text"
              className="compact-input"
              value={formData.llm_model || ''}
              onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
              placeholder="e.g., customer-llm-v2, internal-model-1.0"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Specify the model name for the customer's own LLM
            </p>
          </div>
        )
      }
      
      // For other vendors, show dropdown with predefined models
      return (
        <div key={elementKey}>
          <label className="text-sm font-medium mb-1 block">{label} *</label>
          <select
            className="compact-input"
            value={formData.llm_model || ''}
            onChange={(e) => {
              setFormData({ ...formData, llm_model: e.target.value })
            }}
            required
          >
            <option value="">Select model</option>
            {VENDOR_MODELS[formData.llm_vendor]?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            <option value="Custom">Custom Model</option>
          </select>
        </div>
      )
    }

    // Handle LLM model custom field
    if (fieldName === 'llm_model_custom') {
      if (!formData.llm_vendor) {
        return null
      }
      
      if (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') {
        return (
          <div key={elementKey}>
            <label className="text-sm font-medium mb-1 block">LLM Model *</label>
            <input
              type="text"
              className="compact-input"
              value={formData.llm_model_custom}
              onChange={(e) => setFormData({ ...formData, llm_model_custom: e.target.value })}
              placeholder="e.g., custom-llm-v2, internal-model-1.0, vendor-specific-model"
              required
            />
          </div>
        )
      }
      
      if (formData.llm_model === 'Custom') {
        return (
          <div key={elementKey}>
            <label className="text-sm font-medium mb-1 block">Custom Model Name</label>
            <input
              type="text"
              className="compact-input"
              value={formData.llm_model_custom || ''}
              onChange={(e) => setFormData({ ...formData, llm_model_custom: e.target.value })}
              placeholder="Enter custom model name (e.g., custom-llm-v2, internal-model-1.0)"
            />
          </div>
        )
      }
      
      return null
    }

    // Handle deployment type field
    if (fieldName === 'deployment_type') {
      return (
        <div key={`${fieldName}-${fieldIndex}`}>
          <label className="text-sm font-medium mb-1 block">Deployment Type *</label>
          <select
            className="compact-input"
            value={formData.deployment_type}
            onChange={(e) => setFormData({ ...formData, deployment_type: e.target.value })}
            required
          >
            <option value="">Select deployment type</option>
            <option value="cloud">Cloud</option>
            <option value="on_premise">On-Premise</option>
            <option value="hybrid">Hybrid</option>
            <option value="edge">Edge</option>
          </select>
        </div>
      )
    }

    // Handle data_sharing_scope field - special field with checkboxes and structured data
    if (fieldName === 'data_sharing_scope') {
      const scope = formData.data_sharing_scope || {
        shares_pii: false,
        shares_phi: false,
        shares_financial_data: false,
        shares_biometric_data: false,
        data_retention_period: '',
        data_processing_location: []
      }
      const label = availableField?.label?.trim() || 'Data Sharing Scope'
      const description = availableField?.description?.trim() || 'Data sharing information'
      
      return (
        <div key={`${fieldName}-${fieldIndex}`}>
          <label className="text-sm font-medium text-gray-900 mb-3 block">{label}</label>
          <p className="text-xs text-gray-500 mb-3">{description}</p>
          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.shares_pii || false}
                onChange={(e) => setFormData({
                  ...formData,
                  data_sharing_scope: {
                    ...scope,
                    shares_pii: e.target.checked
                  }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">Shares Personally Identifiable Information (PII)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.shares_phi || false}
                onChange={(e) => setFormData({
                  ...formData,
                  data_sharing_scope: {
                    ...scope,
                    shares_phi: e.target.checked
                  }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">Shares Protected Health Information (PHI)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.shares_financial_data || false}
                onChange={(e) => setFormData({
                  ...formData,
                  data_sharing_scope: {
                    ...scope,
                    shares_financial_data: e.target.checked
                  }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">Shares Financial Data</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.shares_biometric_data || false}
                onChange={(e) => setFormData({
                  ...formData,
                  data_sharing_scope: {
                    ...scope,
                    shares_biometric_data: e.target.checked
                  }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">Shares Biometric Data</span>
            </label>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="text-xs font-medium mb-0.5 block">Data Retention Period</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={scope.data_retention_period || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  data_sharing_scope: {
                    ...scope,
                    data_retention_period: e.target.value
                  }
                })}
                placeholder="e.g., 30 days, 1 year, indefinite"
              />
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium mb-0.5 block">Data Processing Location</label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {WORLD_REGIONS.map((region) => (
                  <label key={region} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(scope.data_processing_location || []).includes(region)}
                      onChange={(e) => {
                        const locations = e.target.checked
                          ? [...(scope.data_processing_location || []), region]
                          : (scope.data_processing_location || []).filter((l: string) => l !== region)
                        setFormData({
                          ...formData,
                          data_sharing_scope: {
                            ...scope,
                            data_processing_location: locations
                          }
                        })
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{region}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Handle data_usage_purpose field - rich text
    if (fieldName === 'data_usage_purpose') {
      const label = availableField?.label?.trim() || 'Data Usage Purpose'
      const description = availableField?.description?.trim() || 'How data is used with LLM'
      return (
        <div key={elementKey}>
          <label className="text-sm font-medium text-gray-900 mb-1 block">{label}</label>
          <p className="text-xs text-gray-500 mb-2">{description}</p>
          <div className="rich-text-editor-wrapper">
            <ReactQuillWrapper
              theme="snow"
              value={formData.data_usage_purpose || ''}
              onChange={(content: string) => setFormData({ ...formData, data_usage_purpose: content })}
              placeholder="Describe how the agent uses data with the LLM. For example:&#10;- Training the model&#10;- Generating responses&#10;- Analyzing user queries&#10;- Personalizing experiences"
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
          <p className="text-xs text-muted-foreground mt-1">
            Explain the purpose and manner in which data is processed by the LLM
          </p>
        </div>
      )
    }

    // Handle data_types field - special field with checkboxes for data processing categories
    if (fieldName === 'data_types') {
      const dataTypes = Array.isArray(formData.data_types) ? formData.data_types : []
      const label = availableField?.label?.trim() || 'Types of Data Processed'
      const description = availableField?.description?.trim() || 'Select all data processing categories that apply'
      
      return (
        <div key={`${fieldName}-${fieldIndex}`}>
          <label className="text-sm font-medium text-gray-900 mb-1 block">{label}</label>
          <p className="text-xs text-gray-500 mb-3">{description}</p>
          <div className="space-y-2 border border-gray-200 rounded-lg p-4">
            {DATA_PROCESSING_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataTypes.includes(category)}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...dataTypes, category]
                      : dataTypes.filter((dt: string) => dt !== category)
                    setFormData({ ...formData, data_types: newTypes })
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{category}</span>
              </label>
            ))}
          </div>
          {dataTypes.length > 0 && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-400 rounded text-xs">
              <strong>Selected:</strong> {dataTypes.join(', ')}
            </div>
          )}
        </div>
      )
    }

    // Handle regions field - special field with checkboxes for world regions
    if (fieldName === 'regions') {
      const regions = Array.isArray(formData.regions) ? formData.regions : []
      const label = availableField?.label?.trim() || 'World Regions'
      const description = availableField?.description?.trim() || 'Select all regions where the agent operates'
      
      return (
        <div key={elementKey}>
          <label className="text-sm font-medium text-gray-900 mb-1 block">{label}</label>
          <p className="text-xs text-gray-500 mb-3">{description}</p>
          <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-lg p-4">
            {WORLD_REGIONS.map((region) => (
              <label key={region} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regions.includes(region)}
                  onChange={(e) => {
                    let newRegions: string[]
                    
                    if (region === 'Global') {
                      // If Global is checked, select all regions
                      // If Global is unchecked, uncheck all regions
                      if (e.target.checked) {
                        newRegions = [...WORLD_REGIONS]
                      } else {
                        newRegions = []
                      }
                    } else {
                      // For other regions
                      if (e.target.checked) {
                        // Add the region
                        newRegions = [...regions, region]
                        // If all other regions are now selected, also select Global
                        const otherRegions = WORLD_REGIONS.filter(r => r !== 'Global')
                        const selectedOtherRegions = newRegions.filter(r => r !== 'Global')
                        if (selectedOtherRegions.length === otherRegions.length) {
                          newRegions = [...newRegions, 'Global']
                        }
                      } else {
                        // Remove the region
                        newRegions = regions.filter((r: string) => r !== region)
                        // If Global was selected, uncheck it when any other region is unchecked
                        if (newRegions.includes('Global')) {
                          newRegions = newRegions.filter((r: string) => r !== 'Global')
                        }
                      }
                    }
                    
                    setFormData({ ...formData, regions: newRegions })
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{region}</span>
              </label>
            ))}
          </div>
          {regions.length > 0 && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-400 rounded text-xs">
              <strong>Selected:</strong> {regions.join(', ')}
            </div>
          )}
        </div>
      )
    }

    // Handle version_info field - special field with structured version information
    if (fieldName === 'version_info') {
      const versionInfo = formData.version_info || {
        release_notes: '',
        changelog: '',
        compatibility: '',
        known_issues: '',
      }
      
      return (
        <div key={`${fieldName}-${fieldIndex}`}>
          <label className="text-sm font-medium mb-1 block">Version Information</label>
          <p className="text-xs text-gray-500 mb-3">Release notes and compatibility information</p>
          <div className="space-y-4 border border-gray-200 rounded-lg p-4">
            <div>
              <label className="text-xs font-medium mb-0.5 block">Release Notes</label>
              <textarea
                className="compact-input min-h-[100px]"
                value={versionInfo.release_notes || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...versionInfo, release_notes: e.target.value }
                })}
                placeholder="What's new in this version..."
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-0.5 block">Changelog</label>
              <textarea
                className="compact-input min-h-[100px]"
                value={versionInfo.changelog || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...versionInfo, changelog: e.target.value }
                })}
                placeholder="List of changes..."
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-0.5 block">Compatibility</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={versionInfo.compatibility || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...versionInfo, compatibility: e.target.value }
                })}
                placeholder="e.g., Python 3.8+, Node.js 16+"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-0.5 block">Known Issues</label>
              <textarea
                className="compact-input min-h-[80px]"
                value={versionInfo.known_issues || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...versionInfo, known_issues: e.target.value }
                })}
                placeholder="Any known issues or limitations..."
              />
            </div>
          </div>
        </div>
      )
    }

    // Handle connection_diagram field - special field with Mermaid diagram editor
    if (fieldName === 'connection_diagram') {
      // Initialize edited diagram when starting to edit
      const handleStartEdit = () => {
        setEditedConnectionDiagram(formData.connection_diagram || '')
        setIsEditingConnectionDiagram(true)
      }
      
      const handleSave = () => {
        setFormData({ ...formData, connection_diagram: editedConnectionDiagram })
        setIsEditingConnectionDiagram(false)
      }
      
      const handleCancel = () => {
        setEditedConnectionDiagram(formData.connection_diagram || '')
        setIsEditingConnectionDiagram(false)
      }
      
      return (
        <div key={`${fieldName}-${fieldIndex}`}>
          <label className="text-sm font-medium mb-1 block">Connection Diagram</label>
          <p className="text-xs text-gray-500 mb-3">Create a Mermaid diagram showing agent connections</p>
          {isEditingConnectionDiagram ? (
            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <textarea
                value={editedConnectionDiagram}
                onChange={(e) => setEditedConnectionDiagram(e.target.value)}
                placeholder="Enter Mermaid diagram code..."
                className="w-full min-h-[300px] p-3 border rounded font-mono text-sm"
                style={{ fontFamily: 'monospace' }}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSave}
                  className="compact-button-primary"
                >
                  Save Diagram
                </button>
                <button
                  onClick={handleCancel}
                  className="compact-button-secondary"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter Mermaid diagram syntax. The diagram will be rendered automatically.
              </p>
              {editedConnectionDiagram && (
                <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <MermaidDiagram diagram={editedConnectionDiagram} id={`connection-diagram-preview-${fieldName}`} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              {formData.connection_diagram ? (
                <>
                  <MermaidDiagram diagram={formData.connection_diagram} id={`connection-diagram-${fieldName}`} />
                  <button
                    onClick={handleStartEdit}
                    className="compact-button-secondary"
                  >
                    Edit Diagram
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm mb-4">No connection diagram yet</p>
                  <button
                    onClick={handleStartEdit}
                    className="compact-button-primary"
                  >
                    + Add Diagram
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  // Legacy hardcoded step rendering removed - now using layout-driven rendering above
  // Keeping this comment for reference
  // Wrapped in false condition to prevent unreachable code warnings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const LEGACY_CODE_DISABLED = false
  if (LEGACY_CODE_DISABLED) {
  const _legacyHardcodedSteps = () => {
    switch (currentStep) {
      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-400 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Why we need this:</strong> Understanding the AI/LLM configuration helps us assess data privacy risks, 
                compliance requirements, and security implications for your agent.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium mb-0.5 block">LLM Vendor *</label>
              <select
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={formData.llm_vendor}
                onChange={(e) => {
                  const newVendor = e.target.value
                  // Reset model when vendor changes (unless it's a custom model)
                  const availableModels = VENDOR_MODELS[newVendor] || []
                  const currentModel = formData.llm_model || ''
                  // Keep model only if it's still valid for the new vendor
                  const keepModel = availableModels.includes(currentModel) || currentModel === 'Custom'
                  setFormData({ 
                    ...formData, 
                    llm_vendor: newVendor,
                    llm_model: keepModel ? currentModel : ''
                  })
                }}
              >
                <option value="">Select vendor</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Google">Google</option>
                <option value="Microsoft">Microsoft</option>
                <option value="Meta">Meta</option>
                <option value="Amazon">Amazon (AWS)</option>
                <option value="Cohere">Cohere</option>
                <option value="Mistral AI">Mistral AI</option>
                <option value="Customer Choice">Customer Choice (Customer's own LLM)</option>
                <option value="Other">Other</option>
              </select>
              {formData.llm_vendor === 'Other' && (
                <input
                  type="text"
                  className="compact-input mt-2"
                  placeholder="Specify vendor name"
                  value={formData.llm_vendor === 'Other' ? formData.llm_vendor : ''}
                  onChange={(e) => setFormData({ ...formData, llm_vendor: e.target.value })}
                />
              )}
              {formData.llm_vendor === 'Customer Choice' && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-400 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> When using the customer's own LLM, please specify the model name below and ensure 
                    data sharing and usage policies are clearly documented.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium mb-0.5 block">LLM Model *</label>
              {!formData.llm_vendor ? (
                <div className="border border-gray-200 rounded-lg p-4 text-center text-sm text-muted-foreground">
                  Please select an LLM vendor first
                </div>
              ) : (formData.llm_vendor === 'Customer Choice' || formData.llm_vendor === 'Other') ? (
                <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    {formData.llm_vendor === 'Customer Choice' 
                      ? 'Enter the model name for the customer\'s LLM:'
                      : 'Enter the model name for this vendor:'}
                  </p>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    value={formData.llm_model_custom}
                    onChange={(e) => setFormData({ ...formData, llm_model_custom: e.target.value })}
                    placeholder="e.g., custom-llm-v2, internal-model-1.0, vendor-specific-model"
                  />
                </div>
              ) : (
                <>
                  <select
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    value={formData.llm_model || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, llm_model: e.target.value })
                    }}
                    required
                  >
                    <option value="">Select model</option>
                    {VENDOR_MODELS[formData.llm_vendor]?.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                    <option value="Custom">Custom Model</option>
                  </select>
                  {formData.llm_model === 'Custom' && (
                    <input
                      type="text"
                      className="compact-input mt-2"
                      value={formData.llm_model_custom || ''}
                      onChange={(e) => setFormData({ ...formData, llm_model_custom: e.target.value })}
                      placeholder="Enter custom model name (e.g., custom-llm-v2, internal-model-1.0)"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Select the model your agent uses.
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="text-xs font-medium mb-0.5 block">Deployment Type *</label>
              <select
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={formData.deployment_type}
                onChange={(e) => setFormData({ ...formData, deployment_type: e.target.value })}
              >
                <option value="">Select deployment type</option>
                <option value="public_cloud_saas">Public Cloud SaaS</option>
                <option value="private_cloud_customer">Private Cloud (Customer)</option>
                <option value="vendor_cloud">Vendor's Cloud</option>
                <option value="onprem_customer">OnPrem-Customer</option>
                <option value="hybrid">Hybrid</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Where is the LLM deployed? This affects data residency and compliance requirements.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Data Sharing Scope</label>
              <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.data_sharing_scope.shares_pii}
                    onChange={(e) => setFormData({
                      ...formData,
                      data_sharing_scope: {
                        ...formData.data_sharing_scope,
                        shares_pii: e.target.checked
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Shares Personally Identifiable Information (PII)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.data_sharing_scope.shares_phi}
                    onChange={(e) => setFormData({
                      ...formData,
                      data_sharing_scope: {
                        ...formData.data_sharing_scope,
                        shares_phi: e.target.checked
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Shares Protected Health Information (PHI)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.data_sharing_scope.shares_financial_data}
                    onChange={(e) => setFormData({
                      ...formData,
                      data_sharing_scope: {
                        ...formData.data_sharing_scope,
                        shares_financial_data: e.target.checked
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Shares Financial Data</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.data_sharing_scope.shares_biometric_data}
                    onChange={(e) => setFormData({
                      ...formData,
                      data_sharing_scope: {
                        ...formData.data_sharing_scope,
                        shares_biometric_data: e.target.checked
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Shares Biometric Data</span>
                </label>
                <div className="mt-4">
                  <label className="text-xs font-medium mb-0.5 block">Data Retention Period</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    value={formData.data_sharing_scope.data_retention_period}
                    onChange={(e) => setFormData({
                      ...formData,
                      data_sharing_scope: {
                        ...formData.data_sharing_scope,
                        data_retention_period: e.target.value
                      }
                    })}
                    placeholder="e.g., 30 days, 1 year, indefinite"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-0.5 block">Data Processing Location</label>
                  <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('US')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'US']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'US')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">US</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('EU')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'EU']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'EU')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">EU</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('UK')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'UK']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'UK')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">UK</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('APAC')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'APAC']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'APAC')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">APAC</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('Canada')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'Canada']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'Canada')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Canada</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('Australia')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'Australia']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'Australia')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Australia</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_sharing_scope.data_processing_location.includes('Global')}
                        onChange={(e) => {
                          const locations = e.target.checked
                            ? [...formData.data_sharing_scope.data_processing_location, 'Global']
                            : formData.data_sharing_scope.data_processing_location.filter(l => l !== 'Global')
                          setFormData({
                            ...formData,
                            data_sharing_scope: {
                              ...formData.data_sharing_scope,
                              data_processing_location: locations
                            }
                          })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Global</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-0.5 block">Data Usage Purpose</label>
              <textarea
                className="compact-input min-h-[120px]"
                value={formData.data_usage_purpose}
                onChange={(e) => setFormData({ ...formData, data_usage_purpose: e.target.value })}
                placeholder="Describe how the agent uses data with the LLM. For example:&#10;- Training the model&#10;- Generating responses&#10;- Analyzing user queries&#10;- Personalizing experiences"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Explain the purpose and manner in which data is processed by the LLM
              </p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-medium mb-3">Capabilities</h3>
              <div className="space-y-2">
                <div className="rich-text-editor-wrapper">
                  <ReactQuillWrapper
                    theme="snow"
                    value={typeof formData.capabilities === 'string' 
                      ? formData.capabilities 
                      : (Array.isArray(formData.capabilities) 
                          ? formData.capabilities.map((c: any) => `<p>${c}</p>`).join('') 
                          : '')}
                    onChange={(content: string) => {
                      setFormData({
                        ...formData,
                        capabilities: content,
                      })
                    }}
                    placeholder="Describe the agent's capabilities (e.g., Natural Language Processing, Image Recognition, Data Analysis)"
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
                <p className="text-xs text-muted-foreground">
                  Use the rich text editor to format and describe the agent's capabilities.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium mb-3">Data Types</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-lg max-h-[300px] overflow-y-auto">
                  {dataTypeOptions.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.data_types.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              data_types: [...formData.data_types, option],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              data_types: formData.data_types.filter(dt => dt !== option),
                            })
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.data_types.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.data_types.map((dt, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"
                      >
                        {dt}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              data_types: formData.data_types.filter((_, i) => i !== idx),
                            })
                          }}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-medium mb-3">Regions</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-lg max-h-[300px] overflow-y-auto">
                  {regionOptions.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.regions.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              regions: [...formData.regions, option],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              regions: formData.regions.filter(r => r !== option),
                            })
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.regions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.regions.map((region, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 flex items-center gap-1"
                      >
                        {region}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              regions: formData.regions.filter((_, i) => i !== idx),
                            })
                          }}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium mb-3">Use Cases (5-10 recommended for assessment)</h3>
              <div className="space-y-3">
                <div className="rich-text-editor-wrapper">
                  <ReactQuillWrapper
                    theme="snow"
                    value={typeof formData.use_cases === 'string' 
                      ? formData.use_cases 
                      : (Array.isArray(formData.use_cases) 
                          ? formData.use_cases.map((uc: any) => `<p>${uc}</p>`).join('') 
                          : '')}
                    onChange={(content: string) => {
                      setFormData({
                        ...formData,
                        use_cases: content,
                      })
                    }}
                    placeholder="Describe the agent's use cases (e.g., Automated customer support, Data analysis and reporting, Content generation)"
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
                <p className="text-xs text-muted-foreground">
                  Use the rich text editor to format and describe the agent's use cases. Recommended: 5-10 use cases for assessment.
                </p>
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-medium mb-3">Target Personas</h3>
              <div className="space-y-2">
                <div className="rich-text-editor-wrapper">
                  <ReactQuillWrapper
                    theme="snow"
                    value={typeof formData.personas === 'string' 
                      ? formData.personas 
                      : (Array.isArray(formData.personas) && formData.personas.length > 0 && typeof formData.personas[0] === 'object' && 'name' in formData.personas[0]
                          ? (formData.personas as Array<{ name: string; description: string }>).map((p: any) => `<p><strong>${p.name || 'Persona'}:</strong> ${p.description || ''}</p>`).join('') 
                          : '')}
                    onChange={(content: string) => {
                      setFormData({
                        ...formData,
                        personas: content,
                      })
                    }}
                    placeholder="List the target personas for this agent (e.g., Data Analyst, Business User, System Administrator)"
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
                <p className="text-xs text-muted-foreground">
                  Use the rich text editor to format and describe the target personas for this agent.
                </p>
              </div>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Agent Connections</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Define the systems and applications your agent connects to. This will help generate a connection diagram and automatically identify applicable compliance frameworks.
              </p>
            </div>

            {/* Connection Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Connection Form */}
              <div className="space-y-4">
                <div className="compact-card space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-0.5 block">Entity/Connection Name *</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                      value={connectionInput.name}
                      onChange={(e) => {
                        setConnectionInput({ ...connectionInput, name: e.target.value })
                        // Trigger real-time diagram update
                        setTimeout(() => {
                          const tempConnections = formData.connections.length > 0 
                            ? [...formData.connections, { ...connectionInput, name: e.target.value }]
                            : [{ ...connectionInput, name: e.target.value }]
                          generateDiagramPreview(tempConnections)
                        }, 300)
                      }}
                      placeholder="e.g., User, Firewall, Browser, SAP, PACS"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Name of the entity or system the agent connects to
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium mb-0.5 block">From *</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        value={connectionInput.source_system || 'Agent'}
                        onChange={(e) => {
                          setConnectionInput({ ...connectionInput, source_system: e.target.value || 'Agent' })
                          setTimeout(() => {
                            const tempConnections = formData.connections.length > 0 
                              ? [...formData.connections, { ...connectionInput, source_system: e.target.value || 'Agent' }]
                              : [{ ...connectionInput, source_system: e.target.value || 'Agent' }]
                            generateDiagramPreview(tempConnections)
                          }, 300)
                        }}
                        placeholder="Agent"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-0.5 block">To (Entity) *</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        value={connectionInput.destination_system || connectionInput.app_name || connectionInput.name || ''}
                        onChange={(e) => {
                          const dest = e.target.value
                          setConnectionInput({ 
                            ...connectionInput, 
                            destination_system: dest,
                            app_name: dest, // Keep app_name in sync for backend
                            // Auto-populate name if empty
                            name: connectionInput.name || dest
                          })
                          setTimeout(() => {
                            const tempConnections = formData.connections.length > 0 
                              ? [...formData.connections, { 
                                  ...connectionInput, 
                                  destination_system: dest, 
                                  app_name: dest,
                                  name: connectionInput.name || dest
                                }]
                              : [{ 
                                  ...connectionInput, 
                                  destination_system: dest, 
                                  app_name: dest,
                                  name: connectionInput.name || dest
                                }]
                            generateDiagramPreview(tempConnections)
                          }, 300)
                        }}
                        placeholder="e.g., User, Firewall, Browser, SAP, PACS"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-0.5 block">Connection Type *</label>
                      <select
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        value={connectionInput.protocol || ''}
                        onChange={(e) => {
                          setConnectionInput({ ...connectionInput, protocol: e.target.value })
                          setTimeout(() => {
                            const tempConnections = formData.connections.length > 0 
                              ? [...formData.connections, { ...connectionInput, protocol: e.target.value }]
                              : [{ ...connectionInput, protocol: e.target.value }]
                            generateDiagramPreview(tempConnections)
                          }, 300)
                        }}
                        required
                      >
                        <option value="">Select Connection Type</option>
                        <option value="api">API</option>
                        <option value="rest_api">REST API</option>
                        <option value="graphql">GraphQL</option>
                        <option value="grpc">gRPC</option>
                        <option value="websocket">WebSocket</option>
                        <option value="db">DB (Database)</option>
                        <option value="database">Database (Generic)</option>
                        <option value="file">File</option>
                        <option value="file_system">File System</option>
                        <option value="tcp_ip">TCP/IP</option>
                        <option value="udp">UDP</option>
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="ftp">FTP</option>
                        <option value="sftp">SFTP</option>
                        <option value="mqtt">MQTT</option>
                        <option value="amqp">AMQP</option>
                        <option value="smtp">SMTP</option>
                        <option value="ldap">LDAP</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-0.5 block">Data Flow *</label>
                      <select
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        value={connectionInput.data_flow_direction}
                        onChange={(e) => {
                          setConnectionInput({ ...connectionInput, data_flow_direction: e.target.value as any })
                          setTimeout(() => {
                            const tempConnections = formData.connections.length > 0 
                              ? [...formData.connections, { ...connectionInput, data_flow_direction: e.target.value }]
                              : [{ ...connectionInput, data_flow_direction: e.target.value }]
                            generateDiagramPreview(tempConnections)
                          }, 300)
                        }}
                        required
                      >
                        <option value="bidirectional">Both (Pull & Push)</option>
                        <option value="inbound">Pull (to Agent)</option>
                        <option value="outbound">Push (from Agent)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const currentFrom = connectionInput.source_system || 'Agent'
                          const currentTo = connectionInput.destination_system || connectionInput.app_name || connectionInput.name
                          setConnectionInput({
                            ...connectionInput,
                            source_system: currentTo,
                            destination_system: currentFrom,
                            app_name: currentFrom
                          })
                          setTimeout(() => {
                            const tempConnections = formData.connections.length > 0 
                              ? [...formData.connections, { 
                                  ...connectionInput, 
                                  source_system: currentTo,
                                  destination_system: currentFrom,
                                  app_name: currentFrom
                                }]
                              : [{ 
                                  ...connectionInput, 
                                  source_system: currentTo,
                                  destination_system: currentFrom,
                                  app_name: currentFrom
                                }]
                            generateDiagramPreview(tempConnections)
                          }, 300)
                        }}
                        className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                        title="Swap From and To"
                      >
                        ⇄ Swap
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const entityName = connectionInput.name || connectionInput.destination_system || connectionInput.app_name
                        const destination = connectionInput.destination_system || connectionInput.app_name || connectionInput.name
                        
                        if (entityName && destination && connectionInput.data_flow_direction) {
                          const newConnection: ConnectionCreate = {
                            name: entityName,
                            app_name: destination,
                            app_type: connectionInput.app_type || 'System',
                            connection_type: connectionInput.connection_type || 'cloud',
                            protocol: connectionInput.protocol || '',
                            endpoint_url: connectionInput.endpoint_url || '',
                            authentication_method: connectionInput.authentication_method || '',
                            description: connectionInput.description || '',
                            data_types_exchanged: connectionInput.data_types_exchanged || [],
                            data_flow_direction: connectionInput.data_flow_direction,
                            source_system: connectionInput.source_system || 'Agent',
                            destination_system: destination,
                            is_active: connectionInput.is_active !== undefined ? connectionInput.is_active : true,
                            is_required: connectionInput.is_required !== undefined ? connectionInput.is_required : true,
                            is_encrypted: connectionInput.is_encrypted !== undefined ? connectionInput.is_encrypted : true,
                            data_classification: connectionInput.data_classification || '',
                            compliance_requirements: connectionInput.compliance_requirements || [],
                          }
                          
                          let updatedConnections: ConnectionCreate[]
                          
                          if (editingConnectionIndex !== null) {
                            // Update existing connection
                            updatedConnections = [...formData.connections]
                            updatedConnections[editingConnectionIndex] = newConnection
                            setFormData({
                              ...formData,
                              connections: updatedConnections
                            })
                            setEditingConnectionIndex(null)
                            
                            // Generate diagram with updated connections immediately
                            generateDiagramPreview(updatedConnections)
                          } else {
                            // Add new connection
                            updatedConnections = [...formData.connections, newConnection]
                            setFormData({
                              ...formData,
                              connections: updatedConnections
                            })
                          }
                          
                          // Reset form
                          setConnectionInput({
                            name: '',
                            app_name: '',
                            app_type: '',
                            connection_type: 'cloud',
                            protocol: '',
                            endpoint_url: '',
                            authentication_method: '',
                            description: '',
                            data_types_exchanged: [],
                            data_flow_direction: 'bidirectional',
                            source_system: 'Agent',
                            destination_system: '',
                            data_classification: '',
                            is_encrypted: true,
                            is_required: true,
                          })
                          
                          // Generate diagram with the updated connections immediately
                          // This ensures the diagram updates right away
                          generateDiagramPreview(updatedConnections)
                          
                          // Also trigger full generation for recommendations
                          // Use setTimeout to ensure state has updated
                          setTimeout(() => {
                          generateDiagramAndRecommendations()
                          }, 100)
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {editingConnectionIndex !== null ? 'Update Connection' : '+ Add Connection'}
                    </button>
                    {editingConnectionIndex !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingConnectionIndex(null)
                          setConnectionInput({
                            name: '',
                            app_name: '',
                            app_type: '',
                            connection_type: 'cloud',
                            protocol: '',
                            endpoint_url: '',
                            authentication_method: '',
                            description: '',
                            data_types_exchanged: [],
                            data_flow_direction: 'bidirectional',
                            source_system: 'Agent',
                            destination_system: '',
                            data_classification: '',
                            is_encrypted: true,
                            is_required: true,
                          })
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Connections List */}
                {formData.connections.length > 0 && (
                  <div className="compact-card">
                    <h3 className="text-lg font-medium mb-4">Added Connections ({formData.connections.length})</h3>
                    <div className="space-y-2">
                      {formData.connections.map((conn, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{conn.name || conn.destination_system || conn.app_name || 'Connection'}</div>
                            <div className="text-sm text-muted-foreground">
                              {conn.source_system || 'Agent'} → {conn.destination_system || conn.app_name || conn.name} 
                              {conn.protocol && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs font-medium">
                                  {conn.protocol.replace('_', ' ').toUpperCase()}
                                </span>
                              )}
                              <span className="ml-2">
                                ({conn.data_flow_direction === 'bidirectional' ? 'Pull & Push' : conn.data_flow_direction === 'inbound' ? 'Pull' : 'Push'})
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              type="button"
                              onClick={() => {
                                // Populate form with connection data for editing
                                setConnectionInput({
                                  name: conn.name || '',
                                  app_name: conn.app_name || '',
                                  app_type: conn.app_type || '',
                                  connection_type: conn.connection_type || 'cloud',
                                  protocol: conn.protocol || '',
                                  endpoint_url: conn.endpoint_url || '',
                                  authentication_method: conn.authentication_method || '',
                                  description: conn.description || '',
                                  data_types_exchanged: conn.data_types_exchanged || [],
                                  data_flow_direction: conn.data_flow_direction || 'bidirectional',
                                  source_system: conn.source_system || 'Agent',
                                  destination_system: conn.destination_system || '',
                                  data_classification: conn.data_classification || '',
                                  is_encrypted: conn.is_encrypted !== undefined ? conn.is_encrypted : true,
                                  is_required: conn.is_required !== undefined ? conn.is_required : true,
                                  compliance_requirements: conn.compliance_requirements || [],
                                })
                                setEditingConnectionIndex(idx)
                                // Scroll to form
                                document.getElementById('connection-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = formData.connections.filter((_, i) => i !== idx)
                                setFormData({ ...formData, connections: updated })
                                
                                // Generate diagram with updated connections immediately
                                if (updated.length > 0) {
                                  generateDiagramPreview(updated)
                                } else {
                                  setConnectionDiagram('')
                                  setFrameworkRecommendations(null)
                                }
                                
                                if (editingConnectionIndex === idx) {
                                  setEditingConnectionIndex(null)
                                  setConnectionInput({
                                    name: '',
                                    app_name: '',
                                    app_type: '',
                                    connection_type: 'cloud',
                                    protocol: '',
                                    endpoint_url: '',
                                    authentication_method: '',
                                    description: '',
                                    data_types_exchanged: [],
                                    data_flow_direction: 'bidirectional',
                                    source_system: 'Agent',
                                    destination_system: '',
                                    data_classification: '',
                                    is_encrypted: true,
                                    is_required: true,
                                  })
                                }
                                
                                // Also trigger full generation for recommendations
                                setTimeout(() => {
                                generateDiagramAndRecommendations()
                                }, 100)
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Diagram Preview */}
              <div className="space-y-4">
                <div className="compact-card">
                  <h3 className="text-lg font-medium mb-4">Diagram Preview</h3>
                  {connectionDiagram ? (
                    <div className="space-y-4">
                      <MermaidDiagram diagram={connectionDiagram} id="connection-diagram-preview" />
                      <p className="text-xs text-muted-foreground">
                        This diagram visualizes how your agent connects in the ecosystem.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Add connections to see the diagram preview</p>
                    </div>
                  )}
                </div>

                {/* Framework Recommendations */}
                {frameworkRecommendations && frameworkRecommendations.frameworks.length > 0 && (
                  <div className="compact-card">
                    <h3 className="text-lg font-medium mb-4">Recommended Compliance Frameworks</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Based on your connections, the following compliance frameworks are recommended:
                    </p>
                    <div className="space-y-3">
                      {frameworkRecommendations.frameworks.map((fw: any) => (
                        <div key={fw.code} className="p-3 bg-blue-50 rounded">
                          <div className="font-medium text-blue-900">{fw.name}</div>
                          <div className="text-sm text-blue-600">{fw.description}</div>
                          {frameworkRecommendations.reasoning[fw.code] && (
                            <div className="text-xs text-blue-600 mt-1">
                              Reasons: {frameworkRecommendations.reasoning[fw.code].join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>


          </div>
        )
      case 7:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-0.5 block">Release Notes</label>
              <textarea
                className="compact-input min-h-[100px]"
                value={formData.version_info.release_notes}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...formData.version_info, release_notes: e.target.value }
                })}
                placeholder="What's new in this version..."
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-0.5 block">Changelog</label>
              <textarea
                className="compact-input min-h-[100px]"
                value={formData.version_info.changelog}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...formData.version_info, changelog: e.target.value }
                })}
                placeholder="List of changes..."
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-0.5 block">Compatibility</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={formData.version_info.compatibility}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...formData.version_info, compatibility: e.target.value }
                })}
                placeholder="e.g., Python 3.8+, Node.js 16+"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-0.5 block">Known Issues</label>
              <textarea
                className="compact-input min-h-[80px]"
                value={formData.version_info.known_issues}
                onChange={(e) => setFormData({
                  ...formData,
                  version_info: { ...formData.version_info, known_issues: e.target.value }
                })}
                placeholder="Any known issues or limitations..."
              />
            </div>
          </div>
        )

      case 8:
        if (!agentId) {
          return (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Please complete previous steps first.</p>
            </div>
          )
        }
        if (frameworkLoading) {
          return <div className="text-center py-8 text-muted-foreground">Loading compliance requirements...</div>
        }
        if (!frameworkRequirements || frameworkRequirements.length === 0) {
          return (
            <div className="space-y-4">
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">No compliance framework requirements apply to this agent based on its category and attributes.</p>
                <p className="text-sm text-muted-foreground mb-4">Agent Category: <span className="font-medium">{formData.category || 'Not specified'}</span></p>
                <p className="text-sm text-muted-foreground">You can proceed to the next step or save as draft.</p>
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={saveDraft}
                  disabled={loading}
                  className="compact-button-secondary"
                >
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
              </div>
            </div>
          )
        }
        return (
          <div className="space-y-6">
            <div className="p-3 bg-blue-50 border border-blue-400 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Agent Category:</strong> {formData.category || 'Not specified'}
                {formData.subcategory && ` / ${formData.subcategory}`}
              </p>
              {frameworkRecommendations && frameworkRecommendations.frameworks.length > 0 && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs text-green-900 font-medium mb-1">
                    📋 Frameworks recommended based on your connections:
                  </p>
                  <ul className="text-xs text-green-800 list-disc list-inside">
                    {frameworkRecommendations.frameworks.map((fw: any) => (
                      <li key={fw.code}>{fw.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-blue-600 mt-1">
                Compliance requirements are shown based on your agent's category, attributes, and connections. You can save as draft at any time.
              </p>
            </div>
            {frameworkRequirements.map((framework) => (
              <RequirementTreeComponent
                key={framework.framework_id}
                requirements={framework.requirements}
                responses={frameworkResponses}
                onResponseChange={handleFrameworkResponseChange}
                frameworkName={framework.framework_name}
              />
            ))}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={saveDraft}
                disabled={loading}
                className="compact-button-secondary"
              >
                {loading ? 'Saving...' : 'Save as Draft'}
              </button>
            </div>
          </div>
        )

      case 9:
        // Removed - requirements are now handled through form designer layout
        return null

      case 10:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-400 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Review Your Submission</h3>
              <p className="text-sm text-blue-600">
                Please review all information before submitting. You can go back to any step to make changes.
              </p>
            </div>

            <div className="space-y-4">
              <div className="compact-card">
                <h3 className="font-medium mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <div className="font-medium">{formData.name || 'Not provided'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <div className="font-medium">{formData.type || 'Not provided'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <div className="font-medium">{formData.category || 'Not provided'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <div className="font-medium">{formData.version || 'Not provided'}</div>
                  </div>
                  {formData.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description:</span>
                      <div className="font-medium mt-1">{formData.description}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="compact-card">
                <h3 className="font-medium mb-3">AI & LLM Configuration</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">LLM Vendor:</span>
                    <div className="font-medium">{formData.llm_vendor || 'Not provided'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LLM Model:</span>
                    <div className="font-medium">
                      {formData.llm_model === 'Custom' && formData.llm_model_custom
                        ? formData.llm_model_custom
                        : formData.llm_model || 'Not provided'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deployment Type:</span>
                    <div className="font-medium">{formData.deployment_type || 'Not provided'}</div>
                  </div>
                  {formData.data_sharing_scope && (
                    <>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Data Sharing Scope:</span>
                        <div className="mt-1 space-y-1">
                          {formData.data_sharing_scope.shares_pii && (
                            <div className="text-xs">• Shares PII</div>
                          )}
                          {formData.data_sharing_scope.shares_phi && (
                            <div className="text-xs">• Shares PHI</div>
                          )}
                          {formData.data_sharing_scope.shares_financial_data && (
                            <div className="text-xs">• Shares Financial Data</div>
                          )}
                          {formData.data_sharing_scope.shares_biometric_data && (
                            <div className="text-xs">• Shares Biometric Data</div>
                          )}
                          {formData.data_sharing_scope.data_retention_period && (
                            <div className="text-xs">• Retention: {formData.data_sharing_scope.data_retention_period}</div>
                          )}
                          {formData.data_sharing_scope.data_processing_location && 
                           (Array.isArray(formData.data_sharing_scope.data_processing_location) 
                             ? formData.data_sharing_scope.data_processing_location.length > 0
                             : formData.data_sharing_scope.data_processing_location) && (
                            <div className="text-xs">• Processing Location: {
                              Array.isArray(formData.data_sharing_scope.data_processing_location)
                                ? formData.data_sharing_scope.data_processing_location.join(', ')
                                : formData.data_sharing_scope.data_processing_location
                            }</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {formData.data_usage_purpose && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Data Usage Purpose:</span>
                      <div className="font-medium mt-1">{formData.data_usage_purpose}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="compact-card">
                <h3 className="font-medium mb-3">Capabilities & Data Types</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Capabilities:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.capabilities.length > 0 ? (
                        formData.capabilities.map((cap, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                            {cap}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Data Types:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.data_types.length > 0 ? (
                        formData.data_types.map((dt, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                            {dt}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="compact-card">
                <h3 className="font-medium mb-3">Regions & Use Cases</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Regions:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.regions.length > 0 ? (
                        formData.regions.map((r, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                            {r}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Use Cases:</span>
                    <div className="mt-1 prose prose-sm max-w-none">
                      {(() => {
                        const useCasesValue = typeof formData.use_cases === 'string' 
                          ? formData.use_cases 
                          : (Array.isArray(formData.use_cases) 
                              ? formData.use_cases.map(uc => `<p>${uc}</p>`).join('') 
                              : '')
                        return useCasesValue.trim() ? (
                          <div dangerouslySetInnerHTML={{ __html: useCasesValue }} />
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const personasValue = typeof formData.personas === 'string' 
                  ? formData.personas 
                  : (Array.isArray(formData.personas) 
                      ? formData.personas.map(p => `<p><strong>${p.name || 'Persona'}:</strong> ${p.description || ''}</p>`).join('') 
                      : '')
                return personasValue.trim() ? (
                  <div className="compact-card">
                    <h3 className="font-medium mb-3">Personas</h3>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: personasValue }} />
                    </div>
                  </div>
                ) : null
              })()}

              {Object.keys(requirementResponses).length > 0 && (
                <div className="compact-card">
                  <h3 className="font-medium mb-3">Requirements Responses</h3>
                  <div className="space-y-2 text-sm">
                    {requirements?.filter(r => requirementResponses[r.id]).map((req) => (
                      <div key={req.id}>
                        <span className="text-muted-foreground">{req.label}:</span>
                        <div className="font-medium mt-1">
                          {typeof requirementResponses[req.id] === 'object'
                            ? JSON.stringify(requirementResponses[req.id], null, 2)
                            : String(requirementResponses[req.id])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }
  } // End of false condition wrapping legacy function

  // Show loading state while layout is being fetched
  if (layoutLoading) {
    return (
      <Layout user={user}>
        <div className="max-w-5xl mx-auto">
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-500">Loading screen layout...</div>
          </div>
        </div>
      </Layout>
    )
  }

  // Layout state is available - formLayout may have empty sections, which is fine (falls back to hardcoded steps)

  // Show loading state while fetching agent or layout
  if (layoutLoading || (agentId && agentLoading)) {
    return (
      <Layout user={user}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading form...</p>
          </div>
        </div>
      </Layout>
    )
  }

  // Convert STEPS to format expected by OnboardingWorkflowPanel
  const workflowSteps = STEPS.map((step, index) => ({
    number: index + 1,
    title: step.title,
    description: step.description || ''
  }))

  return (
    <Layout user={user}>
      <PageContainer maxWidth="full">
        <PageHeader 
          title={agentId ? 'Edit Agent Submission' : 'Submit New Agent'}
          subtitle={agentId ? 'Continue editing your agent submission' : 'Complete all steps to submit your agent for review'}
          backButton={true}
          backUrl="/onboarding"
        />

        {/* Three-column layout: Left Sidebar | Main Content | Right Panel */}
        <div className="flex gap-6">
          {/* Left Sidebar - User & Metadata Info */}
          <OnboardingSidebar
            user={user}
            formData={formData}
            entityType="agent"
            vendors={[]}
            users={[]}
          />

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              {formLayout && (
                <div className="text-xs text-blue-600 mt-1">
                  <p>
                    Using layout: <strong>{formLayout.name}</strong> (ID: {formLayout.id.substring(0, 8)}...)
                    <br />
                    Sections: {STEPS.length} | 
                    Active: {formLayout.is_active ? 'Yes' : 'No'} | 
                    Default: {formLayout.is_default ? 'Yes' : 'No'}
                    {formLayout.sections?.length === 0 && (formLayout.is_default || formLayout.name === 'Vendor Submission Layout (Default)-External') ? ' - auto-populated from default steps' : ''}
                  </p>
                  {formLayout.sections && formLayout.sections.length === 1 && (
                    <p className="text-yellow-600 mt-1">
                      ⚠️ Warning: Layout has only 1 section. If you configured more sections in the Form Designer, 
                      please <button 
                        type="button" 
                        onClick={() => refetchLayout()} 
                        className="underline font-medium hover:text-yellow-800"
                      >
                        refresh this page
                      </button> or ensure the layout was saved correctly.
                    </p>
                  )}
                </div>
              )}
              {layoutError && (
                <p className="text-xs text-red-600 mt-1">
                  Error loading layout: {(layoutError as any)?.response?.data?.detail || (layoutError as any)?.message || 'Unknown error'}
                </p>
              )}
              {!formLayout && !layoutLoading && !layoutError && (
                <p className="text-xs text-yellow-600 mt-1">
                  No active screen layout found. Please configure and activate a layout in the Process Designer.
                </p>
              )}
            </div>

            {/* Step Indicator */}
            <div className="compact-card mb-6">
              <div className="flex items-center justify-between mb-4">
                {STEPS.map((step, idx) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => handleStepClick(step.id)}
                      className={`flex items-center justify-center w-10 h-10 rounded-full font-medium transition-all ${
                        currentStep === step.id
                          ? 'bg-primary text-white'
                          : currentStep > step.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                      title={step.title}
                    >
                      {currentStep > step.id ? '✓' : step.id}
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-2 ${
                          currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="text-center">
                {STEPS[currentStep - 1] && (
                  <>
                <h2 className="text-lg font-medium">{STEPS[currentStep - 1].title}</h2>
                <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
                  </>
                )}
              </div>
            </div>

            {/* Step Content */}
            <div className="compact-card mb-6">
              {renderStepContent()}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === (getBasicInformationStepNumber('vendor') || 1)}
                className="compact-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={loading}
                  className="compact-button-secondary text-sm"
                >
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} of {STEPS.length}
                </span>
              </div>
              {currentStep >= 1 && currentStep <= STEPS.length && currentStep < STEPS.length ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="compact-button-primary"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="compact-button-primary"
                >
                  {loading ? 'Submitting...' : 'Submit Agent'}
                </button>
              )}
            </div>
          </div>

          {/* Right Panel - Workflow/Step Info */}
          <OnboardingWorkflowPanel
            currentStep={currentStep}
            totalSteps={STEPS.length}
            steps={workflowSteps}
            entityType="agent"
          />
        </div>
      </PageContainer>
    </Layout>
  )
}
