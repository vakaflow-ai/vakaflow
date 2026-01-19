import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { productsApi } from '../lib/products'
import { servicesApi } from '../lib/services'
import { vendorsApi } from '../lib/vendors'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton } from '../components/material'
import { Package, Briefcase, Bot, ArrowRight, Clock, CheckCircle, XCircle, Building2, Users, Shield, FileText, ClipboardCheck } from 'lucide-react'
import toast from 'react-hot-toast'

// API client for request type config
const requestTypeConfigApi = {
  getHubOptions: async (portalType: 'internal' | 'external' = 'internal') => {
    const response = await fetch(`/api/v1/request-type-config/hub/options?portal_type=${portalType}`);
    if (!response.ok) throw new Error('Failed to fetch onboarding options');
    return response.json();
  }
};

export default function OnboardingHub() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch recent onboardings
  const { data: recentProducts } = useQuery({
    queryKey: ['recent-products'],
    queryFn: () => productsApi.list(undefined, undefined, undefined, 1, 5),
    enabled: !!user
  })

  const { data: recentServices } = useQuery({
    queryKey: ['recent-services'],
    queryFn: () => servicesApi.list(undefined, undefined, undefined, 1, 5),
    enabled: !!user
  })

  // Fetch stats
  const { data: allProducts } = useQuery({
    queryKey: ['products-stats'],
    queryFn: () => productsApi.list(undefined, undefined, undefined, 1, 1),
    enabled: !!user
  })

  const { data: allServices } = useQuery({
    queryKey: ['services-stats'],
    queryFn: () => servicesApi.list(undefined, undefined, undefined, 1, 1),
    enabled: !!user
  })

  // Fetch onboarding hub options
  const { data: onboardingOptions } = useQuery({
    queryKey: ['onboarding-options', 'internal'],
    queryFn: () => requestTypeConfigApi.getHubOptions('internal'),
    enabled: !!user
  })

  // Count pending (draft status)
  const pendingProducts = recentProducts?.products.filter(p => p.status === 'draft').length || 0
  const pendingServices = recentServices?.services.filter(s => s.status === 'draft').length || 0

  if (!user) {
    return <div>Loading...</div>
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'draft':
        return <Clock className="w-4 h-4 text-gray-500" />
      case 'rejected':
      case 'discontinued':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return 'text-green-600 bg-green-50'
      case 'draft':
        return 'text-gray-600 bg-gray-50'
      case 'rejected':
      case 'discontinued':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-yellow-600 bg-yellow-50'
    }
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Onboarding Hub</h1>
          <p className="text-gray-600 mt-2">Onboard new vendors, products, services, or agents to start qualification workflows</p>
        </div>

        {/* Quick Action Cards - Dynamic based on request type configurations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {onboardingOptions && onboardingOptions.length > 0 ? (
            onboardingOptions.map((option: any) => {
              // Map request types to appropriate routes and icons
              const getRouteAndIcon = (requestType: string) => {
                switch (requestType) {
                  case 'agent_onboarding_workflow':
                    return { route: '/agents/new', icon: Bot, colorClass: 'bg-green-100', iconColor: 'text-green-600' };
                  case 'vendor_submission_workflow':
                    return { route: '/onboarding/vendor', icon: Building2, colorClass: 'bg-orange-100', iconColor: 'text-orange-600' };
                  case 'product_onboarding_workflow':
                    return { route: '/onboarding/product', icon: Package, colorClass: 'bg-blue-100', iconColor: 'text-blue-600' };
                  case 'service_onboarding_workflow':
                    return { route: '/onboarding/service', icon: Briefcase, colorClass: 'bg-purple-100', iconColor: 'text-purple-600' };
                  case 'assessment_workflow':
                    return { route: '/assessments/new', icon: ClipboardCheck, colorClass: 'bg-indigo-100', iconColor: 'text-indigo-600' };
                  default:
                    return { route: '#', icon: FileText, colorClass: 'bg-gray-100', iconColor: 'text-gray-600' };
                }
              };
              
              const { route, icon: IconComponent, colorClass, iconColor } = getRouteAndIcon(option.request_type);
              
              return (
                <MaterialCard 
                  key={option.request_type}
                  className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => route !== '#' ? navigate(route) : toast.error('Feature not implemented yet')}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center`}>
                      <IconComponent className={`w-6 h-6 ${iconColor}`} />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {option.display_name}
                    {option.tenant_specific && option.tenant_display_name && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({option.tenant_display_name})
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {option.description || `Create new ${option.display_name.toLowerCase()}`}
                  </p>
                  <MaterialButton variant="contained" className="w-full">
                    Create {option.display_name.replace(' Onboarding', '')}
                  </MaterialButton>
                </MaterialCard>
              );
            })
          ) : (
            // Fallback to static cards if API fails
            <>
              <MaterialCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/onboarding/product')}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Onboard Product</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add software, hardware, or SaaS products for qualification and assessment
                </p>
                <MaterialButton variant="contained" className="w-full">
                  Create Product
                </MaterialButton>
              </MaterialCard>

              <MaterialCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/onboarding/service')}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-purple-600" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Onboard Service</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add consulting, support, or managed services for qualification workflows
                </p>
                <MaterialButton variant="contained" className="w-full">
                  Create Service
                </MaterialButton>
              </MaterialCard>

              <MaterialCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/agents/new')}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-green-600" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Onboard Agent</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add AI agents or bots for qualification and compliance assessment
                </p>
                <MaterialButton variant="contained" className="w-full">
                  Create Agent
                </MaterialButton>
              </MaterialCard>

              <MaterialCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/onboarding/vendor')}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-orange-600" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Onboard Vendor</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create a new vendor and send notification to vendor coordinator
                </p>
                <MaterialButton variant="contained" className="w-full">
                  Create Vendor
                </MaterialButton>
              </MaterialCard>
            </>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-gray-900">{allProducts?.total || 0}</div>
            <div className="text-sm text-gray-600">Total Products</div>
          </MaterialCard>
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-gray-900">{allServices?.total || 0}</div>
            <div className="text-sm text-gray-600">Total Services</div>
          </MaterialCard>
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{pendingProducts}</div>
            <div className="text-sm text-gray-600">Pending Products</div>
          </MaterialCard>
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{pendingServices}</div>
            <div className="text-sm text-gray-600">Pending Services</div>
          </MaterialCard>
        </div>

        {/* Recent Onboardings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Products */}
          <MaterialCard className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Products</h2>
            {recentProducts?.products && recentProducts.products.length > 0 ? (
              <div className="space-y-3">
                {recentProducts.products.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(product.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.vendor_name}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(product.status)}`}>
                      {product.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No products yet</p>
              </div>
            )}
            <MaterialButton
              variant="text"
              className="w-full mt-4"
              onClick={() => navigate('/products')}
            >
              View All Products →
            </MaterialButton>
          </MaterialCard>

          {/* Recent Services */}
          <MaterialCard className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Services</h2>
            {recentServices?.services && recentServices.services.length > 0 ? (
              <div className="space-y-3">
                {recentServices.services.slice(0, 5).map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/services/${service.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(service.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{service.name}</div>
                        <div className="text-xs text-gray-500">{service.vendor_name}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(service.status)}`}>
                      {service.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Briefcase className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No services yet</p>
              </div>
            )}
            <MaterialButton
              variant="text"
              className="w-full mt-4"
              onClick={() => navigate('/services')}
            >
              View All Services →
            </MaterialButton>
          </MaterialCard>
        </div>
      </div>
    </Layout>
  )
}
