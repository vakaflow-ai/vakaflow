import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { mfaApi, MFAStatus } from '../lib/mfa'
import Layout from '../components/Layout'

export default function MFASettings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [setupCode, setSetupCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: mfaStatus, isLoading } = useQuery<MFAStatus>({
    queryKey: ['mfa-status'],
    queryFn: () => mfaApi.getStatus(),
  })

  const setupMutation = useMutation({
    mutationFn: () => mfaApi.setup('totp'),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes || [])
      setShowBackupCodes(true)
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (code: string) => mfaApi.verify(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      setVerificationCode('')
      alert('MFA verified successfully!')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Verification failed')
    },
  })

  const enableMutation = useMutation({
    mutationFn: () => mfaApi.enable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      alert('MFA enabled successfully!')
    },
  })

  const disableMutation = useMutation({
    mutationFn: () => mfaApi.disable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      alert('MFA disabled successfully!')
    },
  })

  const handleSetup = () => {
    setupMutation.mutate()
  }

  const handleVerify = () => {
    if (verificationCode.length >= 6) {
      verifyMutation.mutate(verificationCode)
    }
  }

  const handleEnable = () => {
    if (window.confirm('Enable MFA? You will need to verify with a code on each login.')) {
      enableMutation.mutate()
    }
  }

  const handleDisable = () => {
    if (window.confirm('Disable MFA? This will reduce your account security.')) {
      disableMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div>Loading...</div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Multi-Factor Authentication</h1>
          <p className="text-muted-foreground">
            Enhance your account security with MFA
          </p>
        </div>

        <div className="compact-card-elevated">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-medium mb-1">MFA Status</h2>
              <p className="text-sm text-muted-foreground">
                {mfaStatus?.enabled ? 'MFA is enabled' : 'MFA is not enabled'}
              </p>
            </div>
            <span className={`status-badge ${mfaStatus?.enabled ? 'status-badge-success' : 'status-badge-info'}`}>
              {mfaStatus?.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {!mfaStatus?.enabled && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Set Up MFA</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
                </p>
                
                {setupMutation.data?.qr_code && (
                  <div className="mb-4">
                    <img 
                      src={setupMutation.data.qr_code} 
                      alt="MFA QR Code" 
                      className="w-48 h-48 mx-auto border border-border rounded-lg p-2 bg-white"
                    />
                  </div>
                )}

                {showBackupCodes && backupCodes.length > 0 && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-medium text-amber-900 mb-2">⚠️ Save These Backup Codes</h4>
                    <p className="text-sm text-amber-800 mb-3">
                      These codes can be used if you lose access to your authenticator app. Save them securely!
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, idx) => (
                        <code key={idx} className="p-2 bg-white border border-amber-300 rounded text-sm font-mono">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {!setupMutation.data && (
                    <button
                      onClick={handleSetup}
                      className="compact-button-primary"
                      disabled={setupMutation.isPending}
                    >
                      {setupMutation.isPending ? 'Setting up...' : 'Generate QR Code'}
                    </button>
                  )}

                  {setupMutation.data && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Enter Verification Code</label>
                        <input
                          type="text"
                          className="compact-input"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the 6-digit code from your authenticator app
                        </p>
                      </div>
                      <button
                        onClick={handleVerify}
                        className="compact-button-primary w-full"
                        disabled={verificationCode.length < 6 || verifyMutation.isPending}
                      >
                        {verifyMutation.isPending ? 'Verifying...' : 'Verify & Enable MFA'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {mfaStatus?.enabled && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ MFA is enabled. You will be required to enter a code when logging in.
                </p>
              </div>
              <button
                onClick={handleDisable}
                className="compact-button-outline text-red-600 border-red-600 hover:bg-red-50"
                disabled={disableMutation.isPending}
              >
                {disableMutation.isPending ? 'Disabling...' : 'Disable MFA'}
              </button>
            </div>
          )}
        </div>

        <div className="compact-card">
          <h3 className="font-medium mb-2">About MFA</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>MFA adds an extra layer of security to your account</li>
            <li>You'll need your password and a code from your authenticator app to log in</li>
            <li>Backup codes can be used if you lose access to your device</li>
            <li>Each code is valid for 30 seconds</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

