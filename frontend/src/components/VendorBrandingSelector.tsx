import { useState, useEffect } from 'react'
import { vendorBrandingPresets, applyBrandingPreset, getPresetById, type BrandingPreset } from '../lib/branding'
import { MaterialCard, MaterialButton } from './material'
import { Check, Palette } from 'lucide-react'

interface VendorBrandingSelectorProps {
  onPresetChange?: (preset: BrandingPreset) => void
  currentPresetId?: string
}

export default function VendorBrandingSelector({ 
  onPresetChange,
  currentPresetId 
}: VendorBrandingSelectorProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    currentPresetId || localStorage.getItem('vendor-branding-preset') || 'professional-blue'
  )

  useEffect(() => {
    // Apply the selected preset on mount
    const preset = getPresetById(selectedPresetId)
    if (preset) {
      applyBrandingPreset(preset)
    }
  }, [selectedPresetId])

  const handlePresetSelect = (preset: BrandingPreset) => {
    setSelectedPresetId(preset.id)
    localStorage.setItem('vendor-branding-preset', preset.id)
    // Apply preset immediately
    applyBrandingPreset(preset)
    // Force a small delay to ensure DOM updates
    setTimeout(() => {
      applyBrandingPreset(preset)
    }, 10)
    if (onPresetChange) {
      onPresetChange(preset)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Palette className="w-6 h-6" style={{ color: 'var(--primary-500)' }} />
        <h2 className="text-headline-small font-normal text-gray-900">Vendor Portal Branding</h2>
      </div>
      
      <p className="text-body-medium text-gray-600 mb-6">
        Choose a professional color scheme for your vendor portal. The selected theme will be applied immediately.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendorBrandingPresets.map((preset) => {
          const isSelected = selectedPresetId === preset.id
          
          return (
            <MaterialCard
              key={preset.id}
              elevation={isSelected ? 4 : 1}
              hover
              className="cursor-pointer p-4 border-2 transition-all duration-200"
              style={{
                borderColor: isSelected ? 'var(--primary-500)' : '#e5e7eb',
                boxShadow: isSelected ? '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)' : undefined
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--primary-300)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }
              }}
              onClick={() => handlePresetSelect(preset)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-title-medium font-medium text-gray-900 mb-1">
                    {preset.name}
                  </h3>
                  <p className="text-body-small text-gray-600">
                    {preset.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0 ml-2">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--primary-500)' }}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Color Preview */}
              <div className="flex gap-2 mt-4">
                <div 
                  className="flex-1 h-9 rounded-lg shadow-sm"
                  style={{ backgroundColor: preset.colors.primary[500] }}
                />
                <div 
                  className="flex-1 h-9 rounded-lg shadow-sm"
                  style={{ backgroundColor: preset.colors.secondary[500] }}
                />
              </div>
              
              {/* Color Palette Preview */}
              <div className="mt-3 flex gap-1">
                {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                  <div
                    key={shade}
                    className="flex-1 h-6 rounded"
                    style={{ backgroundColor: preset.colors.primary[shade as keyof typeof preset.colors.primary] }}
                    title={`Primary ${shade}`}
                  />
                ))}
              </div>
            </MaterialCard>
          )
        })}
      </div>

      <div 
        className="mt-6 p-4 rounded-lg"
        style={{ 
          backgroundColor: 'var(--primary-50)', 
          borderColor: 'var(--primary-200)',
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      >
        <p 
          className="text-body-small"
          style={{ color: 'var(--primary-900)' }}
        >
          <strong>Tip:</strong> The selected branding will be saved and applied automatically when you return to the portal.
        </p>
        {/* Visual test to verify colors are working */}
        <div className="mt-4 flex gap-2 items-center flex-wrap">
          <div className="text-xs text-gray-600">Color Test (CSS Variables):</div>
          <div 
            className="w-8 h-8 rounded border" 
            style={{ backgroundColor: 'var(--primary-500)' }}
            title="Primary 500"
          ></div>
          <div 
            className="w-8 h-8 rounded border" 
            style={{ backgroundColor: 'var(--primary-600)' }}
            title="Primary 600"
          ></div>
          <div 
            className="w-8 h-8 rounded border" 
            style={{ backgroundColor: 'var(--secondary-500)' }}
            title="Secondary 500"
          ></div>
          <div className="text-xs text-gray-600 ml-2">
            (These should match the preset colors above)
          </div>
        </div>
        <div className="mt-2 flex gap-2 items-center flex-wrap">
          <div className="text-xs text-gray-600">Tailwind Classes:</div>
          <div className="w-8 h-8 bg-primary-500 rounded border"></div>
          <div className="w-8 h-8 bg-blue-600 rounded border"></div>
          <div className="w-8 h-8 bg-secondary-500 rounded border"></div>
        </div>
      </div>
    </div>
  )
}

