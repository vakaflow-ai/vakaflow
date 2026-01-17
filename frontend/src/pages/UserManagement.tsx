import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { usersApi, User, UserCreate, UserUpdate, USER_ROLES } from '../lib/users'
import Layout from '../components/Layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Plus, Search, Edit, Trash2, UserPlus, Upload, Loader2 } from 'lucide-react'
import { showToast } from '../utils/toast'
import { useDialogContext } from '../contexts/DialogContext'

export default function UserManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dialog = useDialogContext()
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
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
    queryKey: ['users', user?.tenant_id], // Include tenant_id for proper tenant isolation and caching
    queryFn: () => usersApi.list(user?.tenant_id), // Explicitly pass tenant_id for tenant isolation
    enabled: !!user && ['tenant_admin', 'platform_admin', 'user_admin', 'vendor_coordinator'].includes(user?.role),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateModal(false)
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
      setShowEditModal(false)
      setSelectedUser(null)
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
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. User management access required.</div>
        </div>
      </Layout>
    )
  }

  const isPlatformAdmin = user.role === 'platform_admin'
  const isVendorCoordinator = user.role === 'vendor_coordinator'
  const availableRoles = isPlatformAdmin
    ? USER_ROLES
    : isVendorCoordinator
    ? USER_ROLES.filter(r => ['vendor_user', 'vendor_coordinator'].includes(r.value))
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
    })
    setShowEditModal(true)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    const updateData: UserUpdate = {
      name: formData.name,
      role: formData.role,
    }
    if (formData.password) {
      updateData.password = formData.password
    }
    updateMutation.mutate({ id: selectedUser.id, data: updateData })
  }

  const handleDelete = async (userId: string, userName: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete User',
      message: `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(userId)
    }
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Users</h1>
            <p className="text-muted-foreground">
              {isPlatformAdmin ? 'Manage all platform users' : 'Manage users for your tenant'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {}}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button
              onClick={() => {
                setFormData({ email: '', name: '', password: '', role: 'end_user' })
                setShowCreateModal(true)
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-48">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Roles</option>
                  {availableRoles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-40">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <div className="text-sm text-muted-foreground">Loading users...</div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-muted-foreground mb-1">
                  {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' 
                    ? 'No users match your filters' 
                    : 'No users found'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first user to get started'}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-gray-50">
                      <th className="h-12 px-6 text-left align-middle font-semibold text-sm text-gray-700">Name</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-sm text-gray-700">Email</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-sm text-gray-700">Role</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-sm text-gray-700">Status</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-sm text-gray-700">Created</th>
                      <th className="h-12 px-6 text-right align-middle font-semibold text-sm text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u: User) => (
                      <tr key={u.id} className="border-b border-border hover:bg-gray-50/50 transition-colors">
                        <td className="h-14 px-6 align-middle font-medium text-gray-900">{u.name}</td>
                        <td className="h-14 px-6 align-middle text-sm text-gray-600">{u.email}</td>
                        <td className="h-14 px-6 align-middle text-sm text-gray-600">{u.role.replace(/_/g, ' ')}</td>
                        <td className="h-14 px-6 align-middle">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                            u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="h-14 px-6 align-middle text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="h-14 px-6 align-middle">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(u)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {u.id !== user.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(u.id, u.name)}
                                disabled={deleteMutation.isPending}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogClose onClose={() => setShowCreateModal(false)} />
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Add a new user to your tenant
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name" className="text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter user's full name"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email" className="text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@company.com"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password" className="text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-password"
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role" className="text-sm font-medium text-gray-700">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="create-role"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {availableRoles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent>
            <DialogClose onClose={() => {
              setShowEditModal(false)
              setSelectedUser(null)
            }} />
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  disabled
                  value={formData.email}
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password" className="text-sm font-medium text-gray-700">
                  New Password
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role" className="text-sm font-medium text-gray-700">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="edit-role"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={selectedUser?.role === 'platform_admin' && !isPlatformAdmin}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {availableRoles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {selectedUser?.role === 'platform_admin' && !isPlatformAdmin && (
                  <p className="text-xs text-gray-500 mt-1">
                    Only platform admins can change this role
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedUser(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}
