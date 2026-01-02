# Two-Color Design System

## Overview
The VAKA platform uses a simplified two-color design system for a clean, professional, and maintainable UI.

## Color Palette

### Primary Color (Blue)
- **Purpose**: Main brand color, actions, highlights, active states
- **Usage**: Buttons, links, active navigation items, progress bars, focus states
- **Values**:
  - Default: `hsl(217, 91%, 60%)` - Main primary color
  - Light: `hsl(217, 91%, 96%)` - Light backgrounds, hover states
  - Dark: `hsl(217, 91%, 50%)` - Hover states, pressed buttons
  - Foreground: `hsl(0, 0%, 100%)` - White text on primary backgrounds

### Neutral Color (Gray)
- **Purpose**: Backgrounds, text, borders, secondary elements
- **Usage**: Sidebars, cards, text, borders, inactive states
- **Values**:
  - Default: `hsl(220, 13%, 18%)` - Main neutral color
  - Light: `hsl(220, 13%, 96%)` - Light backgrounds, hover states
  - Dark: `hsl(220, 13%, 10%)` - Dark backgrounds, hover states
  - Foreground: `hsl(0, 0%, 100%)` - White text on neutral backgrounds

## Design Principles

1. **Simplicity**: Only two main colors reduce cognitive load and improve consistency
2. **Accessibility**: All color combinations meet WCAG AA contrast requirements
3. **Flat Design**: No shadows, borders, or gradients - clean and modern
4. **Consistency**: Same color usage patterns across all components

## Usage Guidelines

### Primary Color Usage
- ✅ Action buttons (primary actions)
- ✅ Active navigation items
- ✅ Links and interactive elements
- ✅ Progress indicators
- ✅ Focus states
- ✅ Success states (using primary)
- ✅ Important highlights

### Neutral Color Usage
- ✅ Backgrounds (cards, surfaces)
- ✅ Text (body text, secondary text)
- ✅ Sidebars and navigation
- ✅ Borders and dividers
- ✅ Inactive states
- ✅ Secondary buttons

### Status Colors
- **Success**: Use primary color (blue)
- **Error**: Use destructive color (red) - only for errors
- **Warning**: Use neutral color variations
- **Info**: Use primary color (blue)

## Component Examples

### Buttons
```tsx
// Primary action
<button className="compact-button-primary">Save</button>

// Secondary action
<button className="compact-button-secondary">Cancel</button>

// Outline
<button className="compact-button-outline">More Info</button>
```

### Cards
```tsx
<div className="compact-card">
  {/* Content */}
</div>
```

### Status Badges
```tsx
<span className="status-badge-success">Active</span>
<span className="status-badge-error">Error</span>
<span className="status-badge-warning">Pending</span>
```

## Migration Notes

When updating components:
1. Replace all color variations (50-900 shades) with primary/neutral
2. Use `primary` for actions and highlights
3. Use `neutral` for backgrounds and text
4. Remove all shadow classes
5. Remove all border classes (unless absolutely necessary)
6. Use consistent spacing (8px grid)

## Tailwind Classes

### Available Color Classes
- `bg-primary`, `text-primary`, `bg-primary-light`, `bg-primary-dark`
- `bg-neutral`, `text-neutral`, `bg-neutral-light`, `bg-neutral-dark`
- `bg-background`, `text-foreground`
- `bg-card`, `text-card-foreground`
- `bg-muted`, `text-muted-foreground`

### Typography Classes
- `text-display` - 24px heading
- `text-heading` - 18px heading
- `text-title` - 16px title
- `text-body` - 14px body text
- `text-label` - 12px label
- `text-caption` - 11px caption

### Spacing Classes
- `p-xs`, `p-sm`, `p-md`, `p-lg`, `p-xl`, `p-2xl`
- `m-xs`, `m-sm`, `m-md`, `m-lg`, `m-xl`, `m-2xl`
- `gap-xs`, `gap-sm`, `gap-md`, `gap-lg`, `gap-xl`

