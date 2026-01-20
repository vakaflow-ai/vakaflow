import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SimpleFormLoaderProps {
  requestTypeId: string;
  onFormsLoaded: (submissionId: string, approvalId: string) => void;
}

export default function SimpleFormLoader({ requestTypeId, onFormsLoaded }: SimpleFormLoaderProps) {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Log helper
  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[FormLoader] ${message}`);
  };
  
  // Fetch form associations
  const { data: formAssociations, isLoading, error } = useQuery({
    queryKey: ['simple-form-associations', requestTypeId],
    queryFn: async () => {
      log(`Fetching form associations for request type: ${requestTypeId}`);
      
      try {
        const response = await fetch(`/api/v1/request-type-config/${requestTypeId}/forms`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        log(`Successfully fetched ${data.length} form associations`);
        return data;
      } catch (err) {
        log(`Error fetching form associations: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw err;
      }
    },
    enabled: !!requestTypeId,
    retry: 1
  });
  
  // Fetch library forms
  const { data: libraryForms } = useQuery({
    queryKey: ['simple-library-forms'],
    queryFn: async () => {
      log('Fetching library forms');
      try {
        const response = await fetch('/api/v1/form-layouts/library');
        if (!response.ok) throw new Error('Failed to fetch library forms');
        const data = await response.json();
        log(`Found ${data.length} library forms`);
        return data;
      } catch (err) {
        log(`Error fetching library forms: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return [];
      }
    }
  });
  
  // Process and match forms when data is available
  useEffect(() => {
    log('useEffect triggered');
    log(`formAssociations: ${Array.isArray(formAssociations) ? formAssociations.length : 'not array'}`);
    log(`libraryForms: ${Array.isArray(libraryForms) ? libraryForms.length : 'not array'}`);
    
    if (!Array.isArray(formAssociations) || !Array.isArray(libraryForms)) {
      log('Missing required data arrays');
      return;
    }
    
    if (formAssociations.length === 0) {
      log('No form associations found');
      return;
    }
    
    log('Processing form associations:');
    formAssociations.forEach((assoc: any, index: number) => {
      log(`  ${index + 1}. ${assoc.form_name} (${assoc.form_variation_type}) - ID: ${assoc.form_layout_id}`);
    });
    
    log('Available library forms:');
    libraryForms.forEach((form: any) => {
      log(`  - ${form.name} (ID: ${form.id})`);
    });
    
    // Find associations by type
    const submissionAssoc = formAssociations.find((assoc: any) => assoc.form_variation_type === 'submission');
    const approvalAssoc = formAssociations.find((assoc: any) => assoc.form_variation_type === 'approval');
    
    log(`Found submission association: ${submissionAssoc ? submissionAssoc.form_name : 'None'}`);
    log(`Found approval association: ${approvalAssoc ? approvalAssoc.form_name : 'None'}`);
    
    // Match by name (handle bridge solution ID differences)
    const submissionForm = submissionAssoc 
      ? libraryForms.find((form: any) => form.name === submissionAssoc.form_name)
      : null;
    const approvalForm = approvalAssoc 
      ? libraryForms.find((form: any) => form.name === approvalAssoc.form_name)
      : null;
    
    log(`Matched submission form: ${submissionForm ? submissionForm.name + ' (ID: ' + submissionForm.id + ')' : 'None'}`);
    log(`Matched approval form: ${approvalForm ? approvalForm.name + ' (ID: ' + approvalForm.id + ')' : 'None'}`);
    
    // Return the matched form IDs
    const submissionId = submissionForm?.id || submissionAssoc?.form_layout_id || '';
    const approvalId = approvalForm?.id || approvalAssoc?.form_layout_id || '';
    
    log(`Final IDs to return:`);
    log(`  Submission: ${submissionId || 'None'}`);
    log(`  Approval: ${approvalId || 'None'}`);
    
    onFormsLoaded(submissionId, approvalId);
    
  }, [formAssociations, libraryForms, onFormsLoaded]);
  
  // Render debug information
  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      width: '400px', 
      maxHeight: '300px', 
      overflowY: 'auto',
      backgroundColor: 'white',
      border: '2px solid #333',
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Form Loader Debug</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> 
        {isLoading ? ' ⏳ Loading...' : error ? ' ❌ Error' : ' ✅ Ready'}
      </div>
      <div>
        <strong>Logs:</strong>
        <div style={{ 
          marginTop: '5px', 
          maxHeight: '200px', 
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
          padding: '5px'
        }}>
          {debugInfo.map((log, index) => (
            <div key={index} style={{ marginBottom: '2px' }}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}