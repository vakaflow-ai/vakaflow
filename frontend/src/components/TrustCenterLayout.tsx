import { ReactNode, useState } from 'react'
import { 
  Shield, FileText, Search, Settings, 
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
  onChangeLog?: () => void
  onSettings?: () => void
  searchPlaceholder?: string
  className?: string
  branding?: TrustCenterBranding
}

export default function TrustCenterLayout({
  vendorName,
  sections,
  onReorder,
  onPreview,
  onChangeLog,
  onSettings,
  searchPlaceholder = "Q Search protocol intelligence...",
  className = "",
  branding
}: TrustCenterLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isReordering, setIsReordering] = useState(false)

  // Apply branding colors with defaults
  const primaryColor = branding?.primary_color || '#3b82f6'
  const headerBg = branding?.header_background || '#ffffff'
  const headerTextColor = branding?.header_text_color || '#111827'
  const bodyBg = branding?.sidebar_background || '#f8fafc'
  const sidebarBg = branding?.sidebar_background || '#ffffff'
  const sidebarBorderColor = branding?.sidebar_border_color || '#f1f5f9'
  const secondaryColor = branding?.secondary_color || '#64748b'

  // Sort sections by order
  const sortedSections = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div 
      className={`flex h-screen overflow-hidden ${className}`}
      style={{ 
        backgroundColor: bodyBg,
        fontFamily: branding?.font_family || "'Inter', sans-serif"
      }}
    >
      {/* Professional Sidebar */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} transition-all duration-500 flex flex-col z-30 shadow-2xl shadow-slate-200/50 relative`}
        style={{
          backgroundColor: sidebarBg,
          borderColor: sidebarBorderColor,
          borderRightWidth: '1px'
        }}
      >
        {/* Sidebar Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-50">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 animate-in fade-in duration-500">
              <div className="w-10 h-10 bg-blue-600 rounded-md flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-gray-900 tracking-tight">VAKA Protocol</span>
                <span className="text-xs font-medium text-gray-700 tracking-tight">Trust Matrix</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-primary-50 hover:text-blue-600 transition-all shadow-inner"
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide mt-4">
          {!isSidebarCollapsed && (
            <div className="animate-in slide-in-from-left-4 duration-500">
              <div className="space-y-1">
                <div className="px-4 py-2 text-sm font-medium text-gray-700 tracking-tight mb-2">Editor protocol</div>
                <NavItem icon={<FileText size={18} />} label="Matrix Editor" active primaryColor={primaryColor} />
                <NavItem icon={<Search size={18} />} label="IQ Base (FAQ)" primaryColor={primaryColor} />
                <NavItem icon={<FileText size={18} />} label="Data Vault" primaryColor={primaryColor} />
                <NavItem icon={<Clock size={18} />} label="Audit Updates" primaryColor={primaryColor} />
              </div>
              
              <div className="space-y-1 mt-10">
                <div className="px-4 py-2 text-sm font-medium text-gray-700 tracking-tight mb-2">Inquiry stream</div>
                <NavItem icon={<Shield size={18} />} label="Assessment Stream" primaryColor={primaryColor} />
                <NavItem icon={<Clock size={18} />} label="Live Dialogues" primaryColor={primaryColor} />
              </div>

              <div className="space-y-1 mt-10">
                <div className="px-4 py-2 text-sm font-medium text-gray-700 tracking-tight mb-2">Configuration</div>
                <NavItem icon={<Settings size={18} />} label="System Specs" primaryColor={primaryColor} />
                <NavItem icon={<BarChart3 size={18} />} label="Analytics Hub" primaryColor={primaryColor} />
              </div>
            </div>
          )}
          
          {isSidebarCollapsed && (
            <div className="flex flex-col items-center gap-6 py-2">
              <Shield className="w-6 h-6 text-blue-600" />
              <FileText className="w-6 h-6 text-gray-600" />
              <Search className="w-6 h-6 text-gray-600" />
              <Settings className="w-6 h-6 text-gray-600" />
            </div>
          )}
        </nav>
      </aside>

      {/* Modern Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col relative" style={{ backgroundColor: bodyBg }}>
        {/* Sticky Global Search Header */}
        <div 
          className="sticky top-0 z-20 px-10 h-20 flex items-center justify-between backdrop-blur-xl border-b transition-all"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: sidebarBorderColor
          }}
        >
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="unified-search w-full pl-14 pr-6 h-9 bg-gray-100/50 border-2 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-primary-500/5 transition-all placeholder:text-gray-600"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-gray-200/50 text-xs font-medium text-gray-600 tracking-tight border border-gray-200">⌘ K</div>
          </div>
          
          <div className="flex items-center gap-3">
            {onPreview && (
              <MaterialButton
                variant="outlined"
                size="small"
                color="gray"
                onClick={onPreview}
                className="text-sm font-bold tracking-tight h-10 px-5 border-gray-200 text-gray-600 bg-white rounded-md"
                startIcon={<Eye className="w-4 h-4" />}
              >
                Live Preview
              </MaterialButton>
            )}
            <div className="w-px h-6 bg-gray-200 mx-2" />
            {onSettings && (
              <button
                onClick={onSettings}
                className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-900 hover:text-white transition-all shadow-inner"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Content Grid */}
        <div className="p-10 max-w-6xl mx-auto w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight">{vendorName} Settings</h2>
            </div>
            <p className="text-gray-500 font-medium ml-4 tracking-tight text-[12px]">Configuration Terminal v2.4.0</p>
          </div>

          <div className="grid gap-10">
            {sortedSections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                isReordering={isReordering}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ icon, label, active = false, primaryColor = '#3b82f6' }: { icon: ReactNode; label: string; active?: boolean; primaryColor?: string }) {
  return (
    <div
      className={`px-4 py-3 rounded-lg flex items-center gap-4 cursor-pointer transition-all duration-300 group ${
        active 
          ? 'bg-blue-600 text-white shadow-xl shadow-primary-500/30 font-bold' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <div className={`${active ? 'text-white' : 'text-gray-600 group-hover:text-blue-600'} transition-colors`}>
        {icon}
      </div>
      <span className="text-xs font-bold tracking-tight">{label}</span>
      {active && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      )}
    </div>
  )
}

function SectionCard({ 
  section, 
  isReordering 
}: { 
  section: TrustCenterSection
  index: number
  isReordering: boolean
}) {
  return (
    <MaterialCard 
      elevation={1} 
      className="overflow-hidden border-none bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 group/card rounded-[2rem]"
    >
      {/* Section Header */}
      <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 group-hover/card:bg-white transition-colors">
        <div className="flex items-center gap-5">
          {section.icon && (
            <div className="w-12 h-9 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-md border border-slate-100 group-hover/card:scale-110 transition-transform">
              {section.icon}
            </div>
          )}
          <h3 className="unified-card-title">{section.title}</h3>
        </div>
        <div className="flex items-center gap-3 opacity-0 group-hover/card:opacity-100 transition-all translate-x-4 group-hover/card:translate-x-0">
          {section.actions}
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-all">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="px-10 py-10">
        <div className="animate-in fade-in duration-700">
          {section.content}
        </div>
      </div>
    </MaterialCard>
  )
}

