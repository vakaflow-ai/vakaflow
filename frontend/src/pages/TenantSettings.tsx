import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import { 
  Save, Building2, Globe, Clock, Palette, 
  Mail, Phone, User,
  CreditCard, Shield, Globe2, Activity
} from 'lucide-react'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'

const INDUSTRIES = [
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'technology', label: 'Technology' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'education', label: 'Education' },
  { value: 'government', label: 'Government' },
  { value: 'energy', label: 'Energy' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'consulting', label: 'Consulting' },
]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
]

export default function TenantSettings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'details'>('profile')

  // Profile form data
  const [profileData, setProfileData] = useState({
    industry: '',
    timezone: 'UTC',
    locale: 'en',
    i18n_settings: {
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      currency: 'USD',
    } as Record<string, any>,
  })

  // Details form data
  const [detailsData, setDetailsData] = useState({
    name: '',
    contact_email: '',
    contact_name: '',
    contact_phone: '',
    website: '',
  })
  
  const [websiteInput, setWebsiteInput] = useState('')

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Fetch tenant data
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsApi.getMyTenant(),
    enabled: !!user?.tenant_id && ['tenant_admin', 'platform_admin'].includes(user?.role),
  })

  useEffect(() => {
    if (tenant) {
      setProfileData({
        industry: tenant.industry || '',
        timezone: tenant.timezone || 'UTC',
        locale: tenant.locale || 'en',
        i18n_settings: tenant.i18n_settings || {
          date_format: 'MM/DD/YYYY',
          time_format: '12h',
          currency: 'USD',
        },
      })
      setDetailsData({
        name: tenant.name || '',
        contact_email: tenant.contact_email || '',
        contact_name: tenant.contact_name || '',
        contact_phone: tenant.contact_phone || '',
        website: tenant.website || '',
      })
      setWebsiteInput(tenant.website || '')
    }
  }, [tenant])

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return tenantsApi.updateMyTenant(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      alert('Profile updated successfully!')
    },
  })

  const updateDetailsMutation = useMutation({
    mutationFn: async (data: any) => {
      return tenantsApi.updateMyTenant(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      showToast.success('Tenant details updated successfully!')
    },
  })

  const updateBrandingMutation = useMutation({
    mutationFn: async (branding: Record<string, any>) => {
      return tenantsApi.updateMyBranding(branding)
    },
    onSuccess: async () => {
      // Invalidate and refetch both queries to ensure UI updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant'] }),
        queryClient.invalidateQueries({ queryKey: ['tenant-branding'] }),
      ])
      // Refetch tenant data to update the form with latest values
      await queryClient.refetchQueries({ queryKey: ['tenant', 'current'] })
      await queryClient.refetchQueries({ queryKey: ['tenant-branding'] })
      showToast.success('Branding updated successfully! The sidebar will refresh automatically.')
    },
  })

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      industry: profileData.industry || null,
      timezone: profileData.timezone,
      locale: profileData.locale,
      i18n_settings: profileData.i18n_settings,
    })
  }

  const handleSaveDetails = () => {
    updateDetailsMutation.mutate({
      name: detailsData.name,
      contact_email: detailsData.contact_email,
      contact_name: detailsData.contact_name,
      contact_phone: detailsData.contact_phone,
      website: detailsData.website,
    })
  }

  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Tenant admin access required.</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading tenant settings...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Tenant Settings</h1>
            <p className="text-sm font-medium text-gray-500">
              Configure your organization's profile, internationalization, and corporate identity
            </p>
          </div>
        </div>

        {/* Tabs - Material Design 3 Primary Tabs */}
        <div className="flex gap-4 border-b border-gray-200 px-4 mb-8 bg-white/50 backdrop-blur-sm rounded-t-xl">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-2 px-2 border-b-2 transition-all duration-200 text-sm font-medium tracking-tight ${
              activeTab === 'profile' 
                ? 'border-primary-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe className={`w-4 h-4 ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-600'}`} />
            Regional profile
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 py-2 px-2 border-b-2 transition-all duration-200 text-sm font-medium tracking-tight ${
              activeTab === 'details' 
                ? 'border-primary-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className={`w-4 h-4 ${activeTab === 'details' ? 'text-blue-600' : 'text-gray-600'}`} />
            Organization details
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MaterialCard elevation={1} className="p-8 border border-gray-100 overflow-hidden relative bg-white">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 opacity-70" />
              <div className="flex items-center gap-4 mb-10">
                <div className="w-14 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-blue-600 shadow-sm ring-1 ring-primary-100">
                  <Globe2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Regional & Industry Configuration</h2>
                  <p className="text-sm text-gray-500 font-medium">These settings influence compliance frameworks and reporting standards</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-gray-700 tracking-tight ml-1">
                      Target industry <span className="text-error-500">*</span>
                    </label>
                    <select
                      value={profileData.industry}
                      onChange={(e) => setProfileData({ ...profileData, industry: e.target.value })}
                      className="w-full h-9 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium text-gray-900"
                    >
                      <option value="">Select primary industry</option>
                      {INDUSTRIES.map(industry => (
                        <option key={industry.value} value={industry.value}>{industry.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2 ml-1 flex items-center gap-1.5 font-medium opacity-80">
                      <Shield className="w-3.5 h-3.5 text-primary-500" />
                      Affects compliance frameworks and assessment templates.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-gray-700 tracking-tight ml-1">
                      System timezone
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                      <select
                        value={profileData.timezone}
                        onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                        className="w-full h-9 pl-12 pr-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium text-gray-900"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-gray-700 tracking-tight ml-1">
                      Default locale (Language)
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                      <select
                        value={profileData.locale}
                        onChange={(e) => setProfileData({ ...profileData, locale: e.target.value })}
                        className="w-full h-9 pl-12 pr-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium text-gray-900"
                      >
                        {LOCALES.map(locale => (
                          <option key={locale.value} value={locale.value}>{locale.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-100/80 rounded-lg border border-gray-100 p-6 space-y-6">
                    <h3 className="text-xs font-medium text-gray-700 tracking-tight flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" />
                      Internationalization
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600 ml-1">Date format</label>
                        <select
                          value={profileData.i18n_settings.date_format}
                          onChange={(e) => setProfileData({
                            ...profileData,
                            i18n_settings: { ...profileData.i18n_settings, date_format: e.target.value }
                          })}
                          className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium text-sm"
                        >
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600 ml-1">Time format</label>
                        <select
                          value={profileData.i18n_settings.time_format}
                          onChange={(e) => setProfileData({
                            ...profileData,
                            i18n_settings: { ...profileData.i18n_settings, time_format: e.target.value }
                          })}
                          className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium text-sm"
                        >
                          <option value="12h">12-hour</option>
                          <option value="24h">24-hour</option>
                        </select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium text-gray-600 ml-1">Preferred currency</label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                          <input
                            type="text"
                            value={profileData.i18n_settings.currency}
                            onChange={(e) => setProfileData({
                              ...profileData,
                              i18n_settings: { ...profileData.i18n_settings, currency: e.target.value }
                            })}
                            className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-semibold text-gray-900"
                            placeholder="USD"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-10 mt-10 border-t border-gray-100">
                <MaterialButton
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  size="large"
                  className="px-10 h-9 shadow-lg shadow-primary-500/20"
                  startIcon={<Save className="w-5 h-5" />}
                >
                  {updateProfileMutation.isPending ? 'Syncing...' : 'Update Regional Profile'}
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MaterialCard elevation={1} className="p-8 border border-gray-100 overflow-hidden relative bg-white">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary-600 opacity-70" />
              <div className="flex items-center gap-4 mb-10">
                <div className="w-14 h-10 rounded-lg bg-secondary-50 flex items-center justify-center text-secondary-600 shadow-sm ring-1 ring-secondary-100">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Corporate Identity & Contact</h2>
                  <p className="text-sm text-gray-500 font-medium">Maintain accurate organizational records and communication channels</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="md:col-span-2">
                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-gray-700 tracking-tight ml-1">Organization name *</label>
                    <input
                      type="text"
                      value={detailsData.name}
                      onChange={(e) => setDetailsData({ ...detailsData, name: e.target.value })}
                      className="w-full h-10 px-5 rounded-md border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-secondary-500 focus:ring-4 focus:ring-secondary-500/10 transition-all duration-200 text-xl font-semibold text-gray-900"
                      placeholder="Enter official organization name"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  <MaterialInput
                    label="Primary contact email"
                    type="email"
                    value={detailsData.contact_email}
                    onChange={(e) => setDetailsData({ ...detailsData, contact_email: e.target.value })}
                    startAdornment={<Mail className="w-4 h-4" />}
                    className="h-9 bg-gray-50 focus:bg-white border-gray-200 rounded-md"
                    placeholder="it-admin@company.com"
                  />
                  <MaterialInput
                    label="Corporate phone"
                    type="tel"
                    value={detailsData.contact_phone}
                    onChange={(e) => setDetailsData({ ...detailsData, contact_phone: e.target.value })}
                    startAdornment={<Phone className="w-4 h-4" />}
                    className="h-9 bg-gray-50 focus:bg-white border-gray-200 rounded-md"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="space-y-8">
                  <MaterialInput
                    label="Administrator name"
                    type="text"
                    value={detailsData.contact_name}
                    onChange={(e) => setDetailsData({ ...detailsData, contact_name: e.target.value })}
                    startAdornment={<User className="w-4 h-4" />}
                    className="h-9 bg-gray-50 focus:bg-white border-gray-200 rounded-md"
                    placeholder="Lead Administrator Name"
                  />
                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-gray-700 tracking-tight ml-1">
                      Corporate website
                    </label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                        <input
                          type="text"
                          value={websiteInput}
                          onChange={(e) => setWebsiteInput(e.target.value)}
                          onBlur={(e) => setDetailsData({ ...detailsData, website: e.target.value })}
                          className="w-full h-9 pl-12 pr-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                          placeholder="https://example.com"
                        />
                      </div>
                      <MaterialButton
                        variant="outlined"
                        onClick={async () => {
                          if (!websiteInput.trim()) {
                            showToast.warning('Please enter a website URL')
                            return
                          }
                          try {
                            const updated = await tenantsApi.fetchLogoFromWebsite(websiteInput.trim())
                            queryClient.invalidateQueries({ queryKey: ['tenant'] })
                            queryClient.invalidateQueries({ queryKey: ['tenant-branding'] })
                            setDetailsData({ ...detailsData, website: updated.website || websiteInput })
                            showToast.success('Logo successfully synchronized from website.')
                          } catch (error: any) {
                            showToast.error('Synchronization failed. Please upload logo manually.')
                          }
                        }}
                        className="h-9 border-gray-200 text-blue-600 bg-primary-50/30 hover:bg-primary-50 whitespace-nowrap rounded-md px-6"
                        startIcon={<Activity className="w-4 h-4" />}
                      >
                        Auto-sync
                      </MaterialButton>
                    </div>
                  </div>
                </div>
              </div>

              {/* Branding Section - Material Design */}
              {user?.role === 'tenant_admin' && (
                <div className="mt-12 pt-12 border-t border-gray-100">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-gray-100 text-gray-500">
                      <Palette className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Application Visual Theming</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-xs font-medium text-gray-600 ml-1 tracking-tight">Primary Brand Color</label>
                      <div className="flex items-center gap-5 p-5 bg-gray-50 rounded-lg ring-1 ring-gray-100 transition-all focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:bg-white">
                        <div 
                          className="w-16 h-12 rounded-lg shadow-lg border-4 border-white flex-shrink-0"
                          style={{ backgroundColor: tenant?.custom_branding?.primary_color || '#2196f3' }}
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            defaultValue={tenant?.custom_branding?.primary_color || '#2196f3'}
                            onBlur={(e) => {
                              if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                updateBrandingMutation.mutate({ primary_color: e.target.value })
                              }
                            }}
                            className="bg-transparent border-none p-0 w-full font-mono text-xl font-bold tracking-tight focus:ring-0 text-gray-900"
                          />
                          <div className="text-xs text-gray-600 font-bold mt-1 tracking-tight">HEX Identity Code</div>
                        </div>
                        <input
                          type="color"
                          defaultValue={tenant?.custom_branding?.primary_color || '#2196f3'}
                          onChange={(e) => updateBrandingMutation.mutate({ primary_color: e.target.value })}
                          className="w-10 h-10 rounded-md cursor-pointer border-none p-0 bg-transparent"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-medium text-gray-600 ml-1 tracking-tight">Secondary Accent Color</label>
                      <div className="flex items-center gap-5 p-5 bg-gray-50 rounded-lg ring-1 ring-gray-100 transition-all focus-within:ring-4 focus-within:ring-secondary-500/10 focus-within:bg-white">
                        <div 
                          className="w-16 h-12 rounded-lg shadow-lg border-4 border-white flex-shrink-0"
                          style={{ backgroundColor: tenant?.custom_branding?.secondary_color || '#9c27b0' }}
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            defaultValue={tenant?.custom_branding?.secondary_color || '#9c27b0'}
                            onBlur={(e) => {
                              if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                updateBrandingMutation.mutate({ secondary_color: e.target.value })
                              }
                            }}
                            className="bg-transparent border-none p-0 w-full font-mono text-xl font-bold tracking-tight focus:ring-0 text-gray-900"
                          />
                          <div className="text-xs text-gray-600 font-bold mt-1 tracking-tight">HEX Accent Code</div>
                        </div>
                        <input
                          type="color"
                          defaultValue={tenant?.custom_branding?.secondary_color || '#9c27b0'}
                          onChange={(e) => updateBrandingMutation.mutate({ secondary_color: e.target.value })}
                          className="w-10 h-10 rounded-md cursor-pointer border-none p-0 bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* System Metadata */}
              {tenant && (
                <div className="mt-12 p-8 bg-gray-50 rounded-lg border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-gray-700 tracking-tight block">System Identity</span>
                    <span className="text-lg font-mono font-bold text-primary-700">{tenant.slug}</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-gray-700 tracking-tight block">License Tier</span>
                    <MaterialChip label={tenant.license_tier} color="primary" size="medium" variant="filled" className="font-medium text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-gray-700 tracking-tight block">Operation Status</span>
                    <MaterialChip 
                      label={tenant.status} 
                      color={tenant.status === 'active' ? 'success' : 'default'} 
                      size="medium" 
                      variant="filled" 
                      className="font-medium text-xs" 
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-10 mt-10 border-t border-gray-100">
                <MaterialButton
                  onClick={handleSaveDetails}
                  disabled={updateDetailsMutation.isPending}
                  size="large"
                  color="secondary"
                  className="px-10 h-9 shadow-lg shadow-secondary-500/20"
                  startIcon={<Save className="w-5 h-5" />}
                >
                  {updateDetailsMutation.isPending ? 'Persisting...' : 'Save Corporate Identity'}
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}
      </div>
    </Layout>
  )
}
