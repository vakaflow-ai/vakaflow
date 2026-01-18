import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { Badge } from '../components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Eye, 
  Search,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Download,
  Calendar,
  User,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface AssessmentSummary {
  id: string;
  title: string;
  vendor_name: string;
  submitted_by: string;
  submitted_at: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_revision';
  priority: 'high' | 'medium' | 'low';
  questions_count: number;
  answered_count: number;
  due_date?: string;
  risk_score?: number;
  completion_percentage: number;
}

interface BulkAction {
  action: 'approve' | 'reject' | 'request_revision';
  assessment_ids: string[];
  notes?: string;
}

export default function BulkAssessmentManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [selectedAssessments, setSelectedAssessments] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'submitted_at' | 'vendor_name' | 'priority'>('submitted_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [bulkActionNotes, setBulkActionNotes] = useState('');

  // Mock data - in real implementation, this would come from API
  const { data: assessments = [], isLoading } = useQuery<AssessmentSummary[]>({
    queryKey: ['bulk-assessments'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return [
        {
          id: 'ass-001',
          title: 'Vendor Security Assessment - Cloud Provider A',
          vendor_name: 'CloudTech Solutions Inc.',
          submitted_by: 'john.vendor@cloudtech.com',
          submitted_at: '2024-01-15T10:30:00Z',
          status: 'submitted',
          priority: 'high',
          questions_count: 45,
          answered_count: 42,
          completion_percentage: 93,
          due_date: '2024-01-30T23:59:59Z',
          risk_score: 7.2
        },
        {
          id: 'ass-002',
          title: 'Compliance Assessment - Financial Services B',
          vendor_name: 'FinSecure Corp',
          submitted_by: 'sarah.vendor@finsecure.com',
          submitted_at: '2024-01-14T14:22:00Z',
          status: 'under_review',
          priority: 'medium',
          questions_count: 38,
          answered_count: 38,
          completion_percentage: 100,
          due_date: '2024-02-15T23:59:59Z',
          risk_score: 4.1
        },
        {
          id: 'ass-003',
          title: 'Data Privacy Assessment - Healthcare Provider C',
          vendor_name: 'HealthData Systems LLC',
          submitted_by: 'mike.vendor@healthdata.com',
          submitted_at: '2024-01-13T09:15:00Z',
          status: 'submitted',
          priority: 'high',
          questions_count: 52,
          answered_count: 48,
          completion_percentage: 92,
          due_date: '2024-01-25T23:59:59Z',
          risk_score: 8.7
        },
        {
          id: 'ass-004',
          title: 'Infrastructure Assessment - IT Services D',
          vendor_name: 'InfraTech Solutions',
          submitted_by: 'lisa.vendor@infratech.com',
          submitted_at: '2024-01-12T16:45:00Z',
          status: 'needs_revision',
          priority: 'low',
          questions_count: 35,
          answered_count: 32,
          completion_percentage: 91,
          due_date: '2024-02-05T23:59:59Z',
          risk_score: 3.5
        },
        {
          id: 'ass-005',
          title: 'Cybersecurity Assessment - Software Vendor E',
          vendor_name: 'SecureSoft Inc.',
          submitted_by: 'david.vendor@securesoft.com',
          submitted_at: '2024-01-11T11:30:00Z',
          status: 'submitted',
          priority: 'medium',
          questions_count: 41,
          answered_count: 39,
          completion_percentage: 95,
          due_date: '2024-01-28T23:59:59Z',
          risk_score: 6.8
        }
      ];
    }
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (action: BulkAction) => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { success: true, processed: action.assessment_ids.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-assessments'] });
      setSelectedAssessments(new Set());
      setBulkActionNotes('');
    }
  });

  const toggleAssessmentSelection = (id: string) => {
    setSelectedAssessments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAssessments.size === filteredAssessments.length) {
      setSelectedAssessments(new Set());
    } else {
      setSelectedAssessments(new Set(filteredAssessments.map(a => a.id)));
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'submitted': 'bg-blue-100 text-blue-800',
      'under_review': 'bg-purple-100 text-purple-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'needs_revision': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getRiskLevel = (score?: number) => {
    if (!score) return { level: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    if (score >= 8) return { level: 'High', color: 'bg-red-100 text-red-800' };
    if (score >= 5) return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    return { level: 'Low', color: 'bg-green-100 text-green-800' };
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = 
      assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.submitted_by.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || assessment.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || assessment.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'submitted_at':
        comparison = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        break;
      case 'vendor_name':
        comparison = a.vendor_name.localeCompare(b.vendor_name);
        break;
      case 'priority':
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleBulkAction = (action: 'approve' | 'reject' | 'request_revision') => {
    if (selectedAssessments.size === 0) {
      alert('Please select at least one assessment');
      return;
    }
    
    bulkActionMutation.mutate({
      action,
      assessment_ids: Array.from(selectedAssessments),
      notes: bulkActionNotes
    });
  };

  const exportSelected = () => {
    if (selectedAssessments.size === 0) {
      alert('Please select assessments to export');
      return;
    }
    
    // In real implementation, this would call an export API
    console.log('Exporting assessments:', Array.from(selectedAssessments));
    alert(`Exporting ${selectedAssessments.size} assessments...`);
  };

  if (isLoading || !user) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading assessments...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Assessment Management</h1>
            <p className="text-gray-600 mt-2">
              Review and manage multiple vendor assessments efficiently
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Review
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {assessments.length}
              </div>
              <p className="text-gray-600">Total Assessments</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">
                {assessments.filter(a => a.status === 'submitted').length}
              </div>
              <p className="text-gray-600">Pending Review</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {assessments.filter(a => a.priority === 'high').length}
              </div>
              <p className="text-gray-600">High Priority</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {Math.round(assessments.reduce((sum, a) => sum + a.completion_percentage, 0) / assessments.length)}%
              </div>
              <p className="text-gray-600">Avg Completion</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assessments, vendors, or submitters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="needs_revision">Needs Revision</option>
              </select>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="submitted_at">Sort by Date</option>
                  <option value="vendor_name">Sort by Vendor</option>
                  <option value="priority">Sort by Priority</option>
                </select>
                <Button
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedAssessments.size > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-medium text-blue-900">
                  {selectedAssessments.size} assessment(s) selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAssessments(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <textarea
                  value={bulkActionNotes}
                  onChange={(e) => setBulkActionNotes(e.target.value)}
                  placeholder="Add notes for bulk action..."
                  rows={2}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:w-64"
                />
                
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => handleBulkAction('approve')}
                    disabled={bulkActionMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleBulkAction('request_revision')}
                    disabled={bulkActionMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Revise
                  </Button>
                  
                  <Button
                    variant="danger"
                    onClick={() => handleBulkAction('reject')}
                    disabled={bulkActionMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={exportSelected}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assessments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Assessment Queue
              <span className="text-sm font-normal text-gray-500">
                ({filteredAssessments.length} items)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedAssessments.size === filteredAssessments.length && filteredAssessments.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Assessment</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Priority</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Progress</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Risk</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Submitted</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssessments.map((assessment) => (
                  <tr 
                    key={assessment.id} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedAssessments.has(assessment.id)}
                        onChange={() => toggleAssessmentSelection(assessment.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{assessment.title}</p>
                        <p className="text-sm text-gray-500">by {assessment.submitted_by}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{assessment.vendor_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(assessment.status)}>
                        {assessment.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getPriorityColor(assessment.priority)}>
                        {assessment.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-medium ${getCompletionColor(assessment.completion_percentage)}`}>
                          {assessment.completion_percentage}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {assessment.answered_count}/{assessment.questions_count} questions
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getRiskLevel(assessment.risk_score).color}>
                        {getRiskLevel(assessment.risk_score).level}
                        {assessment.risk_score && ` (${assessment.risk_score})`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">
                        {new Date(assessment.submitted_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/workflow/assessment_review/${assessment.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredAssessments.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assessments found</h3>
                <p className="text-gray-500">Try adjusting your filters or search terms</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}