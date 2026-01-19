// Simple API test utility to diagnose request type loading issues
export const testApiConnectivity = async () => {
  try {
    console.log('=== API Connectivity Test ===')
    
    // Test 1: Check if we can reach the backend
    console.log('1. Testing backend connectivity...')
    const backendResponse = await fetch('http://localhost:8000/docs')
    console.log('Backend reachable:', backendResponse.ok)
    
    // Test 2: Check authentication status
    console.log('2. Testing authentication...')
    const authResponse = await fetch('http://localhost:8000/api/v1/users/me', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    console.log('Auth endpoint status:', authResponse.status)
    
    if (authResponse.status === 401) {
      console.log('User not authenticated - redirecting to login')
      return { authenticated: false, error: 'Not authenticated' }
    }
    
    const userData = await authResponse.json()
    console.log('User data:', userData)
    
    // Test 3: Test request type config endpoint
    console.log('3. Testing request type config endpoint...')
    const requestTypesResponse = await fetch('http://localhost:8000/api/v1/request-type-config', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    console.log('Request types endpoint status:', requestTypesResponse.status)
    
    if (requestTypesResponse.ok) {
      const requestTypesData = await requestTypesResponse.json()
      console.log('Request types data:', requestTypesData)
      return { 
        authenticated: true, 
        success: true, 
        requestTypes: requestTypesData,
        user: userData
      }
    } else {
      const errorText = await requestTypesResponse.text()
      console.log('Request types error:', errorText)
      return { 
        authenticated: true, 
        success: false, 
        error: `API Error: ${requestTypesResponse.status} - ${errorText}` 
      }
    }
    
  } catch (error) {
    console.error('API connectivity test failed:', error)
    return { 
      authenticated: false, 
      success: false, 
      error: `Connection failed: ${error.message}` 
    }
  }
}

// Run the test
testApiConnectivity().then(result => {
  console.log('=== Test Results ===')
  console.log(JSON.stringify(result, null, 2))
})