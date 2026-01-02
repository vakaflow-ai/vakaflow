# 📋 Project Rules and Guidelines

> **📚 For comprehensive coding standards and best practices, see [CODING_STANDARDS.md](./CODING_STANDARDS.md)**
> 
> **🎯 Workspace rules for Cursor AI are defined in [.cursorrules](./.cursorrules)**

## 🌱 Seed Data Management

### Seed Data Script

The project includes a comprehensive seed data script for policies, compliance rules, and review stages.

**Location**: `backend/scripts/seed_data.py`

**Usage**:
```bash
cd backend
source venv/bin/activate
python3 scripts/seed_data.py
```

### Seed Data Contents

#### 1. Policies (8 policies)
- **GDPR Compliance Policy** - EU data protection requirements
- **SOC 2 Type II Compliance** - Security and availability standards
- **HIPAA Compliance Policy** - US healthcare data protection
- **CCPA Compliance Policy** - California privacy requirements
- **ISO 27001 Security Controls** - Information security management
- **PCI DSS Compliance** - Payment card data security
- **Internal Security Policy** - Company security standards
- **Data Privacy Policy** - General privacy requirements

Each policy includes:
- Name, description, category, type, region
- Version and effective dates
- Requirements list
- Rules (JSON) for automated checking

#### 2. Review Stages (4 stages)
- **Security Review** (order: 1) - Security aspects review
- **Compliance Review** (order: 2) - Regulatory compliance review
- **Technical Review** (order: 3) - Technical implementation review
- **Business Review** (order: 4) - Business value and ROI review

Each stage includes:
- Name, order index, description
- Required flag
- Auto-assign flag

#### 3. Compliance Rules
- Rules are embedded in policy definitions (JSON format)
- Rules include validation criteria, requirements, and automated checking logic
- Rules support different compliance frameworks (GDPR, HIPAA, SOC 2, etc.)

### Running Seed Data

**Initial Setup**:
```bash
# Make sure database is running
./manage.sh start

# Run seed script
cd backend
source venv/bin/activate
python3 scripts/seed_data.py
```

**Re-running Seed Data**:
- The script checks for existing records and skips duplicates
- Safe to run multiple times
- Updates existing records if needed

### Seed Data Rules

1. **Idempotency**: Script can be run multiple times safely
2. **Uniqueness**: Policies identified by name + version
3. **Review Stages**: Identified by name (unique)
4. **No Deletion**: Seed script only creates, never deletes
5. **Platform-Wide**: Policies are created without tenant_id (platform-wide)

## 🔐 Security Rules

### Authentication
- JWT tokens required for all API endpoints (except public)
- Token expiration: 24 hours
- Password requirements: min 8 chars, 1 letter, 1 number

### Authorization
- Role-based access control (RBAC)
- Stage-specific review permissions
- Approver-only final approval
- Tenant isolation for multi-tenant data

### Data Protection
- Passwords hashed with bcrypt
- Input validation and sanitization
- SQL injection prevention (SQLAlchemy ORM)
- XSS prevention (input sanitization)
- CORS configured for allowed origins only

## 📊 Review Workflow Rules

### Review Stages Order
1. **Security** (order_index: 1)
2. **Compliance** (order_index: 2)
3. **Technical** (order_index: 3)
4. **Business** (order_index: 4)

### Review Status Flow
```
pending → in_progress → approved
                      ↓
                   rejected
                      ↓
                needs_revision
```

### Agent Status Flow
```
draft → submitted → in_review → approved
                              ↓
                           rejected
                              ↓
                           draft (if needs_revision)
```

### Review Completion Rules
- All 4 review stages must be approved before final approval
- Any rejection moves agent to rejected status
- Needs revision moves agent back to draft
- Approver can only approve/reject after all reviews complete

## ✅ Compliance Rules

### Policy Categories
- **Security**: Security-related policies (SOC 2, ISO 27001, PCI DSS)
- **Compliance**: Regulatory compliance (GDPR, HIPAA, CCPA)
- **Technical**: Technical standards
- **Business**: Business requirements

### Policy Types
- **Regulatory**: Government regulations (GDPR, HIPAA, CCPA)
- **Internal**: Company internal policies
- **Standard**: Industry standards (ISO 27001, SOC 2, PCI DSS)

### Compliance Checking
- Automated checks use RAG (Retrieval-Augmented Generation)
- Manual checks require reviewer input
- Compliance score calculated (0-100)
- Evidence stored for audit trail

## 🎯 Agent Submission Rules

### Required Fields
- Name, type, version (required)
- Category, description (optional)
- Vendor ID (required)

### Status Rules
- New agents start as `draft`
- Must be `submitted` to enter review
- Cannot edit after `submitted` (unless rejected/revision)
- `approved` agents appear in catalog

### Artifact Rules
- File uploads supported
- Types: documentation, code, certifications, etc.
- Stored with metadata (type, size, mime_type)

## 👥 User Role Rules

### Role Permissions

| Role | Submit | Review | Approve | Admin |
|------|--------|--------|---------|-------|
| vendor_user | ✅ | ❌ | ❌ | ❌ |
| security_reviewer | ❌ | ✅ (security) | ❌ | ❌ |
| compliance_reviewer | ❌ | ✅ (compliance) | ❌ | ❌ |
| technical_reviewer | ❌ | ✅ (technical) | ❌ | ❌ |
| business_reviewer | ❌ | ✅ (business) | ❌ | ❌ |
| approver | ❌ | ❌ | ✅ | ❌ |
| tenant_admin | ✅ | ✅ (all) | ✅ | ✅ (tenant) |
| platform_admin | ✅ | ✅ (all) | ✅ | ✅ (platform) |

### Stage-Specific Reviews
- Security reviewer can only review `security` stage
- Compliance reviewer can only review `compliance` stage
- Technical reviewer can only review `technical` stage
- Business reviewer can only review `business` stage
- Tenant admin can review any stage
- Platform admin can review any stage

## 🔄 Workflow Rules

### Review Workflow
1. Vendor submits agent → `submitted`
2. First review approved → `in_review`
3. All 4 reviews approved → Ready for approver
4. Approver approves → `approved`
5. Any rejection → `rejected`
6. Needs revision → `draft`

### Approval Workflow
- Only agents with all 4 reviews approved can be approved
- Approver must provide notes (optional for approval, required for rejection)
- Approval creates approval instance
- Rejection requires detailed reason

### Notification Rules
- Status changes trigger audit logs
- Messages/comments notify relevant users
- Real-time dashboard updates (30s refresh)

## 📝 Code Standards

> **📚 For comprehensive coding standards, see [CODING_STANDARDS.md](./CODING_STANDARDS.md)**

### Core Principles
- **Maintainability**: Code should be easy to understand, modify, and extend
- **Usability**: User experience is paramount - intuitive, responsive, accessible
- **Security**: Security by design - never trust user input, always validate
- **Performance**: Optimize for both developer and runtime performance
- **Scalability**: Design for growth - handle increased load gracefully
- **Reliability**: Fail gracefully, provide clear error messages, log appropriately

### Backend Standards
- **Language**: Python 3.11+
- **Framework**: FastAPI for API
- **ORM**: SQLAlchemy 2.0
- **Validation**: Pydantic for request/response validation
- **Type Safety**: Type hints required for all functions
- **Error Handling**: Use appropriate HTTP status codes, clear error messages
- **Security**: Input validation, SQL injection prevention, XSS prevention
- **Testing**: pytest for unit/integration tests
- **Code Style**: Black (formatting), Ruff (linting), mypy (type checking)

### Frontend Standards
- **Language**: TypeScript (strict mode)
- **Framework**: React 18+ with hooks
- **State Management**: TanStack Query for server state, useState for local state
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui components
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Performance**: Code splitting, lazy loading, React.memo optimization
- **Error Handling**: Comprehensive error states and user-friendly messages
- **Code Style**: ESLint, Prettier, TypeScript compiler

### Database Standards
- **Database**: PostgreSQL 15+
- **Migrations**: Alembic (never modify existing migrations)
- **Primary Keys**: UUID (not sequential integers)
- **Indexes**: On foreign keys and frequently queried fields
- **Constraints**: Use database-level constraints (unique, foreign key, NOT NULL)
- **Transactions**: Use for multi-step operations
- **Connection Pooling**: Configured appropriately

### Design Patterns
- **Separation of Concerns**: Business logic in services, not API routes
- **DRY**: Extract common functionality into reusable components/functions
- **SOLID Principles**: Follow Single Responsibility, Open/Closed, etc.
- **Service Layer**: Keep API routes thin, delegate to services
- **Repository Pattern**: For complex data access patterns

## 🚀 Deployment Rules

### Environment Variables
- Required: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`
- Optional: `REDIS_URL`, `QDRANT_URL`, `LOG_LEVEL`

### Database Migrations
- Always use Alembic migrations
- Never modify migrations after deployment
- Test migrations on staging first

### Service Management
- Use `manage.sh` script for service management
- Services: PostgreSQL, Redis, Qdrant, Backend, Frontend
- Ports: 5433 (PostgreSQL), 6379 (Redis), 6333 (Qdrant), 8000 (Backend), 3000 (Frontend)

## 📚 Documentation Rules

### Code Documentation
- Docstrings for all functions and classes
- Type hints for function parameters and returns
- Comments for complex logic

### API Documentation
- FastAPI auto-generates OpenAPI docs
- Available at `/api/docs` and `/api/redoc`
- Include descriptions in endpoint docstrings

### Project Documentation
- Markdown files in project root
- Keep documentation up to date
- Document all major features and workflows

## 🔍 Testing Rules

### Before Deployment
- Test all user journeys
- Verify role permissions
- Check workflow transitions
- Validate compliance checks
- Test error handling

### Seed Data Testing
- Run seed script after fresh database setup
- Verify all policies and stages created
- Check compliance rules are accessible

## 📋 Maintenance Rules

### Regular Tasks
- Review and update policies quarterly
- Update compliance rules as regulations change
- Review and update seed data annually
- Monitor audit logs for issues
- Update dependencies regularly

### Seed Data Updates
- Add new policies to seed script
- Update existing policies if regulations change
- Never delete policies (mark as inactive)
- Version policies when making changes

---

**Last Updated**: 2024-01-15
**Version**: 1.0

