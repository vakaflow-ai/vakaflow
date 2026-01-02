import { ReactNode } from 'react'
import { MaterialCard } from './material'

interface SummaryCard {
  label: string
  value: string | number
  icon: ReactNode
  color?: 'primary' | 'neutral' | 'error'
  onClick?: () => void
}

interface SummaryCardsProps {
  cards: SummaryCard[]
  columns?: 2 | 3 | 4
}

export default function SummaryCards({ cards, columns = 4 }: SummaryCardsProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    neutral: 'bg-neutral-light text-neutral-dark',
    success: 'bg-primary-light text-primary-dark',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-destructive/10 text-destructive'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-6 mb-8`}>
      {cards.map((card, index) => (
        <MaterialCard
          key={index}
          elevation={2}
          hover={!!card.onClick}
          className={`p-6 cursor-pointer transition-all ${card.onClick ? 'hover:shadow-md-elevation-4' : ''}`}
          onClick={card.onClick}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[card.color || 'primary']}`}>
              {card.icon}
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">
            {card.value}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {card.label}
          </div>
        </MaterialCard>
      ))}
    </div>
  )
}

