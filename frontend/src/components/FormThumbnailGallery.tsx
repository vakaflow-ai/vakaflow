import React from 'react'
import { FormAssociation, getFormAssociationSortOrder, getFormAssociationIsDefault } from '../lib/requestTypeConfig'
import { 
  DocumentTextIcon,
  EyeIcon,
  LinkIcon,
  XIcon
} from './Icons'

interface FormThumbnailGalleryProps {
  forms: FormAssociation[]
  onViewForm: (formId: string) => void
  onRemoveForm: (formId: string) => void
  onSetDefault?: (formId: string) => void
  editable?: boolean
}

export default function FormThumbnailGallery({
  forms,
  onViewForm,
  onRemoveForm,
  onSetDefault,
  editable = true
}: FormThumbnailGalleryProps) {
  const getFormVariationBadge = (isDefault: boolean) => {
    if (isDefault) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Default
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Standard
      </span>
    )
  }

  if (forms.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-2">No forms associated</p>
        <p className="text-sm text-gray-400">Add forms to configure this request type</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {forms.map((form) => (
        <div 
          key={form.id} 
          className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white"
        >
          {/* Form Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {form.form_layout?.name || 'Unnamed Form'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  ID: {form.form_layout_id.substring(0, 8)}...
                </p>
              </div>
              {editable && (
                <button
                  onClick={() => onRemoveForm(form.form_layout_id)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-2"
                  title="Remove form association"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              {getFormVariationBadge(getFormAssociationIsDefault(form))}
              <span className="text-xs text-gray-500">
                Order: {getFormAssociationSortOrder(form)}
              </span>
            </div>
          </div>

          {/* Form Preview */}
          <div className="p-4">
            <div className="space-y-3">
              {/* Form Fields Preview */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Form Fields
                </h4>
                <div className="space-y-1">
                  {form.form_layout?.json_schema?.properties ? (
                    Object.keys(form.form_layout.json_schema.properties)
                      .slice(0, 3)
                      .map((fieldName) => {
                        const field = form.form_layout!.json_schema.properties[fieldName]
                        return (
                          <div key={fieldName} className="flex items-center text-xs text-gray-600">
                            <div className="w-2 h-2 rounded-full bg-blue-400 mr-2 flex-shrink-0"></div>
                            <span className="truncate">{field.title || fieldName}</span>
                          </div>
                        )
                      })
                  ) : (
                    <p className="text-xs text-gray-500 italic">No field schema defined</p>
                  )}
                  
                  {form.form_layout?.json_schema?.properties && 
                   Object.keys(form.form_layout.json_schema.properties).length > 3 && (
                    <p className="text-xs text-gray-500">
                      +{Object.keys(form.form_layout.json_schema.properties).length - 3} more fields
                    </p>
                  )}
                </div>
              </div>

              {/* Form Description */}
              {form.form_layout?.description && (
                <div>
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">
                    Description
                  </h4>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {form.form_layout.description}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className={`inline-flex items-center text-xs ${
                  form.form_layout?.is_active 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${
                    form.form_layout?.is_active ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  {form.form_layout?.is_active ? 'Active' : 'Inactive'}
                </span>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onViewForm(form.form_layout_id)}
                    className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors"
                    title="View form details"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  {editable && onSetDefault && !getFormAssociationIsDefault(form) && (
                    <button
                      onClick={() => onSetDefault(form.form_layout_id)}
                      className="p-1 text-gray-500 hover:text-yellow-600 rounded transition-colors"
                      title="Set as default form"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}