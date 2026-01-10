import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import MermaidDiagram from '../components/MermaidDiagram'
import { BookOpenIcon, LinkIcon, DatabaseIcon } from '../components/Icons'

// Full Stack Architecture Diagram
const architectureDiagram = `graph TB
    subgraph "Client Layer - Frontend (React/TypeScript)"
        UI["React SPA<br/>Port 3000<br/>TypeScript"]
        UI -->|React Router| ROUTES["Route Components<br/>60+ Pages"]
        UI -->|React Query| STATE["State Management<br/>React Query"]
        UI -->|Axios| API_CLIENT["API Client<br/>with Interceptors"]
        
        ROUTES --> PAGES["Key Pages<br/>Dashboard<br/>AgentCatalog<br/>Assessments<br/>WorkflowManagement<br/>FormDesigner<br/>Studio<br/>Analytics"]
        
        STATE --> CACHE["Query Cache<br/>Stale Time Management"]
        API_CLIENT -->|Bearer JWT Token| MIDDLEWARE
    end

    subgraph "API Gateway & Middleware Layer"
        MIDDLEWARE["CORS Middleware"]
        MIDDLEWARE --> SEC_HEADERS["Security Headers<br/>X-Frame-Options CSP"]
        SEC_HEADERS --> RATE_LIMIT["Rate Limiting<br/>Middleware"]
        RATE_LIMIT --> METRICS_MW["Metrics Middleware<br/>Request Tracking"]
        METRICS_MW --> AUTH_CHECK["Authentication<br/>Dependency<br/>JWT Validation"]
        AUTH_CHECK --> TENANT_RESOLVE["Tenant Resolution<br/>Multi-tenant Isolation"]
    end

    subgraph "API Layer - FastAPI (Python)"
        TENANT_RESOLVE --> ROUTER["API Router<br/>/api/v1/*"]
        
        ROUTER --> AUTH_API["/auth<br/>Login Register MFA SSO"]
        ROUTER --> USERS_API["/users<br/>User Management"]
        ROUTER --> TENANTS_API["/tenants<br/>Tenant Management"]
        ROUTER --> AGENTS_API["/agents<br/>Agent CRUD Operations"]
        ROUTER --> VENDORS_API["/vendors<br/>Vendor Management"]
        ROUTER --> ASSESSMENTS_API["/assessments<br/>Assessment Management"]
        ROUTER --> WORKFLOW_API["/workflow<br/>Workflow Orchestration"]
        ROUTER --> COMPLIANCE_API["/compliance<br/>Frameworks Policies"]
        ROUTER --> REVIEWS_API["/reviews<br/>Review Management"]
        ROUTER --> INTEGRATIONS_API["/integrations<br/>External Integrations"]
        ROUTER --> WEBHOOKS_API["/webhooks<br/>Event Notifications"]
        ROUTER --> ANALYTICS_API["/analytics<br/>Business Intelligence"]
        ROUTER --> PRESENTATION_API["/presentation<br/>Business Pages Widgets"]
        ROUTER --> STUDIO_API["/studio<br/>Agentic Flow Builder"]
        ROUTER --> FORMS_API["/form_layouts<br/>Form Designer"]
        ROUTER --> MASTER_DATA_API["/master_data_lists<br/>Master Data Management"]
        ROUTER --> OTHER_APIS["30+ Other Endpoints<br/>Custom Fields<br/>Entity Fields<br/>Role Permissions<br/>Tickets<br/>Messages<br/>Export"]
    end

    subgraph "Service Layer - Business Logic"
        AUTH_API --> AUTH_SVC["Auth Service<br/>JWT Password Hashing<br/>MFA SSO"]
        USERS_API --> USER_SVC["User Service<br/>User Management<br/>Role Assignment"]
        TENANTS_API --> TENANT_SVC["Tenant Service<br/>Multi-tenant Isolation<br/>Feature Flags"]
        AGENTS_API --> AGENT_SVC["Agent Service<br/>Business Logic<br/>Status Management"]
        VENDORS_API --> VENDOR_SVC["Vendor Service<br/>Vendor Matching<br/>Invitations"]
        ASSESSMENTS_API --> ASSESSMENT_SVC["Assessment Service<br/>TPRM Risk Assessment<br/>Scheduling"]
        WORKFLOW_API --> WORKFLOW_SVC["Workflow Service<br/>State Machine<br/>Orchestration"]
        COMPLIANCE_API --> COMPLIANCE_SVC["Compliance Service<br/>Framework Matching<br/>Policy Enforcement"]
        REVIEWS_API --> REVIEW_SVC["Review Service<br/>Review Assignment<br/>Decision Tracking"]
        INTEGRATIONS_API --> INTEGRATION_SVC["Integration Service<br/>SMTP SSO Webhooks<br/>Jira Slack Teams"]
        WEBHOOKS_API --> WEBHOOK_SVC["Webhook Service<br/>Event Delivery<br/>Retry Logic"]
        ANALYTICS_API --> ANALYTICS_SVC["Analytics Service<br/>Predictive Models<br/>Ecosystem Mapping"]
        PRESENTATION_API --> PRESENTATION_SVC["Presentation Service<br/>Page Widget Management<br/>Data Aggregation"]
        STUDIO_API --> STUDIO_SVC["Studio Service<br/>Agentic Flow Builder<br/>Flow Execution"]
        FORMS_API --> FORM_SVC["Form Layout Service<br/>Dynamic Form Generation<br/>Field Access Control"]
        MASTER_DATA_API --> MASTER_DATA_SVC["Master Data Service<br/>Data List Management<br/>Tenant Isolation"]
        
        COMPLIANCE_SVC --> RAG_SVC["RAG Service<br/>Document Processing<br/>Knowledge Retrieval"]
        RAG_SVC --> EMBEDDING_SVC["Embedding Service<br/>Vector Generation<br/>OpenAI Anthropic"]
        
        ASSESSMENT_SVC --> RULE_ENGINE["Business Rules Engine<br/>Rule Evaluation<br/>Auto-assignment"]
        WORKFLOW_SVC --> REMINDER_SVC["Reminder Service<br/>Workflow Reminders<br/>Email Notifications"]
        
        STUDIO_SVC --> AGENTIC_SVC["Agentic Agent Service<br/>AI Agent Registry<br/>MCP Connections"]
        AGENTIC_SVC --> LEARNING_SVC["Learning System<br/>Cross-tenant Learning<br/>Knowledge Base"]
    end

    subgraph "Data Access Layer"
        AUTH_SVC --> ORM["SQLAlchemy ORM<br/>Type-safe Queries"]
        USER_SVC --> ORM
        TENANT_SVC --> ORM
        AGENT_SVC --> ORM
        VENDOR_SVC --> ORM
        ASSESSMENT_SVC --> ORM
        WORKFLOW_SVC --> ORM
        COMPLIANCE_SVC --> ORM
        REVIEW_SVC --> ORM
        INTEGRATION_SVC --> ORM
        WEBHOOK_SVC --> ORM
        ANALYTICS_SVC --> ORM
        PRESENTATION_SVC --> ORM
        STUDIO_SVC --> ORM
        FORM_SVC --> ORM
        MASTER_DATA_SVC --> ORM
        
        ORM --> DB_POOL["Connection Pool<br/>Pool Size 10<br/>Max Overflow 20"]
        DB_POOL --> POSTGRES[("PostgreSQL 15<br/>Primary Database<br/>Multi-tenant Data")]
        
        EMBEDDING_SVC --> QDRANT[("Qdrant<br/>Vector Database<br/>Port 6333<br/>RAG Storage")]
        
        RATE_LIMIT --> REDIS[("Redis 7<br/>Cache Rate Limiting<br/>Port 6379<br/>Session Storage")]
        AUTH_SVC --> REDIS
        WEBHOOK_SVC --> REDIS
        REMINDER_SVC --> REDIS
    end

    subgraph "External Services & Integrations"
        INTEGRATION_SVC --> SMTP["SMTP Server<br/>Email Delivery"]
        INTEGRATION_SVC --> SSO_PROVIDER["SSO Providers<br/>SAML OAuth2"]
        INTEGRATION_SVC --> JIRA["Jira API<br/>Issue Tracking"]
        INTEGRATION_SVC --> SLACK["Slack API<br/>Notifications"]
        INTEGRATION_SVC --> TEAMS["Microsoft Teams<br/>Notifications"]
        INTEGRATION_SVC --> SERVICENOW["ServiceNow API<br/>ITSM Integration"]
        
        EMBEDDING_SVC --> OPENAI["OpenAI API<br/>Embeddings LLM"]
        EMBEDDING_SVC --> ANTHROPIC["Anthropic API<br/>Claude LLM"]
        
        AGENTIC_SVC --> MCP_SERVERS["MCP Servers<br/>Model Context Protocol<br/>External Agents"]
        
        WEBHOOK_SVC --> WEBHOOK_ENDPOINTS["External Webhooks<br/>Event Delivery"]
    end

    subgraph "Background Jobs & Schedulers"
        ASSESSMENT_SVC --> SCHEDULER["Assessment Scheduler<br/>Cron Jobs<br/>Recurring Assessments"]
        REMINDER_SVC --> REMINDER_JOB["Reminder Jobs<br/>Workflow Reminders"]
        SECURITY_SVC["Security Service<br/>CVE Scanning<br/>Incident Tracking"] --> SECURITY_JOB["Security Monitoring<br/>Scheduled Scans"]
    end

    style UI fill:#e1f5ff
    style POSTGRES fill:#c8e6c9
    style QDRANT fill:#fff9c4
    style REDIS fill:#ffccbc
    style ORM fill:#f3e5f5
    style ROUTER fill:#e8f5e9`

// Entity Relationship Diagram (converted to flowchart for visual rendering)
const entityRelationshipDiagram = `graph TB
    subgraph "Core Multi-Tenant Foundation"
        TENANT["TENANT<br/>Multi-tenant Root"]
        TENANT --> USER["USER<br/>Authentication"]
        TENANT --> VENDOR["VENDOR<br/>Vendor Org"]
        TENANT --> ASSESSMENT["ASSESSMENT<br/>TPRM Risk"]
        TENANT --> INTEGRATION["INTEGRATION<br/>External Services"]
        TENANT --> FORM["FORM<br/>Form Designer"]
        TENANT --> BUSINESS_PAGE["BUSINESS_PAGE<br/>Presentation"]
    end

    subgraph "User Management"
        USER --> REVIEW["REVIEW<br/>Review Process"]
        USER --> ASSESSMENT
        USER --> ASSESSMENT_ASSIGNMENT["ASSESSMENT_ASSIGNMENT<br/>Assignment"]
        USER --> ACTION_ITEM["ACTION_ITEM<br/>Tasks"]
        USER --> TICKET["TICKET<br/>Support"]
        USER --> AUDIT_LOG["AUDIT_LOG<br/>Audit Trail"]
    end

    subgraph "Vendor & Agent Hierarchy"
        VENDOR --> AGENT["AGENT<br/>AI Agent Bot"]
        VENDOR --> VENDOR_INVITATION["VENDOR_INVITATION<br/>Invites"]
        VENDOR --> WEBHOOK["WEBHOOK<br/>Events"]
        VENDOR --> ASSESSMENT_ASSIGNMENT["ASSESSMENT_ASSIGNMENT<br/>Assignments"]
        VENDOR --> ASSESSMENT_REVIEW["ASSESSMENT_REVIEW<br/>Reviews"]
        
        AGENT --> AGENT_METADATA["AGENT_METADATA<br/>Metadata"]
        AGENT --> AGENT_ARTIFACT["AGENT_ARTIFACT<br/>Files"]
        AGENT --> AGENT_CONNECTION["AGENT_CONNECTION<br/>Connections"]
        AGENT --> REVIEW
        AGENT --> COMPLIANCE_CHECK["COMPLIANCE_CHECK<br/>Checks"]
        AGENT --> RISK_ASSESSMENT["RISK_ASSESSMENT<br/>Risk"]
        AGENT --> ASSESSMENT_ASSIGNMENT
        AGENT --> TICKET
        AGENT --> OFFBOARDING_REQUEST["OFFBOARDING_REQUEST<br/>Offboarding"]
    end

    subgraph "Assessment System"
        ASSESSMENT --> ASSESSMENT_QUESTION["ASSESSMENT_QUESTION<br/>Questions"]
        ASSESSMENT --> ASSESSMENT_SCHEDULE["ASSESSMENT_SCHEDULE<br/>Schedule"]
        ASSESSMENT --> ASSESSMENT_ASSIGNMENT
        ASSESSMENT --> ASSESSMENT_TEMPLATE["ASSESSMENT_TEMPLATE<br/>Template"]
        ASSESSMENT --> ASSESSMENT_WORKFLOW_HISTORY["ASSESSMENT_WORKFLOW_HISTORY<br/>History"]
        ASSESSMENT --> ASSESSMENT_REVIEW
        ASSESSMENT --> ASSESSMENT_RULE["ASSESSMENT_RULE<br/>Rules"]
        
        ASSESSMENT_TEMPLATE --> ASSESSMENT
        ASSESSMENT_TEMPLATE --> SUBMISSION_REQUIREMENT["SUBMISSION_REQUIREMENT<br/>Requirements"]
        
        ASSESSMENT_ASSIGNMENT --> VENDOR
        ASSESSMENT_ASSIGNMENT --> AGENT
        ASSESSMENT_ASSIGNMENT --> USER
        ASSESSMENT_ASSIGNMENT --> ASSESSMENT_SCHEDULE
        ASSESSMENT_ASSIGNMENT --> ASSESSMENT
        ASSESSMENT_ASSIGNMENT --> ASSESSMENT_QUESTION_RESPONSE["ASSESSMENT_QUESTION_RESPONSE<br/>Responses Artifacts"]
        
        ASSESSMENT_SCHEDULE --> ASSESSMENT
        
        ASSESSMENT_REVIEW --> ASSESSMENT_ASSIGNMENT
        ASSESSMENT_REVIEW --> ASSESSMENT
        ASSESSMENT_REVIEW --> VENDOR
        
        ASSESSMENT_QUESTION_RESPONSE --> ASSESSMENT_QUESTION
        ASSESSMENT_QUESTION_RESPONSE --> ASSESSMENT_ASSIGNMENT
        
        SUBMISSION_REQUIREMENT --> REQUIREMENT_QUESTION["REQUIREMENT_QUESTION<br/>Questions"]
        SUBMISSION_REQUIREMENT --> COMPLIANCE_FRAMEWORK["COMPLIANCE_FRAMEWORK<br/>Framework"]
        
        QUESTION_LIBRARY["QUESTION_LIBRARY<br/>Library"] --> ASSESSMENT_QUESTION
        QUESTION_LIBRARY --> REQUIREMENT_QUESTION
    end

    subgraph "Workflow System"
        WORKFLOW_CONFIG["WORKFLOW_CONFIG<br/>Configuration"] --> WORKFLOW_STAGE["WORKFLOW_STAGE<br/>Stages"]
        WORKFLOW_STAGE --> WORKFLOW_STAGE_ACTION["WORKFLOW_STAGE_ACTION<br/>Actions"]
        WORKFLOW_STAGE --> WORKFLOW_REMINDER["WORKFLOW_REMINDER<br/>Reminders"]
        WORKFLOW_STAGE --> WORKFLOW_AUDIT_TRAIL["WORKFLOW_AUDIT_TRAIL<br/>Audit"]
        
        WORKFLOW_CONFIG --> ASSESSMENT_WORKFLOW_HISTORY
        WORKFLOW_CONFIG --> APPROVAL_INSTANCE["APPROVAL_INSTANCE<br/>Approval"]
        
        APPROVAL_INSTANCE --> APPROVAL_STEP["APPROVAL_STEP<br/>Steps"]
        APPROVAL_INSTANCE --> AGENT
    end

    subgraph "Compliance & Review"
        COMPLIANCE_FRAMEWORK --> COMPLIANCE_CHECK
        COMPLIANCE_FRAMEWORK --> SUBMISSION_REQUIREMENT
        
        REVIEW --> REVIEW_COMMENT["REVIEW_COMMENT<br/>Comments"]
        REVIEW --> REVIEW_DECISION["REVIEW_DECISION<br/>Decision"]
        REVIEW --> WORKFLOW_STAGE
        
        COMPLIANCE_CHECK --> AGENT
        RISK_ASSESSMENT --> AGENT
    end

    subgraph "Knowledge Base & RAG"
        KNOWLEDGE_DOCUMENT["KNOWLEDGE_DOCUMENT<br/>Documents"] --> DOCUMENT_CHUNK["DOCUMENT_CHUNK<br/>Chunks"]
        DOCUMENT_CHUNK --> RAG_QUERY["RAG_QUERY<br/>Queries"]
        KNOWLEDGE_DOCUMENT --> AI_RECOMMENDATION["AI_RECOMMENDATION<br/>Recommendations"]
    end

    subgraph "Integration System"
        INTEGRATION --> WEBHOOK_DELIVERY["WEBHOOK_DELIVERY<br/>Deliveries"]
        INTEGRATION --> TENANT
        
        WEBHOOK --> WEBHOOK_DELIVERY
        WEBHOOK --> VENDOR
    end

    subgraph "Presentation Layer"
        BUSINESS_PAGE --> PAGE_WIDGET["PAGE_WIDGET<br/>Widgets"]
        PAGE_WIDGET --> WIDGET["WIDGET<br/>Widget Def"]
        WIDGET --> WIDGET_DATA_CACHE["WIDGET_DATA_CACHE<br/>Cache"]
    end

    subgraph "Form Designer"
        FORM --> CUSTOM_FIELD_CATALOG["CUSTOM_FIELD_CATALOG<br/>Fields"]
        FORM_LAYOUT["FORM_LAYOUT<br/>Layout"] --> CUSTOM_FIELD_CATALOG
        FORM_LAYOUT --> FORM_TYPE["FORM_TYPE<br/>Type"]
    end

    subgraph "Agentic AI System"
        AGENTIC_AGENT["AGENTIC_AGENT<br/>AI Agent"] --> AGENT_SKILL["AGENT_SKILL<br/>Skills"]
        AGENTIC_AGENT --> AGENTIC_AGENT_SESSION["AGENTIC_AGENT_SESSION<br/>Sessions"]
        AGENTIC_AGENT --> AGENTIC_AGENT_INTERACTION["AGENTIC_AGENT_INTERACTION<br/>Interactions"]
        AGENTIC_AGENT --> MCP_CONNECTION["MCP_CONNECTION<br/>MCP"]
        
        AGENTIC_FLOW["AGENTIC_FLOW<br/>Flow"] --> FLOW_EXECUTION["FLOW_EXECUTION<br/>Execution"]
        FLOW_EXECUTION --> FLOW_NODE_EXECUTION["FLOW_NODE_EXECUTION<br/>Nodes"]
        AGENTIC_FLOW --> STUDIO_AGENT["STUDIO_AGENT<br/>Studio"]
    end

    style TENANT fill:#e1f5ff
    style USER fill:#c8e6c9
    style VENDOR fill:#fff9c4
    style AGENT fill:#ffccbc
    style ASSESSMENT fill:#f3e5f5
    style WORKFLOW_CONFIG fill:#e8f5e9
    style COMPLIANCE_FRAMEWORK fill:#fce4ec`

export default function PlatformArchitecture() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'architecture' | 'er-diagram'>('architecture')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  if (!user) {
    return (
      <Layout user={null}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpenIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Platform Architecture</h1>
          </div>
          <p className="text-gray-600 mt-2">
            Comprehensive architecture and entity relationship diagrams to help developers understand how the platform works.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'architecture'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LinkIcon className="w-5 h-5" />
              Full Stack Architecture
            </button>
            <button
              onClick={() => setActiveTab('er-diagram')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'er-diagram'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DatabaseIcon className="w-5 h-5" />
              Entity Relationship Diagram
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Full Stack Architecture</h2>
                <p className="text-gray-600 mb-4">
                  This diagram shows the complete architecture of the VAKA platform, including the frontend React application,
                  backend FastAPI services, data access layer, and external integrations.
                </p>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <MermaidDiagram diagram={architectureDiagram} id="architecture-diagram" showZoomControls={true} />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Components</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Frontend (React/TypeScript)</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• React 18+ with TypeScript</li>
                      <li>• React Query for state management</li>
                      <li>• React Router for navigation</li>
                      <li>• 60+ pages/components</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">Backend (FastAPI/Python)</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• FastAPI with async support</li>
                      <li>• 50+ API endpoints</li>
                      <li>• Service layer pattern</li>
                      <li>• Multi-tenant architecture</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-2">Data Layer</h4>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• PostgreSQL 15 (primary DB)</li>
                      <li>• Qdrant (vector DB for RAG)</li>
                      <li>• Redis (cache & sessions)</li>
                      <li>• SQLAlchemy ORM</li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-2">Integrations</h4>
                    <ul className="text-sm text-orange-800 space-y-1">
                      <li>• SMTP, SSO (SAML, OAuth2)</li>
                      <li>• Jira, Slack, Teams</li>
                      <li>• OpenAI, Anthropic APIs</li>
                      <li>• Webhooks & MCP servers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'er-diagram' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Entity Relationship Diagram</h2>
                <p className="text-gray-600 mb-4">
                  This diagram shows the database schema and relationships between core entities in the platform.
                  All entities are tenant-isolated for multi-tenant data segregation.
                </p>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <MermaidDiagram diagram={entityRelationshipDiagram} id="er-diagram" showZoomControls={true} />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Core Entity Groups</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Multi-Tenant Foundation</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Tenant (multi-tenant isolation)</li>
                      <li>• User (authentication & authorization)</li>
                      <li>• Role & Permissions</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">Agent Management</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• Vendor (vendor organizations)</li>
                      <li>• Agent (AI agents, bots, services)</li>
                      <li>• Agent Metadata & Artifacts</li>
                      <li>• Agent Connections</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-2">Assessment System</h4>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• Assessment (TPRM, Risk, etc.)</li>
                      <li>• Assessment Assignment</li>
                      <li>• Assessment Template</li>
                      <li>• Question Library</li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-2">Workflow System</h4>
                    <ul className="text-sm text-orange-800 space-y-1">
                      <li>• Workflow Config</li>
                      <li>• Workflow Stages & Actions</li>
                      <li>• Approval Instances</li>
                      <li>• Workflow Audit Trail</li>
                    </ul>
                  </div>
                  <div className="bg-pink-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-pink-900 mb-2">Compliance & Review</h4>
                    <ul className="text-sm text-pink-800 space-y-1">
                      <li>• Compliance Framework</li>
                      <li>• Compliance Checks</li>
                      <li>• Reviews & Decisions</li>
                      <li>• Risk Assessments</li>
                    </ul>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-yellow-900 mb-2">Agentic AI</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      <li>• Agentic Agent</li>
                      <li>• Agentic Flow</li>
                      <li>• Flow Execution</li>
                      <li>• MCP Connections</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Additional Resources</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• <strong>CODING_STANDARDS.md</strong> - Detailed coding standards and best practices</li>
            <li>• <strong>PROJECT_RULES.md</strong> - Project-specific rules and guidelines</li>
            <li>• <strong>DATABASE_SCHEMA.sql</strong> - Complete database schema definition</li>
            <li>• <strong>docs/PLATFORM_ARCHITECTURE.md</strong> - Detailed architecture documentation</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
