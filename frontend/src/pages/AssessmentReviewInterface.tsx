import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { assessmentsApi } from '@/lib/assessments';
import { authApi } from '@/lib/auth';
import { 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Eye, 
  Download,
  MessageSquare,
  Clock,
  User,
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Paperclip,
  AlertTriangle,
  Building,
  Hash,
  TrendingUp
} from 'lucide-react';

interface AssessmentData {
  id: string;
  title: string;
  description: string;
  status: string;
  submitted_by: {
    name: string;
    email: string;
    avatar?: string;
  };
  submitted_at: string;
  due_date?: string;
  vendor: {
    name: string;
    logo?: string;
  };
  responses: AssessmentResponse[];
  metadata: {
    total_questions: number;
    answered_questions: number;
    completion_percentage: number;
  };
  risk_assessment?: {
    overall_score: number;
    critical_findings: number;
    high_risk_areas: string[];
  };
}

interface AssessmentResponse {
  question_id: string;
  question_text: string;
  response_type: string;
  response_value: any;
  required: boolean;
  section: string;
  category: string;
  attachments?: Attachment[];
  evidence_provided: boolean;
}

interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploaded_at: string;
  type: string;
  pathIssue?: string;  // For debugging path construction issues
}

interface ReviewAction {
  action: 'approve' | 'reject' | 'request_revision';
  notes: string;
  revision_requests?: string[];
}

export default function AssessmentReviewInterface() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'section' | 'category' | 'required'>('section');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [revisionRequests, setRevisionRequests] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'responses' | 'evidence' | 'history'>('responses');
  
  // Bulk question selection states
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [questionReviewStatus, setQuestionReviewStatus] = useState<Record<string, 'approved' | 'rejected' | 'needs_revision'>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.getCurrentUser(),
  });

  // Fetch assessment assignment data
  const { data: assignmentStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['assessment-status', assessmentId],
    queryFn: () => assessmentsApi.getAssignmentStatus(assessmentId!),
    enabled: !!assessmentId
  });

  // Fetch assessment questions
  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['assessment-questions', assessmentId],
    queryFn: () => assessmentsApi.getAssignmentQuestions(assessmentId!),
    enabled: !!assessmentId
  });

  // Fetch assessment responses
  const { data: responses, isLoading: responsesLoading } = useQuery({
    queryKey: ['assessment-responses', assessmentId],
    queryFn: () => assessmentsApi.getAssignmentResponses(assessmentId!),
    enabled: !!assessmentId
  });

  const isLoading = statusLoading || questionsLoading || responsesLoading;

  // Transform data to match component interface
  const assessment: AssessmentData | null = React.useMemo(() => {
    if (!assignmentStatus || !questions || !responses) return null;

    console.log('Assessment Data Debug:', {
      assignmentStatus,
      questions: questions.slice(0, 2),
      responses: Object.keys(responses).slice(0, 5).reduce((acc: any, key) => {
        acc[key] = responses[key];
        return acc;
      }, {})
    });

    // Map questions with their responses
    const mappedResponses = questions.map(q => {
      const responseData = responses[q.id];
      console.log(`Question ${q.id} (${q.question_text?.substring(0, 50)}):`, responseData);
      
      // Debug attachments
      if (responseData?.documents) {
        console.log(`Documents for question ${q.id}:`, responseData.documents);
        responseData.documents.forEach((doc: any, idx: number) => {
          console.log(`Document ${idx}:`, {
            name: doc.name,
            path: doc.path,
            size: doc.size,
            type: doc.type,
            fullPath: doc.path ? (doc.path.startsWith('http') ? doc.path : `/api/files/${doc.path}`) : 'NO PATH'
          });
        });
      }
      
      return {
        question_id: q.id,
        question_text: q.question_text || q.title || '',
        response_type: q.response_type || q.field_type || 'text',
        response_value: responseData?.value || '',
        required: q.is_required,
        section: q.section || 'General',
        category: q.category || 'Uncategorized',
        evidence_provided: !!responseData?.documents?.length,
        attachments: responseData?.documents?.map((doc: any, idx: number) => {
          // Generate proper download URL
          let downloadUrl = '#';
          let pathIssue = '';
          
          if (doc.path) {
            // If it's already a full URL, use it
            if (doc.path.startsWith('http')) {
              downloadUrl = doc.path;
            } else {
              // Assume it's a relative path, construct full URL
              downloadUrl = `/api/files/${doc.path}`;
            }
          } else if (doc.name) {
            // Try to construct path from filename as fallback
            // This is a workaround - in production, the backend should provide the path
            const fileNameWithoutExt = doc.name.split('.').slice(0, -1).join('.');
            const extension = doc.name.split('.').pop();
            downloadUrl = `/api/files/uploads/${fileNameWithoutExt}_${idx}.${extension}`;
            pathIssue = 'Path reconstructed from filename';
          } else {
            pathIssue = 'No path or filename available';
          }
          
          return {
            id: `${q.id}-${idx}`,
            filename: doc.name || `document-${idx + 1}`,
            url: downloadUrl,
            size: doc.size || 0,
            uploaded_at: new Date().toISOString(),
            type: doc.type || 'file',
            pathIssue: pathIssue  // For debugging
          };
        }) || []
      };
    });

    return {
      id: assessmentId!,
      title: assignmentStatus.assessment_name || 'Assessment',
      description: '',
      status: assignmentStatus.status,
      submitted_by: {
        name: assignmentStatus.point_of_contact?.name || 'Unknown',
        email: assignmentStatus.point_of_contact?.email || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(assignmentStatus.point_of_contact?.name || 'U')}&background=3b82f6&color=fff`
      },
      submitted_at: assignmentStatus.completed_at || assignmentStatus.started_at || new Date().toISOString(),
      due_date: assignmentStatus.due_date,
      vendor: {
        name: 'Vendor',  // TODO: Get from actual vendor data
        logo: undefined
      },
      responses: mappedResponses,
      metadata: {
        total_questions: assignmentStatus.total_questions,
        answered_questions: assignmentStatus.answered_questions,
        completion_percentage: Math.round((assignmentStatus.answered_questions / assignmentStatus.total_questions) * 100)
      },
      risk_assessment: undefined
    };
  }, [assignmentStatus, questions, responses, assessmentId]);

  // Expand all sections by default when assessment data is loaded
  React.useEffect(() => {
    if (assessment?.responses) {
      const sections = new Set<string>(['Overview']);
      assessment.responses.forEach(r => {
        if (r.section) sections.add(r.section);
      });
      setExpandedSections(sections);
    }
  }, [assessment?.responses]);

  // Check if assessment is completed (approved/rejected) - makes it read-only
  const isCompleted = assessment?.status === 'approved' || assessment?.status === 'rejected';
  const isReadOnly = isCompleted;

  // Review mutation - using the real API
  const reviewMutation = useMutation({
    mutationFn: async (action: ReviewAction) => {
      const decisionMap: Record<string, 'accepted' | 'denied' | 'need_info'> = {
        'approve': 'accepted',
        'reject': 'denied',
        'request_revision': 'need_info'
      };
      
      return await assessmentsApi.submitFinalDecision(
        assessmentId!,
        decisionMap[action.action],
        action.notes
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-status', assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['action-item'] });
      alert(`Assessment ${data.mapped_decision} successfully`);
      navigate('/my-actions');
    },
    onError: (error: any) => {
      alert(`Failed to submit review: ${error?.response?.data?.detail || error.message}`);
    }
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const toggleSelectAllQuestions = () => {
    const filteredQuestionIds = getFilteredResponses()
      .filter(r => r.question_id !== 'overview')
      .map(r => r.question_id);
    
    if (selectedQuestions.size === filteredQuestionIds.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestionIds));
    }
  };

  const handleBulkQuestionAction = (action: 'approved' | 'rejected' | 'needs_revision') => {
    if (selectedQuestions.size === 0) {
      alert('Please select questions to review');
      return;
    }
    
    const newStatus = { ...questionReviewStatus };
    selectedQuestions.forEach(qId => {
      newStatus[qId] = action;
    });
    setQuestionReviewStatus(newStatus);
    setShowBulkActions(false);
    setSelectedQuestions(new Set());
  };

  const handleQuestionNote = (questionId: string, note: string) => {
    setQuestionNotes(prev => ({
      ...prev,
      [questionId]: note
    }));
  };

  const getQuestionStatusColor = (status?: string) => {
    if (!status) return '';
    const colors: Record<string, string> = {
      'approved': 'bg-green-100 border-green-300',
      'rejected': 'bg-red-100 border-red-300',
      'needs_revision': 'bg-orange-100 border-orange-300'
    };
    return colors[status] || '';
  };

  const getQuestionStatusBadge = (status?: string) => {
    if (!status) return null;
    const config: Record<string, { label: string; className: string }> = {
      'approved': { label: 'Approved', className: 'bg-green-500 text-white' },
      'rejected': { label: 'Rejected', className: 'bg-red-500 text-white' },
      'needs_revision': { label: 'Needs Revision', className: 'bg-orange-500 text-white' }
    };
    const { label, className } = config[status];
    return <Badge className={className}>{label}</Badge>;
  };

  const getFilteredResponses = () => {
    if (!assessment?.responses) return [];
    
    let filtered = assessment.responses.filter(response => {
      const matchesSearch = response.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           response.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           response.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRequired = !showOnlyRequired || response.required;
      
      return matchesSearch && matchesRequired;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'section':
          return a.section.localeCompare(b.section);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'required':
          return (b.required ? 1 : 0) - (a.required ? 1 : 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const groupedResponses = () => {
    const responses = getFilteredResponses();
    const groups: Record<string, AssessmentResponse[]> = {
      'Overview': [{
        question_id: 'overview',
        question_text: 'Assessment Overview',
        response_type: 'overview',
        response_value: null,
        required: false,
        section: 'Overview',
        category: 'Overview',
        evidence_provided: false
      }],
      ...responses.reduce((acc: Record<string, AssessmentResponse[]>, response) => {
        if (!acc[response.section]) {
          acc[response.section] = [];
        }
        acc[response.section].push(response);
        return acc;
      }, {})
    };
    
    return groups;
  };

  const handleExportPDF = () => {
    // Create a formatted HTML document for PDF export
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    const responses = assessment?.responses.filter(r => r.question_id !== 'overview') || [];
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Assessment Report - ${assessment?.title || 'Assessment'}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              max-width: 210mm;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            
            .header {
              display: flex;
              align-items: flex-start;
              gap: 20px;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            
            .vendor-logo-container {
              flex-shrink: 0;
            }
            
            .vendor-logo {
              width: 80px;
              height: 80px;
              object-fit: contain;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 8px;
              background: white;
            }
            
            .vendor-logo-placeholder {
              width: 80px;
              height: 80px;
              background: #f3f4f6;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
              color: #9ca3af;
            }
            
            .header-content {
              flex: 1;
            }
            
            .header h1 {
              color: #1f2937;
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            
            .header .meta {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-top: 15px;
              font-size: 13px;
            }
            
            .header .meta-item {
              display: flex;
              gap: 8px;
            }
            
            .header .meta-label {
              color: #6b7280;
              font-weight: 500;
            }
            
            .header .meta-value {
              color: #1f2937;
              font-weight: 600;
            }
            
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            }
            
            .status-submitted { background: #dbeafe; color: #1e40af; }
            .status-approved { background: #dcfce7; color: #166534; }
            .status-rejected { background: #fee2e2; color: #991b1b; }
            .status-under_review { background: #f3e8ff; color: #6b21a8; }
            
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 30px;
              padding: 20px;
              background: #f9fafb;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }
            
            .summary-item {
              text-align: center;
            }
            
            .summary-label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 5px;
            }
            
            .summary-value {
              font-size: 24px;
              font-weight: 700;
              color: #1f2937;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            
            thead {
              background: #f9fafb;
            }
            
            th {
              text-align: left;
              padding: 12px 10px;
              font-weight: 600;
              color: #374151;
              border-bottom: 2px solid #e5e7eb;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            td {
              padding: 12px 10px;
              border-bottom: 1px solid #e5e7eb;
              vertical-align: top;
            }
            
            tbody tr:hover {
              background: #f9fafb;
            }
            
            .section-header {
              background: #f3f4f6 !important;
              font-weight: 600;
              color: #1f2937;
              font-size: 13px;
            }
            
            .section-header td {
              padding: 10px;
              border-bottom: 2px solid #d1d5db;
            }
            
            .question-cell {
              max-width: 300px;
            }
            
            .question-text {
              font-weight: 500;
              color: #1f2937;
              margin-bottom: 6px;
            }
            
            .answered-by {
              font-size: 10px;
              color: #6b7280;
              margin-top: 4px;
            }
            
            .required-badge {
              color: #dc2626;
              font-weight: 600;
            }
            
            .response-cell {
              max-width: 350px;
              word-wrap: break-word;
            }
            
            .response-value {
              color: #374151;
              white-space: pre-wrap;
            }
            
            .no-response {
              color: #9ca3af;
              font-style: italic;
            }
            
            .comment-cell {
              max-width: 200px;
              word-wrap: break-word;
              color: #4b5563;
              font-size: 11px;
            }
            
            .review-status-cell {
              text-align: center;
            }
            
            .review-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
            }
            
            .review-badge.approved {
              background: #dcfce7;
              color: #166534;
            }
            
            .review-badge.rejected {
              background: #fee2e2;
              color: #991b1b;
            }
            
            .review-badge.needs-info {
              background: #fed7aa;
              color: #c2410c;
            }
            
            .review-badge.pending {
              background: #e5e7eb;
              color: #6b7280;
            }
            
            .attachment-link {
              color: #3b82f6;
              text-decoration: none;
              font-size: 11px;
              display: block;
              margin-bottom: 3px;
            }
            
            .attachment-link:hover {
              text-decoration: underline;
              color: #2563eb;
            }
            
            .attachment-icon {
              margin-right: 4px;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 11px;
            }
            
            .page-break {
              page-break-after: always;
            }
            
            .review-history {
              margin-bottom: 30px;
              padding: 20px;
              background: #fefce8;
              border: 1px solid #fde047;
              border-radius: 8px;
            }
            
            .review-history h2 {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
              margin: 0 0 15px 0;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            
            .review-history-item {
              padding: 12px;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              margin-bottom: 10px;
            }
            
            .review-history-item:last-child {
              margin-bottom: 0;
            }
            
            .review-history-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            
            .review-action {
              font-weight: 600;
              font-size: 13px;
            }
            
            .review-action.approved { color: #166534; }
            .review-action.rejected { color: #991b1b; }
            .review-action.revision { color: #c2410c; }
            
            .review-timestamp {
              font-size: 11px;
              color: #6b7280;
            }
            
            .review-notes {
              font-size: 12px;
              color: #4b5563;
              line-height: 1.5;
              padding-left: 12px;
              border-left: 3px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="vendor-logo-container">
              ${assessment?.vendor.logo 
                ? `<img src="${assessment.vendor.logo}" alt="${assessment.vendor.name}" class="vendor-logo" />` 
                : `<div class="vendor-logo-placeholder">🏢</div>`}
            </div>
            <div class="header-content">
              <h1>${assessment?.title || 'Assessment Report'}</h1>
              <div class="status-badge status-${assessment?.status}">${assessment?.status.replace('_', ' ') || 'N/A'}</div>
              <div class="meta">
                <div class="meta-item">
                  <span class="meta-label">Vendor:</span>
                  <span class="meta-value">${assessment?.vendor.name || 'N/A'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Conducted By:</span>
                  <span class="meta-value">${assessment?.submitted_by.name || 'N/A'} (${assessment?.submitted_by.email || 'N/A'})</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Submitted On:</span>
                  <span class="meta-value">${assessment ? new Date(assessment.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Due Date:</span>
                  <span class="meta-value">${assessment?.due_date ? new Date(assessment.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Reviewed By:</span>
                  <span class="meta-value">${user?.name || 'N/A'} (${user?.email || 'N/A'})</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Review Date:</span>
                  <span class="meta-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Questions</div>
              <div class="summary-value">${assessment?.metadata.total_questions || 0}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Answered</div>
              <div class="summary-value">${assessment?.metadata.answered_questions || 0}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Completion</div>
              <div class="summary-value">${assessment?.metadata.completion_percentage || 0}%</div>
            </div>
          </div>
          
          ${reviewNotes || assessment?.status !== 'submitted' ? `
          <div class="review-history">
            <h2>📝 Review History</h2>
            ${(() => {
              const historyItems = [];
              
              // Add submission event
              historyItems.push(`
                <div class="review-history-item">
                  <div class="review-history-header">
                    <span class="review-action" style="color: #3b82f6;">✅ Assessment Submitted</span>
                    <span class="review-timestamp">${assessment ? new Date(assessment.submitted_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                  </div>
                  <div class="review-notes">Submitted by ${assessment?.submitted_by.name || 'N/A'}</div>
                </div>
              `);
              
              // Add current review if there are notes
              if (reviewNotes) {
                const actionLabel = assessment?.status === 'approved' ? '✅ Approved' : 
                                   assessment?.status === 'rejected' ? '❌ Rejected' : 
                                   assessment?.status === 'needs_revision' ? '🔄 Revision Requested' : 
                                   '🔍 Under Review';
                const actionClass = assessment?.status === 'approved' ? 'approved' : 
                                   assessment?.status === 'rejected' ? 'rejected' : 
                                   assessment?.status === 'needs_revision' ? 'revision' : '';
                
                historyItems.push(`
                  <div class="review-history-item">
                    <div class="review-history-header">
                      <span class="review-action ${actionClass}">${actionLabel}</span>
                      <span class="review-timestamp">${new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="review-notes">Reviewed by ${user?.name || 'N/A'}: ${reviewNotes}</div>
                  </div>
                `);
              } else if (assessment?.status !== 'submitted') {
                // Show status if changed but no notes available
                const actionLabel = assessment?.status === 'approved' ? '✅ Approved' : 
                                   assessment?.status === 'rejected' ? '❌ Rejected' : 
                                   assessment?.status === 'needs_revision' ? '🔄 Revision Requested' : 
                                   '🔍 Under Review';
                const actionClass = assessment?.status === 'approved' ? 'approved' : 
                                   assessment?.status === 'rejected' ? 'rejected' : 
                                   assessment?.status === 'needs_revision' ? 'revision' : '';
                
                historyItems.push(`
                  <div class="review-history-item">
                    <div class="review-history-header">
                      <span class="review-action ${actionClass}">${actionLabel}</span>
                      <span class="review-timestamp">${new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                `);
              }
              
              return historyItems.join('');
            })()}
          </div>
          ` : ''}
          
          <table>
            <thead>
              <tr>
                <th style="width: 35%;">Question</th>
                <th style="width: 30%;">Response</th>
                <th style="width: 25%;">Comments</th>
                <th style="width: 10%;">Review</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const groupedBySection: Record<string, typeof responses> = {};
                responses.forEach(r => {
                  const section = r.section || 'Uncategorized';
                  if (!groupedBySection[section]) groupedBySection[section] = [];
                  groupedBySection[section].push(r);
                });
                
                return Object.entries(groupedBySection).map(([section, sectionResponses]) => `
                  <tr class="section-header">
                    <td colspan="4">${section}</td>
                  </tr>
                  ${sectionResponses.map(r => {
                    const answerText = r.response_value 
                      ? (typeof r.response_value === 'object' ? JSON.stringify(r.response_value) : String(r.response_value))
                      : '';
                    
                    const comment = r.response_value && typeof r.response_value === 'object' && (r.response_value as any).comment 
                      ? (r.response_value as any).comment 
                      : '';
                    
                    // Determine review status (this would come from actual review data in production)
                    const hasAttachments = r.attachments && r.attachments.length > 0;
                    const reviewLabel = 'Pending';
                    const reviewStatus = 'pending';
                    
                    return `
                      <tr>
                        <td class="question-cell">
                          <div class="question-text">
                            ${r.question_text}
                            ${r.required ? '<span class="required-badge">*</span>' : ''}
                          </div>
                          <!-- In production, this would show the actual question responder -->
                          <div class="answered-by">Answered by: ${assessment?.submitted_by.name || 'Vendor Team'} (${assessment?.submitted_by.email || 'vendor@example.com'})</div>
                        </td>
                        <td class="response-cell">
                          ${answerText ? `<div class="response-value">${answerText}</div>` : '<div class="no-response">No response provided</div>'}
                          ${hasAttachments && r.attachments ? `
                            <div style="margin-top: 8px;">
                              ${r.attachments.map(att => `
                                <a href="${att.url || '#'}" class="attachment-link" target="_blank">
                                  <span class="attachment-icon">📎</span>
                                  ${att.filename}
                                </a>
                              `).join('')}
                            </div>
                          ` : ''}
                        </td>
                        <td class="comment-cell">
                          ${comment || '<span class="no-response">—</span>'}
                        </td>
                        <td class="review-status-cell">
                          <span class="review-badge ${reviewStatus}">${reviewLabel}</span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                `).join('');
              })()}
            </tbody>
          </table>
          
          <div class="footer">
            Generated on ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <script>
            // Auto-print when page loads
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const handlePreview = () => {
    // Open in new window for preview
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Assessment Review - ${assessment?.title || 'Assessment'}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #1f2937; }
              .question { margin-bottom: 30px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
              .question-text { font-weight: bold; margin-bottom: 10px; }
              .response { background: #f9fafb; padding: 15px; border-radius: 5px; }
              .metadata { color: #6b7280; font-size: 14px; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <h1>${assessment?.title || 'Assessment'}</h1>
            <p><strong>Vendor:</strong> ${assessment?.vendor.name}</p>
            <p><strong>Submitted by:</strong> ${assessment?.submitted_by.name}</p>
            <p><strong>Status:</strong> ${assessment?.status}</p>
            <hr/>
            ${assessment?.responses.filter(r => r.question_id !== 'overview').map(r => `
              <div class="question">
                <div class="question-text">${r.question_text}</div>
                <div class="metadata">
                  Section: ${r.section} | Category: ${r.category} | Type: ${r.response_type}
                  ${r.required ? ' | <span style="color: #dc2626;">Required</span>' : ''}
                </div>
                <div class="response">
                  ${r.response_value || '<em>No response provided</em>'}
                </div>
              </div>
            `).join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleApprove = () => {
    // Approve doesn't require notes
    reviewMutation.mutate({
      action: 'approve',
      notes: reviewNotes || 'Approved'
    });
  };

  const handleReject = () => {
    if (!reviewNotes.trim()) {
      alert('Please add rejection notes explaining why this assessment is being rejected');
      return;
    }
    reviewMutation.mutate({
      action: 'reject',
      notes: reviewNotes
    });
  };

  const handleRequestRevision = () => {
    if (!reviewNotes.trim()) {
      alert('Please add revision request notes. These will be sent back to the vendor.');
      return;
    }
    reviewMutation.mutate({
      action: 'request_revision',
      notes: reviewNotes,
      revision_requests: revisionRequests
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'submitted': 'bg-blue-100 text-blue-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'needs_revision': 'bg-orange-100 text-orange-800',
      'under_review': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return 'text-red-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (isLoading || !user) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading assessment details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading || !assessment) {
    return (
      <Layout user={user}>
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardContent className="text-center py-12">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-gray-900">Assessment Not Found</h2>
              <p className="text-gray-600 mb-6">
                The requested assessment could not be loaded. Please check the assessment ID and try again.
              </p>
              <Button onClick={() => navigate('/my-actions')}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Assessment Header */}
        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Left Column - Assessment Info */}
              <div className="flex-1">
                <div className="flex items-start gap-4 mb-4">
                  {assessment.vendor.logo ? (
                    <img 
                      src={assessment.vendor.logo} 
                      alt={assessment.vendor.name}
                      className="w-16 h-16 rounded-lg object-contain border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building className="w-8 h-8 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-bold text-gray-900">{assessment.title}</h1>
                      <Badge className={getStatusColor(assessment.status)}>
                        {assessment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-4">{assessment.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-gray-500">Submitted by</p>
                          <div className="flex items-center gap-2">
                            {assessment.submitted_by.avatar && (
                              <img 
                                src={assessment.submitted_by.avatar} 
                                alt={assessment.submitted_by.name}
                                className="w-6 h-6 rounded-full"
                              />
                            )}
                            <p className="font-medium text-gray-900">{assessment.submitted_by.name}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-gray-500">Submitted on</p>
                          <p className="font-medium text-gray-900">
                            {new Date(assessment.submitted_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      
                      {assessment.due_date && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500">Due date</p>
                            <p className={`font-medium ${
                              new Date(assessment.due_date) < new Date() ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {new Date(assessment.due_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-gray-500">Completion</p>
                          <p className={`font-medium ${getCompletionColor(assessment.metadata.completion_percentage)}`}>
                            {assessment.metadata.answered_questions}/{assessment.metadata.total_questions} questions
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Risk Assessment Summary */}
                {assessment.risk_assessment && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      Risk Assessment Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Overall Risk Score</p>
                        <p className={`text-2xl font-bold ${getRiskColor(assessment.risk_assessment?.overall_score || 0)}`}>
                          {assessment.risk_assessment?.overall_score || 0}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Critical Findings</p>
                        <p className="text-2xl font-bold text-red-600">
                          {assessment.risk_assessment?.critical_findings || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">High Risk Areas</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assessment.risk_assessment?.high_risk_areas.map((area: string, idx: number) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column - Actions */}
              <div className="flex flex-col gap-3 lg:w-48">
                <Button variant="outline" onClick={handleExportPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={handlePreview}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Assessment Responses */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters and Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Assessment Responses
                  <span className="text-sm font-normal text-gray-500">
                    ({getFilteredResponses().length} items)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search questions, sections, or categories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="section">Sort by Section</option>
                    <option value="category">Sort by Category</option>
                    <option value="required">Sort by Required</option>
                  </select>
                  
                  <Button
                    variant={showOnlyRequired ? "primary" : "outline"}
                    onClick={() => setShowOnlyRequired(!showOnlyRequired)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Required Only
                  </Button>
                </div>
                
                {/* Bulk Selection Controls */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.size > 0 && selectedQuestions.size === getFilteredResponses().filter(r => r.question_id !== 'overview').length}
                      onChange={toggleSelectAllQuestions}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedQuestions.size > 0 ? (
                        `${selectedQuestions.size} question(s) selected`
                      ) : (
                        'Select questions for bulk review'
                      )}
                    </span>
                  </div>
                  
                  {selectedQuestions.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkQuestionAction('approved')}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkQuestionAction('needs_revision')}
                        className="flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Request Revision
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkQuestionAction('rejected')}
                        className="flex items-center gap-1 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedQuestions(new Set())}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Response Groups */}
            {Object.entries(groupedResponses()).map(([section, responses]) => (
              <Card key={section} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection(section)}
                >
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {expandedSections.has(section) ? 
                        <ChevronDown className="w-5 h-5" /> : 
                        <ChevronRight className="w-5 h-5" />
                      }
                      {section}
                      <Badge variant="secondary">
                        {responses.length} items
                      </Badge>
                    </span>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>
                        {responses.filter(r => r.required).length} required
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                
                {expandedSections.has(section) && (
                  <CardContent className="space-y-6">
                    {responses.map((response) => {
                      // Skip overview from selection - show it differently
                      if (response.question_id === 'overview') {
                        return (
                          <div 
                            key={response.question_id} 
                            className="p-6 border border-gray-200 rounded-lg"
                          >
                            <h4 className="font-semibold text-gray-900 text-lg mb-4">Assessment Overview</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="text-center p-4 bg-white rounded-lg border">
                                <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-gray-900">
                                  {assessment.metadata.total_questions}
                                </p>
                                <p className="text-sm text-gray-500">Total Questions</p>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border">
                                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-gray-900">
                                  {assessment.metadata.answered_questions}
                                </p>
                                <p className="text-sm text-gray-500">Answered</p>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border">
                                <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                <p className={`text-2xl font-bold ${getCompletionColor(assessment.metadata.completion_percentage)}`}>
                                  {assessment.metadata.completion_percentage}%
                                </p>
                                <p className="text-sm text-gray-500">Completion</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    
                    const questionStatus = questionReviewStatus[response.question_id];
                    const isSelected = selectedQuestions.has(response.question_id);
                    
                    return (
                      <div 
                        key={response.question_id} 
                        className={`rounded-xl border-2 transition-all overflow-hidden ${
                          isSelected ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                        } ${getQuestionStatusColor(questionStatus)}`}
                      >
                        {/* Question Header */}
                        <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b">
                          <div className="flex items-start gap-4">
                            {/* Checkbox for bulk selection */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleQuestionSelection(response.question_id)}
                              className="mt-1.5 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            
                            <div className="flex-1">
                              <div className="flex items-start gap-3 mb-3 flex-wrap">
                                <h4 className="font-semibold text-gray-900 text-lg leading-tight flex-1">
                                  {response.question_text}
                                </h4>
                                <div className="flex items-center gap-2">
                                  {response.required && (
                                    <Badge variant="destructive" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                  {getQuestionStatusBadge(questionStatus)}
                                </div>
                              </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full">
                                <Hash className="w-3.5 h-3.5" />
                                {response.category}
                              </span>
                              <span className="bg-gray-100 px-2.5 py-1 rounded-full">Type: {response.response_type.replace('_', ' ')}</span>
                              {response.evidence_provided && (
                                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                                  <Paperclip className="w-3.5 h-3.5" />
                                  Evidence Provided
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        </div>
                        
                        {/* Response Content */}
                        <div className="px-6 py-5 bg-white">
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Response</p>
                          </div>
                        
                          {/* Response Display */}
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-100">
                            {response.response_type === 'long_text' && (
                              <div className="prose prose-sm max-w-none overflow-hidden">
                                <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap break-words max-w-full overflow-x-auto">
                                  {response.response_value}
                                </p>
                              </div>
                            )}
                            
                            {response.response_type === 'multi_select' && (
                              <div className="flex flex-wrap gap-2">
                                {(response.response_value as string[]).map((item, idx) => (
                                  <Badge key={idx} variant="secondary" className="px-3 py-1">
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            {response.response_type === 'file_upload' && (
                              <div className="space-y-3">
                                {(response.response_value as string[]).map((filename, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border">
                                    <div className="flex items-center gap-3">
                                      <FileText className="w-5 h-5 text-blue-500" />
                                      <div>
                                        <p className="font-medium text-gray-900">{filename}</p>
                                        <p className="text-sm text-gray-500">Uploaded file</p>
                                      </div>
                                    </div>
                                    <Button variant="outline" size="sm">
                                      Download
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {(response.response_type === 'short_text' || response.response_type === 'text' || response.response_type === 'textarea') && (
                              <p className="text-gray-900 text-base leading-relaxed break-words max-w-full">{response.response_value || <span className="text-gray-400 italic">No response provided</span>}</p>
                            )}
                            
                            {response.response_type === 'overview' && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-white rounded-lg border">
                                  <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900">
                                    {assessment?.metadata.total_questions}
                                  </p>
                                  <p className="text-sm text-gray-500">Total Questions</p>
                                </div>
                                <div className="text-center p-4 bg-white rounded-lg border">
                                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900">
                                    {assessment?.metadata.answered_questions}
                                  </p>
                                  <p className="text-sm text-gray-500">Answered</p>
                                </div>
                                <div className="text-center p-4 bg-white rounded-lg border">
                                  <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                  <p className={`text-2xl font-bold ${getCompletionColor(assessment?.metadata.completion_percentage || 0)}`}>
                                    {assessment?.metadata.completion_percentage}%
                                  </p>
                                  <p className="text-sm text-gray-500">Completion</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Default fallback for other types */}
                            {!['long_text', 'multi_select', 'file_upload', 'short_text', 'text', 'textarea', 'overview'].includes(response.response_type) && response.response_value && (
                              <div className="text-gray-800">
                                {typeof response.response_value === 'string' ? (
                                  <p>{response.response_value}</p>
                                ) : (
                                  <pre className="text-sm">{JSON.stringify(response.response_value, null, 2)}</pre>
                                )}
                              </div>
                            )}
                            
                            {/* Show empty state if no response */}
                            {!response.response_value && response.response_type !== 'overview' && (
                              <p className="text-gray-400 italic text-center py-4">No response provided</p>
                            )}
                          </div>
                          
                          {/* Evidence/Attachments Section */}
                          {response.attachments && response.attachments.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                  <Paperclip className="w-4 h-4" />
                                  Supporting Evidence ({response.attachments.length})
                                </p>
                              </div>
                              <div className="grid gap-2">
                                {response.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors group max-w-full overflow-hidden ${
                                      attachment.url === '#' 
                                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                                        : 'bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <FileText className={`w-5 h-5 flex-shrink-0 ${
                                        attachment.url === '#' 
                                          ? 'text-gray-400' 
                                          : 'text-blue-600 group-hover:text-blue-800'
                                      }`} />
                                      <div className="min-w-0 flex-1">
                                        <p className={`font-medium truncate ${
                                          attachment.url === '#' 
                                            ? 'text-gray-500' 
                                            : 'text-gray-900 group-hover:text-blue-900'
                                        }`} title={attachment.filename}>
                                          {attachment.filename}
                                        </p>
                                        {attachment.size > 0 && (
                                          <p className="text-xs text-gray-500">
                                            {(attachment.size / 1024).toFixed(1)} KB
                                          </p>
                                        )}
                                        {attachment.pathIssue && (
                                          <p className="text-xs text-orange-600 mt-1">
                                            ⚠️ {attachment.pathIssue}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {attachment.url !== '#' ? (
                                      <a
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block"
                                      >
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="text-blue-600 border-blue-300 hover:bg-blue-600 hover:text-white group-hover:bg-blue-600 group-hover:text-white transition-colors"
                                        >
                                          <Eye className="w-4 h-4 mr-1" />
                                          View
                                        </Button>
                                      </a>
                                    ) : (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        disabled
                                        className="text-gray-400 border-gray-300"
                                      >
                                        <Eye className="w-4 h-4 mr-1" />
                                        Unavailable
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Review Action Buttons - Under Response */}
                          <div className="mt-4">
                            {/* Individual question review actions */}
                            {!questionStatus && (
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-600 mr-2">Review this question:</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setQuestionReviewStatus(prev => ({ ...prev, [response.question_id]: 'approved' }))}
                                  className="flex items-center gap-1 text-green-600 hover:bg-green-50 border-green-200"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setQuestionReviewStatus(prev => ({ ...prev, [response.question_id]: 'needs_revision' }))}
                                  className="flex items-center gap-1 hover:bg-orange-50 border-orange-200"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Needs Revision
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setQuestionReviewStatus(prev => ({ ...prev, [response.question_id]: 'rejected' }))}
                                  className="flex items-center gap-1 text-red-600 hover:bg-red-50 border-red-200"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            
                            {/* Question note */}
                            {questionStatus && (
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Review Notes</label>
                                <textarea
                                  value={questionNotes[response.question_id] || ''}
                                  onChange={(e) => handleQuestionNote(response.question_id, e.target.value)}
                                  placeholder="Add notes for this question..."
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const newStatus = { ...questionReviewStatus };
                                    delete newStatus[response.question_id];
                                    setQuestionReviewStatus(newStatus);
                                  }}
                                  className="text-xs"
                                >
                                  Clear Review
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Sidebar - Review Actions */}
          <div className="space-y-6">
            {/* Review Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Review Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCompleted && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertDescription className="text-sm">
                      <span className="font-semibold">This assessment has been {assessment.status}.</span>
                      <br />
                      All review actions are disabled. The assessment is read-only unless resubmitted.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Review Notes <span className="text-gray-400 text-xs">(Optional for approval, required for rejection/revision)</span>
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add your review comments, observations, and recommendations..."
                    rows={6}
                    disabled={isReadOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="primary"
                    onClick={handleApprove}
                    disabled={reviewMutation.isPending || isReadOnly}
                    className="w-full flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {reviewMutation.isPending ? 'Processing...' : isReadOnly ? 'Already Approved/Rejected' : 'Approve Assessment'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleRequestRevision}
                    disabled={reviewMutation.isPending || isReadOnly}
                    className="w-full flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Request Revision (Sends to Vendor)
                  </Button>
                  
                  <Button
                    variant="danger"
                    onClick={handleReject}
                    disabled={reviewMutation.isPending || isReadOnly}
                    className="w-full flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Assessment
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Questions</span>
                    <span className="font-semibold text-gray-900">{assessment.metadata.total_questions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Answered</span>
                    <span className="font-semibold text-green-600">
                      {assessment.metadata.answered_questions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className={`font-semibold ${getCompletionColor(assessment.metadata.completion_percentage)}`}>
                      {assessment.metadata.completion_percentage}%
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${assessment.metadata.completion_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-gray-900">Assessment Submitted</p>
                      <p className="text-xs text-gray-500">
                        {new Date(assessment.submitted_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        by {assessment.submitted_by.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Under Review</p>
                      <p className="text-xs text-gray-500">Awaiting your decision</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}