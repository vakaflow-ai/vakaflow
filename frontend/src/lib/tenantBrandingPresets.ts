// Tenant Branding Color Scheme Presets
// Three-level structure: Left Panel, Headers, Buttons

export interface TenantBrandingPreset {
  id: string
  name: string
  description: string
  preview: {
    leftPanel: string
    header: string
    button: string
  }
  colorSwatches: {
    primary: string[]
    secondary: string[]
  }
  leftPanel: {
    background_color: string
    font_family: string
    font_size: string
    font_color: string
  }
  headers: {
    background_color: string
    font_family: string
    font_size: string
    font_color: string
  }
  buttons: {
    primary: {
      background_color: string
      font_family: string
      font_size: string
      font_color: string
    }
    secondary: {
      background_color: string
      font_family: string
      font_size: string
      font_color: string
    }
  }
  sidebar_hover_background: string
}

export const tenantBrandingPresets: TenantBrandingPreset[] = [
  {
    id: 'professional-dark',
    name: 'Professional Dark',
    description: 'Modern and professional - perfect for enterprise use',
    preview: {
      leftPanel: '#1e293b',
      header: '#1e293b',
      button: '#475569',
    },
    colorSwatches: {
      primary: ['#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617'],
      secondary: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
    },
    leftPanel: {
      background_color: '#1e293b',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '14px',
      font_color: '#cbd5e1',
    },
    headers: {
      background_color: '#1e293b', // Same as logo
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '16px',
      font_color: '#ffffff',
    },
    buttons: {
      primary: {
        background_color: '#475569',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
      secondary: {
        background_color: '#64748b',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
    },
    sidebar_hover_background: '#334155',
  },
  {
    id: 'light-modern',
    name: 'Light Modern',
    description: 'Clean and accessible - ideal for modern workspaces',
    preview: {
      leftPanel: '#f1f5f9',
      header: '#ffffff',
      button: '#334155',
    },
    colorSwatches: {
      primary: ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b'],
      secondary: ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b'],
    },
    leftPanel: {
      background_color: '#f1f5f9',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '14px',
      font_color: '#1e293b', // Dark text for good contrast
    },
    headers: {
      background_color: '#ffffff', // Same as logo - white with dark text
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '16px',
      font_color: '#0f172a', // Very dark text for white background
    },
    buttons: {
      primary: {
        background_color: '#334155', // Darker button for better visibility
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
      secondary: {
        background_color: '#475569',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
    },
    sidebar_hover_background: '#e2e8f0',
  },
  {
    id: 'light-classic',
    name: 'Light Classic',
    description: 'Traditional and clean - perfect for corporate environments',
    preview: {
      leftPanel: '#ffffff',
      header: '#ffffff',
      button: '#1e40af',
    },
    colorSwatches: {
      primary: ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b'],
      secondary: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
    },
    leftPanel: {
      background_color: '#ffffff',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '14px',
      font_color: '#1e293b',
    },
    headers: {
      background_color: '#ffffff',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '16px',
      font_color: '#0f172a',
    },
    buttons: {
      primary: {
        background_color: '#1e40af',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
      secondary: {
        background_color: '#3b82f6',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
    },
    sidebar_hover_background: '#f1f5f9',
  },
  {
    id: 'slate-professional',
    name: 'Slate Professional',
    description: 'Sophisticated slate theme - elegant and minimal',
    preview: {
      leftPanel: '#334155',
      header: '#334155',
      button: '#475569',
    },
    colorSwatches: {
      primary: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
      secondary: ['#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617'],
    },
    leftPanel: {
      background_color: '#334155',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '14px',
      font_color: '#e2e8f0',
    },
    headers: {
      background_color: '#334155',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '16px',
      font_color: '#ffffff',
    },
    buttons: {
      primary: {
        background_color: '#475569',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
      secondary: {
        background_color: '#64748b',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
    },
    sidebar_hover_background: '#475569',
  },
  {
    id: 'navy-corporate',
    name: 'Navy Corporate',
    description: 'Deep navy theme - authoritative and professional',
    preview: {
      leftPanel: '#1e3a8a',
      header: '#1e3a8a',
      button: '#2563eb',
    },
    colorSwatches: {
      primary: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
      secondary: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
    },
    leftPanel: {
      background_color: '#1e3a8a',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '14px',
      font_color: '#dbeafe',
    },
    headers: {
      background_color: '#1e3a8a',
      font_family: 'Inter, system-ui, sans-serif',
      font_size: '16px',
      font_color: '#ffffff',
    },
    buttons: {
      primary: {
        background_color: '#2563eb',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
      secondary: {
        background_color: '#3b82f6',
        font_family: 'Inter, system-ui, sans-serif',
        font_size: '14px',
        font_color: '#ffffff',
      },
    },
    sidebar_hover_background: '#1e40af',
  },
]

export const defaultTenantPreset = tenantBrandingPresets[0] // Professional Dark

