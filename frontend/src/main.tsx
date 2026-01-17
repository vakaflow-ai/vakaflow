import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Suppress ReactQuill findDOMNode deprecation warning (known issue with react-quill v2.0.0)
// This warning is harmless and doesn't affect functionality
const originalError = console.error
const originalWarn = console.warn

const suppressFindDOMNodeWarning = (message: any): boolean => {
  if (typeof message === 'string') {
    return message.includes('findDOMNode is deprecated') ||
           message.includes('Warning: findDOMNode') ||
           (message.includes('findDOMNode') && message.includes('ReactQuill'))
  }
  return false
}

console.error = (...args: any[]) => {
  if (!suppressFindDOMNodeWarning(args[0])) {
    originalError.apply(console, args)
  }
}

console.warn = (...args: any[]) => {
  if (!suppressFindDOMNodeWarning(args[0])) {
    originalWarn.apply(console, args)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

