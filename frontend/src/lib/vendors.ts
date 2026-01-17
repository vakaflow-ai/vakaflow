import api from './api'

export interface Vendor {
  id: string
  name: string
  contact_email: string
  contact_phone?: string
  address?: string
  website?: string
  description?: string
  logo_url?: string
  registration_number?: string
  branding?: {
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    font_family?: string
    header_background?: string
    header_text_color?: string
    sidebar_background?: string
    sidebar_text_color?: string
    button_primary_color?: string
    button_primary_text_color?: string
  }
  created_at: string
  updated_at: string
}

export interface VendorDashboard {
  vendor: {
    id: string
    name: string
    logo_url?: string
  }
  stats: {
    total_agents: number
    agents_by_status: Record<string, number>
    recent_submissions: number
    active_requests: number
    approved_count: number
    avg_compliance?: number
    avg_risk?: number
    agents_by_type: Record<string, number>
  }
  submission_trends: Array<{
    date: string
    value: number
  }>
  recent_activity: Array<{
    type: string
    name: string
    action: string
    timestamp: string
  }>
  filter_options: {
    departments: string[]
    organizations: string[]
    categories: string[]
    subcategories: string[]
    ownerships: Array<{ id: string; name: string }>
  }
}

export interface VendorWithDetails {
  id: string
  name: string
  contact_email: string
  contact_phone?: string
  address?: string
  website?: string
  description?: string
  logo_url?: string
  registration_number?: string
  created_at: string
  updated_at: string
  pocs: Array<{
    id: string
    name: string
    email: string
    phone?: string
    department?: string
    is_active: boolean
  }>
  agents_count: number
  agents: Array<{
    id: string
    name: string
    type: string
    status: string
    created_at?: string
  }>
  invitation_id?: string
  invited_by?: string
  invited_by_name?: string
  invitation_date?: string
}

export interface VendorCreate {
  name: string
  contact_email: string
  contact_phone?: string
  address?: string
  website?: string
  description?: string
  registration_number?: string
}

export const vendorsApi = {
  list: async (includeRecent: boolean = true): Promise<VendorWithDetails[]> => {
    const response = await api.get('/vendors/list', {
      params: { include_recent: includeRecent }
    })
    return response.data
  },
  create: async (data: VendorCreate): Promise<Vendor> => {
    const response = await api.post('/vendors', data)
    return response.data
  },
  getMyVendor: async (): Promise<Vendor> => {
    const response = await api.get('/vendors/me')
    return response.data
  },
  
  updateMyVendor: async (data: Partial<Vendor>): Promise<Vendor> => {
    const response = await api.put('/vendors/me', data)
    return response.data
  },
  
  uploadLogo: async (file: File): Promise<Vendor> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/vendors/me/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
  
  fetchLogoFromWebsite: async (website: string): Promise<Vendor> => {
    const response = await api.post('/vendors/me/fetch-logo', null, {
      params: { website }
    })
    return response.data
  },
  
  getDashboard: async (
    days: number = 30,
    filters?: {
      department?: string
      organization?: string
      category?: string
      subcategory?: string
      ownership?: string
    }
  ): Promise<VendorDashboard> => {
    const params: any = { days }
    if (filters?.department) params.department = filters.department
    if (filters?.organization) params.organization = filters.organization
    if (filters?.category) params.category = filters.category
    if (filters?.subcategory) params.subcategory = filters.subcategory
    if (filters?.ownership) params.ownership = filters.ownership
    
    const response = await api.get('/vendors/me/dashboard', { params })
    return response.data
  },
  
  // Trust Center APIs
  getTrustCenter: async (vendorIdentifier: string): Promise<TrustCenter> => {
    const response = await api.get(`/vendors/trust-center/${vendorIdentifier}`)
    return response.data
  },
  
  getMyTrustCenter: async (): Promise<TrustCenter> => {
    const response = await api.get('/vendors/me/trust-center')
    return response.data
  },
  
  updateMyTrustCenter: async (data: Partial<TrustCenterUpdate>): Promise<TrustCenter> => {
    const response = await api.put('/vendors/me/trust-center', data)
    return response.data
  },
  
  // Subscription, Follow, and Interest APIs
  subscribeToVendor: async (vendorIdentifier: string, notificationPreferences?: Record<string, any>): Promise<VendorSubscription> => {
    const response = await api.post(`/vendors/trust-center/${vendorIdentifier}/subscribe`, { notification_preferences: notificationPreferences })
    return response.data
  },
  
  unsubscribeFromVendor: async (vendorIdentifier: string): Promise<VendorSubscription> => {
    const response = await api.delete(`/vendors/trust-center/${vendorIdentifier}/subscribe`)
    return response.data
  },
  
  followVendor: async (vendorIdentifier: string): Promise<VendorFollow> => {
    const response = await api.post(`/vendors/trust-center/${vendorIdentifier}/follow`)
    return response.data
  },
  
  unfollowVendor: async (vendorIdentifier: string): Promise<VendorFollow> => {
    const response = await api.delete(`/vendors/trust-center/${vendorIdentifier}/follow`)
    return response.data
  },
  
  addToInterestList: async (vendorIdentifier: string, notes?: string): Promise<VendorInterest> => {
    const response = await api.post(`/vendors/trust-center/${vendorIdentifier}/interest`, { notes })
    return response.data
  },
  
  removeFromInterestList: async (vendorIdentifier: string): Promise<VendorInterest> => {
    const response = await api.delete(`/vendors/trust-center/${vendorIdentifier}/interest`)
    return response.data
  },
  
  getVendorStatus: async (vendorIdentifier: string): Promise<VendorStatus> => {
    const response = await api.get(`/vendors/trust-center/${vendorIdentifier}/status`)
    return response.data
  },
  
  getMyInterests: async (): Promise<VendorInterestItem[]> => {
    const response = await api.get('/vendors/me/interests')
    return response.data
  },
  
  getMyFollowing: async (): Promise<VendorFollowItem[]> => {
    const response = await api.get('/vendors/me/following')
    return response.data
  },
}

export interface VendorSubscription {
  vendor_id: string
  vendor_name: string
  subscribed: boolean
  subscribed_at?: string
  notification_preferences?: Record<string, any>
}

export interface VendorFollow {
  vendor_id: string
  vendor_name: string
  following: boolean
  followed_at?: string
}

export interface VendorInterest {
  vendor_id: string
  vendor_name: string
  in_interest_list: boolean
  added_at?: string
  notes?: string
}

export interface VendorStatus {
  vendor_id: string
  vendor_name: string
  subscribed: boolean
  following: boolean
  in_interest_list: boolean
  subscribed_at?: string
  followed_at?: string
  added_at?: string
  notes?: string
}

export interface VendorInterestItem {
  vendor_id: string
  vendor_name: string
  vendor_logo_url?: string
  vendor_website?: string
  added_at: string
  notes?: string
  trust_center_url: string
}

export interface VendorFollowItem {
  vendor_id: string
  vendor_name: string
  vendor_logo_url?: string
  vendor_website?: string
  followed_at: string
  trust_center_url: string
}

export interface TrustCenter {
  vendor_id: string
  vendor_name: string
  vendor_logo_url?: string
  vendor_website?: string
  vendor_description?: string
  branding?: {
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    font_family?: string
    header_background?: string
    header_text_color?: string
    sidebar_background?: string
    sidebar_text_color?: string
    button_primary_color?: string
    button_primary_text_color?: string
  }
  trust_center_enabled: boolean
  compliance_score?: number
  compliance_url?: string
  security_policy_url?: string
  privacy_policy_url?: string
  customer_logos?: Array<{ name: string; logo_url: string }>
  compliance_certifications?: Array<{
    type: string
    name: string
    logo_url?: string
    issued_date?: string
    expiry_date?: string
    verified: boolean
  }>
  published_artifacts?: Array<{
    id: string
    name: string
    type: string
    url: string
    published_date: string
  }>
  published_documents?: Array<{
    id: string
    name: string
    type: string
    url: string
    published_date: string
  }>
  customers: Array<{
    id: string
    name: string
    logo_url?: string
    agents_count: number
  }>
  public_url: string
}

export interface TrustCenterUpdate {
  trust_center_enabled?: boolean
  compliance_score?: number
  compliance_url?: string
  security_policy_url?: string
  privacy_policy_url?: string
  customer_logos?: Array<{ name: string; logo_url: string }>
  compliance_certifications?: Array<{
    type: string
    name: string
    logo_url?: string
    issued_date?: string
    expiry_date?: string
    verified: boolean
  }>
  published_artifacts?: Array<{
    id: string
    name: string
    type: string
    url: string
    published_date: string
  }>
  published_documents?: Array<{
    id: string
    name: string
    type: string
    url: string
    published_date: string
  }>
  trust_center_slug?: string
  branding?: {
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    font_family?: string
    header_background?: string
    header_text_color?: string
    sidebar_background?: string
    sidebar_text_color?: string
    button_primary_color?: string
    button_primary_text_color?: string
  }
}

