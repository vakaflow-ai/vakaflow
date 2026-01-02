# Unified Style System Guide

This document defines the unified style system for all UI components across the VAKA Agent Platform.

## Typography

### Font Family
- **Primary**: Inter
- **Fallback**: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif
- Applied globally to all text elements

### Text Sizes & Weights

#### Headings
- **H1**: 24px (text-2xl), semibold, for main page titles
- **H2**: 18px (text-lg), semibold, for section titles
- **H3**: 16px (text-base), semibold, for subsections
- **H4-H6**: Decreasing sizes with semibold weight

#### Body Text
- **Primary Body**: 12px (text-sm), normal weight (400)
- **Secondary Body**: 12px (text-sm), normal weight (400), muted color
- **Caption**: 11px (text-xs), normal weight (400)

#### Labels
- **Standard Label**: 12px (text-sm), medium weight (500)
- Use `.text-label` class or `text-sm font-medium`

#### Buttons
- **All Buttons**: Normal weight (400), NO bold
- Small: 11px (text-xs)
- Medium: 12px (text-sm) - **Standard**
- Large: 14px (text-base)

#### Tables
- **Headers**: 11px (text-xs), semibold, blue color
- **Primary Cells**: 12px (text-sm), normal weight
- **Secondary Cells**: 12px (text-sm), normal weight, muted color
- **Meta Cells**: 11px (text-xs), normal weight, muted color

### CSS Classes

#### Typography Classes
```css
.text-heading      /* 16px, semibold - for section headings */
.text-subheading   /* 14px, medium - for subsections */
.text-body         /* 12px, normal - for body text */
.text-caption      /* 11px, normal - for captions */
.text-label        /* 12px, medium - for form labels */
```

#### Table Classes
```css
.table-header          /* 11px, semibold, blue - table headers */
.table-cell-primary    /* 12px, normal - primary table cells */
.table-cell-secondary  /* 12px, normal, muted - secondary cells */
.table-cell-meta       /* 11px, normal, muted - metadata cells */
```

#### Page Structure Classes
```css
.unified-page-title      /* 24px, semibold - main page titles */
.unified-page-subtitle   /* 12px, normal, muted - page subtitles */
.unified-section-title   /* 18px, semibold - section headings */
```

#### Form Classes
```css
.unified-filter    /* Standardized filter inputs - 12px, normal weight */
.unified-select    /* Standardized select dropdowns - 12px, normal weight */
.unified-search    /* Standardized search inputs - 12px, normal weight */
.unified-menu-item /* Standardized menu items - 12px, normal weight */
```

#### Card Classes
```css
.unified-card-title     /* 16px, semibold - for card titles */
.unified-card-subtitle  /* 12px, normal - for card subtitles */
```

#### Navigation Classes
```css
.unified-group-menu  /* 11px, medium - for parent menu groups (smaller) */
.unified-sub-menu     /* 14px, normal - for child menu items (larger) */
```

## Buttons

### Font Weight
- **ALL buttons use `font-normal` (400)** - NO bold text
- MaterialButton component enforces this globally

### Sizes
- Small: `text-xs` (11px)
- Medium: `text-sm` (12px) - **Standard**
- Large: `text-base` (14px)

### Variants
- Contained: Solid background, white text
- Outlined: Border, colored text
- Text: No border, colored text

## Input Fields

### Text Size
- **All inputs**: `text-sm` (12px)
- **Font weight**: Normal (400)
- Use `MaterialInput` component for consistency

### Standard Classes
- `.unified-filter` - For filter/search inputs
- `.unified-select` - For dropdown selects

## Tables

### Headers
- Use `.table-header` class
- 11px, semibold, blue color
- Background: Light blue (hsl(217 91% 92%))

### Cells
- Primary: `.table-cell-primary` - 12px, normal weight
- Secondary: `.table-cell-secondary` - 12px, normal weight, muted
- Meta: `.table-cell-meta` - 11px, normal weight, muted

## Colors

### Primary Colors
- Primary Blue: `hsl(217 91% 60%)`
- Primary Light: `hsl(217 91% 92%)` - for backgrounds

### Text Colors
- Foreground: `hsl(var(--foreground))` - main text
- Muted: `hsl(var(--muted-foreground))` - secondary text
- Primary: `hsl(var(--primary))` - links, headers

### Status Colors
- Success: Green
- Warning: Yellow/Orange
- Error: Red
- Info: Blue

## Spacing

### Standard Padding
- Buttons: `px-4 py-2` (medium)
- Inputs: `px-3 py-2`
- Table cells: `px-3 py-1.5` or `px-6 py-2`

## Best Practices

1. **Never use bold on buttons** - Always `font-normal`
2. **Use unified classes** - Prefer `.table-header`, `.table-cell-primary`, etc.
3. **Consistent text sizes** - 12px for body, 11px for headers/captions
4. **Use Material components** - MaterialButton, MaterialInput for consistency
5. **Page titles** - Use `.unified-page-title` for main titles
6. **Section titles** - Use `.unified-section-title` for sections

## Migration Checklist

When updating components:
- [ ] Replace button text with `font-normal` (remove bold)
- [ ] Use `.table-header` for table headers
- [ ] Use `.table-cell-primary` / `.table-cell-secondary` for cells
- [ ] Use `.unified-page-title` for page titles
- [ ] Use `.unified-section-title` for section headings
- [ ] Use `.unified-card-title` for card titles
- [ ] Use `.unified-select` / `.unified-filter` / `.unified-search` for form inputs
- [ ] Use `.unified-group-menu` for parent menu items (11px)
- [ ] Use `.unified-sub-menu` for child menu items (14px)
- [ ] Ensure all text is 12px (text-sm) for body, 11px for headers
- [ ] Remove any hardcoded font weights on buttons
- [ ] Remove `font-medium` or `font-semibold` from search/filter inputs

