/**
 * Frontend caching utilities for improved performance
 * Provides caching strategies for frequently accessed data
 */

import { QueryClient } from '@tanstack/react-query'

// Cache configuration constants
export const CACHE_CONFIG = {
  REQUEST_TYPES: {
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
    retry: 2,
    retryDelay: 1000
  },
  WORKFLOWS: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,    // 15 minutes
    retry: 2,
    retryDelay: 1000
  },
  USERS: {
    staleTime: 2 * 60 * 1000,  // 2 minutes
    gcTime: 5 * 60 * 1000,     // 5 minutes
    retry: 1,
    retryDelay: 500
  }
}

// Predefined query keys for consistency
export const QUERY_KEYS = {
  REQUEST_TYPES: (tenantId?: string) => ['request-type-configs', tenantId],
  WORKFLOWS: (tenantId?: string) => ['workflows', 'active', tenantId],
  USERS: (userId?: string) => ['users', userId],
  CURRENT_USER: ['current-user']
}

/**
 * Create optimized query client with performance settings
 */
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,  // 2 minutes default
        gcTime: 5 * 60 * 1000,     // 5 minutes default
        retry: 2,
        retryDelay: 1000,
        refetchOnWindowFocus: false,  // Reduce unnecessary requests
        refetchOnReconnect: true,
        refetchIntervalInBackground: false
      },
      mutations: {
        retry: 1,
        retryDelay: 500
      }
    }
  })
}

/**
 * Prefetch commonly used data to improve perceived performance
 */
export async function prefetchCommonData(queryClient: QueryClient, tenantId?: string) {
  try {
    // Prefetch request types if tenant is known
    if (tenantId) {
      await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.REQUEST_TYPES(tenantId),
        queryFn: async () => {
          // This would call your actual API
          // return requestTypeConfigApi.getAll()
          return []
        },
        ...CACHE_CONFIG.REQUEST_TYPES
      })
    }
  } catch (error) {
    console.debug('Prefetch failed (non-critical):', error)
  }
}

/**
 * Invalidate cache for specific data types
 */
export function invalidateCache(queryClient: QueryClient, dataType: 'request-types' | 'workflows' | 'users', tenantId?: string) {
  switch (dataType) {
    case 'request-types':
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.REQUEST_TYPES(tenantId) 
      })
      break
    case 'workflows':
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.WORKFLOWS(tenantId) 
      })
      break
    case 'users':
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.USERS() 
      })
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.CURRENT_USER 
      })
      break
  }
}

/**
 * Clear all cached data (useful for logout/tenant switch)
 */
export function clearAllCache(queryClient: QueryClient) {
  queryClient.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(queryClient: QueryClient) {
  const queryCache = queryClient.getQueryCache()
  const queries = queryCache.getAll()
  
  return {
    totalQueries: queries.length,
    activeQueries: queries.filter(q => q.isActive()).length,
    cachedQueries: queries.filter(q => q.state.data).length,
    requestTypeQueries: queries.filter(q => 
      Array.isArray(q.queryKey) && q.queryKey.includes('request-type-configs')
    ).length,
    workflowQueries: queries.filter(q => 
      Array.isArray(q.queryKey) && q.queryKey.includes('workflows')
    ).length
  }
}

// Export types for better TypeScript support
export type CacheConfig = typeof CACHE_CONFIG
export type QueryKeys = typeof QUERY_KEYS