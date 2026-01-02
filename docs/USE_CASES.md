# VAKA Platform - Use Cases

## Overview
This document describes the primary use cases for the VAKA Agentic AI & RAG-powered platform.

---

## Use Case Categories

1. **Agent Management & Discovery**
2. **Flow Creation & Execution**
3. **Assessment & Compliance**
4. **Risk Management**
5. **Vendor Management**
6. **Integration & Automation**

---

## 1. Agent Management & Discovery

### UC-001: Discover Available Agents
**Actor**: Platform User (Admin, Reviewer, Vendor)
**Goal**: Find agents available for use in flows

**Preconditions**:
- User is logged in
- User has access to Studio

**Main Flow**:
1. User navigates to VAKA Studio
2. User clicks "Agents" tab
3. System displays all available agents:
   - VAKA agents (AI GRC, Assessment, Vendor, Compliance Reviewer)
   - External agents (via MCP connections)
   - Marketplace agents
4. User can filter by:
   - Agent type
   - Skills
   - Source (VAKA, External, Marketplace)
   - Category
5. User views agent details (name, type, skills, capabilities)

**Postconditions**:
- User can see all available agents
- User can select agents for flow creation

---

### UC-002: Execute Agent Skill Directly
**Actor**: Platform User
**Goal**: Execute an agent skill without creating a flow

**Preconditions**:
- User is logged in
- Agent is available in Studio

**Main Flow**:
1. User navigates to Studio → Agents
2. User clicks "Execute Agent" on an agent card
3. Modal opens with:
   - Skill selection dropdown
   - Form-based input configuration (no JSON)
4. User selects skill (e.g., "assessment")
5. Form appears with relevant fields:
   - Assessment Type dropdown
   - Agent Selection (Agent/Category/Vendor/All)
   - Optional trigger data toggle
6. User configures inputs using dropdowns
7. User clicks "Execute"
8. System executes agent skill
9. System displays results

**Postconditions**:
- Agent skill executed successfully
- Results displayed to user
- Execution logged

---

## 2. Flow Creation & Execution

### UC-003: Create Business Flow (Form-Based)
**Actor**: Business User (Non-technical)
**Goal**: Create an assessment flow without technical knowledge

**Preconditions**:
- User is logged in
- User has access to Studio
- Vendors and agents exist in system

**Main Flow**:
1. User navigates to Studio → Flows
2. User clicks "+ Business Flow"
3. User enters flow information:
   - Flow Name: "TPRM Assessment Q1 2024"
   - Description: "Quarterly TPRM assessment"
4. User selects vendor from dropdown
5. System shows agents for selected vendor
6. User selects agents (multi-select or "Select All")
7. User selects assessment type: "TPRM"
8. User enables "Include Risk Analysis"
9. User reviews flow preview
10. User clicks "Save Flow"
11. System creates flow with friendly node names

**Postconditions**:
- Flow created and saved
- Flow appears in Flows list
- Flow ready for execution

---

### UC-004: Create Advanced Flow (Visual Builder)
**Actor**: Technical User (Developer, Admin)
**Goal**: Create complex flow with full control

**Preconditions**:
- User is logged in
- User has access to Studio
- Agents available

**Main Flow**:
1. User navigates to Studio → Flows
2. User clicks "+ Advanced Flow"
3. User enters flow details:
   - Flow Name: "Comprehensive Vendor Assessment"
   - Description: "Multi-stage assessment with risk analysis"
   - Category: "assessment"
4. User adds nodes:
   - Node 1: Assessment Agent → assessment skill
   - Node 2: AI GRC Agent → realtime_risk_analysis skill
   - Node 3: Compliance Reviewer → compliance_review skill
5. For each node:
   - User sets friendly name: "TPRM Assessment Step 1"
   - User selects agent and skill
   - User configures input using form (no JSON)
   - User adds custom attributes (priority, timeout, etc.)
6. User connects nodes (edges)
7. User reviews flow structure
8. User clicks "Create Flow"
9. System validates and saves flow

**Postconditions**:
- Complex flow created
- All nodes configured
- Flow ready for execution

---

### UC-005: Execute Flow
**Actor**: Platform User
**Goal**: Execute a saved flow

**Preconditions**:
- Flow exists and is in draft or active status
- User has permission to execute flows

**Main Flow**:
1. User navigates to Studio → Flows
2. User views flow list
3. User clicks "Execute" on a flow
4. System prompts for context:
   - Context ID (e.g., agent_id, vendor_id)
   - Context Type (e.g., "agent", "vendor")
5. User enters context information
6. User clicks "Execute"
7. System:
   - Expands agent selections (if using categories/vendors)
   - Executes nodes sequentially
   - Handles errors and retries
   - Aggregates results
8. System displays execution results

**Postconditions**:
- Flow executed successfully
- Results available
- Execution logged

---

## 3. Assessment & Compliance

### UC-006: TPRM Assessment Flow
**Actor**: GRC Team
**Goal**: Perform Third-Party Risk Management assessment

**Preconditions**:
- Vendor and agents exist
- TPRM flow template available

**Main Flow**:
1. User creates flow: "TPRM Assessment for Vendor ABC"
2. User selects vendor: "ABC Corp"
3. User selects all agents from vendor
4. User selects assessment type: "TPRM"
5. User enables risk analysis
6. User saves flow
7. User executes flow with vendor context
8. System:
   - Assessment Agent performs TPRM on each agent
   - AI GRC Agent performs risk analysis
   - Results aggregated
9. User reviews assessment results and risk scores

**Postconditions**:
- TPRM assessment completed
- Risk scores calculated
- Recommendations provided

---

### UC-007: Vendor Qualification Assessment
**Actor**: Procurement Team
**Goal**: Qualify a vendor before onboarding

**Preconditions**:
- Vendor exists in system
- Assessment Agent available

**Main Flow**:
1. User creates flow: "Vendor Qualification - New Vendor"
2. User selects vendor from dropdown
3. User selects assessment type: "vendor_qualification"
4. User saves flow
5. User executes flow
6. System:
   - Assessment Agent queries RAG for qualification criteria
   - Assessment Agent evaluates vendor against criteria
   - Generates qualification score and recommendations
7. User reviews qualification results

**Postconditions**:
- Vendor qualification completed
- Qualification status determined
- Recommendations provided

---

## 4. Risk Management

### UC-008: Real-Time Risk Analysis
**Actor**: Security Team
**Goal**: Analyze risk for agents in real-time

**Preconditions**:
- Agents exist in system
- AI GRC Agent available

**Main Flow**:
1. User navigates to Studio → Agents
2. User clicks "Execute Agent" on AI GRC Agent
3. User selects skill: "realtime_risk_analysis"
4. User selects agents:
   - Mode: "Category"
   - Categories: "Security & Compliance", "AI_AGENT"
   - Condition: "All Matching"
5. System shows: "X agents will be analyzed"
6. User clicks "Execute"
7. System:
   - Expands selection to actual agent IDs
   - AI GRC Agent analyzes each agent
   - Queries RAG for risk indicators
   - Generates risk scores and alerts
8. User reviews risk analysis results

**Postconditions**:
- Risk analysis completed
- Risk scores calculated
- Alerts generated for high-risk agents

---

### UC-009: Bulk Risk Assessment by Vendor
**Actor**: GRC Team
**Goal**: Assess risk for all agents from a vendor

**Preconditions**:
- Vendor exists with multiple agents
- Flow template available

**Main Flow**:
1. User creates flow: "Risk Assessment - Vendor XYZ"
2. User selects vendor: "XYZ Corp"
3. User selects agent selection mode: "Vendor"
4. User selects condition: "All Matching"
5. User selects skill: "realtime_risk_analysis"
6. User saves flow
7. User executes flow
8. System analyzes all agents from vendor
9. User reviews aggregated risk report

**Postconditions**:
- All vendor agents analyzed
- Risk report generated
- High-risk agents flagged

---

## 5. Vendor Management

### UC-010: Vendor Onboarding Flow
**Actor**: Vendor Management Team
**Goal**: Onboard a new vendor with automated checks

**Preconditions**:
- Vendor registration completed
- Onboarding flow template available

**Main Flow**:
1. User creates flow: "Vendor Onboarding - New Vendor"
2. User selects vendor from dropdown
3. User adds nodes:
   - Node 1: Vendor Agent → vendor_qualification
   - Node 2: Assessment Agent → assessment (type: vendor_qualification)
   - Node 3: Compliance Reviewer → compliance_review
4. User configures each node with form inputs
5. User saves flow
6. User executes flow with vendor context
7. System performs automated onboarding checks
8. User reviews onboarding results

**Postconditions**:
- Vendor onboarding checks completed
- Qualification status determined
- Onboarding workflow initiated

---

### UC-011: Marketplace Review Analysis
**Actor**: Vendor Relations Team
**Goal**: Analyze marketplace reviews for a vendor

**Preconditions**:
- Vendor exists
- Marketplace reviews available
- Assessment Agent available

**Main Flow**:
1. User creates flow: "Marketplace Review Analysis"
2. User selects vendor from dropdown
3. User selects skill: "marketplace_reviews"
4. User saves flow
5. User executes flow
6. System:
   - Assessment Agent retrieves reviews
   - Analyzes sentiment and ratings
   - Generates review summary
7. User reviews analysis results

**Postconditions**:
- Marketplace reviews analyzed
- Review summary generated
- Recommendations provided

---

## 6. Integration & Automation

### UC-012: Automated Assessment Workflow
**Actor**: System (Automated)
**Goal**: Automatically trigger assessments based on events

**Preconditions**:
- Flow template exists
- Event triggers configured
- WorkflowConfigurations integrated

**Main Flow**:
1. System event occurs (e.g., agent submitted)
2. WorkflowConfiguration triggers AgenticFlow
3. System executes flow:
   - Assessment Agent performs assessment
   - AI GRC Agent performs risk analysis
   - Results stored
4. System updates WorkflowConfiguration status
5. System notifies stakeholders

**Postconditions**:
- Automated assessment completed
- Workflow status updated
- Notifications sent

---

### UC-013: i18N Platform Integration
**Actor**: Integration User
**Goal**: Use VAKA agents to send questionnaires via i18N platform

**Preconditions**:
- i18N platform connected via MCP
- Flow template available

**Main Flow**:
1. User creates flow: "i18N Questionnaire Distribution"
2. User adds nodes:
   - Node 1: External Agent (i18N) → send_questionnaire
   - Node 2: Assessment Agent → assessment
3. User configures:
   - Questionnaire selection
   - Recipient selection (agents, vendors)
   - Assessment criteria
4. User saves and executes flow
5. System:
   - Sends questionnaires via i18N platform
   - Collects responses
   - Performs assessment on responses
6. User reviews results

**Postconditions**:
- Questionnaires sent
- Responses collected
- Assessment completed

---

## Use Case Matrix

| Use Case | Priority | Status | Complexity |
|----------|----------|--------|------------|
| UC-001: Discover Agents | P0 | ✅ Complete | Low |
| UC-002: Execute Agent | P0 | ✅ Complete | Medium |
| UC-003: Business Flow | P0 | ✅ Complete | Medium |
| UC-004: Advanced Flow | P0 | ✅ Complete | High |
| UC-005: Execute Flow | P0 | ⚠️ Partial | Medium |
| UC-006: TPRM Assessment | P0 | ✅ Complete | Medium |
| UC-007: Vendor Qualification | P1 | ✅ Complete | Low |
| UC-008: Real-Time Risk | P0 | ✅ Complete | Medium |
| UC-009: Bulk Risk Assessment | P1 | ✅ Complete | Medium |
| UC-010: Vendor Onboarding | P1 | ⚠️ Partial | High |
| UC-011: Marketplace Reviews | P1 | ✅ Complete | Low |
| UC-012: Automated Workflow | P1 | ❌ Pending | High |
| UC-013: i18N Integration | P2 | ❌ Pending | High |

**Legend**:
- ✅ Complete
- ⚠️ Partial (needs work)
- ❌ Pending

---

## Use Case Dependencies

```
UC-001 (Discover Agents)
  ↓
UC-002 (Execute Agent) ──→ UC-005 (Execute Flow)
  ↓
UC-003 (Business Flow) ──→ UC-006 (TPRM Assessment)
  ↓
UC-004 (Advanced Flow) ──→ UC-010 (Vendor Onboarding)
  ↓
UC-012 (Automated Workflow) ──→ UC-013 (i18N Integration)
```

---

## Success Criteria

### For Each Use Case:
1. **Functionality**: All steps execute successfully
2. **Performance**: Completes within acceptable time
3. **User Experience**: Intuitive and easy to use
4. **Error Handling**: Graceful error handling
5. **Logging**: All actions logged for audit

### Platform-Level:
1. **Reliability**: 99.9% success rate
2. **Scalability**: Handles 1000+ concurrent executions
3. **Security**: All data properly isolated
4. **Usability**: No technical knowledge required for business flows

---

## Notes

- Use cases are continuously updated based on user feedback
- New use cases added as platform evolves
- Each use case should have corresponding test cases
