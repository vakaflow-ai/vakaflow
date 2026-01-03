import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDown, X, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface SearchableSelectProps {
  value?: string | number | null
  onChange: (value: string | number | null) => void
  options: SearchableSelectOption[]
  placeholder?: string
  label?: string
  error?: boolean
  errorText?: string
  disabled?: boolean
  required?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  fullWidth?: boolean
  allowClear?: boolean
  startAdornment?: ReactNode
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  error = false,
  errorText,
  disabled = false,
  required = false,
  searchPlaceholder = 'Search or select...',
  emptyMessage = 'No options found',
  className,
  fullWidth = true,
  allowClear = false,
  startAdornment,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)
  const displayValue = selectedOption?.label || ''

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    !option.disabled &&
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault()
        const option = filteredOptions[highlightedIndex]
        if (option && !option.disabled) {
          handleSelect(option.value)
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, highlightedIndex, filteredOptions])

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const optionElement = dropdownRef.current.children[highlightedIndex] as HTMLElement
      if (optionElement) {
        optionElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex])

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setSearchTerm('')
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearchTerm('')
      }
    }
  }

  const hasError = error || !!errorText

  return (
    <div className={cn('space-y-2', fullWidth ? 'w-full' : 'inline-block w-auto', className)}>
      {label && (
        <label className={cn(
          'text-sm font-medium leading-none block text-slate-700',
          hasError && 'text-destructive'
        )}>
          {label}
          {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
        </label>
      )}
      
      <div ref={containerRef} className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            'w-full h-10 px-3 py-2 text-sm rounded-md border bg-white',
            'flex items-center justify-between gap-2',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            disabled
              ? 'cursor-not-allowed opacity-50 bg-muted/50 border-slate-300'
              : 'cursor-pointer',
            hasError
              ? 'border-destructive focus:ring-destructive/20 focus:border-destructive'
              : 'border-slate-300 hover:border-slate-400 focus:ring-primary/20 focus:border-primary',
            startAdornment && 'pl-10'
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label || placeholder}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {startAdornment && (
              <span className="text-slate-400 flex items-center flex-shrink-0">
                {startAdornment}
              </span>
            )}
            <span className={cn(
              'truncate text-left flex-1',
              !displayValue && 'text-slate-400'
            )}>
              {displayValue || placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {allowClear && value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <ChevronDown
              className={cn(
                'w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0',
                isOpen && 'transform rotate-180'
              )}
            />
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg"
            style={{ maxHeight: '300px' }}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-slate-200 sticky top-0 bg-white rounded-t-md">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setHighlightedIndex(-1)
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
              {filteredOptions.length > 0 ? (
                <ul role="listbox" className="py-1">
                  {filteredOptions.map((option, index) => {
                    const isSelected = option.value === value
                    const isHighlighted = index === highlightedIndex
                    
                    return (
                      <li
                        key={option.value}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => !option.disabled && handleSelect(option.value)}
                        className={cn(
                          'px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors',
                          'select-none',
                          isHighlighted && 'bg-slate-100',
                          isSelected && 'bg-primary/10 text-primary font-medium',
                          !isSelected && !isHighlighted && 'hover:bg-slate-50',
                          option.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                        {!isSelected && (
                          <span className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{option.label}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="px-3 py-6 text-sm text-center text-slate-500">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {errorText && (
        <p className="text-sm text-destructive mt-1">
          {errorText}
        </p>
      )}
    </div>
  )
}

