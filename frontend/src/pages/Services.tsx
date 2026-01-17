import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { servicesApi, Service } from '../lib/services'
import Layout from '../components/Layout'
import { MaterialButton, MaterialChip } from '../components/material'
import { SearchIcon, PlusIcon, EditIcon, TrashIcon } from '../components/Icons'
import { Rocket } from 'lucide-react'
import WorkflowStatusCard from '../components/WorkflowStatusCard'
import toast from 'react-hot-toast'
import { useDialogContext } from '../contexts/DialogContext'

export default function Services() {
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
    queryKey: ['services', page, statusFilter, categoryFilter, vendorFilter],
    queryFn: () => servicesApi.list(vendorFilter || undefined, statusFilter || undefined, categoryFilter || undefined, page, 20),
    enabled: !!user
  })

  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) => servicesApi.delete(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      toast.success('Service deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete service')
    }
  })

  if (!user) {
    return <div>Loading...</div>
  }

  // Show detail view if ID is in URL
  if (id) {
    return <ServiceDetail serviceId={id} user={user} />
  }

  const services = data?.services || []
  const filteredServices = services.filter(service => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      service.name.toLowerCase().includes(query) ||
      service.description?.toLowerCase().includes(query) ||
      service.service_type?.toLowerCase().includes(query)
    )
  })

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Services</h1>
            <p className="text-sm text-gray-500 mt-1">Manage vendor services</p>
          </div>
          <div className="flex items-center gap-3">
            <MaterialButton
              onClick={() => navigate('/onboarding/service')}
              variant="outlined"
              className="border-primary-600 text-primary-600 hover:bg-primary-50"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Onboard Service
            </MaterialButton>
            {(user.role === 'tenant_admin' || user.role === 'vendor_user' || user.role === 'vendor_coordinator') && (
              <MaterialButton
                onClick={() => navigate('/services/new')}
                className="bg-primary-600 hover:bg-primary-700"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Service
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
                  placeholder="Search services..."
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

        {/* Services List */}
        {isLoading ? (
          <div className="text-center py-12">Loading services...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">Error loading services</div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No services found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/services/${service.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-500">{service.vendor_name || 'Unknown Vendor'}</p>
                  </div>
                  <MaterialChip
                    label={service.status}
                    className={`${
                      service.status === 'active' ? 'bg-green-100 text-green-800' :
                      service.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}
                  />
                </div>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{service.service_type}</span>
                  {service.category && <span>{service.category}</span>}
                </div>
                {(user.role === 'tenant_admin' || user.role === 'platform_admin') && (
                  <div className="mt-4 flex gap-2">
                    <MaterialButton
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/services/${service.id}/edit`)
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
                          title: 'Delete Service',
                          message: 'Are you sure you want to delete this service? This action cannot be undone.',
                          variant: 'destructive'
                        })
                        if (confirmed) {
                          deleteMutation.mutate(service.id)
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
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total} services
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

function ServiceDetail({ serviceId, user }: { serviceId: string; user: any }) {
  const navigate = useNavigate()

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.get(serviceId),
    enabled: !!serviceId
  })

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">Loading service...</div>
      </Layout>
    )
  }

  if (!service) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">Service not found</div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <MaterialButton
          variant="text"
          onClick={() => navigate('/services')}
          className="mb-4"
        >
          ← Back to Services
        </MaterialButton>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">{service.name}</h1>
              <p className="text-sm text-gray-500">{service.vendor_name}</p>
            </div>
            <MaterialChip
              label={service.status}
              className={`${
                service.status === 'active' ? 'bg-green-100 text-green-800' :
                service.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}
            />
          </div>

          {/* Workflow Status */}
          <div className="mb-6">
            <WorkflowStatusCard entityType="service" entityId={service.id} entityName={service.name} />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Service Type</h3>
              <p className="text-gray-900">{service.service_type}</p>
            </div>
            {service.category && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Category</h3>
                <p className="text-gray-900">{service.category}</p>
              </div>
            )}
            {service.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                <p className="text-gray-900">{service.description}</p>
              </div>
            )}
            {service.use_cases && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Use Cases</h3>
                <div className="text-gray-900 whitespace-pre-wrap">{service.use_cases}</div>
              </div>
            )}
            {service.service_level && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Service Level</h3>
                <p className="text-gray-900">{service.service_level}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
