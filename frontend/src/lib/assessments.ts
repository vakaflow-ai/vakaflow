import api from './api'

export type AssessmentType = 'tprm' | 'vendor_qualification' | 'risk_assessment' | 'ai_vendor_qualification' | 'security_assessment' | 'compliance_assessment' | 'custom'
export type AssessmentStatus = 'draft' | 'active' | 'archived' | 'scheduled'
export type ScheduleFrequency = 'quarterly' | 'yearly' | 'monthly' | 'bi_annual' | 'one_time' | 'custom'
export type QuestionType = 'new_question' | 'requirement_reference'

export interface Assessment {
  id: string
  tenant_id: string
  assessment_id?: string  // Human-readable assessment ID
  name: string
  assessment_type: AssessmentType
  description?: string
  business_purpose?: string
  status: AssessmentStatus
  owner_id: string
  owner?: {  // Owner details (populated from API)
    id: string
    name: string
    email: string
  }
  team_ids?: string[]
  assignment_rules?: {
    vendor_attributes?: Record<string, any>
    agent_attributes?: Record<string, any>
    master_data_tags?: Record<string, any>
    apply_to?: string[] // ['vendor_onboarding', 'agent_onboarding']
  }
  schedule_enabled: boolean
  schedule_frequency?: ScheduleFrequency
  schedule_interval_months?: number
  last_scheduled_date?: string
  next_scheduled_date?: string
  created_by: string
  updated_by?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssessmentQuestion {
  id: string
  assessment_id: string
  question_type: QuestionType
  title?: string  // Question title
  question_text?: string
  description?: string  // Question description
  field_type?: string
  response_type?: string  // ResponseType: Text, File, Number, Date, etc.
  category?: string  // Question category
  is_required: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_id?: string
  order: number
  section?: string
  is_reusable: boolean
  reusable_question_id?: string
  created_at: string
  updated_at: string
}

export interface AssessmentSchedule {
  id: string
  assessment_id: string
  tenant_id: string
  scheduled_date: string
  due_date?: string
  frequency: ScheduleFrequency
  selected_vendor_ids?: string[]
  status: string
  triggered_at?: string
  completed_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface AssessmentAssignment {
  id: string
  assessment_id: string
  schedule_id?: string
  tenant_id: string
  vendor_id?: string
  agent_id?: string
  assignment_type: string
  assigned_by: string
  status: string
  assigned_at: string
  started_at?: string
  completed_at?: string
  due_date?: string
  workflow_ticket_id?: string  // Human-friendly workflow ticket ID (e.g., ASMT-2025-001)
  created_at: string
  updated_at: string
}

// Question Library Types
export interface QuestionLibrary {
  id: string
  question_id?: string  // Human-readable question ID (e.g., Q-SEC-01)
  tenant_id: string
  title: string
  question_text: string
  description?: string
  assessment_type: string[]  // Array of assessment types
  category?: string
  field_type: string
  response_type: string
  is_required: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_ids?: string[]
  compliance_framework_ids?: string[]
  risk_framework_ids?: string[]
  applicable_industries?: string[]
  is_active: boolean
  usage_count: number
  created_by: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface QuestionLibraryCreate {
  title: string
  question_text: string
  description?: string
  assessment_type: string[]  // Array of assessment types
  category?: string
  field_type: string
  response_type: string
  is_required?: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_ids?: string[]
  compliance_framework_ids?: string[]
  risk_framework_ids?: string[]
  applicable_industries?: string[]
}

export interface QuestionLibraryUpdate {
  title?: string
  question_text?: string
  description?: string
  assessment_type?: string[]  // Array of assessment types
  category?: string
  field_type?: string
  response_type?: string
  is_required?: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_ids?: string[]
  compliance_framework_ids?: string[]
  risk_framework_ids?: string[]
  applicable_industries?: string[]
  is_active?: boolean
}

// Assessment Rules Types
export interface AssessmentRule {
  id: string
  tenant_id: string
  name: string
  description?: string
  rule_type: 'question_group' | 'requirement_group' | 'auto_add'
  match_conditions: Record<string, any>
  question_ids?: string[]
  requirement_ids?: string[]
  priority: number
  is_active: boolean
  is_automatic: boolean
  created_by: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface AssessmentRuleCreate {
  name: string
  description?: string
  rule_type: 'question_group' | 'requirement_group' | 'auto_add'
  match_conditions: Record<string, any>
  question_ids?: string[]
  requirement_ids?: string[]
  priority?: number
  is_active?: boolean
  is_automatic?: boolean
}

export interface RuleSuggestion {
  rule_id: string
  rule_name: string
  rule_description?: string
  questions_to_add: string[]
  requirements_to_add: string[]
  match_reason: string
}

export const assessmentsApi = {
  list: async (assessmentType?: AssessmentType, status?: AssessmentStatus, isActive?: boolean): Promise<Assessment[]> => {
    const params: any = {}
    if (assessmentType) params.assessment_type = assessmentType
    if (status) params.status = status
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/assessments', { params })
    return response.data
  },

  get: async (id: string): Promise<Assessment> => {
    const response = await api.get(`/assessments/${id}`)
    return response.data
  },

  create: async (assessment: Partial<Assessment>): Promise<Assessment> => {
    const response = await api.post('/assessments', assessment)
    return response.data
  },

  update: async (id: string, assessment: Partial<Assessment>): Promise<Assessment> => {
    const response = await api.patch(`/assessments/${id}`, assessment)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/assessments/${id}`)
  },

  // Question Management
  listQuestions: async (assessmentId: string): Promise<AssessmentQuestion[]> => {
    const response = await api.get(`/assessments/${assessmentId}/questions`)
    return response.data
  },

  addQuestion: async (assessmentId: string, question: Partial<AssessmentQuestion>): Promise<AssessmentQuestion> => {
    const response = await api.post(`/assessments/${assessmentId}/questions`, question)
    return response.data
  },

  updateQuestion: async (questionId: string, question: Partial<AssessmentQuestion>): Promise<AssessmentQuestion> => {
    const response = await api.patch(`/assessments/questions/${questionId}`, question)
    return response.data
  },

  deleteQuestion: async (questionId: string): Promise<void> => {
    await api.delete(`/assessments/questions/${questionId}`)
  },

  reorderQuestions: async (assessmentId: string, questionOrders: Array<{ question_id: string; order: number }>): Promise<void> => {
    await api.post(`/assessments/${assessmentId}/questions/reorder`, questionOrders)
  },

  // Schedule Management
  listSchedules: async (assessmentId: string): Promise<AssessmentSchedule[]> => {
    const response = await api.get(`/assessments/${assessmentId}/schedules`)
    return response.data
  },

  createSchedule: async (assessmentId: string, schedule: Partial<AssessmentSchedule>): Promise<AssessmentSchedule> => {
    const response = await api.post(`/assessments/${assessmentId}/schedules`, schedule)
    return response.data
  },

  updateSchedule: async (scheduleId: string, schedule: Partial<AssessmentSchedule>): Promise<AssessmentSchedule> => {
    const response = await api.patch(`/assessments/schedules/${scheduleId}`, schedule)
    return response.data
  },

  // Assignment Management
  listAssignments: async (assessmentId: string): Promise<AssessmentAssignment[]> => {
    const response = await api.get(`/assessments/${assessmentId}/assignments`)
    return response.data
  },

  createAssignment: async (assessmentId: string, assignment: Partial<AssessmentAssignment>): Promise<AssessmentAssignment> => {
    const response = await api.post(`/assessments/${assessmentId}/assignments`, assignment)
    return response.data
  },

  // Response Management
  getAssignmentQuestions: async (assignmentId: string): Promise<AssessmentQuestion[]> => {
    // Increase timeout for questions fetch as it may involve complex joins and requirement lookups
    const response = await api.get(`/assessments/assignments/${assignmentId}/questions`, {
      timeout: 120000 // 120 seconds - complex queries with requirements can be slow
    })
    return response.data
  },

  getAssignmentResponses: async (assignmentId: string): Promise<Record<string, {
    value: any
    comment?: string
    documents?: Array<{ name: string; path?: string; size?: number; type?: string }>
  }>> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/responses`)
    return response.data.responses || {}
  },

  saveResponses: async (assignmentId: string, responses: Record<string, any>, isDraft: boolean = false): Promise<{
    assignment_id: string
    workflow_ticket_id?: string
    status: string
    workflow_triggered: boolean
    message: string
  }> => {
    const response = await api.post(`/assessments/assignments/${assignmentId}/responses?is_draft=${isDraft}`, responses)
    return response.data
  },

  saveResponsesDraft: async (assignmentId: string, responses: Record<string, any>): Promise<void> => {
    await api.post(`/assessments/assignments/${assignmentId}/responses/draft`, responses)
  },

  getApprovalStatus: async (assignmentId: string): Promise<{
    has_workflow: boolean
    current_step: number | null
    step_name: string | null
    total_steps: number
    status?: string
  }> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/approval-status`)
    return response.data
  },

  getAssignmentStatus: async (assignmentId: string): Promise<{
    assignment_id: string
    assessment_id: string
    assessment_name?: string
    assessment_id_display?: string
    status: string
    workflow_ticket_id?: string
    total_questions: number
    answered_questions: number
    required_questions: number
    completed: boolean
    started_at?: string
    completed_at?: string
    due_date?: string
    point_of_contact?: {
      id: string
      name: string
      email: string
    }
  }> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/status`)
    return response.data
  },

  triggerApprovalWorkflow: async (assignmentId: string): Promise<{
    success: boolean
    message: string
    action_items_count: number
  }> => {
    const response = await api.post(`/assessments/assignments/${assignmentId}/trigger-approval-workflow`)
    return response.data
  },

  // Question Assignment
  searchVendorUsers: async (assignmentId: string, searchQuery?: string): Promise<Array<{
    id: string
    email: string
    name: string
    organization?: string
    department?: string
  }>> => {
    const params: any = {}
    if (searchQuery) params.search_query = searchQuery
    const response = await api.get(`/assessments/assignments/${assignmentId}/search-users`, { params })
    return response.data
  },

  assignQuestionOwner: async (
    assignmentId: string,
    questionId: string,
    ownerData: { owner_id?: string; owner_email?: string; owner_name?: string }
  ): Promise<{
    success: boolean
    owner_id: string
    owner_name: string
    owner_email: string
    assigned_at?: string
    user_exists: boolean
  }> => {
    const response = await api.post(
      `/assessments/assignments/${assignmentId}/questions/${questionId}/assign`,
      ownerData
    )
    return response.data
  },

  getQuestionOwners: async (assignmentId: string): Promise<Record<string, {
    id: string
    name: string
    email: string
    assigned_at?: string
  }>> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/question-owners`)
    return response.data
  },

  triggerReview: async (assignmentId: string, policyIds?: string[], requirementIds?: string[]): Promise<{
    success: boolean
    review_id: string
    risk_score?: number
    risk_level?: string
    flagged_risks_count?: number
    assigned_to?: string
  }> => {
    const body: any = {}
    if (policyIds) body.policy_ids = policyIds
    if (requirementIds) body.requirement_ids = requirementIds
    const response = await api.post(`/assessments/assignments/${assignmentId}/review`, body)
    return response.data
  },

  getReview: async (reviewId: string): Promise<{
    id: string
    assignment_id: string
    assessment_id: string
    review_type: string
    status: string
    risk_score: number
    risk_level: string
    risk_factors: any[]
    analysis_summary: string
    flagged_risks: any[]
    flagged_questions: string[]
    recommendations: any[]
    assigned_to?: string
    assigned_at?: string
    ai_review_completed_at?: string
    created_at: string
  }> => {
    const response = await api.get(`/assessments/reviews/${reviewId}`)
    return response.data
  },

  getAssignmentReviews: async (assignmentId: string): Promise<Array<{
    id: string
    review_type: string
    status: string
    risk_score: number
    risk_level: string
    assigned_to?: string
    created_at: string
    ai_review_completed_at?: string
  }>> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/reviews`)
    return response.data
  },

  getReviewAuditTrail: async (reviewId: string): Promise<Array<{
    id: string
    action: string
    actor_type: string
    actor_name: string
    action_data: any
    questionnaire_id?: string
    vendor_name?: string
    created_at: string
  }>> => {
    const response = await api.get(`/assessments/reviews/${reviewId}/audit`)
    return response.data
  },

  // Question Review APIs
  reviewQuestion: async (
    assignmentId: string,
    questionId: string,
    status: 'pass' | 'fail' | 'in_progress',
    comment?: string
  ): Promise<{
    success: boolean
    question_review_id: string
    status: string
    message: string
  }> => {
    const response = await api.post(`/assessments/assignments/${assignmentId}/questions/${questionId}/review`, {
      status,
      comment
    })
    return response.data
  },

  getQuestionReviews: async (assignmentId: string): Promise<{
    review_id: string
    question_reviews: Record<string, {
      id: string
      status: 'pending' | 'pass' | 'fail' | 'in_progress' | 'resolved'
      reviewer_comment?: string
      vendor_comment?: string
      is_resolved: boolean
      reviewed_by?: string
      reviewed_at?: string
      resolved_at?: string
    }>
  }> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/question-reviews`)
    return response.data
  },

  addVendorComment: async (
    assignmentId: string,
    questionId: string,
    comment: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/assessments/assignments/${assignmentId}/questions/${questionId}/vendor-comment`, {
      comment
    })
    return response.data
  },

  resolveQuestion: async (
    assignmentId: string,
    questionId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/assessments/assignments/${assignmentId}/questions/${questionId}/resolve`)
    return response.data
  },

  canCloseAssessment: async (assignmentId: string): Promise<{
    can_close: boolean
    unresolved_count: number
    unresolved_items: Array<{
      question_id: string
      status: string
      has_reviewer_comment: boolean
      has_vendor_comment: boolean
    }>
    reason: string
  }> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/can-close`)
    return response.data
  },

  getAnalytics: async (quarter?: string, assessmentType?: string): Promise<{
    overview: {
      total_assessments: number
      total_assignments: number
      completed_assignments: number
      pending_assignments: number
      overdue_assignments: number
      completion_rate: number
    }
    quarterly_progress: Record<string, {
      total: number
      completed: number
      in_progress: number
      pending: number
      overdue: number
    }>
    vendor_distribution: Record<string, {
      vendor_name: string
      assessments: Record<string, {
        total: number
        completed: number
        pending: number
        overdue: number
        risk_status: 'green' | 'yellow' | 'red'
      }>
      overall_risk: 'green' | 'yellow' | 'red'
    }>
    vendor_grading_heatmap: Record<string, {
      vendor_name: string
      grading: {
        accepted: number
        denied: number
        need_info: number
        pending: number
      }
    }>
    vendor_cve_risk: Record<string, {
      vendor_name: string
      total_cves: number
      critical_cves: number
      high_cves: number
      medium_cves: number
      low_cves: number
      risk_score: number
    }>
    next_due_assessments: Array<{
      assignment_id: string
      assessment_name: string
      assessment_type: string
      vendor_name: string
      due_date: string
      days_until_due: number
      status: string
    }>
    assessment_type_distribution: Record<string, number>
    current_quarter: string
  }> => {
    const params: any = {}
    if (quarter) params.quarter = quarter
    if (assessmentType) params.assessment_type = assessmentType
    const response = await api.get('/assessments/analytics/dashboard', { params })
    return response.data
  },

  // Dashboard
  getUpcoming: async (daysAhead?: number): Promise<Array<{
    schedule_id: string
    assessment_id: string
    assessment_name: string
    assessment_type: string
    scheduled_date: string
    due_date?: string
    frequency: string
    vendor_count: number
  }>> => {
    const params: any = {}
    if (daysAhead) params.days_ahead = daysAhead
    const response = await api.get('/assessments/upcoming', { params })
    return response.data
  },

  submitFinalDecision: async (
    assignmentId: string,
    decision: 'accepted' | 'denied' | 'need_info',
    comment?: string,
    forward_to_user_id?: string,
    forward_to_group_id?: string
  ): Promise<{ success: boolean; decision: string; mapped_decision: string; review_id: string; assignment_status: string }> => {
    const body: any = { decision }
    if (comment) body.comment = comment
    if (forward_to_user_id) body.forward_to_user_id = forward_to_user_id
    if (forward_to_group_id) body.forward_to_group_id = forward_to_group_id
    const response = await api.post(`/assessments/assignments/${assignmentId}/decision`, body)
    return response.data
  },

  getWorkflowHistory: async (assignmentId: string): Promise<Array<{
    id: string
    action_type: string
    action_by: {
      id: string
      name?: string
      email?: string
    }
    action_at: string
    forwarded_to?: {
      id: string
      name?: string
      email?: string
    }
    question_ids?: string[]
    comments?: string
    decision_comment?: string
    previous_status?: string
    new_status?: string
    workflow_ticket_id?: string
    action_metadata?: any
  }>> => {
    const response = await api.get(`/assessments/assignments/${assignmentId}/workflow-history`)
    return response.data
  },

  forwardQuestions: async (
    assignmentId: string,
    forward_to_user_id: string,
    question_ids?: string[],
    comment?: string
  ): Promise<{
    success: boolean
    message: string
    forwarded_to: {
      id: string
      name?: string
      email?: string
    }
    question_ids?: string[]
  }> => {
    const response = await api.post(`/assessments/assignments/${assignmentId}/forward`, {
      question_ids,
      forward_to_user_id,
      comment
    })
    return response.data
  },

  // My Assignments - for vendor/agent views
  getMyAssignments: async (status?: string): Promise<Array<{
    id: string
    assessment_id: string
    assessment_name: string
    assessment_type: string
    status: string
    assigned_at: string
    started_at?: string
    completed_at?: string
    due_date?: string
    vendor_name?: string
    agent_name?: string
    progress: {
      answered: number
      total: number
      percentage: number
    }
    is_overdue: boolean
    assignment_type: string
  }>> => {
    const params: any = {}
    if (status) params.status = status
    const response = await api.get('/assessments/my-assignments', { params })
    return response.data
  },
}

export interface AssessmentTemplate {
  id: string
  name: string
  assessment_type: AssessmentType
  description?: string
  applicable_industries: string[]
  questions: Array<{
    question_type: QuestionType
    question_text?: string
    field_type?: string
    requirement_id?: string
    order: number
    is_required: boolean
    section?: string
    [key: string]: any
  }>
  default_schedule_frequency?: ScheduleFrequency
  default_status: AssessmentStatus
  is_active: boolean
  created_at: string
  updated_at: string
}

export const assessmentTemplatesApi = {
  list: async (): Promise<AssessmentTemplate[]> => {
    const response = await api.get('/assessment-templates')
    return response.data
  },

  instantiate: async (templateId: string, assessmentName?: string): Promise<Assessment> => {
    const response = await api.post('/assessment-templates/instantiate', {
      template_id: templateId,
      assessment_name: assessmentName,
    })
    return response.data
  },
}

// Question Library Types
export interface QuestionLibrary {
  id: string
  question_id?: string  // Human-readable question ID (e.g., Q-SEC-01)
  tenant_id: string
  title: string
  question_text: string
  description?: string
  assessment_type: string[]  // Array of assessment types
  category?: string
  field_type: string
  response_type: string
  is_required: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_ids?: string[]
  compliance_framework_ids?: string[]
  risk_framework_ids?: string[]
  applicable_industries?: string[]
  is_active: boolean
  usage_count: number
  created_by: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface QuestionLibraryCreate {
  title: string
  question_text: string
  description?: string
  assessment_type: string[]  // Array of assessment types
  category?: string
  field_type: string
  response_type: string
  is_required?: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_ids?: string[]
  compliance_framework_ids?: string[]
  risk_framework_ids?: string[]
  applicable_industries?: string[]
}

export interface QuestionLibraryUpdate {
  title?: string
  question_text?: string
  description?: string
  assessment_type?: string[]  // Array of assessment types
  category?: string
  field_type?: string
  response_type?: string
  is_required?: boolean
  options?: Array<{ value: string; label: string }>
  validation_rules?: Record<string, any>
  requirement_ids?: string[]
  compliance_framework_ids?: string[]
  risk_framework_ids?: string[]
  applicable_industries?: string[]
  is_active?: boolean
}

// Assessment Rules Types
export interface AssessmentRule {
  id: string
  tenant_id: string
  name: string
  description?: string
  rule_type: 'question_group' | 'requirement_group' | 'auto_add'
  match_conditions: Record<string, any>
  question_ids?: string[]
  requirement_ids?: string[]
  priority: number
  is_active: boolean
  is_automatic: boolean
  created_by: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface AssessmentRuleCreate {
  name: string
  description?: string
  rule_type: 'question_group' | 'requirement_group' | 'auto_add'
  match_conditions: Record<string, any>
  question_ids?: string[]
  requirement_ids?: string[]
  priority?: number
  is_active?: boolean
  is_automatic?: boolean
}

export interface RuleSuggestion {
  rule_id: string
  rule_name: string
  rule_description?: string
  questions_to_add: string[]
  requirements_to_add: string[]
  match_reason: string
}

// Question Library API
export const questionLibraryApi = {
  list: async (params?: {
    assessment_type?: string
    category?: string
    industry?: string
    is_active?: boolean
  }): Promise<QuestionLibrary[]> => {
    const queryParams: Record<string, string> = {}
    if (params?.assessment_type) queryParams.assessment_type = params.assessment_type
    if (params?.category) queryParams.category = params.category
    if (params?.industry) queryParams.industry = params.industry
    if (params?.is_active !== undefined) queryParams.is_active = String(params.is_active)

    const response = await api.get('/question-library', { params: queryParams })
    return response.data
  },

  get: async (id: string): Promise<QuestionLibrary> => {
    const response = await api.get(`/question-library/${id}`)
    return response.data
  },

  create: async (data: QuestionLibraryCreate): Promise<QuestionLibrary> => {
    const response = await api.post('/question-library', data)
    return response.data
  },

  update: async (id: string, data: QuestionLibraryUpdate): Promise<QuestionLibrary> => {
    const response = await api.patch(`/question-library/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/question-library/${id}`)
  },

  toggle: async (id: string): Promise<QuestionLibrary> => {
    const response = await api.patch(`/question-library/${id}/toggle`)
    return response.data
  },
}

// Assessment Rules API
export const assessmentRulesApi = {
  list: async (params?: {
    rule_type?: string
    is_active?: boolean
  }): Promise<AssessmentRule[]> => {
    const queryParams = new URLSearchParams()
    if (params?.rule_type) queryParams.append('rule_type', params.rule_type)
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active))

    const response = await fetch(`/api/v1/assessment-rules?${queryParams.toString()}`, {
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Failed to fetch rules')
    return response.json()
  },

  get: async (id: string): Promise<AssessmentRule> => {
    const response = await fetch(`/api/v1/assessment-rules/${id}`, {
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Failed to fetch rule')
    return response.json()
  },

  create: async (data: AssessmentRuleCreate): Promise<AssessmentRule> => {
    const response = await fetch('/api/v1/assessment-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to create rule')
    return response.json()
  },

  update: async (id: string, data: Partial<AssessmentRuleCreate>): Promise<AssessmentRule> => {
    const response = await fetch(`/api/v1/assessment-rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to update rule')
    return response.json()
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`/api/v1/assessment-rules/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Failed to delete rule')
  },

  applyRules: async (assessmentId: string, autoApply: boolean = false): Promise<RuleSuggestion[]> => {
    const response = await api.post('/assessment-rules/apply', {
      assessment_id: assessmentId,
      auto_apply: autoApply,
    })
    return response.data
  },
}
