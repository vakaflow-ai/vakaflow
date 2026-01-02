import { useState, useRef, useEffect } from 'react'
import { Plus, FileText, Image, Video, FolderOpen, MoreVertical, GripVertical, Trash2, Copy, Search, X } from 'lucide-react'
import { showToast } from '../utils/toast'

interface FormSection {
  id: string
  title: string
  description?: string
  fields: FormField[] // Fields only - questions are for assessments
}

interface FormField {
  id: string
  field_name: string
  field_label: string
  required: boolean
}

interface FormsDesignerProps {
  sections: FormSection[]
  onSectionsChange: (sections: FormSection[]) => void
  availableFields?: Array<{ field_name: string; label: string; source: string; description?: string }>
  onAddField?: (fieldName: string, sectionId: string, fieldId?: string) => void
  showFieldPicker?: boolean // Show field picker sidebar
}

export default function FormsDesigner({
  sections,
  onSectionsChange,
  availableFields = [],
  onAddField,
  showFieldPicker = true
}: FormsDesignerProps) {
  const [formTitle, setFormTitle] = useState('Untitled form')
  const [formDescription, setFormDescription] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null)
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null)
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(true)
  const [showFieldPickerSidebar, setShowFieldPickerSidebar] = useState(false)
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')
  const formContainerRef = useRef<HTMLDivElement>(null)

  // Initialize with a default section if empty
  useEffect(() => {
    if (sections.length === 0) {
      onSectionsChange([{
        id: `section-${Date.now()}`,
        title: 'Untitled Section',
        fields: []
      }])
    }
  }, [sections.length, onSectionsChange])

  // Filter available fields by search query
  const filteredFields = availableFields.filter(field =>
    field.label?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
    field.field_name?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
    field.description?.toLowerCase().includes(fieldSearchQuery.toLowerCase())
  )

  const addSection = () => {
    const newSection: FormSection = {
      id: `section-${Date.now()}`,
      title: 'Untitled Section',
      fields: []
    }
    onSectionsChange([...sections, newSection])
    setEditingSectionId(newSection.id)
  }

  const addField = (sectionId: string, fieldName: string) => {
    const field = availableFields.find(f => f.field_name === fieldName)
    if (!field) return

    // Check if field already exists in this section
    const section = sections.find(s => s.id === sectionId)
    if (section?.fields.some(f => f.field_name === fieldName)) {
      showToast.warning(`Field "${field.label}" is already in this section`)
      return
    }

    const newField: FormField = {
      id: `field-${Date.now()}`,
      field_name: fieldName,
      field_label: field.label || fieldName,
      required: false
    }

    const updatedSections = sections.map(section =>
      section.id === sectionId
        ? { ...section, fields: [...section.fields, newField] }
        : section
    )
    onSectionsChange(updatedSections)
    if (onAddField) {
      onAddField(fieldName, sectionId, newField.id)
    }
    setShowFieldPickerSidebar(false)
    showToast.success(`Added field "${field.label}" to section`)
  }

  const updateSection = (sectionId: string, updates: Partial<FormSection>) => {
    const updatedSections = sections.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    )
    onSectionsChange(updatedSections)
  }

  const deleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      showToast.warning('At least one section is required')
      return
    }
    onSectionsChange(sections.filter(s => s.id !== sectionId))
  }

  const updateField = (sectionId: string, fieldId: string, updates: Partial<FormField>) => {
    const updatedSections = sections.map(section => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        fields: section.fields.map(field =>
          field.id === fieldId ? { ...field, ...updates } : field
        )
      }
    })
    onSectionsChange(updatedSections)
  }

  const duplicateField = (sectionId: string, fieldId: string) => {
    const section = sections.find(s => s.id === sectionId)
    const field = section?.fields.find(f => f.id === fieldId)
    if (!field) return

    const newField: FormField = {
      ...field,
      id: `field-${Date.now()}`,
      field_label: `${field.field_label} (Copy)`
    }

    const updatedSections = sections.map(s =>
      s.id === sectionId
        ? { ...s, fields: [...s.fields, newField] }
        : s
    )
    onSectionsChange(updatedSections)
    showToast.success('Field duplicated')
  }

  const deleteField = (sectionId: string, fieldId: string) => {
    const updatedSections = sections.map(section => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        fields: section.fields.filter(f => f.id !== fieldId)
      }
    })
    onSectionsChange(updatedSections)
    showToast.success('Field deleted')
  }

  const renderFieldInput = (field: FormField) => {
    // For forms, fields are just displayed as input placeholders
    // The actual field type is determined by the field definition
    return (
      <div className="border-b border-gray-300 pb-2 mt-2">
        <input
          type="text"
          placeholder="Field input"
          className="w-full outline-none text-sm text-gray-600"
          disabled
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" ref={formContainerRef}>
      {/* Header - Google Forms style */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="text-xl font-normal border-none outline-none w-full bg-transparent"
                  placeholder="Untitled form"
                />
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="text-sm text-gray-500 border-none outline-none w-full bg-transparent mt-1"
                  placeholder="Form description"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">All changes saved in Drive</span>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Form Title Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="text-2xl font-normal border-none outline-none w-full bg-transparent"
                placeholder="Untitled form"
              />
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="text-sm text-gray-500 border-none outline-none w-full bg-transparent mt-2"
                placeholder="Form description"
              />
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className="mb-6">
            {/* Section Header */}
            <div
              className="bg-purple-50 border-l-4 border-purple-600 px-4 py-2 mb-2"
              onMouseEnter={() => setHoveredSectionId(section.id)}
              onMouseLeave={() => setHoveredSectionId(null)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-900">
                  Section {sectionIndex + 1} of {sections.length}
                </span>
                {hoveredSectionId === section.id && (
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Section Card */}
            <div
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              onMouseEnter={() => setHoveredSectionId(section.id)}
              onMouseLeave={() => setHoveredSectionId(null)}
            >
              {/* Section Title */}
              <div className="mb-4">
                {editingSectionId === section.id ? (
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    onBlur={() => setEditingSectionId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingSectionId(null)
                      }
                    }}
                    className="text-xl font-normal border-none outline-none w-full bg-transparent border-b-2 border-transparent focus:border-blue-500"
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-xl font-normal cursor-text"
                    onClick={() => setEditingSectionId(section.id)}
                  >
                    {section.title}
                  </h2>
                )}
                {section.description && (
                  <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                )}
              </div>

              {/* Fields */}
              {section.fields.map((field, fieldIndex) => (
                <div
                  key={`${field.id}-${fieldIndex}`}
                  className="mb-6 pb-6 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0"
                  onMouseEnter={() => setHoveredFieldId(field.id)}
                  onMouseLeave={() => setHoveredFieldId(null)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-2">
                      <GripVertical className="w-5 h-5 text-gray-600 cursor-move" />
                    </div>
                    <div className="flex-1">
                      {/* Field Label */}
                      {editingFieldId === field.id ? (
                        <input
                          type="text"
                          value={field.field_label}
                          onChange={(e) => updateField(section.id, field.id, { field_label: e.target.value })}
                          onBlur={() => setEditingFieldId(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              setEditingFieldId(null)
                            }
                          }}
                          className="text-base font-normal border-none outline-none w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 mb-2"
                          autoFocus
                        />
                      ) : (
                        <h3
                          className="text-base font-normal cursor-text mb-2"
                          onClick={() => setEditingFieldId(field.id)}
                        >
                          {field.field_label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </h3>
                      )}

                      {/* Field Input Preview */}
                      {renderFieldInput(field)}

                      {/* Field Actions */}
                      {hoveredFieldId === field.id && (
                        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => duplicateField(section.id, field.id)}
                            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => deleteField(section.id, field.id)}
                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                          <div className="flex-1" />
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(section.id, field.id, { required: e.target.checked })}
                              className="w-4 h-4"
                            />
                            Required
                          </label>
                        </div>
                      )}
                    </div>
                    {hoveredFieldId === field.id && (
                      <button className="p-2 hover:bg-gray-100 rounded-full">
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Field Button */}
              {showFieldPicker && availableFields.length > 0 && (
                <button
                  onClick={() => setShowFieldPickerSidebar(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 mt-4"
                >
                  <Plus className="w-5 h-5" />
                  Add field
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add Section Button */}
        <button
          onClick={addSection}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
        >
          <FolderOpen className="w-5 h-5" />
          Add section
        </button>
      </div>

      {/* Field Picker Sidebar */}
      {showFieldPickerSidebar && showFieldPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
          <div className="bg-white w-full max-w-md ml-auto shadow-2xl flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Available Fields
              </h2>
              <button
                onClick={() => setShowFieldPickerSidebar(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={fieldSearchQuery}
                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredFields.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No fields found</div>
              ) : (
                <div className="space-y-2">
                  {filteredFields.map((field, fieldIndex) => {
                    const section = sections.find(s => s.id === hoveredSectionId || sections[0]?.id)
                    const isInSection = section?.fields.some(f => f.field_name === field.field_name)
                    
                    return (
                      <div
                        key={`${field.source}-${field.field_name}-${fieldIndex}`}
                        className={`p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors ${
                          isInSection 
                            ? 'bg-gray-100 opacity-50 cursor-not-allowed' 
                            : 'hover:border-blue-500 hover:bg-blue-50'
                        }`}
                        onClick={() => {
                          if (!isInSection && section) {
                            addField(section.id, field.field_name)
                          }
                        }}
                      >
                        <div className="font-medium text-sm mb-1">{field.label}</div>
                        <div className="text-xs text-gray-600 font-mono mb-1">{field.field_name}</div>
                        {field.description && (
                          <div className="text-xs text-gray-500 line-clamp-2">{field.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {field.source}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toolbar - Right Side */}
      {showFloatingToolbar && !showFieldPickerSidebar && (
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-20">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-col gap-2">
            {showFieldPicker && availableFields.length > 0 && (
              <button
                onClick={() => setShowFieldPickerSidebar(true)}
                className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
                title="Add field"
              >
                <Plus className="w-6 h-6 text-gray-600" />
              </button>
            )}
            <button
              onClick={addSection}
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add section"
            >
              <FolderOpen className="w-6 h-6 text-gray-600" />
            </button>
            <button
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add title and description"
            >
              <FileText className="w-6 h-6 text-gray-600" />
            </button>
            <button
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add image"
            >
              <Image className="w-6 h-6 text-gray-600" />
            </button>
            <button
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add video"
            >
              <Video className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

