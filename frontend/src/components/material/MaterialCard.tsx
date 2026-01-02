import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MaterialCardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24
  hover?: boolean
  children: ReactNode
}

export default function MaterialCard({
  elevation = 0,
  hover = false,
  className,
  children,
  ...props
}: MaterialCardProps) {
  const elevationMap = {
    0: "shadow-none border-border/50",
    1: "shadow-sm border-border",
    2: "shadow border-border",
    3: "shadow-md border-border",
    4: "shadow-lg border-border",
    6: "shadow-xl border-border",
    8: "shadow-2xl border-border",
    12: "shadow-2xl border-border",
    16: "shadow-2xl border-border",
    24: "shadow-2xl border-border"
  }

  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border",
        "transition-all duration-300 ease-in-out",
        elevationMap[elevation] || elevationMap[0],
        hover && "hover:shadow-lg hover:-translate-y-0.5 hover:border-ring/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
