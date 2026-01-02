import api from './api'

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  email: string
  name: string
  password: string
  role: string
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  tenant_id?: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    try {
      const response = await api.post('/auth/login', {
        email: credentials.username, // Backend expects 'email' in JSON
        password: credentials.password,
      });
      return response.data;
    } catch (error: any) {
      // Handle network errors
      if (!error.response) {
        // Network error (no response from server)
        throw new Error('Network error. Please check if the backend is running.')
      }
      // Handle API errors
      if (error.response && error.response.data && error.response.data.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Login failed: An unexpected error occurred.');
    }
  },
  
  register: async (data: RegisterData): Promise<User> => {
    const response = await api.post('/auth/register', data)
    return response.data
  },
  
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me')
    return response.data
  },
  
  logout: () => {
    localStorage.removeItem('access_token')
    window.location.href = '/login'
  },
}

