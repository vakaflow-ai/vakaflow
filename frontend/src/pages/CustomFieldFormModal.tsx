import { useState } from 'react'
import { MaterialButton, MaterialInput, MaterialChip } from '../components/material'
import { CustomField } from '../lib/formLayouts'
import { MasterDataList } from '../lib/masterDataLists'
import { showToast } from '../utils/toast'

interface CustomFieldFormModalProps {
  initialData?: CustomField
  onSave: (field: CustomField) => void
  onCancel: () => void
  masterDataLists: MasterDataList[]
}

export default function CustomFieldFormModal({
  initialData,
  onSave,
  onCancel,
  masterDataLists,
}: CustomFieldFormModalProps) {
  const isEditing = !!initialData
  const [fieldName, setFieldName] = useState(initialData?.field_name || '')
  const [fieldType, setFieldType] = useState<CustomField['field_type']>(initialData?.field_type || 'text')
  const [label, setLabel] = useState(initialData?.label || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '')
  const [isRequired, setIsRequired] = useState(initialData?.is_required || false)
  const [acceptedFileTypes, setAcceptedFileTypes] = useState(initialData?.accepted_file_types || '')
  const [linkText, setLinkText] = useState(initialData?.link_text || '')
  const [masterDataListId, setMasterDataListId] = useState<string>(initialData?.master_data_list_id || '')
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>(initialData?.options || [])
  const [newOptionValue, setNewOptionValue] = useState('')
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [dataSource, setDataSource] = useState<'master' | 'static'>(initialData?.master_data_list_id ? 'master' : 'static')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!fieldName || !label) {
      showToast.error('Field name and label are required')
      return
    }

    const customField: CustomField = {
      ...initialData,
      field_name: fieldName,
      field_type: fieldType,
      label,
      description: description || undefined,
      placeholder: placeholder || undefined,
      is_required: isRequired,
    }

    // Add type-specific fields
    if (fieldType === 'file_upload') {
      customField.accepted_file_types = acceptedFileTypes || undefined
    } else if (fieldType === 'external_link') {
      customField.link_text = linkText || undefined
    } else if (fieldType === 'select' || fieldType === 'multi_select') {
      if (masterDataListId) {
        customField.master_data_list_id = masterDataListId
        customField.options = undefined // Clear static options if using master data
      } else if (options.length > 0) {
        // Auto-generate values if not provided
        const optionsWithValues = options.map(opt => ({
          value: opt.value || opt.label.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          label: opt.label
        }))
        customField.options = optionsWithValues
        customField.master_data_list_id = undefined // Clear master data if using static options
      } else {
        showToast.error('Please either choose an existing list or add at least one option')
        return
      }
    }

    onSave(customField)
  }

  const handleAddOption = () => {
    if (newOptionValue && newOptionLabel) {
      setOptions([...options, { value: newOptionValue, label: newOptionLabel }])
      setNewOptionValue('')
      setNewOptionLabel('')
    }
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full h-[90vh] flex flex-col my-auto mx-auto overflow-hidden">
        {/* Header - Fixed */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{isEditing ? 'Edit' : 'Create'} Field Definition</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isEditing ? 'Update your field properties below.' : 'Add a new custom field to your library.'}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-600 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <form id="custom-field-form" onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="enterprise-form-field">
              <label className="enterprise-label">
                Field Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value)
                  if (!isEditing && !fieldName) {
                    setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
                  }
                }}
                className="enterprise-input"
                placeholder="e.g., Agreement Document"
                required
              />
            </div>

            <div className="enterprise-form-field">
              <label className="enterprise-label">
                Internal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                className="enterprise-input font-mono bg-gray-50"
                placeholder="e.g., agreement_doc"
                required
                disabled={isEditing}
              />
              <p className="text-xs text-gray-600 mt-2">Unique identifier, cannot be changed after creation</p>
            </div>
          </div>

          <div className="enterprise-form-field">
            <label className="enterprise-label">
              Field Type <span className="text-red-500">*</span>
            </label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as CustomField['field_type'])}
              className="enterprise-input"
              required
            >
              <optgroup label="Text Input">
                <option value="text">Single Line Text</option>
                <option value="textarea">Multi-Line Text</option>
              </optgroup>
              <optgroup label="Selection">
                <option value="select">Dropdown List</option>
                <option value="multi_select">Multiple Choice (Checkbox Group)</option>
              </optgroup>
              <optgroup label="Data Types">
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="email">Email Address</option>
                <option value="url">Website URL</option>
              </optgroup>
              <optgroup label="Advanced">
                <option value="file_upload">File Upload</option>
                <option value="external_link">External Link Button</option>
                <option value="json">JSON Data</option>
                <option value="rich_text">Rich Text (Formatted)</option>
              </optgroup>
              <optgroup label="Visualization">
                <option value="architecture_diagram">Architecture Diagram</option>
                <option value="mermaid_diagram">Mermaid Diagram</option>
                <option value="visualization">Custom Visualization</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description / Help Text
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="enterprise-input w-full min-h-[80px]"
              placeholder="Instructions for users filling this field..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Placeholder
            </label>
            <input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              className="enterprise-input w-full"
              placeholder="Example text shown in the empty field..."
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <input
              type="checkbox"
              id="is_required"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <label htmlFor="is_required" className="text-sm font-medium text-blue-900 cursor-pointer">
              Mark as Required
              <span className="block text-xs text-blue-600 font-normal">Users must fill this field before they can submit the form.</span>
            </label>
          </div>

          {/* Type-specific fields */}
          {fieldType === 'file_upload' && (
            <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">
                Allowed File Types
              </label>
              <input
                type="text"
                value={acceptedFileTypes}
                onChange={(e) => setAcceptedFileTypes(e.target.value)}
                className="enterprise-input w-full"
                placeholder="e.g., .pdf, .doc, .docx, .png, .jpg"
              />
              <p className="text-xs text-gray-500 italic">Separate with commas. Leave empty to allow all types.</p>
            </div>
          )}

          {fieldType === 'external_link' && (
            <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">
                Button Label
              </label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="enterprise-input w-full"
                placeholder="e.g., View Documentation"
              />
              <p className="text-xs text-gray-500 italic">Defaults to "Open Link" if empty.</p>
            </div>
          )}

          {(fieldType === 'select' || fieldType === 'multi_select') && (
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <label className="block text-sm font-bold text-gray-800">Options Source</label>
              
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border transition-all ${dataSource === 'master' ? 'bg-white border-blue-300 ring-2 ring-blue-50' : 'bg-transparent border-gray-200 opacity-70'}`}>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="dataSource"
                      value="master"
                      checked={dataSource === 'master'}
                      onChange={() => setDataSource('master')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm font-bold">Use Master Data List</span>
                  </label>
                  {dataSource === 'master' && (
                    <div className="mt-3 ml-6">
                      {masterDataLists.length > 0 ? (
                        <select
                          value={masterDataListId}
                          onChange={(e) => setMasterDataListId(e.target.value)}
                          className="enterprise-input w-full bg-white"
                        >
                          <option value="">Choose a list...</option>
                          {masterDataLists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.name} ({list.values.length} items)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-600 font-medium">No active master data lists found. Create one first.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className={`p-3 rounded-lg border transition-all ${dataSource === 'static' ? 'bg-white border-blue-300 ring-2 ring-blue-50' : 'bg-transparent border-gray-200 opacity-70'}`}>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="dataSource"
                      value="static"
                      checked={dataSource === 'static'}
                      onChange={() => setDataSource('static')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm font-bold">Define Custom Options</span>
                  </label>
                  {dataSource === 'static' && (
                    <div className="mt-3 ml-6 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOptionLabel}
                          onChange={(e) => setNewOptionLabel(e.target.value)}
                          className="enterprise-input flex-1 bg-white"
                          placeholder="Option Label (e.g., Yes, High, etc.)"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                        />
                        <MaterialButton
                          type="button"
                          onClick={handleAddOption}
                          disabled={!newOptionLabel}
                          size="small"
                        >
                          Add
                        </MaterialButton>
                      </div>
                      
                      {options.length > 0 && (
                        <div className="bg-white border border-gray-100 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                          {options.map((opt, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded group">
                              <span className="text-sm font-medium">{opt.label}</span>
                              <MaterialButton
                                variant="text"
                                size="small"
                                color="error"
                                onClick={() => handleRemoveOption(idx)}
                                className="!p-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                              </MaterialButton>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0 bg-white">
          <MaterialButton
            type="button"
            variant="text"
            color="gray"
            onClick={onCancel}
          >
            Cancel
          </MaterialButton>
          <MaterialButton
            onClick={() => {
              const form = document.getElementById('custom-field-form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
          >
            {isEditing ? 'Save Changes' : 'Create Field Definition'}
          </MaterialButton>
        </div>
      </div>
    </div>
  )
}
