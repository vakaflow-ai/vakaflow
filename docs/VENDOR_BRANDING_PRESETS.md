# Vendor Portal Branding Presets

## Overview

Professional Material Design-compliant color presets for vendor portal branding. These presets provide ready-to-use color schemes that are visually appealing, accessible, and follow Material Design principles.

## Available Presets

### 1. Professional Blue (Default)
- **ID**: `professional-blue`
- **Description**: Trustworthy and corporate - perfect for enterprise vendors
- **Primary**: Blue (#2196f3)
- **Secondary**: Indigo (#3f51b5)
- **Best For**: Enterprise, corporate, financial services

### 2. Trust Green
- **ID**: `trust-green`
- **Description**: Growth and reliability - ideal for sustainability-focused vendors
- **Primary**: Green (#4caf50)
- **Secondary**: Teal (#009688)
- **Best For**: Sustainability, healthcare, environmental services

### 3. Premium Purple
- **ID**: `premium-purple`
- **Description**: Innovation and creativity - great for tech and creative vendors
- **Primary**: Purple (#9c27b0)
- **Secondary**: Deep Purple (#673ab7)
- **Best For**: Technology, creative agencies, innovation companies

### 4. Corporate Navy
- **ID**: `corporate-navy`
- **Description**: Professional and authoritative - perfect for financial and legal vendors
- **Primary**: Navy Blue (#1976d2)
- **Secondary**: Slate (#607d8b)
- **Best For**: Financial services, legal, consulting

### 5. Energetic Orange
- **ID**: `energetic-orange`
- **Description**: Dynamic and approachable - ideal for service and hospitality vendors
- **Primary**: Orange (#ff9800)
- **Secondary**: Pink (#e91e63)
- **Best For**: Hospitality, retail, consumer services

### 6. Modern Teal
- **ID**: `modern-teal`
- **Description**: Fresh and modern - perfect for digital and SaaS vendors
- **Primary**: Teal (#009688)
- **Secondary**: Light Blue (#03a9f4)
- **Best For**: SaaS, digital services, startups

### 7. Sophisticated Gray
- **ID**: `sophisticated-gray`
- **Description**: Elegant and minimal - ideal for luxury and premium vendors
- **Primary**: Gray (#9e9e9e)
- **Secondary**: Blue Gray (#607d8b)
- **Best For**: Luxury brands, premium services, minimal design

### 8. Vibrant Red
- **ID**: `vibrant-red`
- **Description**: Bold and confident - great for retail and consumer vendors
- **Primary**: Red (#f44336)
- **Secondary**: Orange (#ff9800)
- **Best For**: Retail, consumer goods, e-commerce

## Usage

### In Profile Page
Vendor users can select a preset from the Profile page under "Vendor Portal Branding" section. The preset is applied immediately and saved to localStorage.

### Programmatic Usage

```typescript
import { applyBrandingPreset, getPresetById } from '../lib/branding'

// Apply a preset
const preset = getPresetById('professional-blue')
if (preset) {
  applyBrandingPreset(preset)
}
```

### Component Usage

```tsx
import VendorBrandingSelector from '../components/VendorBrandingSelector'

<VendorBrandingSelector
  currentPresetId="professional-blue"
  onPresetChange={(preset) => {
    // Handle preset change
    console.log('Selected preset:', preset.name)
  }}
/>
```

## Technical Details

- All presets use Material Design color system (50-900 shades)
- Colors are applied via CSS variables for dynamic theming
- Presets are stored in localStorage for persistence
- Tailwind config uses CSS variables for primary/secondary colors
- Material Design elevation and typography are maintained

## Customization

After selecting a preset, vendors can further customize:
- Individual color values (primary, secondary, accent)
- Font family
- Header and sidebar colors
- Button colors

Advanced customization options are available in the Profile page under "Advanced Customization" section.

