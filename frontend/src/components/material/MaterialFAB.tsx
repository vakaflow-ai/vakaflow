import { ButtonHTMLAttributes, ReactNode } from 'react'

interface MaterialFABProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'primary' | 'neutral' | 'error'
  size?: 'small' | 'medium' | 'large'
  extended?: boolean
  children?: ReactNode
}

export default function MaterialFAB({
  color = 'primary',
  size = 'medium',
  extended = false,
  className,
  children,
  ...props
}: MaterialFABProps) {
  return (
    <button {...props}>
      {children && <span>{children}</span>}
    </button>
  )
}

