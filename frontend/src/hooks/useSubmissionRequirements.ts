/**
 * Custom hook for managing submission requirements
 * Extracts business logic from SubmissionRequirementsManagement component
 * 
 * @module hooks/useSubmissionRequirements
 */

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionRequirementsApi, SubmissionRequirement } from '../lib/submissionRequirements'

export interface RequirementFilters {
  requirementType?: 'compliance' | 'risk' | 'questionnaires' | ''
  complianceFramework?: string
  risk?: boolean
  functionalArea?: string
  questionnaireType?: string
  category?: string
  section?: string
  sourceType?: string
  enabled?: 'all' | 'enabled' | 'disabled'
  searchQuery?: string
  showUnmapped?: boolean
}

export interface UseSubmissionRequirementsOptions {
  filters?: RequirementFilters
  enabled?: boolean
}

/**
 * Custom hook for fetching and managing submission requirements
 */
export function useSubmissionRequirements(options: UseSubmissionRequirementsOptions = {}) {
  const queryClient = useQueryClient()
  const { filters = {}, enabled = true } = options

  // Fetch requirements with filters
  const {
    data: requirements,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [
      'submission-requirements',
      filters.requirementType,
      filters.complianceFramework,
      filters.risk,
      filters.functionalArea,
      filters.questionnaireType,
      filters.category,
      filters.section,
      filters.sourceType,
      filters.enabled
    ],
    queryFn: () => submissionRequirementsApi.list(
      filters.category || undefined,
      filters.section || undefined,
      filters.sourceType || undefined,
      filters.enabled === 'all' ? undefined : filters.enabled === 'enabled',
      undefined, // agentCategory
      undefined, // agentType
      filters.questionnaireType || undefined,
      filters.requirementType || undefined
    ),
    enabled
  })

  // Filter requirements based on search and other filters
  const filteredRequirements = useMemo(() => {
    if (!requirements) return []

    return requirements.filter(req => {
      // Filter by Requirement Type
      if (filters.requirementType && req.requirement_type !== filters.requirementType) {
        return false
      }

      // Filter by Compliance Framework
      if (filters.complianceFramework) {
        if (req.requirement_type !== 'compliance' || 
            req.section !== 'Compliance Frameworks' || 
            req.source_name !== filters.complianceFramework) {
          return false
        }
      }

      // Filter by Risk
      if (filters.risk) {
        if (req.requirement_type !== 'risk' || req.section !== 'Risks') {
          return false
        }
      }

      // Filter by Functional Area
      if (filters.functionalArea) {
        if (req.section !== `Functional Areas - ${filters.functionalArea}`) {
          return false
        }
      }

      // Filter by Questionnaire Type
      if (filters.questionnaireType) {
        if (req.requirement_type !== 'questionnaires' || 
            req.questionnaire_type !== filters.questionnaireType) {
          return false
        }
      }

      // Filter by Category
      if (filters.category && req.category !== filters.category) {
        return false
      }

      // Filter by Section
      if (filters.section && req.section !== filters.section) {
        return false
      }

      // Filter by Source Type
      if (filters.sourceType && req.source_type !== filters.sourceType) {
        return false
      }

      // Filter by Enabled Status
      if (filters.enabled === 'enabled' && !req.is_enabled) {
        return false
      }
      if (filters.enabled === 'disabled' && req.is_enabled) {
        return false
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const matchesSearch =
          req.label.toLowerCase().includes(query) ||
          (req.catalog_id && req.catalog_id.toLowerCase().includes(query)) ||
          (req.description && req.description.toLowerCase().includes(query)) ||
          (req.section && req.section.toLowerCase().includes(query)) ||
          (req.source_name && req.source_name.toLowerCase().includes(query))
        
        if (!matchesSearch) {
          return false
        }
      }

      // Filter by mapping status
      if (filters.showUnmapped === false) {
        const isMapped =
          req.section === 'Risks' ||
          req.section === 'Compliance Frameworks' ||
          (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ')
        
        if (!isMapped) {
          return false
        }
      }

      return true
    })
  }, [requirements, filters])

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!requirements) {
      return {
        complianceFrameworks: [],
        functionalAreas: [],
        categories: [],
        sections: [],
        questionnaireTypes: []
      }
    }

    return {
      complianceFrameworks: Array.from(new Set(
        requirements
          .filter(req => req.section === 'Compliance Frameworks' && req.source_name)
          .map(req => req.source_name!)
          .sort()
      )),
      functionalAreas: Array.from(new Set(
        requirements
          .filter(req => req.section?.startsWith('Functional Areas - '))
          .map(req => req.section!.replace('Functional Areas - ', ''))
          .sort()
      )),
      categories: Array.from(new Set(
        requirements
          .map(req => req.category)
          .filter(Boolean)
          .sort()
      )),
      sections: Array.from(new Set(
        requirements
          .map(req => req.section)
          .filter(Boolean)
          .sort()
      )),
      questionnaireTypes: Array.from(new Set(
        requirements
          .map(req => req.questionnaire_type)
          .filter(Boolean)
          .sort()
      ))
    }
  }, [requirements])

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!requirements) {
      return {
        total: 0,
        mapped: 0,
        unmapped: 0,
        byType: { compliance: 0, risk: 0, questionnaires: 0 },
        byQuestionnaire: {
          tprm: 0,
          security: 0,
          subContractor: 0,
          qualification: 0
        }
      }
    }

    const mapped = requirements.filter(req => {
      return req.section === 'Risks' ||
        req.section === 'Compliance Frameworks' ||
        (req.section?.startsWith('Functional Areas - ') && req.section !== 'Functional Areas - ')
    }).length

    return {
      total: requirements.length,
      mapped,
      unmapped: requirements.length - mapped,
      byType: {
        compliance: requirements.filter(r => r.requirement_type === 'compliance').length,
        risk: requirements.filter(r => r.requirement_type === 'risk').length,
        questionnaires: requirements.filter(r => r.requirement_type === 'questionnaires').length
      },
      byQuestionnaire: {
        tprm: requirements.filter(r => r.questionnaire_type === 'TPRM- Questionnaire').length,
        security: requirements.filter(r => r.questionnaire_type === 'Vendor Security Questionnaire').length,
        subContractor: requirements.filter(r => r.questionnaire_type === 'Sub Contractor Questionnaire').length,
        qualification: requirements.filter(r => r.questionnaire_type === 'Vendor Qualification').length
      }
    }
  }, [requirements])

  return {
    requirements,
    filteredRequirements,
    isLoading,
    error,
    refetch,
    filterOptions,
    statistics
  }
}

/**
 * Hook for requirement mutations (create, update, delete)
 */
export function useRequirementMutations() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: Partial<SubmissionRequirement>) => 
      submissionRequirementsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; requirement: Partial<SubmissionRequirement> }) =>
      submissionRequirementsApi.update(data.id, data.requirement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => submissionRequirementsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
    }
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => submissionRequirementsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-requirements'] })
    }
  })

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    toggleMutation
  }
}

/**
 * Utility function to generate field_name from catalog_id
 * Entity design: Entity has Title (label) and Description, field_name is a short code from catalog_id
 * 
 * @deprecated Use catalog_id instead. field_name should be generated from catalog_id on backend.
 */
export function generateFieldName(catalogId: string): string {
  if (!catalogId || typeof catalogId !== 'string') {
    throw new Error('Catalog ID must be a non-empty string')
  }

  // Convert catalog_id (e.g., "REQ-COM-01") to field_name (e.g., "req_com_01")
  let fieldName = catalogId
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]/g, '') // Remove invalid characters
    .substring(0, 50) // Limit to 50 chars for readability

  // Ensure it starts with a letter
  if (!fieldName || !/^[a-z]/.test(fieldName)) {
    fieldName = 'req_' + (fieldName || Date.now().toString())
  }

  // Ensure it matches valid pattern
  if (!/^[a-z][a-z0-9_]*$/.test(fieldName)) {
    fieldName = 'req_' + Date.now().toString()
  }

  return fieldName
}
