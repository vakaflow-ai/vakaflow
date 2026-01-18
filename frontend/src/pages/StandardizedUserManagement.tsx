import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import Layout from '../components/Layout'
import { authApi } from '../lib/auth'
import { usersApi } from '../lib/users'
import { showToast } from '../utils/toast'
import { 
  StandardPageContainer, 
  StandardPageHeader, 
  StandardActionButton,
  StandardCard,
  StandardTable,
  StandardSearchFilter,
  useDelete
} from '../components/StandardizedLayout'
import { 
  UserPlus, 
  Upload, 
  Edit, 
  Trash2, 
  Search,
  Loader2
} from 'lucide-react'
// Mock API imports for demonstration purposes

interface User {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface UserCreate {
  email: string
  name: string
  password: string
  role: string
}

interface UserUpdate {
  name?: string
  password?: string
  role?: string
}

const USER_ROLES = [
  { value: 'end_user', label: 'End User' },
  { value: 'approver', label: 'Approver' },
  { value: 'admin', label: 'Admin' },
  { value: 'platform_admin', label: 'Platform Admin' }
]

export default function StandardizedUserManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Using direct modal functions since useStandardModals hook isn't available yet
  const { handleDelete: handleStandardDelete, isDeleting } = useDelete()
  const [user, setUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [formData, setFormData] = useState<UserCreate>({
    email: '',
    name: '',
    password: '',
    role: 'end_user',
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users', user?.tenant_id],
    queryFn: () => usersApi.list(user?.tenant_id),
    enabled: !!user && ['tenant_admin', 'platform_admin', 'user_admin', 'vendor_coordinator'].includes(user?.role),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      // Modal would be closed here
      setFormData({ email: '', name: '', password: '', role: 'end_user' })
      showToast.success('User created successfully')
    },
    onError: (err: any) => {
      showToast.error(err.response?.data?.detail || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      // Modal would be closed here
      showToast.success('User updated successfully')
    },
    onError: (err: any) => {
      showToast.error(err.response?.data?.detail || 'Failed to update user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => usersApi.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      showToast.success('User deleted successfully')
    },
    onError: (err: any) => {
      showToast.error(err.response?.data?.detail || 'Failed to delete user')
    },
  })

  if (!user || !['tenant_admin', 'platform_admin', 'user_admin', 'vendor_coordinator'].includes(user.role)) {
    return (
      <Layout user={user}>
        <StandardPageContainer>
          <div className="text-center py-12">
            <div className="text-gray-500">Access denied. User management access required.</div>
          </div>
        </StandardPageContainer>
      </Layout>
    )
  }

  const isPlatformAdmin = user.role === 'platform_admin'
  const availableRoles = isPlatformAdmin
    ? USER_ROLES
    : USER_ROLES.filter(r => r.value !== 'platform_admin')

  const filteredUsers = users?.filter((u: User) => {
    const matchesSearch = searchQuery === '' || 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active)
    return matchesSearch && matchesRole && matchesStatus
  }) || []

  const handleCreateUser = () => {
    // Direct modal implementation for demo purposes
    alert('Create user modal would appear here')
  }

  const handleEditUser = (user: User) => {
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
    })
    
    // Direct modal implementation for demo purposes
    alert('Edit user modal would appear here')
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete user "${userName}"?`)
    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(userId)
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
  }

  const renderUserRow = (user: User, index: number) => (
    <tr key={user.id} className="unified-table-row">
      <td className="unified-table-cell-primary">{user.name}</td>
      <td className="unified-table-cell">{user.email}</td>
      <td className="unified-table-cell">{user.role.replace(/_/g, ' ')}</td>
      <td className="unified-table-cell">
        <span className={user.is_active ? 'unified-badge-success' : 'unified-badge-error'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="unified-table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
      <td className="unified-table-cell">
        <div className="flex gap-1 justify-end">
          <StandardActionButton
            variant="outline"
            size="sm"
            icon={<Edit className="w-4 h-4" />}
            onClick={() => handleEditUser(user)}
          >
            Edit
          </StandardActionButton>
          {user.id !== user.id && (
            <StandardActionButton
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => handleDeleteUser(user.id, user.name)}
              disabled={isDeleting}
            >
              Delete
            </StandardActionButton>
          )}
        </div>
      </td>
    </tr>
  )

  return (
    <Layout user={user}>
      <StandardPageContainer>
        <StandardPageHeader
          title="Users"
          subtitle={isPlatformAdmin ? 'Manage all platform users' : 'Manage users for your tenant'}
          actions={
            <>
              <StandardActionButton
                variant="outline"
                icon={<Upload className="w-4 h-4" />}
              >
                Import CSV
              </StandardActionButton>
              <StandardActionButton
                icon={<UserPlus className="w-4 h-4" />}
                onClick={handleCreateUser}
              >
                Add User
              </StandardActionButton>
            </>
          }
        />

        <StandardCard>
          <div className="p-6">
            <StandardSearchFilter
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search users by name, email, or role..."
              filters={
                <>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="unified-select w-48"
                  >
                    <option value="all">All Roles</option>
                    {availableRoles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="unified-select w-40"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </>
              }
            />
          </div>
        </StandardCard>

        <StandardCard>
          <StandardTable
            headers={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role' },
              { key: 'status', label: 'Status' },
              { key: 'created', label: 'Created' },
              { key: 'actions', label: 'Actions', className: 'text-right' }
            ]}
            data={filteredUsers}
            renderRow={renderUserRow}
            emptyMessage={
              searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'No users match your filters'
                : 'No users found'
            }
          />
        </StandardCard>
      </StandardPageContainer>
    </Layout>
  )
}