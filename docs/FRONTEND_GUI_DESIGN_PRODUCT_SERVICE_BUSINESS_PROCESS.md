# Frontend GUI Design: Product/Service Onboarding & Business Process Designer

## Overview

This document outlines the frontend GUI design for Product/Service onboarding and the Business Process Designer feature, addressing user experience, navigation, workflow triggers, and unique value propositions.

---

## 1. Landing Page & Navigation Structure

### 1.1 Main Navigation Updates

**Current Structure:**
- Studio & Workflows Section
  - Studio
  - Workflow Management
  - Workflow Templates
  - Workflow Analytics
  - Form Designer

**Updated Structure:**
- Studio & Workflows Section
  - Studio
  - Workflow Management
  - **Business Process Designer** (renamed from "Entities")
  - Workflow Templates
  - Workflow Analytics
  - Form Designer

### 1.2 Landing Page: Product/Service Onboarding Hub

**Route:** `/onboarding` or `/products-services/onboarding`

**Purpose:** Central hub for vendors and admins to onboard new Products, Services, or Agents

**Key Features:**
- **Quick Action Cards** - Three primary entry points:
  1. **Onboard Product** - For software, hardware, SaaS products
  2. **Onboard Service** - For consulting, support, managed services
  3. **Onboard Agent** - For AI agents/bots (existing)

- **Recent Onboardings** - Show last 5 products/services/agents created
- **Onboarding Status** - Show pending qualifications, approvals, workflows
- **Quick Stats** - Total products, services, agents, pending workflows

**Design:**
```
┌─────────────────────────────────────────────────────────┐
│  Product/Service Onboarding Hub                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Product   │  │   Service    │  │    Agent     │  │
│  │  Onboarding │  │  Onboarding  │  │  Onboarding  │  │
│  │             │  │              │  │              │  │
│  │  [Create]   │  │  [Create]     │  │  [Create]    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Recent Onboardings                                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Product: "Security Suite v2.0" - In Review       │   │
│  │ Service: "Managed Security Services" - Approved  │   │
│  │ Agent: "GRC Bot" - Pending Qualification        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Quick Stats                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                │
│  │  45  │  │  23  │  │  12  │  │   8  │                │
│  │Products│Services│Agents│Pending│                    │
│  └──────┘  └──────┘  └──────┘  └──────┘                │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Product/Service Onboarding Flow

### 2.1 Who Can Onboard?

**Roles with Onboarding Permissions:**
- **Vendor Users** (`vendor_user`, `vendor_coordinator`)
  - Can onboard Products/Services for their own vendor
  - Limited to their vendor's offerings
  - Can view their own onboarding status

- **Tenant Admins** (`tenant_admin`)
  - Can onboard Products/Services for any vendor in their tenant
  - Full access to all onboarding workflows
  - Can manage all products/services

- **Platform Admins** (`platform_admin`)
  - Cross-tenant access (with explicit tenant selection)
  - Full system access

### 2.2 Onboarding Wizard Flow

**Step 1: Select Entity Type**
- Product
- Service
- Agent (existing)

**Step 2: Basic Information**
- Name, Description
- Category, Type
- Vendor Selection (auto-selected for vendor users)

**Step 3: Additional Details**
- Product: SKU, Version, Pricing Model, Website
- Service: Service Level, Pricing Model
- Use Cases (rich text editor)

**Step 4: Workflow Selection**
- **Auto-Trigger:** System automatically matches workflows based on:
  - Entity type (product/service/agent)
  - Category (security, compliance, etc.)
  - Vendor attributes
- **Manual Selection:** User can choose from available workflow templates
- **Custom Workflow:** Create new workflow from template

**Step 5: Review & Submit**
- Summary of all information
- Selected workflow preview
- Submit to start workflow

### 2.3 Workflow Auto-Trigger Logic

**When Product/Service is Created:**
1. System checks `WorkflowConfiguration` for matching conditions:
   - `entity_type` matches ("product", "service", "agent", "vendor")
   - Category matches (if specified)
   - Vendor attributes match (if specified)

2. **If Match Found:**
   - Automatically create `WorkflowInstance`
   - Set initial stage (e.g., "draft", "pending_review")
   - Assign to appropriate reviewers (based on workflow rules)
   - Send notifications

3. **If No Match:**
   - Product/Service created in "draft" status
   - User can manually trigger workflow from detail page
   - Or select from workflow templates

**Example Workflow Matching:**
```python
# Workflow condition example
{
  "entity_type": ["product", "service"],
  "category": "security",
  "auto_trigger": true
}

# When product with category="security" is created:
# → Automatically triggers "Security Product Qualification" workflow
```

---

## 3. Business Process Designer (Renamed from "Entities")

### 3.1 Navigation & Location

**Menu Path:** `Studio & Workflows` → `Business Process Designer`

**Route:** `/workflows/business-process-designer` or `/business-process-designer`

**Why "Business Process Designer" not "Entity"?**
- More user-friendly, business-focused terminology
- Aligns with workflow terminology
- Better reflects the purpose: designing business processes, not just managing entities
- Matches industry standard terminology (BPMN, process modeling)

### 3.2 Landing Page: Business Process Designer

**Main View:**
- **Process Library** - List of all business processes
- **Create New Process** - Button to start new process design
- **Process Templates** - Pre-built process templates
- **Recent Processes** - Quick access to recently edited processes

**Process Categories:**
- Compliance Processes (SOC2, ISO27001, GDPR)
- Onboarding Processes (Vendor, Product, Service, Agent)
- Risk Assessment Processes
- Approval Processes
- Custom Processes

### 3.3 Process Designer Interface

**Visual Flow Builder:**
- **Canvas** - Drag-and-drop process steps
- **Toolbox** - Available step types:
  - Start/End nodes
  - Entity steps (Product, Service, Agent, Vendor, Assessment)
  - Form steps (data collection)
  - Assessment steps (qualification)
  - Workflow steps (nested workflows)
  - Decision steps (conditional branching)
  - AI Agent steps (automated processing)
  - Action steps (custom actions)

**Step Configuration Panel:**
- Step name, description
- Entity mapping (which entity this step operates on)
- Form/Assessment/Workflow selection
- Audience configuration (who can see/edit)
- Conditional branching rules
- Schedule configuration (for recurring steps)

**Process Properties:**
- Process name, description
- Entity type (product, service, agent, vendor, assessment)
- Department, Business Unit
- Process owner
- Status (draft, active, archived)

### 3.4 Unique USPs of Business Process Designer

#### 3.4.1 **Entity-Agnostic Process Design**
- **USP:** Design processes that work across all entity types (Product, Service, Agent, Vendor, Assessment)
- **Benefit:** One process template can be reused for multiple entity types
- **Example:** "Security Qualification" process works for Products, Services, and Agents

#### 3.4.2 **AI-Powered Process Steps**
- **USP:** Integrate AI agent steps directly into business processes
- **Benefit:** Automated risk assessment, compliance checking, data analysis
- **Example:** 
  - Step 1: Collect product information (Form)
  - Step 2: AI Risk Assessment (AI Agent step)
  - Step 3: Human Review (if risk > threshold)

#### 3.4.3 **Visual Process Modeling**
- **USP:** Drag-and-drop visual process builder (no code required)
- **Benefit:** Business users can design processes without technical knowledge
- **Features:**
  - Conditional branching visualization
  - Parallel process tracks
  - Real-time validation
  - Process simulation/preview

#### 3.4.4 **Template Library Integration**
- **USP:** One-click application of pre-built process templates
- **Benefit:** Start with industry best practices, customize as needed
- **Templates:**
  - SOC2 Compliance Process
  - ISO27001 Compliance Process
  - GDPR Compliance Process
  - Vendor Onboarding Process
  - Risk Assessment Process

#### 3.4.5 **Workflow Orchestration Integration**
- **USP:** Processes automatically execute as workflows with approval stages
- **Benefit:** Designed processes become executable workflows automatically
- **Flow:**
  1. Design process in Business Process Designer
  2. Process automatically creates `WorkflowConfiguration`
  3. When triggered, executes as multi-stage workflow
  4. Tracks progress, sends notifications, manages approvals

#### 3.4.6 **Multi-Stage Approval Workflows**
- **USP:** Built-in approval stages with role-based access
- **Benefit:** Enforce governance and compliance automatically
- **Features:**
  - Sequential approvals (Stage 1 → Stage 2 → Stage 3)
  - Parallel approvals (multiple reviewers simultaneously)
  - Conditional routing (high risk → additional review)
  - Escalation rules (auto-escalate if not reviewed in X days)

#### 3.4.7 **Form Designer Integration**
- **USP:** Design custom forms for each process step
- **Benefit:** Collect exactly the data needed for each stage
- **Features:**
  - Dynamic form generation per step
  - Field-level permissions
  - Conditional field visibility
  - Rich text, file uploads, structured data

#### 3.4.8 **Assessment Integration**
- **USP:** Embed qualification assessments into processes
- **Benefit:** Automated qualification workflows
- **Example:**
  - Process: "Product Qualification"
  - Step 1: Product Information Form
  - Step 2: Security Assessment (automated)
  - Step 3: Compliance Assessment
  - Step 4: Business Review
  - Step 5: Final Approval

#### 3.4.9 **Schedule & Automation**
- **USP:** Schedule recurring process steps
- **Benefit:** Automated periodic reviews, assessments, updates
- **Example:**
  - Annual compliance review (scheduled)
  - Quarterly risk assessment (scheduled)
  - Monthly vendor check-in (scheduled)

#### 3.4.10 **Process Analytics**
- **USP:** Track process performance, bottlenecks, completion times
- **Benefit:** Continuous improvement of business processes
- **Metrics:**
  - Average completion time per stage
  - Bottleneck identification
  - Success/failure rates
  - Reviewer performance

---

## 4. Workflow Trigger & Approval Process

### 4.1 Automatic Workflow Trigger

**When Product/Service is Created:**

1. **Entity Creation Event**
   ```
   POST /api/v1/products
   → Product created with status="draft"
   → Event: "product.created"
   ```

2. **Workflow Matching Service**
   ```python
   # Backend automatically checks:
   matching_workflows = WorkflowOrchestrationService.find_matching_workflows(
     entity_type="product",
     entity_id=product.id,
     entity_attributes={
       "category": product.category,
       "vendor_id": product.vendor_id
     }
   )
   ```

3. **Workflow Instance Creation**
   ```python
   # If matching workflow found:
   workflow_instance = WorkflowOrchestrationService.start_workflow(
     workflow_config_id=matching_workflow.id,
     entity_type="product",
     entity_id=product.id,
     triggered_by=current_user.id
   )
   ```

4. **Initial Stage Assignment**
   - Workflow starts at first stage (e.g., "draft", "pending_review")
   - Assignees determined by workflow rules
   - Notifications sent

### 4.2 Manual Workflow Trigger

**From Product/Service Detail Page:**

**"Start Qualification Workflow" Button:**
- Shows available workflows for this entity type
- User selects workflow template
- Creates workflow instance
- Navigates to workflow view

**Workflow Selection Modal:**
```
┌─────────────────────────────────────┐
│  Start Qualification Workflow      │
├─────────────────────────────────────┤
│                                     │
│  Available Workflows:               │
│  ○ Product Qualification (Standard)│
│  ○ Security Assessment             │
│  ○ Compliance Review               │
│  ○ Custom Workflow                 │
│                                     │
│  [Cancel]  [Start Workflow]        │
└─────────────────────────────────────┘
```

### 4.3 Approval Process Flow

**Multi-Stage Approval Example:**

**Stage 1: Information Collection (Draft)**
- **Actor:** Vendor User or Admin
- **Action:** Fill out product/service information form
- **Completion:** Submit for review

**Stage 2: Automated Assessment (In Progress)**
- **Actor:** AI Agent (automated)
- **Action:** Risk assessment, compliance check
- **Completion:** Generate assessment report

**Stage 3: Security Review (Pending Review)**
- **Actor:** Security Reviewer
- **Action:** Review security assessment, approve/reject
- **Completion:** Approve → Next stage, Reject → Back to draft

**Stage 4: Compliance Review (Pending Review)**
- **Actor:** Compliance Reviewer
- **Action:** Review compliance status, approve/reject
- **Completion:** Approve → Next stage, Reject → Back to draft

**Stage 5: Business Review (Pending Approval)**
- **Actor:** Business Owner
- **Action:** Final business decision, approve/reject
- **Completion:** Approve → Approved, Reject → Rejected

**Stage 6: Approved**
- **Status:** Product/Service is approved and active
- **Action:** Can be used in assessments, workflows, etc.

### 4.4 Workflow Status Indicators

**Visual Status Badges:**
- 🟢 **Draft** - Initial creation, not yet submitted
- 🟡 **Pending Review** - Waiting for reviewer action
- 🔵 **In Progress** - Currently being processed (AI agent, etc.)
- 🟠 **Needs Revision** - Rejected, needs changes
- ✅ **Approved** - Final approval, active
- ❌ **Rejected** - Final rejection

**Workflow Progress Bar:**
```
[████████░░░░░░░░] 50% Complete
Stage 3 of 6: Security Review
```

---

## 5. User Interface Mockups

### 5.1 Product/Service Onboarding Wizard

**Step 1: Entity Type Selection**
```
┌─────────────────────────────────────────────┐
│  Onboard New Offering                       │
├─────────────────────────────────────────────┤
│                                             │
│  What would you like to onboard?            │
│                                             │
│  ┌──────────────┐  ┌──────────────┐        │
│  │   Product    │  │   Service    │        │
│  │              │  │              │        │
│  │  Software,   │  │  Consulting,│        │
│  │  Hardware,   │  │  Support,    │        │
│  │  SaaS        │  │  Managed    │        │
│  │              │  │  Services    │        │
│  │  [Select]    │  │  [Select]    │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  ┌──────────────┐                          │
│  │    Agent     │                          │
│  │              │                          │
│  │  AI Agent,  │                          │
│  │  Bot        │                          │
│  │              │                          │
│  │  [Select]    │                          │
│  └──────────────┘                          │
│                                             │
│  [Cancel]                    [Next →]      │
└─────────────────────────────────────────────┘
```

**Step 2: Basic Information**
```
┌─────────────────────────────────────────────┐
│  Product Information                        │
├─────────────────────────────────────────────┤
│                                             │
│  Name *                    [______________]│
│                                             │
│  Description              [______________]  │
│                           [______________]  │
│                                             │
│  Category *              [Dropdown ▼]     │
│  └─ Security, Compliance, Automation...    │
│                                             │
│  Product Type *          [Dropdown ▼]     │
│  └─ Software, Hardware, SaaS...           │
│                                             │
│  Vendor *                 [Auto-selected]  │
│                                             │
│  [← Back]                    [Next →]     │
└─────────────────────────────────────────────┘
```

**Step 3: Workflow Selection**
```
┌─────────────────────────────────────────────┐
│  Select Qualification Workflow               │
├─────────────────────────────────────────────┤
│                                             │
│  Recommended Workflow:                      │
│  ┌─────────────────────────────────────┐   │
│  │ ✓ Product Qualification (Standard)  │   │
│  │   Multi-stage approval workflow     │   │
│  │   Includes: Security, Compliance,   │   │
│  │   Business Review                   │   │
│  │   [Use This Workflow]               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Other Available Workflows:                 │
│  • Security Assessment Only                 │
│  • Compliance Review Only                   │
│  • Custom Workflow                          │
│                                             │
│  [← Back]              [Skip]  [Continue] │
└─────────────────────────────────────────────┘
```

### 5.2 Business Process Designer Interface

**Main Canvas View:**
```
┌─────────────────────────────────────────────────────────────┐
│  Business Process Designer - "Product Qualification"          │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│ Toolbox  │  Canvas                                           │
│          │  ┌──────┐                                         │
│ [Start]  │  │Start │                                         │
│ [End]    │  └──┬───┘                                         │
│          │     │                                              │
│ [Entity] │     ▼                                              │
│ [Form]   │  ┌──────────────┐                                 │
│ [Assess] │  │Product Info  │                                 │
│ [Workflow│  │(Form Step)   │                                 │
│ [Decision│  └──┬───────────┘                                 │
│ [AI Agent│     │                                              │
│ [Action] │     ▼                                              │
│          │  ┌──────────────┐                                 │
│          │  │Risk Assess   │                                 │
│          │  │(AI Agent)    │                                 │
│          │  └──┬───────────┘                                 │
│          │     │                                              │
│          │     ├─[High Risk]──►┌──────────────┐             │
│          │     │               │Security Rev. │             │
│          │     └─[Low Risk]───►┌──────────────┐             │
│          │                     │Compliance    │             │
│          │                     │Review        │             │
│          │                     └──┬───────────┘             │
│          │                        │                           │
│          │                        ▼                           │
│          │                     ┌──────────────┐              │
│          │                     │   End        │              │
│          │                     └──────────────┘              │
│          │                                                    │
├──────────┴───────────────────────────────────────────────────┤
│  [Save]  [Preview]  [Publish]  [Settings]                    │
└─────────────────────────────────────────────────────────────┘
```

**Step Configuration Panel:**
```
┌─────────────────────────────────────────────┐
│  Configure Step: "Risk Assessment"          │
├─────────────────────────────────────────────┤
│                                             │
│  Step Name:        [Risk Assessment]       │
│                                             │
│  Step Type:        [AI Agent ▼]            │
│                                             │
│  AI Agent:         [GRC Agent ▼]           │
│                                             │
│  Skill:            [risk_assessment ▼]      │
│                                             │
│  Input Data:                                │
│  ┌─────────────────────────────────────┐   │
│  │ entity_id: ${workflow.entity_id}    │   │
│  │ entity_type: ${workflow.entity_type}│   │
│  │ assessment_type: comprehensive       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  On Success:        [Continue ▼]           │
│  On Failure:        [Escalate ▼]           │
│                                             │
│  Audience (Who can see this step):         │
│  ☑ Security Reviewer                        │
│  ☑ Compliance Reviewer                       │
│  ☐ Vendor User                              │
│                                             │
│  [Cancel]                    [Save]        │
└─────────────────────────────────────────────┘
```

---

## 6. Integration Points

### 6.1 Product/Service Detail Pages

**Enhanced Product Detail Page:**
- **Overview Tab:** Basic information, status, workflow progress
- **Workflow Tab:** Current workflow status, stages, approvals
- **Assessments Tab:** Related assessments and qualifications
- **Agents Tab:** Tagged agents (for products)
- **Use Cases Tab:** Use case documentation
- **Architecture Tab:** Architecture diagrams and documentation
- **Landscape Tab:** Technology landscape positioning

**Workflow Section:**
```
┌─────────────────────────────────────────────┐
│  Qualification Workflow                      │
├─────────────────────────────────────────────┤
│                                             │
│  Status: 🟡 Pending Review                  │
│                                             │
│  Progress: [████████░░░░░░░░] 50%          │
│                                             │
│  Current Stage: Security Review            │
│  Assigned To: John Doe (Security Team)     │
│                                             │
│  Workflow Stages:                          │
│  ✅ 1. Information Collection (Complete)    │
│  ✅ 2. Automated Risk Assessment (Complete)│
│  🟡 3. Security Review (In Progress)       │
│  ⏳ 4. Compliance Review (Pending)         │
│  ⏳ 5. Business Review (Pending)            │
│  ⏳ 6. Final Approval (Pending)             │
│                                             │
│  [View Full Workflow]  [Add Comment]        │
└─────────────────────────────────────────────┘
```

### 6.2 Dashboard Integration

**Executive Dashboard:**
- **Onboarding Metrics:**
  - Products/Services pending approval
  - Average onboarding time
  - Approval rate by entity type

**Workflow Dashboard:**
- **Process Performance:**
  - Active processes
  - Average completion time
  - Bottleneck stages
  - Success/failure rates

---

## 7. User Roles & Permissions

### 7.1 Vendor Users
- ✅ Create Products/Services for their vendor
- ✅ View their own onboarding workflows
- ✅ Submit information for workflow stages
- ❌ Cannot approve workflows
- ❌ Cannot design business processes

### 7.2 Tenant Admins
- ✅ Create Products/Services for any vendor
- ✅ Design business processes
- ✅ Approve workflows
- ✅ Manage all workflows
- ✅ Access workflow analytics

### 7.3 Reviewers (Security, Compliance, Business)
- ✅ View assigned workflow stages
- ✅ Approve/reject workflow stages
- ✅ Add comments and feedback
- ❌ Cannot create Products/Services
- ❌ Cannot design business processes

---

## 8. Implementation Checklist

### 8.1 Navigation Updates
- [ ] Rename "Entities" to "Business Process Designer" in navigation
- [ ] Update route from `/entities` to `/workflows/business-process-designer`
- [ ] Update menu permissions

### 8.2 Onboarding Hub
- [ ] Create `/onboarding` landing page
- [ ] Create Product onboarding wizard
- [ ] Create Service onboarding wizard
- [ ] Integrate workflow auto-trigger
- [ ] Add onboarding status dashboard

### 8.3 Business Process Designer
- [ ] Update Entities.tsx to BusinessProcessDesigner.tsx
- [ ] Enhance visual flow builder
- [ ] Add AI agent step configuration
- [ ] Integrate workflow templates
- [ ] Add process analytics

### 8.4 Workflow Integration
- [ ] Implement workflow auto-trigger on Product/Service creation
- [ ] Add workflow selection UI
- [ ] Enhance workflow status indicators
- [ ] Add workflow progress tracking

### 8.5 Product/Service Detail Pages
- [ ] Add workflow status section
- [ ] Add workflow history
- [ ] Add approval actions
- [ ] Integrate with Business Process Designer

---

## 9. Success Metrics

### 9.1 User Experience
- **Onboarding Time:** Reduce from manual process to < 5 minutes
- **Workflow Automation:** 80%+ workflows auto-triggered
- **Process Design:** Non-technical users can design processes

### 9.2 Business Value
- **Approval Time:** Reduce average approval time by 40%
- **Compliance:** 100% of products/services go through qualification
- **Visibility:** Real-time visibility into all onboarding workflows

### 9.3 Adoption
- **Template Usage:** 70%+ workflows use templates
- **Process Reuse:** Processes reused across multiple entity types
- **User Satisfaction:** High satisfaction with Business Process Designer

---

## 10. Future Enhancements

### 10.1 Advanced Features
- **Process Versioning:** Version control for business processes
- **Process Simulation:** Test processes before deployment
- **Process Mining:** Analyze actual process execution vs. design
- **Collaborative Design:** Multiple users design processes together

### 10.2 Integration Enhancements
- **External System Integration:** Trigger processes from external systems
- **API-Based Process Execution:** Execute processes via API
- **Webhook Triggers:** Start processes from webhook events

### 10.3 Analytics & Reporting
- **Process Performance Dashboard:** Real-time process metrics
- **Predictive Analytics:** Predict process completion times
- **Bottleneck Analysis:** Identify and resolve bottlenecks automatically

---

## Conclusion

This frontend GUI design provides a comprehensive, user-friendly interface for Product/Service onboarding and Business Process Designer, with clear workflows, intuitive navigation, and powerful automation capabilities. The design emphasizes:

1. **Ease of Use:** Simple onboarding wizards, visual process design
2. **Automation:** Auto-triggered workflows, AI-powered steps
3. **Visibility:** Clear status indicators, progress tracking
4. **Flexibility:** Template-based, customizable processes
5. **Governance:** Multi-stage approvals, role-based access

The Business Process Designer serves as the central hub for designing, managing, and executing business processes across all entity types, making it a unique and powerful tool for TPRM and GRC workflows.
