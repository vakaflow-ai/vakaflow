import { ReactNode, useState, useEffect } from 'react'
import { 
  Shield, FileText, Search, 
  Eye, Clock, GripVertical, MoreVertical,
  BarChart3, ChevronLeft, ChevronRight
} from 'lucide-react'
import { MaterialCard, MaterialButton } from './material'

interface TrustCenterSection {
  id: string
  title: string
  icon?: ReactNode
  content: ReactNode
  order?: number
  actions?: ReactNode
}

interface TrustCenterBranding {
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  font_family?: string
  header_background?: string
  header_text_color?: string
  sidebar_background?: string
  sidebar_text_color?: string
  sidebar_border_color?: string
  button_primary_color?: string
  button_primary_text_color?: string
}

interface TrustCenterLayoutProps {
  vendorName: string
  sections: TrustCenterSection[]
  onReorder?: (sections: TrustCenterSection[]) => void
  onPreview?: () => void
  searchPlaceholder?: string
  className?: string
  branding?: TrustCenterBranding
  useBranding?: boolean // If false, uses default colors even if branding is provided
  showSidebar?: boolean // If false, hides the sidebar (for use within main Layout)
}

export default function TrustCenterLayout({
  vendorName,
  sections,
  onReorder,
  onPreview,
  searchPlaceholder = "Q Search content",
  className = "",
  branding,
  useBranding = true, // Default to true for public trust center, false for management
  showSidebar = true // Default to true, false when used within main Layout
}: TrustCenterLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isReordering, setIsReordering] = useState(false)

  // Apply branding colors to CSS variables for theme support (only if useBranding is true)
  useEffect(() => {
    if (!useBranding) return // Skip branding application for management page
    
    const root = document.documentElement
    
    // Primary colors
    const primaryColor = branding?.primary_color || '#3b82f6'
    const buttonPrimaryColor = branding?.button_primary_color || branding?.primary_color || '#3b82f6'
    const buttonTextColor = branding?.button_primary_text_color || '#ffffff'
    
    // Background colors
    const headerBg = branding?.header_background || '#ffffff'
    const sidebarBg = branding?.sidebar_background || '#ffffff'
    const bodyBg = branding?.sidebar_background || '#f8fafc'
    
    // Text colors
    const headerTextColor = branding?.header_text_color || '#111827'
    const sidebarTextColor = branding?.sidebar_text_color || '#111827'
    
    // Border colors
    const sidebarBorderColor = branding?.sidebar_border_color || '#e5e7eb'
    
    // Convert hex to HSL for CSS variables if needed, or use directly
    root.style.setProperty('--trust-center-primary', primaryColor)
    root.style.setProperty('--trust-center-button-primary', buttonPrimaryColor)
    root.style.setProperty('--trust-center-button-text', buttonTextColor)
    root.style.setProperty('--trust-center-header-bg', headerBg)
    root.style.setProperty('--trust-center-sidebar-bg', sidebarBg)
    root.style.setProperty('--trust-center-body-bg', bodyBg)
    root.style.setProperty('--trust-center-header-text', headerTextColor)
    root.style.setProperty('--trust-center-sidebar-text', sidebarTextColor)
    root.style.setProperty('--trust-center-border', sidebarBorderColor)
    
    // Also set font family
    if (branding?.font_family) {
      root.style.setProperty('--trust-center-font-family', branding.font_family)
    }
  }, [branding, useBranding])

  // Get theme colors from CSS variables (same as other VAKA pages) when not using branding
  const getThemeColor = (cssVar: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback
    try {
      const root = document.documentElement
      const computed = getComputedStyle(root)
      const value = computed.getPropertyValue(cssVar).trim()
      return value || fallback
    } catch {
      return fallback
    }
  }

  // Apply branding colors with defaults for direct use
  // If useBranding is false, use VAKA theme CSS variables (same as Layout component)
  const primaryColor = useBranding 
    ? (branding?.primary_color || '#3b82f6') 
    : '#3b82f6' // Standard VAKA blue (hsl(217, 91%, 60%))
  
  const headerBg = useBranding 
    ? (branding?.header_background || '#ffffff') 
    : '#ffffff' // White header (same as Layout)
  
  const headerTextColor = useBranding 
    ? (branding?.header_text_color || '#111827') 
    : '#111827' // Dark text (hsl(220, 13%, 18%))
  
  const bodyBg = useBranding 
    ? (branding?.sidebar_background || '#f8fafc') 
    : '#f8fafc' // Light body background
  
  // Sidebar uses dark theme in VAKA (same as Layout component)
  const sidebarBg = useBranding 
    ? (branding?.sidebar_background || '#ffffff') 
    : 'hsl(220, 13%, 18%)' // Dark sidebar (same as Layout --sidebar-bg)
  
  const sidebarTextColor = useBranding
    ? (branding?.sidebar_text_color || '#111827')
    : '#ffffff' // White text on dark sidebar (same as Layout --sidebar-text)
  
  const sidebarBorderColor = useBranding 
    ? (branding?.sidebar_border_color || '#e5e7eb') 
    : 'hsl(220, 13%, 18%)' // Same as sidebar bg for dark theme
  
  const sidebarHoverBg = useBranding
    ? (sidebarBg === '#ffffff' ? '#f3f4f6' : 'rgba(255, 255, 255, 0.1)')
    : 'hsl(220, 13%, 25%)' // Darker hover (same as Layout --sidebar-hover-bg)
  
  const buttonPrimaryColor = useBranding 
    ? (branding?.button_primary_color || branding?.primary_color || '#3b82f6') 
    : '#3b82f6' // Standard VAKA blue
  
  const buttonTextColor = useBranding 
    ? (branding?.button_primary_text_color || '#ffffff') 
    : '#ffffff' // White text on blue button
  
  // Font family only if using branding
  const fontFamily = useBranding ? (branding?.font_family || "'Inter', sans-serif") : "'Inter', sans-serif"

  // Sort sections by order
  const sortedSections = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div 
      className={`flex ${showSidebar ? 'h-screen overflow-hidden' : 'min-h-screen'} ${className}`}
      style={{ 
        backgroundColor: bodyBg,
        fontFamily: fontFamily
      }}
    >
      {/* Professional Sidebar - Only show if showSidebar is true */}
      {showSidebar && (
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} transition-all duration-500 flex flex-col z-30 shadow-xl relative`}
        style={{
          backgroundColor: sidebarBg,
          borderColor: sidebarBorderColor,
          borderRightWidth: '1px',
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Sidebar Brand Header */}
        <div 
          className="h-20 flex items-center justify-between px-6 border-b transition-colors"
          style={{ 
            borderColor: sidebarBorderColor,
            backgroundColor: sidebarBg
          }}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 animate-in fade-in duration-500">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg transition-all"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 4px 14px 0 ${primaryColor}40`
                }}
              >
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span 
                  className="text-[15px] font-semibold tracking-tight"
                  style={{ color: useBranding ? headerTextColor : sidebarTextColor }}
                >
                  VAKA Protocol
                </span>
                <span 
                  className="text-xs font-medium tracking-tight opacity-70"
                  style={{ color: useBranding ? headerTextColor : sidebarTextColor }}
                >
                  Trust Matrix
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
            style={{
              backgroundColor: sidebarHoverBg,
              color: useBranding ? headerTextColor : sidebarTextColor
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide mt-4">
          {!isSidebarCollapsed && (
            <div className="animate-in slide-in-from-left-4 duration-500">
              <div className="space-y-1">
                <div className="px-4 py-2 text-sm font-medium text-gray-700 tracking-tight mb-2">Trust Center</div>
                <NavItem 
                  icon={<FileText size={18} />} 
                  label="Matrix Editor" 
                  active 
                  primaryColor={primaryColor}
                  sidebarBg={sidebarBg}
                  sidebarTextColor={useBranding ? headerTextColor : sidebarTextColor}
                />
                <NavItem 
                  icon={<Shield size={18} />} 
                  label="Assessment Stream" 
                  primaryColor={primaryColor}
                  sidebarBg={sidebarBg}
                  sidebarTextColor={useBranding ? headerTextColor : sidebarTextColor}
                  onClick={() => window.open('/assessments/analytics', '_blank')}
                />
                <NavItem 
                  icon={<Clock size={18} />} 
                  label="Audit Updates" 
                  primaryColor={primaryColor}
                  sidebarBg={sidebarBg}
                  sidebarTextColor={useBranding ? headerTextColor : sidebarTextColor}
                  onClick={() => window.open('/audit', '_blank')}
                />
                <NavItem 
                  icon={<BarChart3 size={18} />} 
                  label="Analytics Hub" 
                  primaryColor={primaryColor}
                  sidebarBg={sidebarBg}
                  sidebarTextColor={useBranding ? headerTextColor : sidebarTextColor}
                  onClick={() => window.open('/analytics', '_blank')}
                />
              </div>
            </div>
          )}
          
          {isSidebarCollapsed && (
            <div className="flex flex-col items-center gap-6 py-2">
              <Shield 
                className="w-6 h-6 transition-colors cursor-pointer hover:scale-110" 
                style={{ color: primaryColor }}
                onClick={() => setIsSidebarCollapsed(false)}
              />
              <FileText 
                className="w-6 h-6 transition-colors cursor-pointer hover:scale-110" 
                style={{ color: useBranding ? headerTextColor : sidebarTextColor, opacity: 0.6 }}
                onClick={() => setIsSidebarCollapsed(false)}
              />
              <BarChart3 
                className="w-6 h-6 transition-colors cursor-pointer hover:scale-110" 
                style={{ color: useBranding ? headerTextColor : sidebarTextColor, opacity: 0.6 }}
                onClick={() => setIsSidebarCollapsed(false)}
              />
            </div>
          )}
        </nav>
      </aside>
      )}

      {/* Modern Main Content Area */}
      <main className={`flex-1 ${showSidebar ? 'overflow-y-auto' : ''} flex flex-col relative`} style={{ backgroundColor: showSidebar ? bodyBg : 'transparent' }}>
        {/* Sticky Global Search Header - Only show if showSidebar is true */}
        {showSidebar && (
        <div 
          className="sticky top-0 z-20 px-10 h-20 flex items-center justify-between backdrop-blur-xl border-b transition-all"
          style={{ 
            backgroundColor: headerBg === '#ffffff' ? 'rgba(255, 255, 255, 0.95)' : `${headerBg}E6`,
            borderColor: sidebarBorderColor,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <div className="flex-1 max-w-2xl relative group">
            <Search 
              className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors" 
              style={{ 
                color: headerTextColor,
                opacity: 0.6
              }}
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="unified-search w-full pl-14 pr-6 h-10 rounded-xl border-2 border-transparent transition-all focus:ring-4 focus:ring-opacity-10"
              style={{
                backgroundColor: headerBg === '#ffffff' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.1)',
                color: headerTextColor,
                borderColor: 'transparent'
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = headerBg === '#ffffff' ? '#ffffff' : 'rgba(255, 255, 255, 0.2)'
                e.target.style.borderColor = primaryColor
                e.target.style.boxShadow = `0 0 0 4px ${primaryColor}15`
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = headerBg === '#ffffff' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.1)'
                e.target.style.borderColor = 'transparent'
                e.target.style.boxShadow = 'none'
              }}
            />
            <div 
              className="absolute right-4 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-medium tracking-tight border"
              style={{
                backgroundColor: headerBg === '#ffffff' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.15)',
                color: headerTextColor,
                borderColor: sidebarBorderColor,
                opacity: 0.7
              }}
            >
              ⌘ K
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {onPreview && (
              <MaterialButton
                variant="outlined"
                size="small"
                onClick={onPreview}
                className="text-sm font-medium tracking-tight h-10 px-5 rounded-xl transition-all hover:scale-105"
                style={{
                  borderColor: sidebarBorderColor,
                  color: headerTextColor,
                  backgroundColor: headerBg === '#ffffff' ? 'transparent' : 'rgba(255, 255, 255, 0.1)'
                }}
                startIcon={<Eye className="w-4 h-4" />}
              >
                Live Preview
              </MaterialButton>
            )}
          </div>
        </div>
        )}

        {/* Header Section - Show when sidebar is hidden */}
        {!showSidebar && (
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-1.5 h-8 rounded-full transition-all"
                  style={{ backgroundColor: primaryColor }}
                />
                <h2 
                  className="text-2xl font-semibold tracking-tight text-gray-900"
                >
                  {vendorName} Settings
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {onPreview && (
                  <MaterialButton
                    variant="outlined"
                    size="small"
                    onClick={onPreview}
                    className="text-sm font-medium tracking-tight h-10 px-5 rounded-xl transition-all hover:scale-105 border-gray-300 text-gray-700 hover:bg-gray-50"
                    startIcon={<Eye className="w-4 h-4" />}
                  >
                    Live Preview
                  </MaterialButton>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content Grid */}
        <div className={`${showSidebar ? 'p-10 max-w-6xl mx-auto' : 'p-6 max-w-7xl mx-auto'} w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700`}>
          {showSidebar && (
            <div className="flex flex-col gap-2 mb-2">
              <div className="flex items-center gap-3">
                <div 
                  className="w-1.5 h-8 rounded-full transition-all"
                  style={{ backgroundColor: primaryColor }}
                />
                <h2 
                  className="text-3xl font-semibold tracking-tight"
                  style={{ color: headerTextColor }}
                >
                  {vendorName} Settings
                </h2>
              </div>
            </div>
          )}

          <div className="grid gap-6">
            {sortedSections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                isReordering={isReordering}
                primaryColor={primaryColor}
                bodyBg={bodyBg}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ 
  icon, 
  label, 
  active = false, 
  primaryColor = '#3b82f6',
  onClick,
  sidebarBg,
  sidebarTextColor
}: { 
  icon: ReactNode
  label: string
  active?: boolean
  primaryColor?: string
  onClick?: () => void
  sidebarBg?: string
  sidebarTextColor?: string
}) {
  const isLight = sidebarBg === '#ffffff' || (!sidebarBg || sidebarBg.includes('255'))
  const isDarkSidebar = sidebarBg && (sidebarBg.includes('hsl(220') || sidebarBg.includes('18%'))
  
  // Get hover background color based on sidebar theme
  const getHoverBg = () => {
    if (isLight) return '#f3f4f6'
    if (isDarkSidebar) {
      return 'hsl(220, 13%, 25%)' // Standard VAKA dark sidebar hover
    }
    return 'rgba(255, 255, 255, 0.1)'
  }
  
  return (
    <div
      onClick={onClick}
      className="px-4 py-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-300 group relative overflow-hidden"
      style={{
        backgroundColor: active ? primaryColor : 'transparent',
        color: active ? '#ffffff' : (sidebarTextColor || '#6b7280')
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = getHoverBg()
          e.currentTarget.style.color = sidebarTextColor || '#111827'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = sidebarTextColor || '#6b7280'
        }
      }}
    >
      <div 
        className="transition-colors"
        style={{ 
          color: active ? '#ffffff' : (sidebarTextColor || '#6b7280')
        }}
      >
        {icon}
      </div>
      <span className="text-xs font-semibold tracking-tight">{label}</span>
      {active && (
        <div 
          className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: '#ffffff' }}
        />
      )}
      {active && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full"
          style={{ backgroundColor: '#ffffff', opacity: 0.3 }}
        />
      )}
    </div>
  )
}

function SectionCard({ 
  section, 
  isReordering,
  primaryColor,
  bodyBg
}: { 
  section: TrustCenterSection
  index: number
  isReordering: boolean
  primaryColor?: string
  bodyBg?: string
}) {
  const isLight = bodyBg === '#ffffff' || bodyBg === '#f8fafc' || !bodyBg
  
  return (
    <MaterialCard 
      elevation={1} 
      className="overflow-hidden border-none transition-all duration-500 group/card rounded-2xl"
      style={{
        backgroundColor: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
        boxShadow: isLight 
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' 
          : '0 1px 3px 0 rgba(0, 0, 0, 0.3)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = isLight
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          : '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isLight
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.3)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Section Header */}
      <div 
        className="px-8 py-6 border-b flex items-center justify-between transition-colors"
        style={{
          borderColor: isLight ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)',
          backgroundColor: isLight ? '#f9fafb' : 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div className="flex items-center gap-4">
          {section.icon && (
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover/card:scale-110"
              style={{
                backgroundColor: primaryColor || '#3b82f6',
                color: '#ffffff',
                boxShadow: `0 4px 6px -1px ${primaryColor || '#3b82f6'}40`
              }}
            >
              {section.icon}
            </div>
          )}
          <h3 className="unified-card-title" style={{ color: isLight ? '#111827' : '#ffffff' }}>
            {section.title}
          </h3>
        </div>
        <div className="flex items-center gap-3 opacity-0 group-hover/card:opacity-100 transition-all translate-x-4 group-hover/card:translate-x-0">
          {section.actions}
          <button 
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{
              color: isLight ? '#6b7280' : 'rgba(255, 255, 255, 0.7)',
              backgroundColor: isLight ? 'transparent' : 'rgba(255, 255, 255, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isLight ? '#f3f4f6' : 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isLight ? 'transparent' : 'rgba(255, 255, 255, 0.05)'
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="px-8 py-8">
        <div className="animate-in fade-in duration-700">
          {section.content}
        </div>
      </div>
    </MaterialCard>
  )
}

