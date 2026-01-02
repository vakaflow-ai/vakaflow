import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { vendorsApi, VendorFollowItem } from '../lib/vendors'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { Heart, ExternalLink, Trash2, Building2, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { showToast } from '../utils/toast'

export default function MyFollowing() {
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

  const { data: following = [], isLoading } = useQuery<VendorFollowItem[]>({
    queryKey: ['my-following'],
    queryFn: () => vendorsApi.getMyFollowing(),
    enabled: !!user,
  })

  const unfollowMutation = useMutation({
    mutationFn: (vendorId: string) => vendorsApi.unfollowVendor(vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-following'] })
      showToast.success('Unfollowed vendor')
    },
  })

  const filteredFollowing = following.filter(item =>
    item.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!user) {
    return null
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium mb-2">Following Vendors</h1>
            <p className="text-sm text-muted-foreground">
              Vendors you're following for updates and news
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
          <div className="text-center py-12">Loading following list...</div>
        ) : filteredFollowing.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <Heart className="w-12 h-9 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery ? 'No vendors match your search' : "You're not following any vendors yet"}
            </p>
            <p className="text-sm text-gray-600">
              {searchQuery ? 'Try a different search term' : 'Follow vendors from their trust center pages to stay updated'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFollowing.map((item) => (
              <div key={item.vendor_id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    {item.vendor_logo_url ? (
                      <img
                        src={item.vendor_logo_url}
                        alt={item.vendor_name}
                        className="h-9 w-12 object-contain rounded"
                      />
                    ) : (
                      <div className="h-9 w-12 bg-gray-200 rounded flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{item.vendor_name}</h3>
                      {item.vendor_website && (
                        <a
                          href={item.vendor_website}
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
                    onClick={() => unfollowMutation.mutate(item.vendor_id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Unfollow vendor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Following since {new Date(item.followed_at).toLocaleDateString()}</span>
                  <a
                    href={item.trust_center_url}
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

