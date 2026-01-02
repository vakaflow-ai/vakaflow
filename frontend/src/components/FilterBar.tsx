import { ReactNode } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { MaterialButton, MaterialCard } from './material'

interface FilterBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
  onRefresh?: () => void
}

export default function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  actions,
  onRefresh
}: FilterBarProps) {
  return (
    <MaterialCard elevation={1} className="mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center p-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 text-base rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Filters */}
        {filters && (
          <div className="flex items-center gap-3 flex-wrap">
            {filters}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <MaterialButton
              variant="outlined"
              color="neutral"
              size="small"
              onClick={onRefresh}
              startIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </MaterialButton>
          )}
          {actions}
        </div>
      </div>
    </MaterialCard>
  )
}

