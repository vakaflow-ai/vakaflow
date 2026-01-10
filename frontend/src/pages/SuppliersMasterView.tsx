import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/auth'
import { suppliersMasterApi, SupplierMasterView } from '../lib/suppliersMaster'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import {
  Building2, FileText, Shield, AlertTriangle, CheckCircle, XCircle,
  Users, Package, FileCheck, Search, Filter, Download, Eye, ChevronDown, ChevronRight,
  Calendar, DollarSign, Tag, ExternalLink, File, User
} from 'lucide-react'
import { MaterialCard, MaterialButton } from '../components/material'

export default function SuppliersMasterView() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  React.useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: ['suppliers-master'],
    queryFn: () => suppliersMasterApi.list(),
    enabled: !!user && (user?.role === 'tenant_admin' || user?.role === 'business_reviewer' || user?.role === 'platform_admin'),
  })

  // Filter suppliers based on search term
  const filteredSuppliers = useMemo(() => {
    if (!suppliers || !searchTerm) return suppliers || []
    const term = searchTerm.toLowerCase()
    return suppliers.filter(s => 
      s.vendor.name.toLowerCase().includes(term) ||
      s.vendor.contact_email?.toLowerCase().includes(term) ||
      s.vendor.description?.toLowerCase().includes(term)
    )
  }, [suppliers, searchTerm])

  const toggleSection = (supplierId: string, section: string) => {
    const key = `${supplierId}-${section}`
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isSectionExpanded = (supplierId: string, section: string) => {
    return expandedSections[`${supplierId}-${section}`] || false
  }

  const getStatusBadge = (status: string, type: 'agreement' | 'cve' | 'investigation' | 'compliance') => {
    const baseClasses = 'px-2 py-1 rounded text-xs font-medium'
    switch (type) {
      case 'agreement':
        switch (status?.toLowerCase()) {
          case 'active':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'expired':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'pending_signature':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
        }
      case 'cve':
        switch (status?.toLowerCase()) {
          case 'confirmed':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'resolved':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'mitigated':
            return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
        }
      case 'investigation':
      case 'compliance':
        switch (status?.toLowerCase()) {
          case 'open':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'in_progress':
          case 'in_remediation':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          case 'resolved':
          case 'closed':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
        }
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString()
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  if (!user || !['tenant_admin', 'business_reviewer', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="text-center py-12">Loading suppliers...</div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="text-center py-12 text-red-600">Error loading suppliers</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Suppliers Master View</h1>
          <p className="text-gray-600">Comprehensive view of all suppliers, their offerings, assessments, agreements, CVEs, and compliance status</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search suppliers by name, email, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Suppliers List */}
        <div className="space-y-6">
          {filteredSuppliers?.map((supplier) => (
            <MaterialCard key={supplier.vendor.id} className="p-6">
              {/* Supplier Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  {supplier.vendor.logo_url ? (
                    <img src={supplier.vendor.logo_url} alt={supplier.vendor.name} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{supplier.vendor.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{supplier.vendor.contact_email}</p>
                    {supplier.vendor.website && (
                      <a href={supplier.vendor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1">
                        <ExternalLink className="w-3 h-3" />
                        {supplier.vendor.website}
                      </a>
                    )}
                    {supplier.vendor.compliance_score !== null && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Compliance Score: </span>
                        <span className={`text-sm font-semibold ${supplier.vendor.compliance_score >= 80 ? 'text-green-600' : supplier.vendor.compliance_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {supplier.vendor.compliance_score}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <MaterialButton
                  onClick={() => navigate(`/vendors/${supplier.vendor.id}`)}
                  className="flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  View Profile
                </MaterialButton>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{supplier.offerings.length}</div>
                  <div className="text-sm text-gray-600">Offerings</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{supplier.agreements.length}</div>
                  <div className="text-sm text-gray-600">Agreements</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{supplier.cves.filter(c => c.confirmed).length}</div>
                  <div className="text-sm text-gray-600">Confirmed CVEs</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{supplier.investigations.filter(i => i.status === 'open' || i.status === 'in_progress').length}</div>
                  <div className="text-sm text-gray-600">Open Investigations</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{supplier.compliance_issues.filter(c => c.status === 'open' || c.status === 'in_remediation').length}</div>
                  <div className="text-sm text-gray-600">Open Compliance Issues</div>
                </div>
              </div>

              {/* Expandable Sections */}
              <div className="space-y-4">
                {/* Offerings */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'offerings')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'offerings') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <Package className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Offerings ({supplier.offerings.length})</span>
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'offerings') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.offerings.length === 0 ? (
                        <p className="text-gray-500 text-sm">No offerings recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.offerings.map((offering) => (
                            <div key={offering.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{offering.name}</h4>
                                  {offering.description && <p className="text-sm text-gray-600 mt-1">{offering.description}</p>}
                                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                    {offering.category && <span>Category: {offering.category}</span>}
                                    {offering.pricing_model && <span>Pricing: {offering.pricing_model}</span>}
                                    {offering.price && <span>Price: {formatCurrency(offering.price)}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {offering.is_active && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>}
                                  {offering.is_approved && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Approved</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Agreements */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'agreements')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'agreements') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <FileText className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Agreements & NDAs ({supplier.agreements.length})</span>
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'agreements') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.agreements.length === 0 ? (
                        <p className="text-gray-500 text-sm">No agreements recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.agreements.map((agreement) => (
                            <div key={agreement.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{agreement.title}</h4>
                                    {getStatusBadge(agreement.status, 'agreement')}
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{agreement.agreement_type}</span>
                                  </div>
                                  {agreement.description && <p className="text-sm text-gray-600 mt-1">{agreement.description}</p>}
                                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                    {agreement.effective_date && <span>Effective: {formatDate(agreement.effective_date)}</span>}
                                    {agreement.expiry_date && <span>Expires: {formatDate(agreement.expiry_date)}</span>}
                                    {agreement.signed_date && <span>Signed: {formatDate(agreement.signed_date)}</span>}
                                  </div>
                                  {agreement.pdf_file_path && (
                                    <a
                                      href={`/api/v1/uploads/${agreement.pdf_file_path.split('uploads/')[1] || agreement.pdf_file_path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                                    >
                                      <File className="w-4 h-4" />
                                      View PDF
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CVEs */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'cves')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'cves') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <Shield className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">CVEs ({supplier.cves.length})</span>
                      {supplier.cves.filter(c => c.confirmed).length > 0 && (
                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                          {supplier.cves.filter(c => c.confirmed).length} Confirmed
                        </span>
                      )}
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'cves') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.cves.length === 0 ? (
                        <p className="text-gray-500 text-sm">No CVEs recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.cves.map((cve) => (
                            <div key={cve.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{cve.cve_id}</h4>
                                    {getStatusBadge(cve.status, 'cve')}
                                    {cve.confirmed && <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">Confirmed</span>}
                                    {cve.severity && <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      cve.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                      cve.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                      cve.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>{cve.severity}</span>}
                                  </div>
                                  <p className="text-sm text-gray-900 font-medium mt-1">{cve.title}</p>
                                  {cve.description && <p className="text-sm text-gray-600 mt-1">{cve.description}</p>}
                                  {cve.cvss_score && <p className="text-sm text-gray-600 mt-1">CVSS Score: {cve.cvss_score}</p>}
                                  {cve.remediation_notes && <p className="text-sm text-gray-600 mt-2">Remediation: {cve.remediation_notes}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Investigations */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'investigations')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'investigations') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <AlertTriangle className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Investigations ({supplier.investigations.length})</span>
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'investigations') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.investigations.length === 0 ? (
                        <p className="text-gray-500 text-sm">No investigations recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.investigations.map((investigation) => (
                            <div key={investigation.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{investigation.title}</h4>
                                    {getStatusBadge(investigation.status, 'investigation')}
                                    {investigation.priority && <span className={`px-2 py-1 rounded text-xs ${
                                      investigation.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                      investigation.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>{investigation.priority}</span>}
                                  </div>
                                  {investigation.description && <p className="text-sm text-gray-600 mt-1">{investigation.description}</p>}
                                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                    <span>Type: {investigation.investigation_type}</span>
                                    {investigation.opened_at && <span>Opened: {formatDate(investigation.opened_at)}</span>}
                                  </div>
                                  {investigation.findings && <p className="text-sm text-gray-600 mt-2">Findings: {investigation.findings}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Compliance Issues */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'compliance')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'compliance') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <FileCheck className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Compliance Issues ({supplier.compliance_issues.length})</span>
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'compliance') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.compliance_issues.length === 0 ? (
                        <p className="text-gray-500 text-sm">No compliance issues recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.compliance_issues.map((issue) => (
                            <div key={issue.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{issue.title}</h4>
                                    {getStatusBadge(issue.status, 'compliance')}
                                    {issue.compliance_framework && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{issue.compliance_framework}</span>}
                                    {issue.severity && <span className={`px-2 py-1 rounded text-xs ${
                                      issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                      issue.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>{issue.severity}</span>}
                                  </div>
                                  {issue.description && <p className="text-sm text-gray-600 mt-1">{issue.description}</p>}
                                  {issue.requirement && <p className="text-sm text-gray-600 mt-1">Requirement: {issue.requirement}</p>}
                                  {issue.remediation_plan && <p className="text-sm text-gray-600 mt-2">Remediation: {issue.remediation_plan}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Department Relationships */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'departments')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'departments') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <Users className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Department Relationships ({supplier.department_relationships.length})</span>
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'departments') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.department_relationships.length === 0 ? (
                        <p className="text-gray-500 text-sm">No department relationships recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.department_relationships.map((dept) => (
                            <div key={dept.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{dept.department}</h4>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{dept.relationship_type}</span>
                                    {dept.is_active && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>}
                                  </div>
                                  {dept.contact_person && <p className="text-sm text-gray-600 mt-1">Contact: {dept.contact_person}</p>}
                                  {dept.contact_email && <p className="text-sm text-gray-600">Email: {dept.contact_email}</p>}
                                  {dept.annual_spend && <p className="text-sm text-gray-600 mt-1">Annual Spend: {formatCurrency(dept.annual_spend)}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Assessment History */}
                <div>
                  <button
                    onClick={() => toggleSection(supplier.vendor.id, 'assessments')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isSectionExpanded(supplier.vendor.id, 'assessments') ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <Calendar className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Assessment History ({supplier.assessment_history.length})</span>
                    </div>
                  </button>
                  {isSectionExpanded(supplier.vendor.id, 'assessments') && (
                    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                      {supplier.assessment_history.length === 0 ? (
                        <p className="text-gray-500 text-sm">No assessment history</p>
                      ) : (
                        <div className="space-y-3">
                          {supplier.assessment_history.map((assessment) => (
                            <div key={assessment.id} className="border-b border-gray-100 pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{assessment.name}</h4>
                                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                    {assessment.type && <span>Type: {assessment.type}</span>}
                                    {assessment.status && <span>Status: {assessment.status}</span>}
                                    {assessment.assigned_at && <span>Assigned: {formatDate(assessment.assigned_at)}</span>}
                                    {assessment.completed_at && <span>Completed: {formatDate(assessment.completed_at)}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </MaterialCard>
          ))}
        </div>

        {filteredSuppliers?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'No suppliers found matching your search' : 'No suppliers found'}
          </div>
        )}
      </div>
    </Layout>
  )
}

