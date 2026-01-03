import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { MaterialInput } from '../components/material'
import { MaterialForm } from '../components/material'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Rocket, AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authApi.login({
        username: email,
        password,
      })
      
      localStorage.setItem('access_token', response.access_token)
      navigate('/my-actions')
    } catch (err: any) {
      setError(err.message || 'Invalid email or password')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4">
            <Rocket className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">
            Welcome to VAKA
          </h1>
          <p className="text-slate-600 text-sm">
            Agent Onboarding & Offboarding Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200 shadow-xl">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900 mb-1.5">
                Sign In
              </h2>
              <p className="text-xs text-slate-600">
                Enter your credentials to access the platform
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <MaterialForm
              submitLabel="Sign In"
              onSubmit={handleSubmit}
              loading={loading}
            >
              <MaterialInput
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                fullWidth
              />
              
              <MaterialInput
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
                showPasswordToggle
                fullWidth
              />
            </MaterialForm>

            <div className="mt-5 text-center">
              <p className="text-xs text-slate-600">
                Don't have an account?{' '}
                <Link 
                  to="/register" 
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
