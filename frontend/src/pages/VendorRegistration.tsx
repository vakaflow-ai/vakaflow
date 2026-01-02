import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { vendorInvitationsApi, InvitationAccept } from '../lib/vendorInvitations'
import { otpApi } from '../lib/otp'
import { authApi } from '../lib/auth'

export default function VendorRegistration() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const emailParam = searchParams.get('email')
  const tenantIdParam = searchParams.get('tenant_id')
  const tenantSlugParam = searchParams.get('tenant_slug')

  const [step, setStep] = useState<'verify-email' | 'vendor-details' | 'complete'>('verify-email')
  const [email, setEmail] = useState(emailParam || '')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  
  // Vendor details
  const [vendorName, setVendorName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const { data: invitation, isLoading: invitationLoading } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => vendorInvitationsApi.getByToken(token!),
    enabled: !!token,
    retry: false,
  })

  const sendOTP = useMutation({
    mutationFn: () => otpApi.send({ email: email.toLowerCase(), purpose: 'email_verification' }),
    onSuccess: () => {
      setOtpSent(true)
      alert('OTP code sent to your email. Please check your inbox.')
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Failed to send OTP code')
    }
  })

  const verifyOTP = useMutation({
    mutationFn: () => otpApi.verify({ email: email.toLowerCase(), otp, purpose: 'email_verification' }),
    onSuccess: () => {
      setOtpVerified(true)
      setStep('vendor-details')
      alert('Email verified successfully!')
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Invalid OTP code')
    }
  })

  const acceptInvitation = useMutation({
    mutationFn: (data: InvitationAccept) => vendorInvitationsApi.accept(data),
    onSuccess: () => {
      setStep('complete')
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Failed to create vendor account')
    }
  })

  useEffect(() => {
    if (invitation && invitation.email) {
      setEmail(invitation.email)
    }
  }, [invitation])

  const handleSendOTP = () => {
    if (!email.trim()) {
      alert('Please enter your email address')
      return
    }
    sendOTP.mutate()
  }

  const handleVerifyOTP = () => {
    if (!otp.trim() || otp.length !== 6) {
      alert('Please enter a valid 6-digit OTP code')
      return
    }
    verifyOTP.mutate()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      alert('Invalid invitation token')
      return
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long')
      return
    }

    if (!vendorName.trim() || !name.trim()) {
      alert('Please fill in all required fields')
      return
    }

    acceptInvitation.mutate({
      token,
      email: email.toLowerCase(),
      otp,
      vendor_name: vendorName.trim(),
      contact_phone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
      website: website.trim() || undefined,
      description: description.trim() || undefined,
      registration_number: registrationNumber.trim() || undefined,
      password,
      name: name.trim(),
      tenant_id: tenantIdParam || undefined,
      tenant_slug: tenantSlugParam || undefined
    })
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-medium mb-4 text-center">Invalid Invitation</h1>
          <p className="text-muted-foreground text-center mb-4">
            This invitation link is invalid or missing required parameters.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full compact-button-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-muted-foreground">Loading invitation...</div>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-medium mb-4 text-center">Invitation Not Found</h1>
          <p className="text-muted-foreground text-center mb-4">
            This invitation link is invalid or has expired.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full compact-button-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-medium mb-4">Registration Complete!</h1>
          <p className="text-muted-foreground mb-6">
            Your vendor account has been created successfully. You can now log in and start submitting your AI Agent solutions.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full compact-button-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-medium mb-2">Vendor Registration</h1>
            {invitation.tenant_name && (
              <p className="text-muted-foreground">
                You've been invited by <strong>{invitation.tenant_name}</strong>
                {tenantSlugParam && (
                  <span className="text-xs ml-2">({tenantSlugParam})</span>
                )}
              </p>
            )}
            {invitation.invited_by_name && (
              <p className="text-sm text-muted-foreground">
                Invited by: {invitation.invited_by_name}
              </p>
            )}
            {!tenantIdParam && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                ⚠️ Warning: Tenant information missing from invitation link. Please use the link from your invitation email.
              </div>
            )}
            {invitation.message && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-400 rounded-lg">
                <p className="text-sm text-blue-900">{invitation.message}</p>
              </div>
            )}
          </div>

          {step === 'verify-email' && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium mb-4">Step 1: Verify Your Email</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="compact-input w-full"
                  required
                  disabled={!!emailParam}
                />
              </div>
              {!otpSent ? (
                <button
                  onClick={handleSendOTP}
                  disabled={sendOTP.isPending}
                  className="w-full compact-button-primary"
                >
                  {sendOTP.isPending ? 'Sending...' : 'Send Verification Code'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Enter 6-digit OTP Code</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="compact-input w-full text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Check your email for the verification code
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleVerifyOTP}
                      disabled={verifyOTP.isPending || otp.length !== 6}
                      className="flex-1 compact-button-primary"
                    >
                      {verifyOTP.isPending ? 'Verifying...' : 'Verify Code'}
                    </button>
                    <button
                      onClick={handleSendOTP}
                      disabled={sendOTP.isPending}
                      className="compact-button-secondary"
                    >
                      Resend
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'vendor-details' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-medium mb-4">Step 2: Vendor & Account Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="compact-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Vendor/Company Name *</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="compact-input w-full"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="compact-input w-full"
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="compact-input w-full"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contact Phone</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="compact-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="compact-input w-full"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="compact-input w-full"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Registration Number</label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="compact-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="compact-input w-full"
                  rows={3}
                  placeholder="Brief description of your vendor/company..."
                />
              </div>

              <button
                type="submit"
                disabled={acceptInvitation.isPending}
                className="w-full compact-button-primary"
              >
                {acceptInvitation.isPending ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

