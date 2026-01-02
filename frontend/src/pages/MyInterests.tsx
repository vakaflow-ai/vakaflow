import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { vendorsApi, VendorInterestItem } from '../lib/vendors'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { Star, ExternalLink, Trash2, Building2, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { showToast } from '../utils/toast'

export default function MyInterests() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => {
        navigate('/login')
      })
  }, [navigate])

  const { data: interests = [], isLoading } = useQuery<VendorInterestItem[]>({
    queryKey: ['my-interests'],
    queryFn: () => vendorsApi.getMyInterests(),
    enabled: !!user,
  })

  const removeMutation = useMutation({
    mutationFn: (vendorId: string) => vendorsApi.removeFromInterestList(vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-interests'] })
      showToast.success('Removed from interest list')
    },
  })

  const filteredInterests = interests.filter(interest =>
    interest.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!user) {
    return null
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium mb-2">My Interest List</h1>
            <p className="text-sm text-muted-foreground">
              Vendors you've added to your interest list for future reference
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border rounded-lg p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading interest list...</div>
        ) : filteredInterests.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <Star className="w-12 h-9 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery ? 'No vendors match your search' : 'Your interest list is empty'}
            </p>
            <p className="text-sm text-gray-600">
              {searchQuery ? 'Try a different search term' : 'Add vendors to your interest list from their trust center pages'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInterests.map((interest) => (
              <div key={interest.vendor_id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    {interest.vendor_logo_url ? (
                      <img
                        src={interest.vendor_logo_url}
                        alt={interest.vendor_name}
                        className="h-9 w-12 object-contain rounded"
                      />
                    ) : (
                      <div className="h-9 w-12 bg-gray-200 rounded flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{interest.vendor_name}</h3>
                      {interest.vendor_website && (
                        <a
                          href={interest.vendor_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-600 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMutation.mutate(interest.vendor_id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Remove from interest list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {interest.notes && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Notes:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{interest.notes}</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Added {new Date(interest.added_at).toLocaleDateString()}</span>
                  <a
                    href={interest.trust_center_url}
                    className="text-blue-600 hover:text-blue-600 flex items-center gap-1"
                  >
                    View Trust Center
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

