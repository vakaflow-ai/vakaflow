import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorInvitationsApi, VendorInvitation, InvitationCreate } from '../lib/vendorInvitations'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { FormField } from '../components/FormField'
import { useFormValidation } from '../hooks/useFormValidation'

// Helper to extract error message
const getErrorMessage = (error: any): string => {
  if (error?.response?.data?.detail) {
    return error.response.data.detail
  }
  if (error?.response?.data?.message) {
    return error.response.data.message
  }
  if (Array.isArray(error?.response?.data?.detail)) {
    return error.response.data.detail.map((e: any) => e.msg || e).join(', ')
  }
  return error?.message || 'Failed to send invitation'
}

// Pre-seeded invitation messages
const INVITATION_MESSAGES = {
  'ai-agentic-app-onboarding': `Dear Vendor,

We are pleased to invite you to submit your AI Agentic Application for onboarding to our platform. 

This invitation provides you with access to our Vendor Portal where you can:
- Submit your AI Agent solution for review
- Track the status of your submission
- Respond to reviewer feedback
- Manage your agent configurations

Please complete your registration using the link provided in this email. Once registered, you'll be able to submit your AI Agent application and begin the onboarding process.

We look forward to working with you.

Best regards,
The Platform Team`,

  'vendor-onboarding': `Dear Vendor,

Welcome! We are excited to invite you to join our vendor network and submit your solutions to our organization.

This invitation grants you access to our Vendor Portal where you can:
- Create and manage your vendor profile
- Submit AI Agent solutions for review
- Track submission status and reviews
- Communicate with our review team

Please complete your registration using the link in this email. After registration, you'll be able to set up your vendor account and begin submitting solutions.

We're looking forward to partnering with you.

Best regards,
The Platform Team`,

  'vendor-app-onboarding-request': `Dear Vendor,

We have received your request to onboard your AI Agent application to our platform. We are pleased to extend this invitation for you to proceed with the submission process.

This invitation provides access to our Vendor Portal where you can:
- Complete your vendor registration
- Submit your AI Agent application
- Provide required documentation and details
- Track the onboarding progress

Please use the registration link in this email to get started. Once registered, you'll be able to submit your application and begin the onboarding review process.

If you have any questions, please don't hesitate to reach out.

Best regards,
The Platform Team`
}

type InvitationType = 'ai-agentic-app-onboarding' | 'vendor-onboarding' | 'vendor-app-onboarding-request' | ''

export default function InviteVendor() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [invitationType, setInvitationType] = useState<InvitationType>('')

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset
  } = useFormValidation(
    { email: '', message: '' },
    {
      email: {
        required: true,
        email: true,
        message: 'Please enter a valid email address'
      },
      message: {
        maxLength: 1000,
        message: 'Message must be no more than 1000 characters'
      }
    }
  )

  // Handle invitation type selection
  const handleInvitationTypeChange = (type: InvitationType) => {
    setInvitationType(type)
    if (type && INVITATION_MESSAGES[type]) {
      handleChange('message', INVITATION_MESSAGES[type])
    } else {
      handleChange('message', '')
    }
  }

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.getCurrentUser(),
  })

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['vendor-invitations', statusFilter],
    queryFn: () => vendorInvitationsApi.list(statusFilter || undefined),
    enabled: !!user,
  })

  const createInvitation = useMutation({
    mutationFn: (data: InvitationCreate) => vendorInvitationsApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] })
      reset()
      setInvitationType('')
      
      // Check if email was sent successfully
      if (data.email_sent === false && data.email_error) {
        alert(`Invitation created successfully, but the email could not be sent.\n\n${data.email_error}\n\nPlease configure SMTP settings in Integration Management, then you can resend the invitation email.`)
      } else if (data.email_sent === false) {
        alert(`Invitation created successfully, but the email could not be sent.\n\nPlease configure SMTP settings in Integration Management, then you can resend the invitation email.`)
      } else {
      alert(`Invitation sent successfully! The vendor will receive an email with a registration link to access the Vendor Portal.`)
      }
    },
    onError: async (error: any) => {
      const errorMessage = getErrorMessage(error)
      console.error('Invitation error:', error)
      console.error('Error response:', error?.response?.data)
      console.error('Error status:', error?.response?.status)
      
      // Handle "already exists" error - fetch existing invitation and offer to resend
      if (errorMessage.includes('already exists') || errorMessage.includes('active invitation')) {
        try {
          // Get the email from the form values
          const emailToCheck = values.email?.trim().toLowerCase()
          
          if (emailToCheck) {
            // Fetch all invitations to find the existing one
            const invitations = await vendorInvitationsApi.list('pending')
            const existingInvitation = invitations.find(
              inv => inv.email.toLowerCase() === emailToCheck
            )
            
            if (existingInvitation) {
              const expiresAt = new Date(existingInvitation.expires_at)
              const expiresIn = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              
              const message = `An active invitation already exists for ${emailToCheck}.\n\n` +
                `Invitation Details:\n` +
                `- Status: ${existingInvitation.status}\n` +
                `- Expires in: ${expiresIn} day(s)\n` +
                `- Created: ${new Date(existingInvitation.created_at).toLocaleDateString()}\n\n` +
                `Would you like to resend the invitation email?`
              
              if (confirm(message)) {
                resendInvitation.mutate(existingInvitation.id)
              }
            } else {
              alert(`An active invitation already exists for ${emailToCheck}.\n\nThis vendor may already be registered or have a pending invitation.`)
            }
          } else {
            alert(`An active invitation already exists for this email.\n\nThis vendor may already be registered or have a pending invitation.`)
          }
        } catch (fetchError) {
          // Fallback if we can't fetch invitations
          alert(`An active invitation already exists for this email.\n\nThis vendor may already be registered or have a pending invitation.`)
        }
      } else {
        // Show user-friendly error message for other errors
      let userMessage = `Failed to send invitation: ${errorMessage}`
      
        if (errorMessage.includes('tenant')) {
        userMessage += '\n\nPlease contact your administrator to ensure your account is properly configured.'
      } else if (errorMessage.includes('email')) {
        userMessage += '\n\nPlease check that the email address is valid and correctly formatted.'
      }
      
      alert(userMessage)
      }
    }
  })

  const resendInvitation = useMutation({
    mutationFn: (id: string) => vendorInvitationsApi.resend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] })
      alert('Invitation email resent successfully!')
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Failed to resend invitation')
    }
  })

  const cancelInvitation = useMutation({
    mutationFn: (id: string) => vendorInvitationsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] })
      alert('Invitation cancelled successfully!')
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Failed to cancel invitation')
    }
  })

  const onSubmit = async (formValues: { email: string; message: string }) => {
    createInvitation.mutate({ 
      email: formValues.email.trim().toLowerCase(), 
      message: formValues.message.trim() || undefined 
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'status-badge-warning',
      accepted: 'status-badge-success',
      expired: 'status-badge',
      cancelled: 'status-badge-error',
    }
    return badges[status] || 'status-badge'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!user) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  const allowedRoles = ['tenant_admin', 'business_reviewer', 'platform_admin']
  if (!allowedRoles.includes(user?.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Access Denied</div>
          <div className="text-muted-foreground">Only tenant admins and business users can invite vendors.</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invite Vendor</h1>
          <p className="text-sm text-gray-600">
            Invite vendors to submit their AI Agent solutions to your organization
          </p>
        </div>

        {/* Invitation Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Send Invitation</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              label="Vendor Email"
              name="email"
              type="email"
              value={values.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              error={touched.email ? errors.email : undefined}
              required
              placeholder="vendor@example.com"
            />
            <p className="text-sm text-gray-600 -mt-2 mb-6">
              The vendor will receive an invitation email with a registration link to access the Vendor Portal
            </p>

            {/* Invitation Type Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Invitation Type
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="invitationType"
                    value="ai-agentic-app-onboarding"
                    checked={invitationType === 'ai-agentic-app-onboarding'}
                    onChange={(e) => handleInvitationTypeChange(e.target.value as InvitationType)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">AI Agentic App Onboarding</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Invite vendor to submit their AI Agent application for onboarding
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="invitationType"
                    value="vendor-onboarding"
                    checked={invitationType === 'vendor-onboarding'}
                    onChange={(e) => handleInvitationTypeChange(e.target.value as InvitationType)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Vendor Onboarding</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Invite vendor to join the platform and create their vendor profile
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="invitationType"
                    value="vendor-app-onboarding-request"
                    checked={invitationType === 'vendor-app-onboarding-request'}
                    onChange={(e) => handleInvitationTypeChange(e.target.value as InvitationType)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Vendor App Onboarding Request</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Respond to vendor's request to onboard their application
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="invitationType"
                    value=""
                    checked={invitationType === ''}
                    onChange={(e) => handleInvitationTypeChange(e.target.value as InvitationType)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Custom Message</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Write your own custom invitation message
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <FormField
              label="Optional Message"
              name="message"
              as="textarea"
              value={values.message}
              onChange={(e) => {
                handleChange('message', e.target.value)
                // Clear invitation type if user manually edits message
                if (invitationType && e.target.value !== INVITATION_MESSAGES[invitationType]) {
                  setInvitationType('')
                }
              }}
              onBlur={() => handleBlur('message')}
              error={touched.message ? errors.message : undefined}
              placeholder="Add a personal message to the invitation..."
              rows={6}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground -mt-2">
              {values.message.length}/1000 characters
            </p>
            
            <button
              type="submit"
              disabled={createInvitation.isPending}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createInvitation.isPending ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

        {/* Invitations List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Invitations</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !invitations || invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invitations yet. Send your first invitation above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Tenant</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Invited By</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Sent Date</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Message</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
              {invitations.map((invitation: VendorInvitation) => (
                    <tr key={invitation.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-sm">{invitation.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`status-badge ${getStatusBadge(invitation.status)}`}>
                          {invitation.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">
                          {invitation.tenant_name || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">
                          {invitation.invited_by_name || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-700">
                          <div>{formatDate(invitation.created_at)}</div>
                          {invitation.status === 'pending' && invitation.expires_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Expires: {formatDate(invitation.expires_at)}
                        </div>
                      )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {invitation.message ? (
                          <div className="max-w-md">
                            <div 
                              className="text-sm text-gray-700 overflow-hidden text-ellipsis" 
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                maxHeight: '3em'
                              }}
                              title={invitation.message}
                            >
                              {invitation.message}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {invitation.status === 'pending' && (
                          <div className="flex gap-2">
                          <button
                            onClick={() => resendInvitation.mutate(invitation.id)}
                            disabled={resendInvitation.isPending}
                              className="compact-button-secondary text-xs whitespace-nowrap"
                            title="Resend invitation email"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to cancel this invitation?')) {
                                cancelInvitation.mutate(invitation.id)
                              }
                            }}
                            disabled={cancelInvitation.isPending}
                              className="compact-button-secondary text-xs text-red-600 whitespace-nowrap"
                            title="Cancel invitation"
                          >
                            Cancel
                          </button>
                          </div>
                      )}
                      </td>
                    </tr>
              ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

