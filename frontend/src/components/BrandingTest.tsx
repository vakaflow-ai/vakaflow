import { useEffect } from 'react'

// Simple test component to verify branding is working
export default function BrandingTest() {
  useEffect(() => {
    const root = document.documentElement
    const primary500 = getComputedStyle(root).getPropertyValue('--primary-500').trim()
    const primary = getComputedStyle(root).getPropertyValue('--primary').trim()
    const tenantPrimary = getComputedStyle(root).getPropertyValue('--tenant-primary').trim()
    
    console.log('=== BRANDING TEST ===')
    console.log('--primary-500:', primary500)
    console.log('--primary:', primary)
    console.log('--tenant-primary:', tenantPrimary)
    console.log('====================')
  }, [])

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white border rounded-lg shadow-lg z-50">
      <div className="text-xs font-mono space-y-1">
        <div>Primary 500: <span className="w-4 h-4 inline-block border" style={{ backgroundColor: 'var(--primary-500)' }}></span></div>
        <div>Tenant Primary: <span className="w-4 h-4 inline-block border" style={{ backgroundColor: 'var(--tenant-primary)' }}></span></div>
        <div className="mt-2">
          <div className="w-20 h-8 bg-primary-500 rounded"></div>
          <div className="text-xs mt-1">bg-primary-500 class</div>
        </div>
      </div>
    </div>
  )
}

