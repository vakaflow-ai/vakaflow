import React, { useRef } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

// Wrapper component for ReactQuill
// Note: findDOMNode deprecation warning is suppressed globally in main.tsx
// This is a known issue with react-quill v2.0.0 and React 18 StrictMode
// The warning is harmless and doesn't affect functionality
const ReactQuillWrapper: React.FC<any> = (props) => {
  const quillRef = useRef<ReactQuill>(null)
  return <ReactQuill ref={quillRef} {...props} />
}

export default ReactQuillWrapper
