import React, { useState, useRef, useEffect } from 'react'
import { Plus, FileText, FolderOpen, GripVertical, Trash2, Search, X, ChevronUp, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { showToast } from '../utils/toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  availableFields?: Array<{ 
    field_name: string
    label: string
    source: string
    description?: string
    entity_name?: string
    entity_label?: string
    category?: string
    [key: string]: any
  }>
  onAddField?: (fieldName: string, sectionId: string, fieldId?: string) => void
  showFieldPicker?: boolean // Show field picker sidebar
  formTitle?: string // Form name from parent
  formDescription?: string // Form description from parent
  onFormTitleChange?: (title: string) => void // Callback for form title changes
  onFormDescriptionChange?: (description: string) => void // Callback for form description changes
}

function SortableSection({
  section,
  sectionIndex,
  activeSectionId,
  setActiveSectionId,
  editingSectionId,
  setEditingSectionId,
  updateSection,
  deleteSection,
  moveSection,
  sectionsCount,
  editingFieldId,
  setEditingFieldId,
  updateField,
  deleteField,
  renderFieldInput,
  showFieldPicker,
  availableFields,
  setShowFieldPickerSidebar,
  isExpanded,
  onToggleExpand
}: {
  section: FormSection
  sectionIndex: number
  activeSectionId: string | null
  setActiveSectionId: (id: string | null) => void
  editingSectionId: string | null
  setEditingSectionId: (id: string | null) => void
  updateSection: (id: string, updates: Partial<FormSection>) => void
  deleteSection: (id: string) => void
  moveSection: (index: number, direction: 'up' | 'down') => void
  sectionsCount: number
  editingFieldId: string | null
  setEditingFieldId: (id: string | null) => void
  updateField: (sectionId: string, fieldId: string, updates: Partial<FormField>) => void
  deleteField: (sectionId: string, fieldId: string) => void
  renderFieldInput: (field: FormField) => React.ReactNode
  showFieldPicker: boolean
  availableFields: Array<any>
  setShowFieldPickerSidebar: (show: boolean) => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`mb-4 transition-all duration-200 ${activeSectionId === section.id ? 'ring-2 ring-primary-500 ring-offset-2 rounded-lg' : ''}`}
      onClick={() => setActiveSectionId(section.id)}
    >
      <div
        className={`bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-lg shadow-md-elevation-1 border-2 p-4 ${activeSectionId === section.id ? 'border-blue-500' : 'border-primary-200'}`}
      >
        <div className="mb-3 pb-2 border-b border-primary-300 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-5 h-5 text-primary-400" />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="p-1 hover:bg-primary-200 rounded transition-colors flex-shrink-0"
              title={isExpanded ? "Collapse section" : "Expand section"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-primary-700" />
              ) : (
                <ChevronDown className="w-4 h-4 text-primary-700" />
              )}
            </button>
            <div className="flex-1 min-w-0">
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
                  className="text-subheading font-medium border-none outline-none w-full bg-transparent border-b-2 border-transparent focus:border-primary-600 text-gray-800 transition-colors duration-200"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2
                    className="text-subheading font-medium cursor-text text-gray-800 truncate"
                    onClick={(e) => { e.stopPropagation(); setEditingSectionId(section.id); }}
                  >
                    {section.title}
                  </h2>
                  {activeSectionId === section.id && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0">Active</span>
                  )}
                </div>
              )}
              {section.description && (
                <p className="text-body text-primary-700 mt-1 truncate">{section.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); moveSection(sectionIndex, 'up') }}
              disabled={sectionIndex === 0}
              className="p-1 hover:bg-primary-200 rounded disabled:opacity-30 transition-colors"
              title="Move section up"
            >
              <ChevronUp className="w-4 h-4 text-primary-700" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); moveSection(sectionIndex, 'down') }}
              disabled={sectionIndex === sectionsCount - 1}
              className="p-1 hover:bg-primary-200 rounded disabled:opacity-30 transition-colors"
              title="Move section down"
            >
              <ChevronDown className="w-4 h-4 text-primary-700" />
            </button>
            {sectionsCount > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteSection(section.id) }}
                className="p-1 hover:bg-error-100 rounded text-error-500 transition-colors ml-2"
                title="Delete section"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
        <div className="bg-white rounded border border-gray-200 p-3 space-y-2">
          <SortableContext
            items={section.fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {section.fields.map((field, fieldIndex) => (
              <SortableField
                key={field.id}
                field={field}
                fieldIndex={fieldIndex}
                sectionId={section.id}
                editingFieldId={editingFieldId}
                setEditingFieldId={setEditingFieldId}
                updateField={updateField}
                deleteField={deleteField}
                renderFieldInput={renderFieldInput}
              />
            ))}
          </SortableContext>
          {section.fields.length === 0 && (
            <div className="text-center py-2 text-gray-600 text-xs border border-dashed border-gray-200 rounded italic">
              No fields in this section. Add fields from the sidebar or click below.
            </div>
          )}

          {showFieldPicker && availableFields.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveSectionId(section.id); setShowFieldPickerSidebar(true); }}
              className={`w-full py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-4 text-sm font-medium shadow-sm ${activeSectionId === section.id ? 'bg-blue-600 text-white hover:bg-primary-700' : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'}`}
            >
              <Plus className="w-4 h-4" />
              <span>Add field to this section</span>
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function SortableField({
  field,
  fieldIndex,
  sectionId,
  editingFieldId,
  setEditingFieldId,
  updateField,
  deleteField,
  renderFieldInput
}: {
  field: FormField
  fieldIndex: number
  sectionId: string
  editingFieldId: string | null
  setEditingFieldId: (id: string | null) => void
  updateField: (sectionId: string, fieldId: string, updates: Partial<FormField>) => void
  deleteField: (sectionId: string, fieldId: string) => void
  renderFieldInput: (field: FormField) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pb-2 group`}
    >
      <div className="flex items-start gap-2 bg-white rounded p-1 hover:bg-slate-50 transition-colors">
        <div 
          className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing px-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-primary-300 group-hover:text-primary-500 transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          {/* Field Label */}
          {editingFieldId === field.id ? (
            <input
              type="text"
              value={field.field_label}
              onChange={(e) => updateField(sectionId, field.id, { field_label: e.target.value })}
              onBlur={() => setEditingFieldId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  setEditingFieldId(null)
                }
              }}
              className={`text-body border-none outline-none w-full bg-transparent border-b border-blue-500 mb-1 text-gray-800 transition-colors duration-200 ${!field.required ? 'font-bold' : 'font-medium'}`}
              autoFocus
            />
          ) : (
            <h3
              className={`text-body cursor-text mb-1 text-gray-800 flex items-center gap-2 ${!field.required ? 'font-bold' : 'font-medium'}`}
              onClick={() => setEditingFieldId(field.id)}
            >
              {field.field_label}
              {field.required && <span className="text-red-600 font-bold">*</span>}
              <span className="text-xs text-gray-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">({field.field_name})</span>
            </h3>
          )}

          {/* Field Input Preview - Compact */}
          <div className="relative mt-2">
            <div className="w-full px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md italic">
              Field input preview...
            </div>
          </div>

          {/* Field Actions - Always visible, compact */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => deleteField(sectionId, field.id)}
              className="text-xs text-red-600 hover:text-white hover:bg-red-500 px-2 py-1 rounded flex items-center gap-1.5 transition-all duration-200 font-bold border border-error-200 hover:border-error-600 shadow-sm"
              title="Delete field"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <div className="flex-1" />
            <label className={`flex items-center gap-2 px-2 py-1 rounded border transition-all duration-200 cursor-pointer shadow-sm ${field.required ? 'bg-secondary-50 border-secondary-200 text-secondary-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => {
                  updateField(sectionId, field.id, { required: e.target.checked })
                }}
                className="w-3.5 h-3.5 text-secondary-600 rounded border-secondary-300 focus:ring-secondary-500/20 accent-secondary-600 cursor-pointer"
              />
              <span className="text-xs font-bold">Required</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FormsDesigner({
  sections,
  onSectionsChange,
  availableFields = [],
  onAddField,
  showFieldPicker = true,
  formTitle: propFormTitle,
  formDescription: propFormDescription,
  onFormTitleChange,
  onFormDescriptionChange
}: FormsDesignerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const activeId = active.id as string
      const overId = over.id as string

      if (activeId.startsWith('section-') && overId.startsWith('section-')) {
        const oldIndex = sections.findIndex((s) => s.id === activeId)
        const newIndex = sections.findIndex((s) => s.id === overId)
        onSectionsChange(arrayMove(sections, oldIndex, newIndex))
      } else if (activeId.startsWith('field-') && overId.startsWith('field-')) {
        // Find which section both fields belong to
        const section = sections.find((s) =>
          s.fields.some((f) => f.id === activeId)
        )
        if (section) {
          const oldIndex = section.fields.findIndex((f) => f.id === activeId)
          const newIndex = section.fields.findIndex((f) => f.id === overId)
          
          const updatedSections = sections.map((s) => {
            if (s.id === section.id) {
              return {
                ...s,
                fields: arrayMove(s.fields, oldIndex, newIndex),
              }
            }
            return s
          })
          onSectionsChange(updatedSections)
        }
      }
    }
  }

  const [formTitle, setFormTitle] = useState(propFormTitle || 'Untitled form')
  const [formDescription, setFormDescription] = useState(propFormDescription || '')
  
  // Sync with props when they change
  useEffect(() => {
    if (propFormTitle !== undefined) {
      setFormTitle(propFormTitle)
    }
  }, [propFormTitle])
  
  useEffect(() => {
    if (propFormDescription !== undefined) {
      setFormDescription(propFormDescription)
    }
  }, [propFormDescription])
  
  const handleTitleChange = (newTitle: string) => {
    setFormTitle(newTitle)
    if (onFormTitleChange) {
      onFormTitleChange(newTitle)
    }
  }
  
  const handleDescriptionChange = (newDescription: string) => {
    setFormDescription(newDescription)
    if (onFormDescriptionChange) {
      onFormDescriptionChange(newDescription)
    }
  }
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(true)
  const [showFieldPickerSidebar, setShowFieldPickerSidebar] = useState(true) // Show by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set()) // Track expanded sections
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')
  const [fieldSourceFilter, setFieldSourceFilter] = useState<string>('all')
  const [fieldCategoryFilter, setFieldCategoryFilter] = useState<string>('all')
  const [expandedEntityGroups, setExpandedEntityGroups] = useState<Set<string>>(new Set())
  const formContainerRef = useRef<HTMLDivElement>(null)

  // Initialize with a default section if empty
  useEffect(() => {
    if (sections.length === 0) {
      const id = `section-${Date.now()}`
      onSectionsChange([{
        id,
        title: 'Untitled Section',
        fields: []
      }])
      setActiveSectionId(id)
      setExpandedSections(new Set([id]))
    } else if (!activeSectionId) {
      const firstId = sections[0].id
      setActiveSectionId(firstId)
      setExpandedSections(new Set([firstId]))
    }
  }, [sections.length, onSectionsChange, activeSectionId])
  
  // Auto-expand active section and collapse others
  useEffect(() => {
    if (activeSectionId) {
      setExpandedSections(new Set([activeSectionId]))
    }
  }, [activeSectionId])

  // Get unique sources and categories from available fields
  const uniqueSources = Array.from(new Set(availableFields.map(f => f.source).filter(Boolean)))
  const uniqueCategories = Array.from(new Set(availableFields.map(f => f.category).filter(Boolean)))

  // Filter available fields by search query, source, and category
  const filteredFields = availableFields.filter(field => {
    const matchesSearch = field.label?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
      field.field_name?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
      field.description?.toLowerCase().includes(fieldSearchQuery.toLowerCase())
    const matchesSource = fieldSourceFilter === 'all' || field.source === fieldSourceFilter
    const matchesCategory = fieldCategoryFilter === 'all' || field.category === fieldCategoryFilter
    return matchesSearch && matchesSource && matchesCategory
  })

  // Check if a field has special configuration (options, depends_on, etc.)
  const isSpecialField = (field: any): boolean => {
    const fieldConfig = field.field_config || {}
    return !!(
      (fieldConfig.options && fieldConfig.options.length > 0) ||
      fieldConfig.depends_on ||
      field.field_type === 'multi_select' ||
      (field.field_type === 'json' && fieldConfig.options && fieldConfig.options.length > 0) ||
      field.field_type === 'select' && fieldConfig.options && fieldConfig.options.length > 0
    )
  }

  // Group entity fields by entity_name and identify special fields
  const groupFieldsByEntity = () => {
    const entityGroups: Record<string, Array<typeof availableFields[0]>> = {}
    const specialFields: Array<typeof availableFields[0]> = []
    const nonEntityFields: Array<typeof availableFields[0]> = []

    filteredFields.forEach(field => {
      // Check if field has special configuration
      if (isSpecialField(field)) {
        specialFields.push(field)
      }
      
      // Check if field has entity_name property or source starts with "entity:"
      const entityName = (field as any).entity_name || (field.source?.startsWith('entity:') ? field.source.replace('entity:', '') : null)
      
      if (entityName) {
        if (!entityGroups[entityName]) {
          entityGroups[entityName] = []
        }
        entityGroups[entityName].push(field)
      } else {
        nonEntityFields.push(field)
      }
    })

    // Add special fields as a separate group
    if (specialFields.length > 0) {
      entityGroups['_special_fields'] = specialFields
    }

    return { entityGroups, nonEntityFields, specialFields }
  }

  const { entityGroups, nonEntityFields, specialFields } = groupFieldsByEntity()

  const toggleEntityGroup = (entityName: string) => {
    const newExpanded = new Set(expandedEntityGroups)
    if (newExpanded.has(entityName)) {
      newExpanded.delete(entityName)
    } else {
      newExpanded.add(entityName)
    }
    setExpandedEntityGroups(newExpanded)
  }

  const addEntityGroup = (entityName: string, sectionId: string) => {
    const entityFields = entityGroups[entityName] || []
    const section = sections.find(s => s.id === sectionId) || sections[0]
    if (!section) return

    let addedCount = 0
    entityFields.forEach(field => {
      if (!section.fields.some(f => f.field_name === field.field_name)) {
        const newField: FormField = {
          id: `field-${Date.now()}-${Math.random()}`,
          field_name: field.field_name,
          field_label: field.label || field.field_name,
          required: false
        }
        const updatedSections = sections.map(s =>
          s.id === sectionId
            ? { ...s, fields: [...s.fields, newField] }
            : s
        )
        onSectionsChange(updatedSections)
        if (onAddField) {
          onAddField(field.field_name, sectionId, newField.id)
        }
        addedCount++
      }
    })

    if (addedCount > 0) {
      showToast.success(`Added ${addedCount} field${addedCount > 1 ? 's' : ''} from ${(entityFields[0] as any)?.entity_label || entityName}`)
    } else {
      showToast.warning(`All fields from ${(entityFields[0] as any)?.entity_label || entityName} are already in this section`)
    }
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSections.length) return
    
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]
    onSectionsChange(newSections)
  }

  const moveField = (sectionId: string, index: number, direction: 'up' | 'down') => {
    const updatedSections = sections.map(section => {
      if (section.id !== sectionId) return section
      
      const newFields = [...section.fields]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= newFields.length) return section
      
      const temp = newFields[index]
      newFields[index] = newFields[targetIndex]
      newFields[targetIndex] = temp
      return { ...section, fields: newFields }
    })
    onSectionsChange(updatedSections.filter((s): s is FormSection => 'fields' in s))
  }

  const addSection = () => {
    const id = `section-${Date.now()}`
    const newSection: FormSection = {
      id,
      title: 'Untitled Section',
      fields: []
    }
    onSectionsChange([...sections, newSection])
    setEditingSectionId(id)
    setActiveSectionId(id)
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
    // Keep sidebar open for quick field selection
    showToast.success(`Added field "${field.label}" to section`)
  }

  const updateSection = (sectionId: string, updates: Partial<FormSection>) => {
    const updatedSections = sections.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    )
    onSectionsChange(updatedSections)
  }

  const updateField = (sectionId: string, fieldId: string, updates: Partial<FormField>) => {
    const updatedSections = sections.map(section =>
      section.id === sectionId
        ? {
            ...section,
            fields: section.fields.map(field =>
              field.id === fieldId ? { ...field, ...updates } : field
            )
          }
        : section
    )
    onSectionsChange(updatedSections)
  }

  const deleteField = (sectionId: string, fieldId: string) => {
    const updatedSections = sections.map(section =>
      section.id === sectionId
        ? { ...section, fields: section.fields.filter(field => field.id !== fieldId) }
        : section
    )
    onSectionsChange(updatedSections)
  }

  const duplicateField = (sectionId: string, fieldId: string) => {
    const section = sections.find(s => s.id === sectionId)
    const field = section?.fields.find(f => f.id === fieldId)
    if (field) {
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
    }
  }

  const deleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      showToast.warning('At least one section is required')
      return
    }
    onSectionsChange(sections.filter(s => s.id !== sectionId))
  }

  const renderFieldInput = (field: FormField) => {
    // Compact Material Design outlined input style
    return (
      <div className="relative mt-2">
        <div className="relative">
          <input
            type="text"
            placeholder=" "
            className="peer w-full px-2 py-1.5 text-xs text-gray-800 border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-primary-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          />
          <label className="absolute left-2 top-1 text-xs text-gray-500 pointer-events-none">
            Field input
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-default" ref={formContainerRef}>
      {/* Material Design Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-md-elevation-1">
        <div className="max-w-4xl mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center shadow-md-elevation-2">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-subheading font-normal border-none outline-none w-full bg-transparent text-gray-800 placeholder:text-gray-500"
              placeholder="Untitled form"
            />
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="text-body text-gray-600 border-none outline-none w-full bg-transparent mt-1 placeholder:text-gray-500"
                  placeholder="Form description"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area with Sidebar - Flex Layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 relative" style={{ minHeight: 'calc(100vh - 120px)' }}>
          {/* Field Picker Sidebar - Matches form content height */}
          {showFieldPicker && availableFields.length > 0 && showFieldPickerSidebar && (
            <div className="w-80 flex-shrink-0">
              <div 
                className="bg-white h-full shadow-md-elevation-8 border-r border-gray-200 flex flex-col sticky"
                style={{ top: '200px', maxHeight: 'calc(100vh - 240px)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 border-b border-primary-200 flex items-center justify-between bg-primary-50">
                <h2 className="text-label flex items-center gap-1.5 text-gray-800">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Fields
                </h2>
                <button
                  onClick={() => setShowFieldPickerSidebar(false)}
                  className="p-1 hover:bg-primary-100 rounded transition-colors duration-200"
                  aria-label="Collapse Fields panel"
                  title="Collapse"
                >
                  <ChevronDown className="w-4 h-4 text-primary-700" />
                </button>
                </div>
                <div className="p-3 border-b border-gray-200 bg-gray-50/50 space-y-2">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="text"
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      placeholder="Search fields..."
                      className="unified-search w-full pl-9 pr-4 py-2 shadow-inner"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Field Definition Source</label>
                      <select
                        value={fieldSourceFilter}
                        onChange={(e) => setFieldSourceFilter(e.target.value)}
                        className="unified-select w-full text-xs h-8"
                      >
                        <option value="all">All Sources</option>
                        {uniqueSources.map(source => (
                          <option key={source} value={source}>
                            {source.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={fieldCategoryFilter}
                        onChange={(e) => setFieldCategoryFilter(e.target.value)}
                        className="unified-select w-full text-xs h-8"
                      >
                        <option value="all">All Categories</option>
                        {uniqueCategories.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {Object.keys(entityGroups).length > 0 || nonEntityFields.length > 0 ? (
                    <>
                      {/* Special Fields Group - Show first */}
                      {entityGroups['_special_fields'] && entityGroups['_special_fields'].length > 0 && (
                        (() => {
                          const specialFieldsGroup = entityGroups['_special_fields']
                          const isExpanded = expandedEntityGroups.has('_special_fields')
                          const activeSection = sections.find(s => s.id === activeSectionId)
                          const fieldsInSection = activeSection ? new Set(activeSection.fields.map((f: any) => typeof f === 'object' ? f.field_name : f)) : new Set()
                          const allFieldsInSection = specialFieldsGroup.every(field => fieldsInSection.has(field.field_name))
                          
                          return (
                            <div key="_special_fields" className="mb-4 border-2 border-purple-200 rounded-lg overflow-hidden bg-purple-50/30">
                              <div 
                                className="p-2 bg-purple-50 border-b border-purple-200 flex items-center justify-between cursor-pointer hover:bg-purple-100 transition-colors"
                                onClick={() => {
                                  const newExpanded = new Set(expandedEntityGroups)
                                  if (isExpanded) {
                                    newExpanded.delete('_special_fields')
                                  } else {
                                    newExpanded.add('_special_fields')
                                  }
                                  setExpandedEntityGroups(newExpanded)
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <ChevronRight className={`w-4 h-4 text-purple-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  <span className="text-sm font-semibold text-purple-800">⭐ Special Fields</span>
                                  <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">({specialFieldsGroup.length})</span>
                                </div>
                                {activeSection && !allFieldsInSection && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      addEntityGroup('_special_fields', activeSection.id)
                                    }}
                                    className="text-xs text-purple-700 hover:text-purple-900 font-medium px-2 py-1 hover:bg-purple-100 rounded transition-colors"
                                  >
                                    Add All
                                  </button>
                                )}
                              </div>
                              {isExpanded && (
                                <div className="p-2 space-y-1 bg-white">
                                  {specialFieldsGroup.map((field, fieldIndex) => {
                                    const isInSection = fieldsInSection.has(field.field_name)
                                    const fieldConfig = (field as any).field_config || {}
                                    const hasOptions = fieldConfig.options && fieldConfig.options.length > 0
                                    const hasDependency = !!fieldConfig.depends_on
                                    const fieldType = field.field_type
                                    
                                    return (
                                      <button
                                        key={`${field.field_name}-${fieldIndex}`}
                                        onClick={() => {
                                          if (activeSectionId) {
                                            addField(activeSectionId, field.field_name)
                                          }
                                        }}
                                        disabled={!activeSectionId || isInSection}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors border-l-2 ${
                                          isInSection
                                            ? 'bg-green-50 text-green-700 cursor-not-allowed border-green-300'
                                            : activeSectionId
                                            ? 'hover:bg-purple-50 text-gray-700 cursor-pointer border-purple-300'
                                            : 'text-gray-400 cursor-not-allowed border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <span className="font-medium">{field.label || field.field_name}</span>
                                            <div className="flex items-center gap-1 mt-0.5">
                                              {hasOptions && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Options</span>
                                              )}
                                              {hasDependency && (
                                                <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">Depends on {fieldConfig.depends_on}</span>
                                              )}
                                              {(fieldType === 'multi_select' || (fieldType === 'json' && hasOptions)) && (
                                                <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded">Multi-select</span>
                                              )}
                                            </div>
                                          </div>
                                          {isInSection && (
                                            <CheckCircle2 className="w-3 h-3 text-green-600 ml-2" />
                                          )}
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })()
                      )}
                      
                      {/* Entity Groups */}
                      {Object.entries(entityGroups)
                        .filter(([entityName]) => entityName !== '_special_fields')
                        .map(([entityName, fields]) => {
                        const entityLabel = fields[0]?.entity_label || entityName
                        const isExpanded = expandedEntityGroups.has(entityName)
                        const activeSection = sections.find(s => s.id === activeSectionId)
                        const fieldsInSection = activeSection ? new Set(activeSection.fields.map((f: any) => typeof f === 'object' ? f.field_name : f)) : new Set()
                        const allFieldsInSection = fields.every(field => fieldsInSection.has(field.field_name))
                        
                        return (
                          <div key={entityName} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                            <div 
                              className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => {
                                const newExpanded = new Set(expandedEntityGroups)
                                if (isExpanded) {
                                  newExpanded.delete(entityName)
                                } else {
                                  newExpanded.add(entityName)
                                }
                                setExpandedEntityGroups(newExpanded)
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                <span className="text-sm font-semibold text-gray-800">{entityLabel}</span>
                                <span className="text-xs text-gray-500">({fields.length})</span>
                              </div>
                              {activeSection && !allFieldsInSection && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    addEntityGroup(entityName, activeSection.id)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                                >
                                  Add All
                                </button>
                              )}
                            </div>
                            {isExpanded && (
                              <div className="p-2 space-y-1">
                                {fields.map((field, fieldIndex) => {
                                  const isInSection = fieldsInSection.has(field.field_name)
                                  const isSpecial = isSpecialField(field)
                                  return (
                                    <button
                                      key={`${field.field_name}-${fieldIndex}`}
                                      onClick={() => {
                                        if (activeSectionId) {
                                          addField(activeSectionId, field.field_name)
                                        }
                                      }}
                                      disabled={!activeSectionId || isInSection}
                                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        isInSection
                                          ? 'bg-green-50 text-green-700 cursor-not-allowed'
                                          : activeSectionId
                                          ? 'hover:bg-blue-50 text-gray-700 cursor-pointer'
                                          : 'text-gray-400 cursor-not-allowed'
                                      } ${isSpecial ? 'border-l-2 border-purple-300' : ''}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          {isSpecial && <span className="text-purple-500">⭐</span>}
                                          <span className="font-medium">{field.label || field.field_name}</span>
                                        </div>
                                        {isInSection && (
                                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                                        )}
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      
                      {/* Non-Entity Fields */}
                      {nonEntityFields.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2">Other Fields</h4>
                          <div className="space-y-1">
                            {nonEntityFields.map((field, fieldIndex) => {
                              const activeSection = sections.find(s => s.id === activeSectionId)
                              const fieldsInSection = activeSection ? new Set(activeSection.fields.map((f: any) => typeof f === 'object' ? f.field_name : f)) : new Set()
                              const isInSection = fieldsInSection.has(field.field_name)
                              return (
                                <button
                                  key={`${field.field_name}-${fieldIndex}`}
                                  onClick={() => {
                                    if (activeSectionId) {
                                      addField(activeSectionId, field.field_name)
                                    }
                                  }}
                                  disabled={!activeSectionId || isInSection}
                                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                    isInSection
                                      ? 'bg-green-50 text-green-700 cursor-not-allowed'
                                      : activeSectionId
                                      ? 'hover:bg-blue-50 text-gray-700 cursor-pointer'
                                      : 'text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{field.label || field.field_name}</span>
                                    {isInSection && (
                                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No fields available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Content - Material Design */}
          <div className="flex-1 max-w-4xl mx-auto px-6 py-8">
            {/* Sections - Material Design Cards */}
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section, sectionIndex) => {
                const isExpanded = expandedSections.has(section.id)
                return (
                  <SortableSection
                    key={section.id}
                    section={section}
                    sectionIndex={sectionIndex}
                    activeSectionId={activeSectionId}
                    setActiveSectionId={(id) => {
                      setActiveSectionId(id)
                      if (id) {
                        // Expand the selected section and collapse others
                        setExpandedSections(new Set([id]))
                      }
                    }}
                    editingSectionId={editingSectionId}
                    setEditingSectionId={setEditingSectionId}
                    updateSection={updateSection}
                    deleteSection={deleteSection}
                    moveSection={moveSection}
                    sectionsCount={sections.length}
                    editingFieldId={editingFieldId}
                    setEditingFieldId={setEditingFieldId}
                    updateField={updateField}
                    deleteField={deleteField}
                    renderFieldInput={renderFieldInput}
                    showFieldPicker={showFieldPicker}
                    availableFields={availableFields}
                    setShowFieldPickerSidebar={setShowFieldPickerSidebar}
                    isExpanded={isExpanded}
                    onToggleExpand={() => {
                      const newExpanded = new Set(expandedSections)
                      if (isExpanded) {
                        newExpanded.delete(section.id)
                      } else {
                        // Collapse all others and expand this one
                        newExpanded.clear()
                        newExpanded.add(section.id)
                        setActiveSectionId(section.id)
                      }
                      setExpandedSections(newExpanded)
                    }}
                  />
                )
              })}
            </SortableContext>

            {/* Add Section Button - Material Design Outlined */}
            <button
              onClick={addSection}
              className="w-full py-2 border-2 border-dashed border-primary-300 rounded-lg text-blue-600 hover:border-blue-500 hover:text-blue-600 hover:bg-primary-50 transition-all duration-200 flex items-center justify-center gap-2 font-medium text-body"
            >
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <span>Add section</span>
            </button>
          </div>
        </div>
      </DndContext>

      {/* Floating Action Button (FAB) - Material Design */}
      {showFloatingToolbar && !showFieldPickerSidebar && (
        <div className="fixed right-6 bottom-6 z-20 flex flex-col gap-2">
              {showFieldPicker && availableFields.length > 0 && (
                <button
                  onClick={() => setShowFieldPickerSidebar(!showFieldPickerSidebar)}
                  className={`w-12 h-9 bg-primary-500 text-white rounded-full shadow-md-elevation-6 hover:shadow-md-elevation-8 hover:bg-blue-600 transition-all duration-200 flex items-center justify-center ${showFieldPickerSidebar ? 'bg-blue-600 ring-2 ring-primary-300' : ''}`}
                  title={showFieldPickerSidebar ? "Hide fields" : "Show fields"}
                >
                  <FileText className="w-5 h-5 text-white" />
                </button>
              )}
          <button
            onClick={addSection}
            className="w-14 h-10 bg-primary-500 text-white rounded-full shadow-md-elevation-6 hover:shadow-md-elevation-8 hover:bg-blue-600 transition-all duration-200 flex items-center justify-center"
            title="Add section"
          >
            <FolderOpen className="w-6 h-6 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
