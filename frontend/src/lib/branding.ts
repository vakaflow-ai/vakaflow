// Professional Vendor Portal Branding Presets
// Material Design compliant color palettes

export interface BrandingPreset {
  id: string
  name: string
  description: string
  colors: {
    primary: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string
      600: string
      700: string
      800: string
      900: string
    }
    secondary: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string
      600: string
      700: string
      800: string
      900: string
    }
    accent?: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string
      600: string
      700: string
      800: string
      900: string
    }
  }
}

export const vendorBrandingPresets: BrandingPreset[] = [
  {
    id: 'modern-indigo',
    name: 'Modern Indigo',
    description: 'Contemporary and vibrant - perfect for tech and innovation',
    colors: {
      primary: {
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#6366f1', // Main primary
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
      },
      secondary: {
        50: '#f5f3ff',
        100: '#ede9fe',
        200: '#ddd6fe',
        300: '#c4b5fd',
        400: '#a78bfa',
        500: '#8b5cf6', // Main secondary
        600: '#7c3aed',
        700: '#6d28d9',
        800: '#5b21b6',
        900: '#4c1d95',
      },
    },
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    description: 'Fresh and modern - ideal for healthcare and wellness',
    colors: {
      primary: {
        50: '#f0fdfa',
        100: '#ccfbf1',
        200: '#99f6e4',
        300: '#5eead4',
        400: '#2dd4bf',
        500: '#14b8a6', // Main primary
        600: '#0d9488',
        700: '#0f766e',
        800: '#115e59',
        900: '#134e4a',
      },
      secondary: {
        50: '#ecfeff',
        100: '#cffafe',
        200: '#a5f3fc',
        300: '#67e8f9',
        400: '#22d3ee',
        500: '#06b6d4', // Main secondary
        600: '#0891b2',
        700: '#0e7490',
        800: '#155e75',
        900: '#164e63',
      },
    },
  },
  {
    id: 'forest-emerald',
    name: 'Forest Emerald',
    description: 'Natural and trustworthy - perfect for sustainability and finance',
    colors: {
      primary: {
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981', // Main primary
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b',
      },
      secondary: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e', // Main secondary
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
      },
    },
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    description: 'Premium and sophisticated - ideal for luxury and creative industries',
    colors: {
      primary: {
        50: '#faf5ff',
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#a855f7', // Main primary
        600: '#9333ea',
        700: '#7e22ce',
        800: '#6b21a8',
        900: '#581c87',
      },
      secondary: {
        50: '#fdf4ff',
        100: '#fae8ff',
        200: '#f5d0fe',
        300: '#f0abfc',
        400: '#e879f9',
        500: '#d946ef', // Main secondary
        600: '#c026d3',
        700: '#a21caf',
        800: '#86198f',
        900: '#701a75',
      },
    },
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Energetic and warm - perfect for creative and dynamic teams',
    colors: {
      primary: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316', // Main primary
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12',
      },
      secondary: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444', // Main secondary
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
      },
    },
  },
  {
    id: 'professional-blue',
    name: 'Professional Blue',
    description: 'Classic and trustworthy - perfect for enterprise vendors',
    colors: {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6', // Main primary
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
      },
      secondary: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b', // Main secondary
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
      },
    },
  },
  {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    description: 'Professional and authoritative - perfect for financial and legal vendors',
    colors: {
      primary: {
        50: '#e3f2fd',
        100: '#bbdefb',
        200: '#90caf9',
        300: '#64b5f6',
        400: '#42a5f5',
        500: '#1976d2', // Main primary (darker blue)
        600: '#1565c0',
        700: '#0d47a1',
        800: '#0a3d91',
        900: '#002171',
      },
      secondary: {
        50: '#eceff1',
        100: '#cfd8dc',
        200: '#b0bec5',
        300: '#90a4ae',
        400: '#78909c',
        500: '#607d8b', // Main secondary (slate)
        600: '#546e7a',
        700: '#455a64',
        800: '#37474f',
        900: '#263238',
      },
    },
  },
]

// Default preset
export const defaultVendorPreset = vendorBrandingPresets[0] // Modern Indigo

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

// Import the existing contrast function from utils
import { getContrastTextColor as getContrastTextColorUtil } from '../utils/colors'

// Re-export for convenience
export function getContrastTextColor(backgroundColor: string): string {
  return getContrastTextColorUtil(backgroundColor, '#000000', '#ffffff')
}

// Apply branding preset to CSS variables
export function applyBrandingPreset(preset: BrandingPreset) {
  const root = document.documentElement
  
  // Set primary colors
  Object.entries(preset.colors.primary).forEach(([shade, color]) => {
    root.style.setProperty(`--primary-${shade}`, color)
  })
  
  // Set secondary colors
  Object.entries(preset.colors.secondary).forEach(([shade, color]) => {
    root.style.setProperty(`--secondary-${shade}`, color)
  })
  
  // Set main primary and secondary for Tailwind
  root.style.setProperty('--primary', preset.colors.primary[500])
  root.style.setProperty('--secondary', preset.colors.secondary[500])
  
  // Calculate contrast text colors for primary and secondary
  const primaryTextColor = getContrastTextColor(preset.colors.primary[500])
  const secondaryTextColor = getContrastTextColor(preset.colors.secondary[500])
  root.style.setProperty('--primary-text', primaryTextColor)
  root.style.setProperty('--secondary-text', secondaryTextColor)
  
  // Set vendor branding colors (for vendor users only)
  // Use separate variables to avoid conflicts with tenant branding
  root.style.setProperty('--vendor-primary', preset.colors.primary[500])
  root.style.setProperty('--vendor-secondary', preset.colors.secondary[500])
  root.style.setProperty('--vendor-primary-text', primaryTextColor)
  root.style.setProperty('--vendor-secondary-text', secondaryTextColor)
  
  // Also set tenant-primary for backward compatibility (but only for vendor users)
  // This ensures buttons work, but tenant users won't see vendor colors
  root.style.setProperty('--tenant-primary', preset.colors.primary[500])
  root.style.setProperty('--tenant-secondary', preset.colors.secondary[500])
  root.style.setProperty('--tenant-primary-text', primaryTextColor)
  root.style.setProperty('--tenant-secondary-text', secondaryTextColor)
  
  // Set sidebar and header colors - light backgrounds with dark text
  // Vendor portal uses light backgrounds that work with dark/black fonts
  root.style.setProperty('--sidebar-bg', '#ffffff') // White sidebar background
  root.style.setProperty('--sidebar-header-bg', '#ffffff') // White sidebar header
  root.style.setProperty('--sidebar-text', '#111827') // Dark/black text for light background
  root.style.setProperty('--sidebar-hover-bg', '#f3f4f6') // Light gray hover
  root.style.setProperty('--sidebar-border', '#e5e7eb') // Light border
  
  // Header always white for light background with dark text
  root.style.setProperty('--header-bg', '#ffffff')
  
  // Use dark/black text for white background
  root.style.setProperty('--header-text', '#111827')
  root.style.setProperty('--header-text-color', '#111827')
  
  // Header border - light gray for clean separation
  root.style.setProperty('--header-border', '#e5e7eb')
  
  // Body background - light for dark text
  root.style.setProperty('--body-bg', '#ffffff')
  root.style.setProperty('--body-text-color', '#111827') // Dark text
  root.style.setProperty('--body-text-primary', '#111827') // Dark text
  root.style.setProperty('--body-text-secondary', '#4b5563') // Medium gray
  root.style.setProperty('--body-text-muted', '#6b7280') // Light gray
  
  // Force a reflow to ensure styles are applied
  void root.offsetHeight
  
  // Trigger a custom event so components can react to branding changes
  window.dispatchEvent(new CustomEvent('branding-changed', { 
    detail: { presetId: preset.id, primary: preset.colors.primary[500] }
  }))
}

// Get preset by ID
export function getPresetById(id: string): BrandingPreset | undefined {
  return vendorBrandingPresets.find(preset => preset.id === id)
}

// Initialize with default preset
export function initializeBranding() {
  // Check if there's a saved preset in localStorage
  const savedPresetId = localStorage.getItem('vendor-branding-preset')
  
  if (savedPresetId) {
    const preset = getPresetById(savedPresetId)
    if (preset) {
      applyBrandingPreset(preset)
      return
    }
  }
  
  // Apply default preset
  applyBrandingPreset(defaultVendorPreset)
}

