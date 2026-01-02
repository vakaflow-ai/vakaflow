import api from './api'

export interface OTPRequest {
  email: string
  purpose?: 'email_verification' | 'password_reset'
}

export interface OTPVerify {
  email: string
  otp: string
  purpose?: 'email_verification' | 'password_reset'
}

export const otpApi = {
  send: async (data: OTPRequest): Promise<{ message: string; expires_in_minutes?: number }> => {
    const response = await api.post('/otp/send', data)
    return response.data
  },

  verify: async (data: OTPVerify): Promise<{ message: string; verified: boolean }> => {
    const response = await api.post('/otp/verify', data)
    return response.data
  },
}

