import api from './api'

export interface Rating {
  id: string
  rating: number
  comment?: string
  ease_of_use?: number
  reliability?: number
  performance?: number
  support?: number
  created_at: string
}

export interface Review {
  id: string
  title: string
  content: string
  rating: number
  is_verified: boolean
  is_helpful: number
  created_at: string
}

export interface VendorStats {
  average_rating: number
  total_ratings: number
  total_reviews: number
  rating_distribution: Record<number, number>
}

export const marketplaceApi = {
  createRating: async (vendorId: string, agentId: string, rating: number, comment?: string) => {
    const response = await api.post('/marketplace/ratings', {
      vendor_id: vendorId,
      agent_id: agentId,
      rating,
      comment,
    })
    return response.data
  },
  
  createReview: async (vendorId: string, agentId: string, title: string, content: string, rating: number) => {
    const response = await api.post('/marketplace/reviews', {
      vendor_id: vendorId,
      agent_id: agentId,
      title,
      content,
      rating,
    })
    return response.data
  },
  
  getAgentRatings: async (agentId: string, page: number = 1, limit: number = 20) => {
    const response = await api.get(`/marketplace/agents/${agentId}/ratings`, {
      params: { page, limit },
    })
    return response.data
  },
  
  getAgentReviews: async (agentId: string, page: number = 1, limit: number = 20) => {
    const response = await api.get(`/marketplace/agents/${agentId}/reviews`, {
      params: { page, limit },
    })
    return response.data
  },
  
  getVendorStats: async (vendorId: string): Promise<VendorStats> => {
    const response = await api.get(`/marketplace/vendors/${vendorId}/stats`)
    return response.data
  },
}

