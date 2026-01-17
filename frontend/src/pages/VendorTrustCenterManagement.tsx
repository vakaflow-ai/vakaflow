import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorsApi, TrustCenter, TrustCenterUpdate } from '../lib/vendors'
import TrustCenterLayout from '../components/TrustCenterLayout'
import Layout from '../components/Layout'
import { Shield, Save, Plus, X, ExternalLink, Copy, Check, Link as LinkIcon, Award, FileText, Users, Building2, Palette, Lock, Eye } from 'lucide-react'
import { authApi } from '../lib/auth'
import { showToast } from '../utils/toast'
import { useNavigate } from 'react-router-dom'
import { MaterialInput, MaterialButton, MaterialChip } from '../components/material'
import { useDialogContext } from '../contexts/DialogContext'

export default function VendorTrustCenterManagement() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const dialog = useDialogContext()
  const [user, setUser] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const { data: trustCenter, isLoading } = useQuery<TrustCenter>({
    queryKey: ['my-trust-center'],
    queryFn: () => vendorsApi.getMyTrustCenter(),
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when window regains focus
  })

  const updateMutation = useMutation({
    mutationFn: (data: TrustCenterUpdate) => vendorsApi.updateMyTrustCenter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trust-center'] })
      showToast.success('Trust center updated successfully!')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Unknown error'
      showToast.error(`Failed to update trust center: ${errorMessage}`)
    },
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  const handleCopyUrl = () => {
    if (trustCenter?.public_url) {
      navigator.clipboard.writeText(trustCenter.public_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const [formData, setFormData] = useState<TrustCenterUpdate>({
    trust_center_enabled: false,
    compliance_score: undefined,
    compliance_url: '',
    security_policy_url: '',
    privacy_policy_url: '',
    // customer_logos is now auto-generated, removed from form
    compliance_certifications: [],
    published_artifacts: [],
    published_documents: [],
    trust_center_slug: '',
    branding: {
      primary_color: '#3b82f6',
      header_background: '#ffffff',
      header_text_color: '#111827',
      sidebar_background: '#f9fafb',
      button_primary_color: '#3b82f6',
      button_primary_text_color: '#ffffff',
    }
  })

  // Initialize form data when trust center loads
  useEffect(() => {
    if (trustCenter) {
      setFormData({
        trust_center_enabled: trustCenter.trust_center_enabled,
        compliance_score: trustCenter.compliance_score,
        compliance_url: trustCenter.compliance_url || '',
        security_policy_url: trustCenter.security_policy_url || '',
        privacy_policy_url: trustCenter.privacy_policy_url || '',
        // customer_logos is auto-generated, not editable
        compliance_certifications: trustCenter.compliance_certifications || [],
        published_artifacts: trustCenter.published_artifacts || [],
        published_documents: trustCenter.published_documents || [],
        trust_center_slug: trustCenter.public_url.split('/').pop() || '',
        branding: trustCenter.branding || {
          primary_color: '#3b82f6',
          header_background: '#ffffff',
          header_text_color: '#111827',
          sidebar_background: '#f9fafb',
          button_primary_color: '#3b82f6',
          button_primary_text_color: '#ffffff',
        },
      })
    }
  }, [trustCenter])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const addCustomerLogo = async () => {
    const name = await dialog.prompt({
      title: 'Add Customer Logo',
      message: 'Enter customer information',
      label: 'Customer Name',
      placeholder: 'Enter customer name...',
      required: true
    })
    if (!name) return

    const logoUrl = await dialog.prompt({
      title: 'Add Customer Logo',
      message: 'Enter the logo URL',
      label: 'Logo URL',
      placeholder: 'https://example.com/logo.png',
      required: true
    })
    if (name && logoUrl) {
      setFormData({
        ...formData,
        customer_logos: [...(formData.customer_logos || []), { name, logo_url: logoUrl }],
      })
    }
  }

  const removeCustomerLogo = (index: number) => {
    const logos = [...(formData.customer_logos || [])]
    logos.splice(index, 1)
    setFormData({ ...formData, customer_logos: logos })
  }

  const addCertification = async () => {
    const type = await dialog.prompt({
      title: 'Add Certification',
      message: 'Enter certification details',
      label: 'Certification Type',
      placeholder: 'e.g., SOC 2, ISO 27001',
      required: true
    })
    if (!type) return

    const name = await dialog.prompt({
      title: 'Add Certification',
      message: 'Enter the certification name',
      label: 'Certification Name',
      placeholder: 'Enter certification name...',
      required: true
    })
    if (!name) return

    const logoUrl = await dialog.prompt({
      title: 'Add Certification',
      message: 'Enter the certification logo URL (optional)',
      label: 'Logo URL',
      placeholder: 'https://example.com/logo.png',
      required: false
    })
    if (type && name) {
      setFormData({
        ...formData,
        compliance_certifications: [
          ...(formData.compliance_certifications || []),
          {
            type,
            name,
            logo_url: logoUrl || undefined,
            verified: false,
          },
        ],
      })
    }
  }

  const removeCertification = (index: number) => {
    const certs = [...(formData.compliance_certifications || [])]
    certs.splice(index, 1)
    setFormData({ ...formData, compliance_certifications: certs })
  }

  const addDocument = async () => {
    const name = await dialog.prompt({
      title: 'Add Document',
      message: 'Enter document information',
      label: 'Document Name',
      placeholder: 'Enter document name...',
      required: true
    })
    if (!name) return

    const type = await dialog.prompt({
      title: 'Add Document',
      message: 'Enter the document type',
      label: 'Document Type',
      placeholder: 'e.g., Policy, Report, Whitepaper',
      required: true
    })
    if (!type) return

    const url = await dialog.prompt({
      title: 'Add Document',
      message: 'Enter the document URL',
      label: 'Document URL',
      placeholder: 'https://example.com/document.pdf',
      required: true
    })
    if (name && type && url) {
      setFormData({
        ...formData,
        published_documents: [
          ...(formData.published_documents || []),
          {
            id: Date.now().toString(),
            name,
            type,
            url,
            published_date: new Date().toISOString(),
          },
        ],
      })
    }
  }

  const removeDocument = (index: number) => {
    const docs = [...(formData.published_documents || [])]
    docs.splice(index, 1)
    setFormData({ ...formData, published_documents: docs })
  }

  const addArtifact = async () => {
    const name = await dialog.prompt({
      title: 'Add Artifact',
      message: 'Enter artifact information',
      label: 'Artifact Name',
      placeholder: 'Enter artifact name...',
      required: true
    })
    if (!name) return

    const type = await dialog.prompt({
      title: 'Add Artifact',
      message: 'Enter the artifact type',
      label: 'Artifact Type',
      placeholder: 'e.g., Report, Certificate, Assessment',
      required: true
    })
    if (!type) return

    const url = await dialog.prompt({
      title: 'Add Artifact',
      message: 'Enter the artifact URL',
      label: 'Artifact URL',
      placeholder: 'https://example.com/artifact.pdf',
      required: true
    })
    if (name && type && url) {
      setFormData({
        ...formData,
        published_artifacts: [
          ...(formData.published_artifacts || []),
          {
            id: Date.now().toString(),
            name,
            type,
            url,
            published_date: new Date().toISOString(),
          },
        ],
      })
    }
  }

  const removeArtifact = (index: number) => {
    const artifacts = [...(formData.published_artifacts || [])]
    artifacts.splice(index, 1)
    setFormData({ ...formData, published_artifacts: artifacts })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading trust center settings...</p>
        </div>
      </div>
    )
  }

  const vendorName = trustCenter?.vendor_name || 'Your Trust Center'

  // Build sections for TrustCenterLayout
  const sections = [
    {
      id: 'overview',
      title: 'Overview',
      icon: <Shield className="w-5 h-5" />,
      order: 1,
      content: (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 shadow-inner">
            <div>
              <h4 className="font-semibold text-gray-900 tracking-tight">Trust Center Visibility</h4>
              <p className="text-xs text-gray-500 font-medium">Manage your public trust center status</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={formData.trust_center_enabled || false}
                onChange={(e) => setFormData({ ...formData, trust_center_enabled: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-primary-500 transition-all cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Enabled</span>
            </label>
          </div>
          {trustCenter?.public_url && (
            <div className="flex items-center gap-3 p-4 bg-primary-50/30 rounded-lg border border-primary-100">
              <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center text-blue-600 shadow-sm">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-blue-600 tracking-tight mb-0.5">Live Portal URL</span>
                <code className="text-sm font-mono font-bold text-primary-700 truncate block">{trustCenter.public_url}</code>
              </div>
              <MaterialButton
                variant="outlined"
                size="small"
                onClick={handleCopyUrl}
                className="rounded-md bg-white border-primary-100 text-blue-600 hover:bg-primary-50 px-4"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </MaterialButton>
            </div>
          )}
          {formData.trust_center_enabled && (
            <div className="space-y-2 pt-2">
              <label className="block text-sm font-medium text-gray-600 tracking-tight ml-1">Custom URL slug (optional)</label>
              <div className="flex items-center gap-2">
                <div className="h-9 flex items-center px-4 bg-gray-100 text-gray-600 font-medium text-sm rounded-l-xl border border-r-0 border-gray-200">/trust-center/</div>
                <input
                  type="text"
                  value={formData.trust_center_slug || ''}
                  onChange={(e) => setFormData({ ...formData, trust_center_slug: e.target.value })}
                  placeholder="e.g. acme-corp"
                  className="flex-1 h-9 px-4 text-sm font-bold rounded-r-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200"
                  pattern="[a-z0-9\-]+"
                />
              </div>
              <p className="text-xs text-gray-600 font-bold ml-1">Use lowercase letters, numbers, and hyphens only</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'branding',
      title: 'Branding',
      icon: <Palette className="w-5 h-5" />,
      order: 1.5,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.branding?.primary_color || '#3b82f6'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, primary_color: e.target.value }
                  })}
                  className="h-10 w-20 p-1 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.branding?.primary_color || '#3b82f6'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, primary_color: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Button Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.branding?.button_primary_color || formData.branding?.primary_color || '#3b82f6'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, button_primary_color: e.target.value }
                  })}
                  className="h-10 w-20 p-1 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.branding?.button_primary_color || formData.branding?.primary_color || '#3b82f6'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, button_primary_color: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Header Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.branding?.header_background || '#ffffff'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, header_background: e.target.value }
                  })}
                  className="h-10 w-20 p-1 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.branding?.header_background || '#ffffff'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, header_background: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Header Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.branding?.header_text_color || '#111827'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, header_text_color: e.target.value }
                  })}
                  className="h-10 w-20 p-1 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.branding?.header_text_color || '#111827'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, header_text_color: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Body Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.branding?.sidebar_background || '#f9fafb'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, sidebar_background: e.target.value }
                  })}
                  className="h-10 w-20 p-1 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.branding?.sidebar_background || '#f9fafb'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, sidebar_background: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Button Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.branding?.button_primary_text_color || '#ffffff'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, button_primary_text_color: e.target.value }
                  })}
                  className="h-10 w-20 p-1 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.branding?.button_primary_text_color || '#ffffff'}
                  onChange={(e) => setFormData({
                    ...formData,
                    branding: { ...formData.branding, button_primary_text_color: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Font Family</label>
            <select
              value={formData.branding?.font_family || ''}
              onChange={(e) => setFormData({
                ...formData,
                branding: { ...formData.branding, font_family: e.target.value }
              })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
            >
              <option value="">Default (Inter)</option>
              <option value="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif">Sans Serif</option>
              <option value="ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif">Serif</option>
              <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">Monospace</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      id: 'compliance',
      title: 'Compliance & Audit',
      icon: <Award className="w-5 h-5" />,
      order: 2,
      content: (
        <div className="space-y-8">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-600 tracking-tight ml-1">Overall compliance score (0-100)</label>
            <div className="relative group max-w-xs">
              <input
                type="number"
                min="0"
                max="100"
                value={formData.compliance_score || ''}
                onChange={(e) =>
                  setFormData({ ...formData, compliance_score: e.target.value ? parseInt(e.target.value) : undefined })
                }
                className="w-full h-10 pl-6 pr-12 text-2xl font-bold rounded-lg border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-primary-500/10 transition-all text-primary-700"
                placeholder="0"
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-medium text-gray-600">%</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-600 tracking-tight ml-1">Certifications & Accreditations</label>
              <MaterialButton
                type="button"
                variant="outlined"
                size="small"
                color="primary"
                onClick={addCertification}
                className="rounded-md border-primary-100 bg-primary-50/30 px-4"
                startIcon={<Plus className="w-4 h-4" />}
              >
                Add Certification
              </MaterialButton>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.compliance_certifications?.map((cert, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow group/item">
                  <div className="w-12 h-9 rounded-md bg-gray-50 flex items-center justify-center text-blue-600 border border-gray-100">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{cert.name}</p>
                    <p className="text-xs font-medium text-gray-700 tracking-tight mt-0.5">{cert.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-error-50 transition-all opacity-0 group-hover/item:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!formData.compliance_certifications || formData.compliance_certifications.length === 0) && (
                <div className="md:col-span-2 py-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-sm font-medium text-gray-600">No active certifications configured</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'policies',
      title: 'Policies & Legal',
      icon: <FileText className="w-5 h-5" />,
      order: 3,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2 md:col-span-2">
            <MaterialInput
              label="Compliance Policy URL"
              type="url"
              value={formData.compliance_url || ''}
              onChange={(e) => setFormData({ ...formData, compliance_url: e.target.value })}
              placeholder="https://example.com/compliance"
              className="h-9 bg-gray-50 focus:bg-white rounded-md"
              startAdornment={<Shield className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-2">
            <MaterialInput
              label="Security Policy URL"
              type="url"
              value={formData.security_policy_url || ''}
              onChange={(e) => setFormData({ ...formData, security_policy_url: e.target.value })}
              placeholder="https://example.com/security"
              className="h-9 bg-gray-50 focus:bg-white rounded-md"
              startAdornment={<Lock className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-2">
            <MaterialInput
              label="Privacy Policy URL"
              type="url"
              value={formData.privacy_policy_url || ''}
              onChange={(e) => setFormData({ ...formData, privacy_policy_url: e.target.value })}
              placeholder="https://example.com/privacy"
              className="h-9 bg-gray-50 focus:bg-white rounded-md"
              startAdornment={<Shield className="w-4 h-4" />}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'customers',
      title: 'Trusted By',
      icon: <Users className="w-5 h-5" />,
      order: 4,
      content: (
        <div>
          <p className="text-xs text-gray-500 mb-4">
            Automatically populated from tenants using your approved agents
          </p>
          {trustCenter?.customer_logos && trustCenter.customer_logos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {trustCenter.customer_logos.map((logo, idx) => (
                <div key={idx} className="border rounded-lg p-3 text-center">
                  {logo.logo_url && (
                    <img src={logo.logo_url} alt={logo.name} className="h-12 w-auto object-contain mx-auto" />
                  )}
                  <p className="text-xs text-center mt-2 text-gray-600">{logo.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">
              No customer logos available. Customer logos are automatically generated when tenants use your approved agents.
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'documents',
      title: 'Global Documents',
      icon: <FileText className="w-5 h-5" />,
      order: 5,
      content: (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900 tracking-tight">Technical Assets</h4>
              <p className="text-xs text-gray-500 font-medium">Manage whitepapers, case studies, and architecture briefs</p>
            </div>
            <MaterialButton
              type="button"
              variant="outlined"
              size="small"
              color="primary"
              onClick={addDocument}
              className="rounded-md border-primary-100 bg-primary-50/30 px-4"
              startIcon={<Plus className="w-4 h-4" />}
            >
              Add Document
            </MaterialButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.published_documents?.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow group/item">
                <div className="w-12 h-9 rounded-md bg-gray-50 flex items-center justify-center text-blue-600 border border-gray-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{doc.name}</p>
                  <p className="text-xs font-medium text-gray-700 tracking-tight mt-0.5">{doc.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDocument(idx)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-error-50 transition-all opacity-0 group-hover/item:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.published_documents || formData.published_documents.length === 0) && (
              <div className="md:col-span-2 py-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <p className="text-sm font-medium text-gray-600">No documents published yet</p>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'artifacts',
      title: 'External Artifacts',
      icon: <LinkIcon className="w-5 h-5" />,
      order: 6,
      content: (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900 tracking-tight">Verified Proofs</h4>
              <p className="text-xs text-gray-500 font-medium">Link to external audit results or proof-of-concept repositories</p>
            </div>
            <MaterialButton
              type="button"
              variant="outlined"
              size="small"
              color="primary"
              onClick={addArtifact}
              className="rounded-md border-primary-100 bg-primary-50/30 px-4"
              startIcon={<Plus className="w-4 h-4" />}
            >
              Add Artifact
            </MaterialButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.published_artifacts?.map((artifact, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow group/item">
                <div className="w-12 h-9 rounded-md bg-gray-50 flex items-center justify-center text-blue-600 border border-gray-100">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{artifact.name}</p>
                  <p className="text-xs font-medium text-gray-700 tracking-tight mt-0.5">{artifact.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeArtifact(idx)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-error-50 transition-all opacity-0 group-hover/item:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.published_artifacts || formData.published_artifacts.length === 0) && (
              <div className="md:col-span-2 py-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <p className="text-sm font-medium text-gray-600">No artifacts linked yet</p>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ]

  return (
    <Layout user={user}>
      <form onSubmit={handleSubmit} className="h-full">
        <TrustCenterLayout
          vendorName={vendorName}
          sections={sections}
          branding={trustCenter?.branding}
          useBranding={false} // Management page uses default colors
          showSidebar={false} // Hide TrustCenterLayout sidebar, use main Layout sidebar instead
          onPreview={() => {
            if (trustCenter?.public_url) {
              window.open(trustCenter.public_url, '_blank')
            } else {
              showToast.error('Trust center not published yet')
            }
          }}
          searchPlaceholder="Q Search content"
        />
        {/* Floating Action Buttons - Aligned together */}
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          {trustCenter?.public_url && (
            <MaterialButton
              variant="outlined"
              size="small"
              onClick={() => {
                if (trustCenter?.public_url) {
                  window.open(trustCenter.public_url, '_blank')
                } else {
                  showToast.error('Trust center not published yet')
                }
              }}
              className="px-6 py-2 rounded-[2rem] font-medium flex items-center gap-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-lg transition-all hover:scale-105"
              startIcon={<Eye className="w-4 h-4" />}
            >
              Live Preview
            </MaterialButton>
          )}
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-8 py-2 rounded-[2rem] font-bold flex items-center gap-3 disabled:opacity-50 shadow-2xl transition-all hover:scale-105 active:scale-95 group bg-blue-600 text-white hover:bg-blue-700"
          >
            <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="tracking-tight">{updateMutation.isPending ? 'Synchronizing...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </Layout>
  )
}

