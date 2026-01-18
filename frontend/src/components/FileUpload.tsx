import { useState, useRef } from 'react'
import { agentsApi } from '../lib/agents'

interface FileUploadProps {
  agentId: string
  artifactType?: string
  onUploadComplete?: () => void
}

export default function FileUpload({ agentId, artifactType = 'DOCUMENTATION', onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setUploading(false)
    setProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      // Show immediate progress
      setProgress(30)
      
      await agentsApi.uploadArtifact(agentId, file, artifactType)
      
      // Show completion
      setProgress(100)
      
      // Reset after delay
      setTimeout(resetState, 500)
      onUploadComplete?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed')
      resetState()
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded compact-button-secondary cursor-pointer ${
          uploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {uploading ? 'Uploading...' : 'Upload File'}
      </label>

      {uploading && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
    </div>
  )
}

