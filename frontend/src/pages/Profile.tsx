import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { usersApi, type User } from '../lib/users'
import { tenantsApi } from '../lib/tenants'
import { vendorsApi, type Vendor } from '../lib/vendors'
import Layout from '../components/Layout'
import { Save, User as UserIcon, Mail, Building2, Globe, Clock, Settings, Phone, MapPin, Link as LinkIcon, FileText, Upload, Image, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { MaterialCard, MaterialButton, MaterialInput, MaterialChip } from '../components/material'

export default function Profile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [vendor, setVendor] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    organization: '',
  })
  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    contact_phone: '',
    address: '',
    website: '',
    description: '',
  })
  const [brandingData, setBrandingData] = useState({
    primary_color: '',
    secondary_color: '',
    accent_color: '',
    font_family: '',
    header_background: '',
    header_text_color: '',
    sidebar_background: '',
    sidebar_text_color: '',
    button_primary_color: '',
    button_primary_text_color: '',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Fetch tenant info if user has tenant_id
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', user?.tenant_id],
    queryFn: () => user?.tenant_id ? tenantsApi.get(user.tenant_id) : Promise.resolve(null),
    enabled: !!user?.tenant_id,
  })

  // Fetch vendor info if user is a vendor_user
  const { data: vendorData, refetch: refetchVendor } = useQuery({
    queryKey: ['vendor', 'me'],
    queryFn: () => vendorsApi.getMyVendor(),
    enabled: !!user && user.role === 'vendor_user',
    retry: false, // Don't retry if vendor not found (might not be set up yet)
  })

  useEffect(() => {
    if (tenantData) {
      setTenant(tenantData)
    }
  }, [tenantData])

  useEffect(() => {
    if (vendorData) {
      setVendor(vendorData)
      setVendorFormData({
        name: vendorData.name || '',
        contact_phone: vendorData.contact_phone || '',
        address: vendorData.address || '',
        website: vendorData.website || '',
        description: vendorData.description || '',
      })
      if (vendorData.branding) {
        setBrandingData({
          primary_color: vendorData.branding.primary_color || '',
          secondary_color: vendorData.branding.secondary_color || '',
          accent_color: vendorData.branding.accent_color || '',
          font_family: vendorData.branding.font_family || '',
          header_background: vendorData.branding.header_background || '',
          header_text_color: vendorData.branding.header_text_color || '',
          sidebar_background: vendorData.branding.sidebar_background || '',
          sidebar_text_color: vendorData.branding.sidebar_text_color || '',
          button_primary_color: vendorData.branding.button_primary_color || '',
          button_primary_text_color: vendorData.branding.button_primary_text_color || '',
        })
      }
    }
  }, [vendorData])

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        department: user.department || '',
        organization: user.organization || '',
      })
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<User>) => usersApi.update(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      authApi.getCurrentUser().then(setUser)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update profile')
    },
  })

  const updateVendorMutation = useMutation({
    mutationFn: (data: Partial<Vendor>) => vendorsApi.updateMyVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor profile updated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update vendor profile')
    },
  })

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => vendorsApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', 'me'] })
      toast.success('Logo uploaded successfully')
      setLogoFile(null)
      refetchVendor()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to upload logo')
    },
  })

  const handleSave = async () => {
    if (!user) return
    
    try {
      // Update user profile
      await updateMutation.mutateAsync(formData)
      
      // Update vendor profile if user is a vendor
      if (user.role === 'vendor_user' && vendor) {
        // Include branding in vendor update
        const vendorUpdateData = {
          ...vendorFormData,
          branding: Object.keys(brandingData).some(key => brandingData[key as keyof typeof brandingData]) 
            ? brandingData 
            : undefined
        }
        await updateVendorMutation.mutateAsync(vendorUpdateData)
        // Refresh vendor data after successful update
        await refetchVendor()
      }
      
      setIsEditing(false)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      // Error is already handled by mutation onError callbacks
      console.error('Error updating profile:', error)
    }
  }

  if (!user) {
    return (
      <Layout user={null}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2">Profile Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account information and preferences
            </p>
          </div>
          {!isEditing && (
            <MaterialButton
              onClick={() => setIsEditing(true)}
              className="shadow-md-elevation-2"
            >
              Edit Profile
            </MaterialButton>
          )}
        </div>

        <MaterialCard elevation={2} className="p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b">
            <div className="w-16 h-12 bg-primary-50 rounded-full flex items-center justify-center shadow-sm">
              <UserIcon className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-500 font-medium">{user.email}</p>
              {user.role && (
                <MaterialChip 
                  label={user.role.replace(/_/g, ' ')} 
                  color="primary" 
                  size="small" 
                  variant="outlined" 
                  className="mt-2 font-medium"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <MaterialInput
                label="Name"
                value={isEditing ? formData.name : (user.name || 'Not set')}
                onChange={isEditing ? (e) => setFormData({ ...formData, name: e.target.value }) : undefined}
                disabled={!isEditing}
                placeholder="Enter your name"
                startAdornment={<UserIcon className="w-4 h-4" />}
                required
              />

              <MaterialInput
                label="Email"
                value={user.email}
                disabled
                helperText="Email cannot be changed"
                startAdornment={<Mail className="w-4 h-4" />}
              />
            </div>

            <div className="space-y-4">
              <MaterialInput
                label="Department"
                value={isEditing ? formData.department : (user.department || 'Not set')}
                onChange={isEditing ? (e) => setFormData({ ...formData, department: e.target.value }) : undefined}
                disabled={!isEditing}
                placeholder="Enter department"
                startAdornment={<Building2 className="w-4 h-4" />}
              />

              <MaterialInput
                label="Organization"
                value={isEditing ? formData.organization : (user.organization || 'Not set')}
                onChange={isEditing ? (e) => setFormData({ ...formData, organization: e.target.value }) : undefined}
                disabled={!isEditing}
                placeholder="Enter organization"
                startAdornment={<Building2 className="w-4 h-4" />}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 justify-end mt-8 pt-6 border-t">
              <MaterialButton
                variant="outlined"
                onClick={() => {
                  setIsEditing(false)
                  setFormData({
                    name: user.name || '',
                    email: user.email || '',
                    department: user.department || '',
                    organization: user.organization || '',
                  })
                }}
              >
                Cancel
              </MaterialButton>
              <MaterialButton
                onClick={handleSave}
                disabled={updateMutation.isPending}
                startIcon={<Save className="w-4 h-4" />}
                className="shadow-md-elevation-4"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </MaterialButton>
            </div>
          )}
        </MaterialCard>

        {/* Vendor Entity Details Section - Only for vendor users */}
        {user?.role === 'vendor_user' && (
          <MaterialCard elevation={2} className="p-6">
            <h3 className="text-lg font-medium mb-6 flex items-center gap-2 text-gray-900 border-b pb-4">
              <Building2 className="w-5 h-5 text-primary-500" />
              Vendor Entity Details
            </h3>
            {!vendor ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <div className="animate-pulse">Loading vendor information...</div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MaterialInput
                    label="Vendor Name"
                    value={isEditing ? vendorFormData.name : (vendor.name || 'Not set')}
                    onChange={isEditing ? (e) => setVendorFormData({ ...vendorFormData, name: e.target.value }) : undefined}
                    disabled={!isEditing}
                    placeholder="Enter vendor name"
                    startAdornment={<Building2 className="w-4 h-4" />}
                  />

                  <MaterialInput
                    label="Contact Phone"
                    value={isEditing ? vendorFormData.contact_phone : (vendor.contact_phone || 'Not set')}
                    onChange={isEditing ? (e) => setVendorFormData({ ...vendorFormData, contact_phone: e.target.value }) : undefined}
                    disabled={!isEditing}
                    placeholder="Enter contact phone"
                    startAdornment={<Phone className="w-4 h-4" />}
                  />
                </div>

                <MaterialInput
                  label="Address"
                  value={isEditing ? vendorFormData.address : (vendor.address || 'Not set')}
                  onChange={isEditing ? (e) => setVendorFormData({ ...vendorFormData, address: e.target.value }) : undefined}
                  disabled={!isEditing}
                  placeholder="Enter address"
                  startAdornment={<MapPin className="w-4 h-4" />}
                  multiline
                  rows={3}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-gray-600" />
                    Website
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <MaterialInput
                        type="url"
                        value={vendorFormData.website}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, website: e.target.value })}
                        placeholder="https://example.com"
                        fullWidth
                      />
                      {vendorFormData.website && (
                        <MaterialButton
                          variant="outlined"
                          size="small"
                          onClick={async () => {
                            try {
                              await vendorsApi.fetchLogoFromWebsite(vendorFormData.website.trim())
                              queryClient.invalidateQueries({ queryKey: ['vendor', 'me'] })
                              await refetchVendor()
                              toast.success('Logo fetched successfully!')
                            } catch (error: any) {
                              toast.error('Failed to fetch logo')
                            }
                          }}
                          startIcon={<Image className="w-4 h-4" />}
                          className="h-[42px] whitespace-nowrap"
                        >
                          Fetch Logo
                        </MaterialButton>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-900 bg-blue-100/80 px-4 py-3 rounded-lg border border-gray-100">
                      {vendor.website ? (
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                          {vendor.website}
                          <ChevronRight className="w-3 h-3" />
                        </a>
                      ) : 'Not set'}
                    </div>
                  )}
                </div>

                <MaterialInput
                  label="Description"
                  value={isEditing ? vendorFormData.description : (vendor.description || 'Not set')}
                  onChange={isEditing ? (e) => setVendorFormData({ ...vendorFormData, description: e.target.value }) : undefined}
                  disabled={!isEditing}
                  placeholder="Enter vendor description"
                  startAdornment={<FileText className="w-4 h-4" />}
                  multiline
                  rows={4}
                />

                {/* Logo Section */}
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <Image className="w-4 h-4 text-gray-600" />
                    Vendor Logo
                  </label>
                  <div className="flex items-start gap-6">
                    {(vendor.logo_url || logoFile) && (
                      <div className="relative group">
                        <img 
                          src={logoFile ? URL.createObjectURL(logoFile) : (vendor.logo_url?.startsWith('http') ? vendor.logo_url : `http://localhost:8000${vendor.logo_url}`)}
                          alt="Vendor logo" 
                          className="h-24 w-24 object-contain border rounded-md p-3 bg-white shadow-sm transition-shadow group-hover:shadow-md"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      </div>
                    )}
                    
                    {isEditing && (
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id="logo-upload"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) setLogoFile(e.target.files[0])
                            }}
                            className="hidden"
                          />
                          <label 
                            htmlFor="logo-upload"
                            className="cursor-pointer px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-blue-600 transition-all flex items-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            {logoFile ? 'Change File' : 'Choose Logo File'}
                          </label>
                          {logoFile && (
                            <span className="text-xs text-gray-500 font-medium truncate max-w-[200px]">
                              {logoFile.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">PNG, JPG or WebP (max 5MB)</p>
                        {logoFile && (
                          <MaterialButton
                            size="small"
                            onClick={() => uploadLogoMutation.mutate(logoFile)}
                            disabled={uploadLogoMutation.isPending}
                            startIcon={<Upload className="w-4 h-4" />}
                          >
                            {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Now'}
                          </MaterialButton>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </MaterialCard>
        )}

        {tenant && (
          <MaterialCard elevation={2} className="p-6">
            <h3 className="text-lg font-medium mb-6 flex items-center gap-2 text-gray-900 border-b pb-4">
              <Building2 className="w-5 h-5 text-primary-500" />
              Tenant information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 tracking-tight">Tenant name</label>
                <div className="text-sm font-medium text-gray-900 bg-blue-100/80 px-4 py-2.5 rounded-lg border border-gray-100">{tenant.name}</div>
              </div>
              {tenant.industry && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 tracking-tight flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Industry
                  </label>
                  <div className="text-sm font-medium text-gray-900 capitalize bg-blue-100/80 px-4 py-2.5 rounded-lg border border-gray-100">{tenant.industry}</div>
                </div>
              )}
              {tenant.timezone && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 tracking-tight flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Timezone
                  </label>
                  <div className="text-sm font-medium text-gray-900 bg-blue-100/80 px-4 py-2.5 rounded-lg border border-gray-100">{tenant.timezone}</div>
                </div>
              )}
              {tenant.locale && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 tracking-tight flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Locale
                  </label>
                  <div className="text-sm font-medium text-gray-900 bg-blue-100/80 px-4 py-2.5 rounded-lg border border-gray-100">{tenant.locale}</div>
                </div>
              )}
            </div>
          </MaterialCard>
        )}

        <MaterialCard elevation={2} className="p-6">
          <h3 className="text-lg font-medium mb-6 flex items-center gap-2 text-gray-900 border-b pb-4">
            <Settings className="w-5 h-5 text-primary-500" />
            Account Security
          </h3>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/mfa')}
              className="w-full text-left p-5 border-2 border-gray-50 rounded-md hover:border-primary-100 hover:bg-primary-50/20 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-9 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                  <Settings className="w-6 h-6 text-gray-600 group-hover:text-primary-500" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-base">Multi-Factor Authentication</div>
                  <div className="text-sm text-gray-500">Add an extra layer of security to your account</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" />
            </button>
          </div>
        </MaterialCard>
      </div>
    </Layout>
  )
}
