-- Agent Onboarding/Offboarding Platform Database Schema

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- VENDOR, ADMIN, SECURITY_REVIEWER, COMPLIANCE_REVIEWER, IT_REVIEWER, BUSINESS_REVIEWER
    organization_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address TEXT,
    registration_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- AI_AGENT, BOT, AUTOMATION, API_SERVICE, etc.
    category VARCHAR(100),
    description TEXT,
    version VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED, OFFBOARDED
    submission_date TIMESTAMP,
    approval_date TIMESTAMP,
    rejection_date TIMESTAMP,
    rejection_reason TEXT,
    compliance_score INTEGER, -- 0-100
    risk_score INTEGER, -- 1-10
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE TABLE agent_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    capabilities JSONB, -- Array of capabilities
    data_types JSONB, -- Array of data types processed
    regions JSONB, -- Array of regions
    integrations JSONB, -- Array of integration details
    dependencies JSONB, -- Array of dependencies
    architecture_info JSONB, -- Architecture details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL, -- DOCUMENTATION, CODE, CERTIFICATION, TEST_RESULT, etc.
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    certification_type VARCHAR(100) NOT NULL, -- SOC2, ISO27001, GDPR, etc.
    certification_number VARCHAR(255),
    issued_by VARCHAR(255),
    issued_date DATE,
    expiry_date DATE,
    certificate_file_path TEXT,
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP
);

-- Policies and Compliance
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- SECURITY, COMPLIANCE, TECHNICAL, BUSINESS
    type VARCHAR(100) NOT NULL, -- REGULATORY, INTERNAL, STANDARD
    region VARCHAR(100),
    description TEXT,
    policy_document_path TEXT,
    version VARCHAR(50),
    effective_date DATE,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES policies(id),
    check_type VARCHAR(50) NOT NULL, -- AUTOMATED, MANUAL
    status VARCHAR(50) NOT NULL, -- PASS, FAIL, WARNING, N/A, PENDING
    details TEXT,
    evidence JSONB, -- Array of evidence references
    rag_context JSONB, -- RAG retrieval context
    confidence_score DECIMAL(3,2), -- 0.00-1.00
    checked_by UUID REFERENCES users(id),
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Reviews
CREATE TABLE review_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- PRE_REVIEW, SECURITY_REVIEW, COMPLIANCE_REVIEW, TECHNICAL_REVIEW, BUSINESS_REVIEW
    order_index INTEGER NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    auto_assign BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES review_stages(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, BLOCKED
    review_type VARCHAR(50) NOT NULL, -- INITIAL, RE_REVIEW, APPEAL
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    commenter_id UUID NOT NULL REFERENCES users(id),
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal notes vs vendor-visible comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL, -- APPROVED, REJECTED, CONDITIONAL_APPROVAL, NEEDS_REVISION
    decision_text TEXT,
    conditions JSONB, -- Array of conditions for conditional approval
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) NOT NULL, -- SECURITY, BUSINESS, TECHNICAL, COMPLIANCE
    risk_level VARCHAR(50) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    risk_score INTEGER, -- 1-10
    description TEXT,
    mitigation_strategies JSONB,
    assessed_by UUID REFERENCES users(id),
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rag_recommendations JSONB
);

-- Approval Workflow
CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    agent_type VARCHAR(100),
    risk_level VARCHAR(50),
    workflow_config JSONB NOT NULL, -- Workflow definition
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE approval_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id),
    current_step INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT
);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES approval_instances(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL, -- REVIEW, APPROVAL, NOTIFICATION
    assigned_to UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    completed_at TIMESTAMP,
    notes TEXT
);

-- Offboarding
CREATE TABLE offboarding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(100) NOT NULL, -- CONTRACT_END, SECURITY_INCIDENT, REPLACEMENT, OTHER
    reason_details TEXT,
    target_date DATE,
    replacement_agent_id UUID REFERENCES agents(id),
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED', -- INITIATED, IN_PROGRESS, COMPLETED, CANCELLED
    impact_analysis JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    offboarding_id UUID REFERENCES offboarding_requests(id),
    extraction_type VARCHAR(50) NOT NULL, -- DOCUMENTATION, OPERATIONAL, INTEGRATION, DEPENDENCIES
    extracted_content JSONB,
    stored_location TEXT,
    extracted_by UUID REFERENCES users(id),
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RAG and Knowledge Base
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(100) NOT NULL, -- POLICY, STANDARD, HISTORICAL_CASE, BEST_PRACTICE, TEMPLATE
    category VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE, -- SHA-256 hash for deduplication
    metadata JSONB,
    source VARCHAR(255),
    version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension, adjust based on model
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rag_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    query_embedding VECTOR(1536),
    context JSONB,
    retrieved_chunks JSONB,
    generated_response TEXT,
    confidence_score DECIMAL(3,2),
    user_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommendations
CREATE TABLE ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id),
    recommendation_type VARCHAR(50) NOT NULL, -- REVIEW_FOCUS, COMPLIANCE_GAP, RISK_MITIGATION, BEST_PRACTICE
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    source_type VARCHAR(50), -- HISTORICAL_DATA, POLICY, BEST_PRACTICE
    source_references JSONB,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, ACCEPTED, DISMISSED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adoption Tracking
CREATE TABLE agent_adoptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    business_unit_id UUID,
    adoption_date DATE,
    usage_metrics JSONB,
    user_feedback JSONB,
    business_value_assessment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit and Logging
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- AGENT, REVIEW, COMPLIANCE_CHECK, etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, APPROVE, REJECT, etc.
    user_id UUID REFERENCES users(id),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- AGENT_SUBMITTED, REVIEW_ASSIGNED, APPROVAL_REQUIRED, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    url TEXT NOT NULL,
    events JSONB NOT NULL, -- Array of event types
    secret VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL, -- PENDING, SUCCESS, FAILED
    response_code INTEGER,
    response_body TEXT,
    attempts INTEGER DEFAULT 0,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_agents_vendor_id ON agents(vendor_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_submission_date ON agents(submission_date);
CREATE INDEX idx_reviews_agent_id ON reviews(agent_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_compliance_checks_agent_id ON compliance_checks(agent_id);
CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_rag_queries_agent_id ON rag_queries(agent_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Full-text search indexes
CREATE INDEX idx_agents_name_search ON agents USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_knowledge_documents_content_search ON knowledge_documents USING gin(to_tsvector('english', title || ' ' || content));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

