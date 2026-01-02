import { useState, useEffect } from 'react'
import { agentsApi } from '../lib/agents'
import MermaidDiagram from './MermaidDiagram'

interface ConnectionDiagramProps {
  agentId: string
  diagram: string | null | undefined
  canEdit?: boolean
  onUpdate?: () => void
}

export default function ConnectionDiagram({ agentId, diagram, canEdit = false, onUpdate }: ConnectionDiagramProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedDiagram, setEditedDiagram] = useState(diagram || '')
  const [isSaving, setIsSaving] = useState(false)

  // Sync editedDiagram with diagram prop when it changes (but not when editing)
  useEffect(() => {
    if (!isEditing && diagram !== undefined) {
      setEditedDiagram(diagram || '')
    }
  }, [diagram, isEditing])

  const handleSave = async () => {
    if (!canEdit) {
      alert('You do not have permission to edit this diagram.')
      return
    }
    
    setIsSaving(true)
    try {
      await agentsApi.updateConnectionDiagram(agentId, editedDiagram)
      setIsEditing(false)
      if (onUpdate) {
        onUpdate()
      }
      // Update local state to reflect the saved diagram
      setEditedDiagram(editedDiagram)
    } catch (error: any) {
      console.error('Failed to update diagram:', error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update diagram. Please try again.'
      alert(`Failed to update diagram: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedDiagram(diagram || '')
    setIsEditing(false)
  }

  if (!diagram && !isEditing) {
    return (
      <div className="compact-card">
        <h3 className="text-lg font-medium mb-4">Connection Diagram</h3>
        <p className="text-sm text-muted-foreground">No connection diagram available.</p>
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 compact-button-primary"
          >
            + Add Diagram
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="compact-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Connection Diagram</h3>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm compact-button-secondary"
          >
            Edit Diagram
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={editedDiagram}
            onChange={(e) => setEditedDiagram(e.target.value)}
            placeholder="Enter Mermaid diagram code..."
            className="w-full min-h-[300px] p-3 border rounded font-mono text-sm"
            style={{ fontFamily: 'monospace' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="compact-button-primary"
            >
              {isSaving ? 'Saving...' : 'Save Diagram'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="compact-button-secondary"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter Mermaid diagram syntax. The diagram will be rendered automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <MermaidDiagram diagram={diagram || ''} id={`connection-diagram-${agentId}`} />
          <div className="bg-muted p-4 rounded">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> This diagram shows the agent's connections to external systems as submitted.
              {canEdit && ' You can edit this diagram if needed.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

