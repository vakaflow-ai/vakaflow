import React from 'react'
import { RequestTypeConfig, FormAssociation } from '../lib/requestTypeConfig'
import { FormLayout } from '../lib/formLayouts'
import { 
  DocumentTextIcon,
  ChevronRightIcon,
  PlusIcon,
  EyeIcon
} from './Icons'

interface RequestTypeCardWithFormsProps {
  config: RequestTypeConfig & { associatedForms: FormAssociation[] }
  isSelected: boolean
  onSelect: () => void
  onAssociateForm: () => void
  onViewForm: (formId: string) => void
  onEdit: () => void
  onDelete: () => void
}

export default function RequestTypeCardWithForms({
  config,
  isSelected,
  onSelect,
  onAssociateForm,
  onViewForm,
  onEdit,
  onDelete
}: RequestTypeCardWithFormsProps) {
  const getVisibilityBadge = (scope: string) => {
    const styles = {
      internal: 'bg-blue-100 text-blue-800',
      external: 'bg-green-100 text-green-800',
      both: 'bg-purple-100 text-purple-800'
    }
    const labels = {
      internal: 'Internal',
      external: 'External',
      both: 'Both'
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[scope as keyof typeof styles] || styles.both}`}>
        {labels[scope as keyof typeof labels] || labels.both}
      </span>
    )
  }

  const getStatusBadge = (isActive: boolean) => (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )

  return (
    <div 
      className={`rounded-lg border transition-all duration-200 cursor-pointer ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <DocumentTextIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900 truncate">{config.display_name}</h3>
              {getStatusBadge(config.is_active)}
            </div>
            <p className="text-sm text-gray-500 font-mono truncate mb-2">{config.request_type}</p>
            <div className="flex items-center gap-2">
              {getVisibilityBadge(config.visibility_scope)}
              <span className="text-xs text-gray-500">
                {config.associatedForms.length} form{config.associatedForms.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Edit request type"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete request type"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Preview Section */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">Associated Forms</h4>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAssociateForm()
              }}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <PlusIcon className="w-3 h-3" />
              Add Form
            </button>
          </div>
          
          {config.associatedForms.length > 0 ? (
            <div className="space-y-2">
              {config.associatedForms.slice(0, 3).map((form) => (
                <div 
                  key={form.id} 
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md group hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {form.form_layout?.name || 'Unnamed Form'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      Order: {form.sort_order} {form.is_default && '• Default'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewForm(form.form_layout_id)
                      }}
                      className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors"
                      title="View form"
                    >
                      <EyeIcon className="w-3 h-3" />
                    </button>
                    <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              ))}
              
              {config.associatedForms.length > 3 && (
                <div className="text-center py-1">
                  <span className="text-xs text-gray-500">
                    +{config.associatedForms.length - 3} more forms
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <DocumentTextIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No forms associated</p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAssociateForm()
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <PlusIcon className="w-3 h-3" />
                Associate a form
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}