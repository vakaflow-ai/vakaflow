
-- Create ecosystem entities tables manually
-- This bypasses the complex migration chain issues

-- Create ecosystem_entities table
CREATE TABLE IF NOT EXISTS ecosystem_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    
    -- Entity identification
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('agent', 'product', 'service')),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    description TEXT,
    
    -- Version and lifecycle
    version VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'active', 'paused', 'offboarded', 'archived')),
    
    -- Governance fields
    service_account VARCHAR(255),
    department VARCHAR(100),
    organization VARCHAR(255),
    kill_switch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_governance_review TIMESTAMP,
    governance_owner_id UUID REFERENCES users(id),
    
    -- Skills-based approach
    skills JSONB,
    
    -- Compliance and risk
    compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
    risk_score INTEGER CHECK (risk_score >= 1 AND risk_score <= 10),
    security_controls JSONB,
    compliance_standards JSONB,
    
    -- Documentation and artifacts
    documentation_urls JSONB,
    architecture_diagrams JSONB,
    landscape_diagrams JSONB,
    
    -- Ecosystem relationships
    related_entity_ids JSONB,
    integration_points JSONB,
    
    -- Lifecycle timestamps
    submission_date TIMESTAMP,
    approval_date TIMESTAMP,
    activation_date TIMESTAMP,
    deactivation_date TIMESTAMP,
    
    -- Metadata
    extra_metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for ecosystem_entities
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_tenant_id ON ecosystem_entities(tenant_id);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_vendor_id ON ecosystem_entities(vendor_id);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_entity_type ON ecosystem_entities(entity_type);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_status ON ecosystem_entities(status);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_department ON ecosystem_entities(department);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_organization ON ecosystem_entities(organization);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_governance_owner_id ON ecosystem_entities(governance_owner_id);
CREATE INDEX IF NOT EXISTS ix_ecosystem_entities_kill_switch_enabled ON ecosystem_entities(kill_switch_enabled);

-- Create entity_lifecycle_events table
CREATE TABLE IF NOT EXISTS entity_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES ecosystem_entities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,
    from_status VARCHAR(50) CHECK (from_status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'active', 'paused', 'offboarded', 'archived')),
    to_status VARCHAR(50) NOT NULL CHECK (to_status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'active', 'paused', 'offboarded', 'archived')),
    triggered_by UUID REFERENCES users(id),
    
    -- Event context
    reason TEXT,
    automated BOOLEAN NOT NULL DEFAULT FALSE,
    workflow_step VARCHAR(100),
    
    -- Metadata
    event_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for entity_lifecycle_events
CREATE INDEX IF NOT EXISTS ix_entity_lifecycle_events_entity_id ON entity_lifecycle_events(entity_id);
CREATE INDEX IF NOT EXISTS ix_entity_lifecycle_events_tenant_id ON entity_lifecycle_events(tenant_id);
CREATE INDEX IF NOT EXISTS ix_entity_lifecycle_events_event_type ON entity_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS ix_entity_lifecycle_events_triggered_by ON entity_lifecycle_events(triggered_by);

-- Create shared_governance_profiles table
CREATE TABLE IF NOT EXISTS shared_governance_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Profile identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    profile_type VARCHAR(50) NOT NULL,
    
    -- Shared governance fields
    security_controls JSONB,
    compliance_standards JSONB,
    monitoring_requirements JSONB,
    documentation_templates JSONB,
    
    -- Usage tracking
    entity_count INTEGER NOT NULL DEFAULT 0,
    last_applied TIMESTAMP,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for shared_governance_profiles
CREATE INDEX IF NOT EXISTS ix_shared_governance_profiles_tenant_id ON shared_governance_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS ix_shared_governance_profiles_profile_type ON shared_governance_profiles(profile_type);
CREATE INDEX IF NOT EXISTS ix_shared_governance_profiles_created_by ON shared_governance_profiles(created_by);

-- Add governance fields to existing agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS service_account VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS kill_switch_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_governance_review TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS governance_owner_id UUID REFERENCES users(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS related_product_ids JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS related_service_ids JSONB;

-- Create indexes for new agent fields
CREATE INDEX IF NOT EXISTS ix_agents_service_account ON agents(service_account);
CREATE INDEX IF NOT EXISTS ix_agents_department ON agents(department);
CREATE INDEX IF NOT EXISTS ix_agents_organization ON agents(organization);
CREATE INDEX IF NOT EXISTS ix_agents_kill_switch_enabled ON agents(kill_switch_enabled);
CREATE INDEX IF NOT EXISTS ix_agents_governance_owner_id ON agents(governance_owner_id);

-- Add new fields to agent_metadata table
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS data_classification_levels JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS jurisdictions JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS related_product_ids JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS related_service_ids JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS hosting_provider VARCHAR(100);
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS ai_ml_info JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS training_data_source TEXT;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS certification_status JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS audit_trail_enabled BOOLEAN;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS privacy_policy_url VARCHAR(500);
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS data_protection_officer VARCHAR(255);
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS change_log JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS rollback_procedures TEXT;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS business_purpose TEXT;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS target_audience JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS competitive_advantage TEXT;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS governance_framework VARCHAR(100);
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS service_level_agreements JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS documentation_urls JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS architecture_diagrams JSONB;
ALTER TABLE agent_metadata ADD COLUMN IF NOT EXISTS landscape_diagrams JSONB;

-- Create indexes for new metadata fields
CREATE INDEX IF NOT EXISTS ix_agent_metadata_data_classification ON agent_metadata USING GIN(data_classification_levels);
CREATE INDEX IF NOT EXISTS ix_agent_metadata_jurisdictions ON agent_metadata USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS ix_agent_metadata_hosting_provider ON agent_metadata(hosting_provider);

-- Insert sample data for testing
INSERT INTO ecosystem_entities (tenant_id, vendor_id, name, entity_type, category, description, status, department, organization, kill_switch_enabled, compliance_score, risk_score)
SELECT 
    '00000000-0000-0000-0000-000000000001'::UUID, -- Default tenant
    v.id,
    'Sample Security Bot',
    'agent',
    'Security',
    'AI-powered security monitoring agent',
    'active',
    'Security',
    'Engineering',
    FALSE,
    85,
    3
FROM vendors v 
WHERE v.name ILIKE '%default%' OR v.name ILIKE '%sample%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify tables created
SELECT 'Tables created successfully!' as status;