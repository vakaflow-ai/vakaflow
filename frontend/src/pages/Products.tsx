import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { productsApi, Product } from '../lib/products'
import { vendorsApi } from '../lib/vendors'
import Layout from '../components/Layout'
import { MaterialButton, MaterialChip } from '../components/material'
import { SearchIcon, FilterIcon, PlusIcon, EditIcon, TrashIcon, ChevronRightIcon } from '../components/Icons'
import { Rocket } from 'lucide-react'
import WorkflowStatusCard from '../components/WorkflowStatusCard'
import toast from 'react-hot-toast'
import { useDialogContext } from '../contexts/DialogContext'

export default function Products() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const dialog = useDialogContext()
  const [user, setUser] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [vendorFilter, setVendorFilter] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', page, statusFilter, categoryFilter, vendorFilter],
    queryFn: () => productsApi.list(vendorFilter || undefined, statusFilter || undefined, categoryFilter || undefined, page, 20),
    enabled: !!user
  })

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => productsApi.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete product')
    }
  })

  if (!user) {
    return <div>Loading...</div>
  }

  // Show detail view if ID is in URL
  if (id) {
    return <ProductDetail productId={id} user={user} />
  }

  const products = data?.products || []
  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      product.name.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.product_type?.toLowerCase().includes(query)
    )
  })

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500 mt-1">Manage vendor products</p>
          </div>
          <div className="flex items-center gap-3">
            <MaterialButton
              onClick={() => navigate('/onboarding/product')}
              variant="outlined"
              className="border-primary-600 text-primary-600 hover:bg-primary-50"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Onboard Product
            </MaterialButton>
            {(user.role === 'tenant_admin' || user.role === 'vendor_user' || user.role === 'vendor_coordinator') && (
              <MaterialButton
                onClick={() => navigate('/products/new')}
                className="bg-primary-600 hover:bg-primary-700"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Product
              </MaterialButton>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="Filter by category..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input
                type="text"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                placeholder="Filter by vendor ID..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Products List */}
        {isLoading ? (
          <div className="text-center py-12">Loading products...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">Error loading products</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No products found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-gray-500">{product.vendor_name || 'Unknown Vendor'}</p>
                  </div>
                  <MaterialChip
                    label={product.status}
                    className={`${
                      product.status === 'active' ? 'bg-green-100 text-green-800' :
                      product.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}
                  />
                </div>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{product.product_type}</span>
                  {product.category && <span>{product.category}</span>}
                </div>
                {(user.role === 'tenant_admin' || user.role === 'platform_admin') && (
                  <div className="mt-4 flex gap-2">
                    <MaterialButton
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/products/${product.id}/edit`)
                      }}
                    >
                      <EditIcon className="w-4 h-4 mr-1" />
                      Edit
                    </MaterialButton>
                    <MaterialButton
                      size="small"
                      variant="outlined"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const confirmed = await dialog.confirm({
                          title: 'Delete Product',
                          message: 'Are you sure you want to delete this product? This action cannot be undone.',
                          variant: 'destructive'
                        })
                        if (confirmed) {
                          deleteMutation.mutate(product.id)
                        }
                      }}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <TrashIcon className="w-4 h-4 mr-1" />
                      Delete
                    </MaterialButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total} products
            </div>
            <div className="flex gap-2">
              <MaterialButton
                variant="outlined"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </MaterialButton>
              <MaterialButton
                variant="outlined"
                disabled={page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </MaterialButton>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

function ProductDetail({ productId, user }: { productId: string; user: any }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.get(productId),
    enabled: !!productId
  })

  const { data: agents } = useQuery({
    queryKey: ['product-agents', productId],
    queryFn: () => productsApi.getAgents(productId),
    enabled: !!productId
  })

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">Loading product...</div>
      </Layout>
    )
  }

  if (!product) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">Product not found</div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <MaterialButton
          variant="text"
          onClick={() => navigate('/products')}
          className="mb-4"
        >
          ← Back to Products
        </MaterialButton>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">{product.name}</h1>
              <p className="text-sm text-gray-500">{product.vendor_name}</p>
            </div>
            <MaterialChip
              label={product.status}
              className={`${
                product.status === 'active' ? 'bg-green-100 text-green-800' :
                product.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}
            />
          </div>

          {/* Workflow Status */}
          <div className="mb-6">
            <WorkflowStatusCard entityType="product" entityId={product.id} entityName={product.name} />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Product Type</h3>
              <p className="text-gray-900">{product.product_type}</p>
            </div>
            {product.category && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Category</h3>
                <p className="text-gray-900">{product.category}</p>
              </div>
            )}
            {product.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                <p className="text-gray-900">{product.description}</p>
              </div>
            )}
            {product.use_cases && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Use Cases</h3>
                <div className="text-gray-900 whitespace-pre-wrap">{product.use_cases}</div>
              </div>
            )}
            {agents && agents.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Related Agents</h3>
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                      onClick={() => navigate(`/agents/${agent.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{agent.name}</span>
                        {agent.relationship_type && (
                          <MaterialChip label={agent.relationship_type} size="small" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
