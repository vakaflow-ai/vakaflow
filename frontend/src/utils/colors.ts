/**
 * Calculate the relative luminance of a color
 * Based on WCAG 2.1 guidelines
 * @param color - Hex color string (e.g., "#ffffff" or "rgb(255, 255, 255)")
 * @returns Luminance value between 0 and 1
 */
export function getLuminance(color: string): number {
  // Convert hex to RGB
  let r: number, g: number, b: number
  
  if (color.startsWith('#')) {
    // Hex color
    const hex = color.slice(1)
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  } else if (color.startsWith('rgb')) {
    // RGB color
    const matches = color.match(/\d+/g)
    if (matches && matches.length >= 3) {
      r = parseInt(matches[0], 10)
      g = parseInt(matches[1], 10)
      b = parseInt(matches[2], 10)
  } else {
      // Default to white if parsing fails
      return 1
    }
  } else if (color.startsWith('rgba')) {
    // RGBA color - extract RGB values
    const matches = color.match(/\d+/g)
    if (matches && matches.length >= 3) {
      r = parseInt(matches[0], 10)
      g = parseInt(matches[1], 10)
      b = parseInt(matches[2], 10)
    } else {
      return 1
    }
  } else {
    // Try to parse as CSS variable or other format
    // Default to white if we can't parse
    return 1
  }
  
  // Normalize RGB values to 0-1 range
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  
  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Get appropriate text color (black or white) based on background color
 * @param backgroundColor - Background color string (hex, rgb, rgba, or CSS variable)
 * @param lightText - Color to use for light backgrounds (default: '#000000')
 * @param darkText - Color to use for dark backgrounds (default: '#ffffff')
 * @returns Appropriate text color
 */
export function getContrastTextColor(
  backgroundColor: string | undefined | null,
  lightText: string = '#000000',
  darkText: string = '#ffffff'
): string {
  if (!backgroundColor) {
    return lightText // Default to dark text on undefined background
  }
  
  // Handle CSS variables - use a temporary element to get computed color
  if (backgroundColor.startsWith('var(') || backgroundColor.startsWith('--')) {
    try {
      // Create a temporary element to resolve CSS variables
      const tempEl = document.createElement('div')
      tempEl.style.backgroundColor = backgroundColor
      tempEl.style.position = 'absolute'
      tempEl.style.visibility = 'hidden'
      tempEl.style.pointerEvents = 'none'
      document.body.appendChild(tempEl)
      
      const computedBg = getComputedStyle(tempEl).backgroundColor
      document.body.removeChild(tempEl)
      
      // Check if we got a valid color (not transparent or invalid)
      if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
        backgroundColor = computedBg
      } else {
        // Try to extract fallback from var() if available
        if (backgroundColor.startsWith('var(')) {
          const match = backgroundColor.match(/var\([^,)]+,\s*([^)]+)\)/)
          if (match && match[1]) {
            backgroundColor = match[1].trim()
          } else {
            return lightText
          }
        } else {
          return lightText
        }
      }
    } catch (e) {
      return lightText
    }
  }
  
  // Handle rgba with opacity - extract base color
  if (backgroundColor.includes('rgba')) {
    const matches = backgroundColor.match(/\d+/g)
    if (matches && matches.length >= 3) {
      backgroundColor = `rgb(${matches[0]}, ${matches[1]}, ${matches[2]})`
    }
  }
  
  const luminance = getLuminance(backgroundColor)
  
  // Use dark text on light backgrounds (luminance > 0.5)
  // Use light text on dark backgrounds (luminance <= 0.5)
  return luminance > 0.5 ? lightText : darkText
}

/**
 * Get sidebar color preset based on primary color and theme
 * @param primaryColor - Primary color hex string (e.g., "#2196f3")
 * @param theme - 'light' or 'dark'
 * @returns Sidebar color preset object
 */
export function getSidebarColorPreset(primaryColor: string | undefined | null, theme: 'light' | 'dark' = 'dark'): {
  sidebarBg: string
  sidebarHeaderBg: string
  sidebarText: string
  sidebarHoverBg: string
  sidebarBorder: string
} {
  // Default colors if no primary color
  if (!primaryColor) {
    return theme === 'light'
      ? {
          sidebarBg: '#f8f9fa',
          sidebarHeaderBg: '#ffffff',
          sidebarText: '#1f2937',
          sidebarHoverBg: '#e5e7eb',
          sidebarBorder: '#e5e7eb',
        }
      : {
          sidebarBg: '#0f172a',
          sidebarHeaderBg: '#1e293b',
          sidebarText: '#e2e8f0',
          sidebarHoverBg: '#334155',
          sidebarBorder: '#1e293b',
        }
  }

  // Try to get computed primary color if it's a CSS variable
  let resolvedPrimary = primaryColor
  if (primaryColor.startsWith('var(') || primaryColor.startsWith('--') || primaryColor.includes('hsl(var')) {
    try {
      // Try to get from CSS variable
      const root = document.documentElement
      const computed = getComputedStyle(root)
      
      // Extract variable name
      let varName = primaryColor
      if (primaryColor.startsWith('var(')) {
        const match = primaryColor.match(/var\(([^,)]+)(?:,\s*([^)]+))?\)/)
        if (match) {
          varName = match[1].trim()
        }
      } else if (primaryColor.includes('hsl(var')) {
        // Handle hsl(var(--primary)) format
        const match = primaryColor.match(/hsl\(var\(([^)]+)\)\)/)
        if (match) {
          varName = match[1].trim()
        }
      }
      
      // Try to get the value
      let value = computed.getPropertyValue(varName).trim()
      if (!value && primaryColor.includes('var(')) {
        // Try fallback
        const match = primaryColor.match(/var\([^,)]+,\s*([^)]+)\)/)
        if (match && match[1]) {
          value = match[1].trim()
        }
      }
      
      // If we got a value, try to resolve it further if it's still a variable
      if (value) {
        if (value.startsWith('var(') || value.startsWith('--') || value.includes('hsl(')) {
          // Try to get computed color from a temporary element
          const tempEl = document.createElement('div')
          tempEl.style.backgroundColor = value
          tempEl.style.position = 'absolute'
          tempEl.style.visibility = 'hidden'
          tempEl.style.pointerEvents = 'none'
          document.body.appendChild(tempEl)
          const computedBg = getComputedStyle(tempEl).backgroundColor
          document.body.removeChild(tempEl)
          if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
            resolvedPrimary = computedBg
          } else {
            resolvedPrimary = value
          }
        } else {
          resolvedPrimary = value
        }
      } else {
        // Fallback: try to get computed color from a temporary element
        const tempEl = document.createElement('div')
        tempEl.style.backgroundColor = primaryColor
        tempEl.style.position = 'absolute'
        tempEl.style.visibility = 'hidden'
        tempEl.style.pointerEvents = 'none'
        document.body.appendChild(tempEl)
        const computedBg = getComputedStyle(tempEl).backgroundColor
        document.body.removeChild(tempEl)
        if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
          resolvedPrimary = computedBg
        }
      }
    } catch (e) {
      // Fallback to default
      console.warn('Failed to resolve primary color:', primaryColor, e)
    }
  }

  // Parse RGB from hex or rgb string
  let r = 0, g = 0, b = 0
  if (resolvedPrimary.startsWith('#')) {
    const hex = resolvedPrimary.slice(1)
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  } else if (resolvedPrimary.startsWith('rgb')) {
    const matches = resolvedPrimary.match(/\d+/g)
    if (matches && matches.length >= 3) {
      r = parseInt(matches[0], 10)
      g = parseInt(matches[1], 10)
      b = parseInt(matches[2], 10)
    }
  }

  // Validate RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b) || r === 0 && g === 0 && b === 0) {
    // If parsing failed, return defaults
    return theme === 'light'
      ? {
          sidebarBg: '#f8f9fa',
          sidebarHeaderBg: '#ffffff',
          sidebarText: '#1f2937',
          sidebarHoverBg: '#e5e7eb',
          sidebarBorder: '#e5e7eb',
        }
      : {
          sidebarBg: '#3e2723', // Rich dark brown (similar to image)
          sidebarHeaderBg: '#4e342e', // Slightly lighter brown
          sidebarText: '#ffffff', // Pure white for maximum contrast
          sidebarHoverBg: '#5d4037', // Lighter brown for hover
          sidebarBorder: '#4e342e', // Border matches header
        }
  }

  if (theme === 'light') {
    // Light mode: Use solid light tint of primary color (more visible)
    // Mix primary with white (85% white, 15% primary) - stronger than before
    const lightR = Math.max(240, Math.round(r * 0.15 + 255 * 0.85))
    const lightG = Math.max(240, Math.round(g * 0.15 + 255 * 0.85))
    const lightB = Math.max(240, Math.round(b * 0.15 + 255 * 0.85))
    
    // Header is slightly darker (75% white, 25% primary) - more visible
    const headerR = Math.max(230, Math.round(r * 0.25 + 255 * 0.75))
    const headerG = Math.max(230, Math.round(g * 0.25 + 255 * 0.75))
    const headerB = Math.max(230, Math.round(b * 0.25 + 255 * 0.75))
    
    // Hover is more primary (60% white, 40% primary) - clearly visible
    const hoverR = Math.max(220, Math.round(r * 0.4 + 255 * 0.6))
    const hoverG = Math.max(220, Math.round(g * 0.4 + 255 * 0.6))
    const hoverB = Math.max(220, Math.round(b * 0.4 + 255 * 0.6))
    
    return {
      sidebarBg: `rgb(${lightR}, ${lightG}, ${lightB})`,
      sidebarHeaderBg: `rgb(${headerR}, ${headerG}, ${headerB})`,
      sidebarText: '#1f2937', // Dark text for light background
      sidebarHoverBg: `rgb(${hoverR}, ${hoverG}, ${hoverB})`,
      sidebarBorder: `rgb(${Math.max(200, Math.round(r * 0.3 + 255 * 0.7))}, ${Math.max(200, Math.round(g * 0.3 + 255 * 0.7))}, ${Math.max(200, Math.round(b * 0.3 + 255 * 0.7))})`,
    }
  } else {
    // Dark mode: Use rich, solid dark shade of primary color (like dark brown/orange)
    // Create a deep, saturated dark color by mixing primary with dark tones
    // Use 60% primary, 40% darkening (towards black but keeping color richness)
    const darkR = Math.max(30, Math.round(r * 0.6))
    const darkG = Math.max(30, Math.round(g * 0.6))
    const darkB = Math.max(30, Math.round(b * 0.6))
    
    // Header is slightly lighter but still dark (75% primary, 25% darkening)
    const headerR = Math.max(40, Math.round(r * 0.75))
    const headerG = Math.max(40, Math.round(g * 0.75))
    const headerB = Math.max(40, Math.round(b * 0.75))
    
    // Hover is lighter and more vibrant (90% primary, 10% lightening) - clearly visible
    const hoverR = Math.min(255, Math.round(r * 0.9 + 20))
    const hoverG = Math.min(255, Math.round(g * 0.9 + 20))
    const hoverB = Math.min(255, Math.round(b * 0.9 + 20))
    
    // Border is slightly lighter than background for definition
    const borderR = Math.max(50, Math.round(r * 0.65))
    const borderG = Math.max(50, Math.round(g * 0.65))
    const borderB = Math.max(50, Math.round(b * 0.65))
    
    return {
      sidebarBg: `rgb(${darkR}, ${darkG}, ${darkB})`,
      sidebarHeaderBg: `rgb(${headerR}, ${headerG}, ${headerB})`,
      sidebarText: '#ffffff', // Pure white text for maximum contrast on dark background
      sidebarHoverBg: `rgb(${hoverR}, ${hoverG}, ${hoverB})`,
      sidebarBorder: `rgb(${borderR}, ${borderG}, ${borderB})`,
    }
  }
}

