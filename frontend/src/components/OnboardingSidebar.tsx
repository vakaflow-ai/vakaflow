import React from 'react'
import { User, Building2, Mail, Phone, MapPin, Briefcase, Users, Calendar } from 'lucide-react'
import { MaterialCard } from './material'

interface OnboardingSidebarProps {
  user: any
  formData: any
  entityType: 'product' | 'service' | 'agent' | 'vendor'
  vendors?: any[]
  users?: any[]
}

export default function OnboardingSidebar({ user, formData, entityType, vendors, users }: OnboardingSidebarProps) {
  const selectedVendor = vendors?.find(v => v.id === formData.vendor_id)
  const owner = users?.find(u => u.id === (formData.metadata as any)?.owner_id)
  const metadata = formData.metadata || {}

  return (
    <div className="w-80 flex-shrink-0">
      <div className="sticky top-4 space-y-4">
        {/* User Information */}
        <MaterialCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Your Information</h3>
              <p className="text-xs text-gray-500">Current user details</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Name</div>
              <div className="text-sm font-medium text-gray-900">{user?.name || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Email</div>
              <div className="text-sm font-medium text-gray-900">{user?.email || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Role</div>
              <div className="text-sm font-medium text-gray-900 capitalize">
                {user?.role?.replace(/_/g, ' ') || '-'}
              </div>
            </div>
            {user?.department && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Department</div>
                <div className="text-sm font-medium text-gray-900">{user.department}</div>
              </div>
            )}
          </div>
        </MaterialCard>

        {/* Entity Metadata */}
        <MaterialCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Entity Details</h3>
              <p className="text-xs text-gray-500">Current submission info</p>
            </div>
          </div>
          <div className="space-y-3">
            {formData.name && (
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  {entityType === 'product' ? 'Product' : entityType === 'service' ? 'Service' : entityType === 'agent' ? 'Agent' : 'Vendor'} Name
                </div>
                <div className="text-sm font-medium text-gray-900">{formData.name}</div>
              </div>
            )}
            {selectedVendor && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Vendor</div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <div className="text-sm font-medium text-gray-900">{selectedVendor.name}</div>
                </div>
              </div>
            )}
            {formData.category && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Category</div>
                <div className="text-sm font-medium text-gray-900 capitalize">{formData.category}</div>
              </div>
            )}
            {formData.type && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Type</div>
                <div className="text-sm font-medium text-gray-900 capitalize">
                  {formData.type.replace(/_/g, ' ')}
                </div>
              </div>
            )}
            {formData.version && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Version</div>
                <div className="text-sm font-medium text-gray-900">{formData.version}</div>
              </div>
            )}
          </div>
        </MaterialCard>

        {/* Business Information */}
        {(owner || metadata.department || metadata.business_unit) && (
          <MaterialCard className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Business Info</h3>
                <p className="text-xs text-gray-500">Organization details</p>
              </div>
            </div>
            <div className="space-y-3">
              {owner && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Owner</div>
                  <div className="text-sm font-medium text-gray-900">
                    {owner.name} ({owner.email})
                  </div>
                </div>
              )}
              {metadata.department && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Department</div>
                  <div className="text-sm font-medium text-gray-900">{metadata.department}</div>
                </div>
              )}
              {metadata.business_unit && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Business Unit</div>
                  <div className="text-sm font-medium text-gray-900">{metadata.business_unit}</div>
                </div>
              )}
            </div>
          </MaterialCard>
        )}

        {/* Contact Information */}
        {(metadata.support_email || metadata.support_phone) && (
          <MaterialCard className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Support Contact</h3>
                <p className="text-xs text-gray-500">Support information</p>
              </div>
            </div>
            <div className="space-y-3">
              {metadata.support_email && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Email</div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div className="text-sm font-medium text-gray-900">{metadata.support_email}</div>
                  </div>
                </div>
              )}
              {metadata.support_phone && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Phone</div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div className="text-sm font-medium text-gray-900">{metadata.support_phone}</div>
                  </div>
                </div>
              )}
            </div>
          </MaterialCard>
        )}
      </div>
    </div>
  )
}
