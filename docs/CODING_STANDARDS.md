# 🎯 Coding Standards & Best Practices

## Table of Contents
1. [General Principles](#general-principles)
2. [Security Standards](#security-standards)
3. [Code Quality](#code-quality)
4. [Backend Standards (Python/FastAPI)](#backend-standards)
5. [Frontend Standards (TypeScript/React)](#frontend-standards)
6. [Database Standards](#database-standards)
7. [API Design Standards](#api-design-standards)
8. [Error Handling](#error-handling)
9. [Testing Standards](#testing-standards)
10. [Documentation Standards](#documentation-standards)
11. [Performance Standards](#performance-standards)
12. [Accessibility Standards](#accessibility-standards)

---

## General Principles

### Core Values
1. **Maintainability**: Code should be easy to understand, modify, and extend
2. **Usability**: User experience is paramount - intuitive, responsive, accessible
3. **Security**: Security by design - never trust user input, always validate
4. **Performance**: Optimize for both developer and runtime performance
5. **Scalability**: Design for growth - handle increased load gracefully
6. **Reliability**: Fail gracefully, provide clear error messages, log appropriately

### Design Patterns
- **Separation of Concerns**: Business logic separate from presentation and data access
- **DRY (Don't Repeat Yourself)**: Extract common functionality into reusable components/functions
- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **Composition over Inheritance**: Prefer composition for flexibility
- **Fail Fast**: Validate early, fail with clear messages
- **Explicit over Implicit**: Make code intentions clear through naming and structure

---

## Security Standards

### Input Validation
- ✅ **Always validate and sanitize all user inputs**
- ✅ **Use type-safe schemas (Pydantic for backend, Zod for frontend)**
- ✅ **Validate on both client and server (defense in depth)**
- ✅ **Reject invalid input immediately with clear error messages**
- ✅ **Never trust client-side validation alone**

```python
# ✅ GOOD: Pydantic validation
class RequirementCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    requirement_type: str = Field(..., pattern="^(compliance|risk|questionnaires)$")
    
# ❌ BAD: No validation
def create_requirement(data: dict):
    label = data.get('label')  # No validation!
```

### Authentication & Authorization
- ✅ **Use JWT tokens with appropriate expiration**
- ✅ **Implement role-based access control (RBAC)**
- ✅ **Enforce tenant isolation for multi-tenant data**
- ✅ **Use dependency injection for permission checks**
- ✅ **Never expose sensitive data in error messages**

```python
# ✅ GOOD: Permission check via dependency
@router.post("", dependencies=[Depends(require_requirement_management_permission)])
async def create_requirement(...):
    ...

# ❌ BAD: Manual check in every endpoint
if user.role != 'admin':
    raise HTTPException(...)
```

### Data Protection
- ✅ **Hash passwords with bcrypt (never store plaintext)**
- ✅ **Use parameterized queries (SQLAlchemy ORM prevents SQL injection)**
- ✅ **Sanitize output to prevent XSS**
- ✅ **Use HTTPS in production**
- ✅ **Implement CORS properly (whitelist origins)**
- ✅ **Never log sensitive data (passwords, tokens, PII)**

### Secrets Management
- ✅ **Store secrets in environment variables, never in code**
- ✅ **Use `.env` files for local development (gitignored)**
- ✅ **Rotate secrets regularly**
- ✅ **Use different secrets for dev/staging/production**

---

## Code Quality

### Code Organization
- ✅ **Follow consistent file structure**
- ✅ **Group related functionality together**
- ✅ **Keep files focused (single responsibility)**
- ✅ **Limit file size (aim for < 500 lines, max 1000 lines)**
- ✅ **Use meaningful directory structure**

```
✅ GOOD Structure:
backend/app/
├── api/v1/          # API endpoints
├── core/            # Core configuration
├── models/          # Database models
├── schemas/         # Pydantic schemas
├── services/        # Business logic
└── utils/           # Utility functions

frontend/src/
├── components/      # Reusable components
├── pages/           # Page components
├── lib/             # API clients, utilities
├── hooks/           # Custom React hooks
└── types/           # TypeScript types
```

### Naming Conventions

#### Python (Backend)
- ✅ **Classes**: `PascalCase` (e.g., `SubmissionRequirement`)
- ✅ **Functions/Variables**: `snake_case` (e.g., `create_requirement`)
- ✅ **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- ✅ **Private**: Prefix with `_` (e.g., `_internal_helper`)
- ✅ **Type hints**: Always use type hints for function parameters and returns

```python
# ✅ GOOD
class SubmissionRequirement(Base):
    def get_catalog_id(self) -> str:
        ...

# ❌ BAD
class submissionRequirement:  # Wrong case
    def GetCatalogId(self):  # Wrong case, no type hints
        ...
```

#### TypeScript (Frontend)
- ✅ **Components**: `PascalCase` (e.g., `SubmissionRequirementsManagement`)
- ✅ **Functions/Variables**: `camelCase` (e.g., `handleSubmit`)
- ✅ **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- ✅ **Types/Interfaces**: `PascalCase` (e.g., `SubmissionRequirement`)
- ✅ **Files**: `PascalCase` for components, `camelCase` for utilities

```typescript
// ✅ GOOD
interface SubmissionRequirement {
  catalog_id?: string
}

const handleSubmit = (e: React.FormEvent): void => {
  ...
}

// ❌ BAD
interface submissionRequirement {  // Wrong case
  ...
}
const HandleSubmit = () => {  // Wrong case
  ...
}
```

### Code Comments
- ✅ **Explain WHY, not WHAT** (code should be self-documenting)
- ✅ **Document complex business logic**
- ✅ **Add TODO comments with context and owner**
- ✅ **Keep comments up to date with code changes**
- ✅ **Use docstrings for public functions/classes**

```python
# ✅ GOOD: Explains why
# Auto-generate field_name from label to avoid long technical IDs
# Users should only see human-readable catalog IDs
field_name = generate_from_label(label)

# ❌ BAD: States the obvious
# Set field_name to label
field_name = label
```

---

## Backend Standards (Python/FastAPI)

### Type Safety
- ✅ **Always use type hints**
- ✅ **Use Pydantic models for request/response validation**
- ✅ **Use `Optional[T]` for nullable values**
- ✅ **Use `Union` types when multiple types are valid**

```python
# ✅ GOOD
from typing import Optional, List
from pydantic import BaseModel, Field

def create_requirement(
    requirement_data: RequirementCreate,
    current_user: User,
    db: Session
) -> RequirementResponse:
    ...

# ❌ BAD: No type hints
def create_requirement(data, user, db):
    ...
```

### Error Handling
- ✅ **Use appropriate HTTP status codes**
- ✅ **Provide clear, actionable error messages**
- ✅ **Log errors with context**
- ✅ **Never expose internal errors to clients**
- ✅ **Use custom exception classes for business logic errors**

```python
# ✅ GOOD
@router.post("")
async def create_requirement(
    requirement_data: RequirementCreate,
    current_user: User = Depends(require_permission),
    db: Session = Depends(get_db)
):
    try:
        requirement = SubmissionRequirement(**requirement_data.dict())
        db.add(requirement)
        db.commit()
        return RequirementResponse.from_orm(requirement)
    except IntegrityError as e:
        logger.error(f"Database error creating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "tenant_id": str(current_user.tenant_id)
        })
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A requirement with this identifier already exists"
        )

# ❌ BAD: Generic error, no logging
@router.post("")
async def create_requirement(data: dict):
    requirement = SubmissionRequirement(**data)
    db.add(requirement)
    db.commit()  # Could fail, no error handling
```

### Database Access
- ✅ **Use SQLAlchemy ORM (prevents SQL injection)**
- ✅ **Use transactions for multi-step operations**
- ✅ **Handle database errors gracefully**
- ✅ **Use database indexes for frequently queried fields**
- ✅ **Avoid N+1 queries (use eager loading when needed)**
- ✅ **Use connection pooling**

```python
# ✅ GOOD: Transaction with error handling
def create_requirement_with_responses(db: Session, req_data: dict, responses: list):
    try:
        requirement = SubmissionRequirement(**req_data)
        db.add(requirement)
        db.flush()  # Get ID without committing
        
        for resp_data in responses:
            response = SubmissionRequirementResponse(
                requirement_id=requirement.id,
                **resp_data
            )
            db.add(response)
        
        db.commit()
        return requirement
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating requirement: {e}")
        raise

# ❌ BAD: No transaction, no error handling
def create_requirement(db: Session, data: dict):
    req = SubmissionRequirement(**data)
    db.add(req)
    db.commit()  # If this fails, partial state
```

### Service Layer Pattern
- ✅ **Keep business logic in service classes, not in API routes**
- ✅ **API routes should be thin - delegate to services**
- ✅ **Services should be testable independently**

```python
# ✅ GOOD: Service layer
class RequirementService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_requirement(
        self, 
        data: RequirementCreate, 
        user_id: UUID
    ) -> SubmissionRequirement:
        # Business logic here
        catalog_id = self._generate_catalog_id(data)
        requirement = SubmissionRequirement(
            catalog_id=catalog_id,
            **data.dict()
        )
        self.db.add(requirement)
        self.db.commit()
        return requirement

# API route delegates to service
@router.post("")
async def create_requirement(
    data: RequirementCreate,
    current_user: User = Depends(require_permission),
    db: Session = Depends(get_db)
):
    service = RequirementService(db)
    return service.create_requirement(data, current_user.id)

# ❌ BAD: Business logic in route
@router.post("")
async def create_requirement(data: dict, db: Session):
    # Business logic mixed with HTTP handling
    catalog_id = generate_id(data)
    requirement = SubmissionRequirement(catalog_id=catalog_id, **data)
    db.add(requirement)
    db.commit()
    return requirement
```

---

## Frontend Standards (TypeScript/React)

### Component Structure
- ✅ **Use functional components with hooks**
- ✅ **Keep components focused (single responsibility)**
- ✅ **Extract reusable logic into custom hooks**
- ✅ **Use composition over prop drilling**
- ✅ **Limit component size (aim for < 300 lines)**

```typescript
// ✅ GOOD: Focused component with custom hook
function SubmissionRequirementsTable() {
  const { requirements, isLoading, error } = useRequirements()
  const { selectedItems, handleSelect } = useSelection()
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  
  return (
    <table>
      {requirements.map(req => (
        <RequirementRow 
          key={req.id} 
          requirement={req}
          selected={selectedItems.has(req.id)}
          onSelect={handleSelect}
        />
      ))}
    </table>
  )
}

// ❌ BAD: Monolithic component
function SubmissionRequirementsManagement() {
  // 1000+ lines of mixed concerns
  // State management, API calls, UI rendering all mixed
}
```

### State Management
- ✅ **Use React Query for server state**
- ✅ **Use useState for local UI state**
- ✅ **Use Context for shared state (sparingly)**
- ✅ **Avoid prop drilling (use Context or composition)**
- ✅ **Keep state as local as possible**

```typescript
// ✅ GOOD: Appropriate state management
function RequirementForm() {
  // Server state
  const { data: requirement } = useQuery(['requirement', id], () => 
    api.getRequirement(id)
  )
  
  // Local form state
  const [formData, setFormData] = useState({
    label: requirement?.label || '',
    description: requirement?.description || ''
  })
  
  // Mutation
  const mutation = useMutation({
    mutationFn: (data) => api.updateRequirement(id, data),
    onSuccess: () => queryClient.invalidateQueries(['requirement', id])
  })
  
  return <form onSubmit={handleSubmit}>...</form>
}

// ❌ BAD: Global state for everything
const GlobalStore = {
  requirements: [],
  formData: {},
  filters: {},
  // Everything in one place
}
```

### Performance Optimization
- ✅ **Use React.memo for expensive components**
- ✅ **Use useMemo for expensive calculations**
- ✅ **Use useCallback for event handlers passed to children**
- ✅ **Lazy load routes and heavy components**
- ✅ **Virtualize long lists**
- ✅ **Debounce search inputs**

```typescript
// ✅ GOOD: Optimized component
const RequirementRow = React.memo(({ requirement, onSelect }: Props) => {
  const handleClick = useCallback(() => {
    onSelect(requirement.id)
  }, [requirement.id, onSelect])
  
  const metadata = useMemo(() => 
    buildMetadata(requirement), 
    [requirement]
  )
  
  return <tr onClick={handleClick}>...</tr>
})

// ❌ BAD: No optimization, re-renders on every parent update
function RequirementRow({ requirement, onSelect }) {
  return (
    <tr onClick={() => onSelect(requirement.id)}>
      {buildMetadata(requirement).map(...)}  // Recalculated every render
    </tr>
  )
}
```

### Accessibility (a11y)
- ✅ **Use semantic HTML elements**
- ✅ **Provide ARIA labels for interactive elements**
- ✅ **Ensure keyboard navigation works**
- ✅ **Maintain proper focus management**
- ✅ **Provide alt text for images**
- ✅ **Ensure sufficient color contrast**

```typescript
// ✅ GOOD: Accessible component
<button
  onClick={handleDelete}
  aria-label="Delete requirement REQ-SEC-01"
  className="text-red-600 hover:text-red-700"
>
  <Trash2 className="w-4 h-4" aria-hidden="true" />
  <span className="sr-only">Delete</span>
</button>

// ❌ BAD: No accessibility
<div onClick={handleDelete} className="delete-btn">
  <Trash2 />
</div>
```

### Error Handling
- ✅ **Handle loading and error states**
- ✅ **Provide user-friendly error messages**
- ✅ **Log errors for debugging**
- ✅ **Provide retry mechanisms where appropriate**

```typescript
// ✅ GOOD: Comprehensive error handling
function RequirementsList() {
  const { data, isLoading, error, refetch } = useQuery(
    ['requirements'],
    () => api.listRequirements(),
    {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  )
  
  if (isLoading) return <LoadingSpinner />
  
  if (error) {
    return (
      <ErrorMessage
        message="Failed to load requirements"
        error={error}
        onRetry={refetch}
      />
    )
  }
  
  return <RequirementsTable requirements={data} />
}

// ❌ BAD: No error handling
function RequirementsList() {
  const { data } = useQuery(['requirements'], api.listRequirements)
  return <RequirementsTable requirements={data} />  // Crashes if error
}
```

---

## Database Standards

### Schema Design
- ✅ **Use UUIDs for primary keys (security, distributed systems)**
- ✅ **Add indexes on foreign keys and frequently queried columns**
- ✅ **Use appropriate data types (avoid TEXT for small strings)**
- ✅ **Add NOT NULL constraints where appropriate**
- ✅ **Use database-level constraints (unique, foreign key)**
- ✅ **Add comments to columns for documentation**

```python
# ✅ GOOD: Well-designed model
class SubmissionRequirement(Base):
    __tablename__ = "submission_requirements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    catalog_id = Column(String(50), nullable=True, unique=True, index=True)
    label = Column(String(255), nullable=False)  # NOT NULL enforced
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Indexes for common queries
    __table_args__ = (
        Index('ix_requirements_tenant_catalog', 'tenant_id', 'catalog_id'),
    )

# ❌ BAD: Poor design
class Requirement(Base):
    id = Column(Integer, primary_key=True)  # Sequential IDs
    data = Column(Text)  # Everything in one column
    # No indexes, no constraints
```

### Migrations
- ✅ **Always use Alembic for schema changes**
- ✅ **Never modify existing migrations (create new ones)**
- ✅ **Test migrations on staging before production**
- ✅ **Make migrations reversible (implement downgrade)**
- ✅ **Handle data migration carefully (backup first)**

```python
# ✅ GOOD: Safe migration
def upgrade() -> None:
    # Add column as nullable first
    op.add_column('requirements', sa.Column('catalog_id', sa.String(50), nullable=True))
    
    # Populate data
    op.execute("UPDATE requirements SET catalog_id = generate_catalog_id(...)")
    
    # Then make it non-nullable
    op.alter_column('requirements', 'catalog_id', nullable=False)
    
    # Add index
    op.create_index('ix_requirements_catalog_id', 'requirements', ['catalog_id'])

def downgrade() -> None:
    op.drop_index('ix_requirements_catalog_id', 'requirements')
    op.drop_column('requirements', 'catalog_id')
```

---

## API Design Standards

### RESTful Design
- ✅ **Use appropriate HTTP methods (GET, POST, PUT, PATCH, DELETE)**
- ✅ **Use proper status codes (200, 201, 400, 401, 403, 404, 500)**
- ✅ **Use consistent URL patterns**
- ✅ **Version APIs (`/api/v1/...`)**
- ✅ **Use plural nouns for resources**

```python
# ✅ GOOD: RESTful design
@router.get("/submission-requirements", response_model=List[RequirementResponse])
async def list_requirements(...):
    ...

@router.post("/submission-requirements", response_model=RequirementResponse, status_code=201)
async def create_requirement(...):
    ...

@router.get("/submission-requirements/{requirement_id}", response_model=RequirementResponse)
async def get_requirement(requirement_id: UUID, ...):
    ...

@router.patch("/submission-requirements/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(requirement_id: UUID, ...):
    ...

@router.delete("/submission-requirements/{requirement_id}", status_code=204)
async def delete_requirement(requirement_id: UUID, ...):
    ...

# ❌ BAD: Non-RESTful
@router.post("/getRequirements")
@router.post("/createRequirement")
@router.post("/updateRequirement")
```

### Request/Response Validation
- ✅ **Use Pydantic models for all request/response schemas**
- ✅ **Validate all inputs**
- ✅ **Return consistent response formats**
- ✅ **Include error details in error responses**

```python
# ✅ GOOD: Validated schemas
class RequirementCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    requirement_type: str = Field(..., pattern="^(compliance|risk|questionnaires)$")
    description: Optional[str] = Field(None, max_length=1000)
    
    class Config:
        schema_extra = {
            "example": {
                "label": "Data Classification",
                "requirement_type": "compliance",
                "description": "Requirement for data classification"
            }
        }

@router.post("", response_model=RequirementResponse)
async def create_requirement(
    requirement_data: RequirementCreate,  # Validated automatically
    ...
):
    ...
```

### Pagination & Filtering
- ✅ **Implement pagination for list endpoints**
- ✅ **Use query parameters for filtering**
- ✅ **Return pagination metadata**
- ✅ **Limit maximum page size**

```python
# ✅ GOOD: Paginated endpoint
@router.get("", response_model=PaginatedResponse[RequirementResponse])
async def list_requirements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    requirement_type: Optional[str] = None,
    ...
):
    query = db.query(SubmissionRequirement)
    
    # Apply filters
    if category:
        query = query.filter(SubmissionRequirement.category == category)
    
    # Paginate
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return PaginatedResponse(
        items=[RequirementResponse.from_orm(r) for r in items],
        total=total,
        page=page,
        page_size=page_size
    )
```

---

## Error Handling

### Backend Error Handling
- ✅ **Use appropriate HTTP status codes**
- ✅ **Provide clear, actionable error messages**
- ✅ **Log errors with context**
- ✅ **Never expose stack traces to clients**
- ✅ **Use custom exception classes**

```python
# ✅ GOOD: Proper error handling
class RequirementNotFoundError(Exception):
    pass

@router.get("/{requirement_id}")
async def get_requirement(requirement_id: UUID, db: Session):
    requirement = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.id == requirement_id
    ).first()
    
    if not requirement:
        logger.warning(f"Requirement not found: {requirement_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Requirement with ID {requirement_id} not found"
        )
    
    return RequirementResponse.from_orm(requirement)

# ❌ BAD: Generic error
@router.get("/{requirement_id}")
async def get_requirement(requirement_id: UUID, db: Session):
    requirement = db.query(SubmissionRequirement).get(requirement_id)
    return requirement  # Returns None if not found, causes 500 error
```

### Frontend Error Handling
- ✅ **Handle all error states (network, validation, server)**
- ✅ **Show user-friendly error messages**
- ✅ **Provide retry mechanisms**
- ✅ **Log errors for debugging**

```typescript
// ✅ GOOD: Comprehensive error handling
function useRequirements() {
  return useQuery(
    ['requirements'],
    async () => {
      try {
        const response = await api.listRequirements()
        return response.data
      } catch (error) {
        if (error.response?.status === 401) {
          // Handle auth error
          navigate('/login')
        } else if (error.response?.status >= 500) {
          // Server error - show retry
          throw new Error('Server error. Please try again.')
        } else {
          // Client error - show message
          throw new Error(error.response?.data?.detail || 'Failed to load requirements')
        }
      }
    },
    {
      retry: (failureCount, error) => {
        // Only retry on network errors, not 4xx errors
        return error.response?.status >= 500 && failureCount < 3
      }
    }
  )
}
```

---

## Testing Standards

### Test Coverage
- ✅ **Aim for >80% code coverage**
- ✅ **Test critical business logic**
- ✅ **Test error cases**
- ✅ **Test edge cases**
- ✅ **Use integration tests for API endpoints**

### Test Organization
- ✅ **Follow Arrange-Act-Assert pattern**
- ✅ **Use descriptive test names**
- ✅ **Keep tests independent**
- ✅ **Use fixtures for common setup**

```python
# ✅ GOOD: Well-structured test
def test_create_requirement_success(db_session, test_user):
    # Arrange
    requirement_data = RequirementCreate(
        label="Test Requirement",
        requirement_type="compliance",
        field_name="test_field"
    )
    
    # Act
    result = create_requirement(requirement_data, test_user, db_session)
    
    # Assert
    assert result.label == "Test Requirement"
    assert result.catalog_id is not None
    assert db_session.query(SubmissionRequirement).count() == 1

def test_create_requirement_duplicate_field_name(db_session, test_user):
    # Arrange
    existing = SubmissionRequirement(field_name="existing_field", ...)
    db_session.add(existing)
    db_session.commit()
    
    requirement_data = RequirementCreate(
        label="New Requirement",
        field_name="existing_field",  # Duplicate
        ...
    )
    
    # Act & Assert
    with pytest.raises(HTTPException) as exc:
        create_requirement(requirement_data, test_user, db_session)
    
    assert exc.value.status_code == 400
    assert "already exists" in exc.value.detail
```

---

## Documentation Standards

### Code Documentation
- ✅ **Document all public functions/classes with docstrings**
- ✅ **Include parameter and return type documentation**
- ✅ **Add examples for complex functions**
- ✅ **Keep documentation up to date**

```python
# ✅ GOOD: Comprehensive docstring
def generate_catalog_id(
    db: Session,
    tenant_id: UUID,
    requirement_type: str,
    category: Optional[str] = None
) -> str:
    """Generate a unique catalog ID for a requirement.
    
    Format: REQ-{CATEGORY}-{SEQ}
    Examples:
    - REQ-SEC-01, REQ-SEC-02 (Security requirements)
    - REQ-COM-01 (Compliance requirements)
    - REQ-TPRM-01 (TPRM Questionnaire)
    
    Args:
        db: Database session
        tenant_id: Tenant UUID
        requirement_type: Type of requirement (compliance, risk, questionnaires)
        category: Optional category (security, compliance, etc.)
    
    Returns:
        Unique catalog ID string (e.g., "REQ-SEC-01")
    
    Raises:
        ValueError: If requirement_type is invalid
    
    Example:
        >>> catalog_id = generate_catalog_id(db, tenant_id, "compliance", "security")
        >>> catalog_id
        'REQ-SEC-01'
    """
    ...
```

### API Documentation
- ✅ **Use FastAPI's automatic OpenAPI documentation**
- ✅ **Add descriptions to endpoints**
- ✅ **Include example requests/responses**
- ✅ **Document error responses**

---

## Performance Standards

### Backend Performance
- ✅ **Use database indexes for frequently queried fields**
- ✅ **Avoid N+1 queries (use eager loading)**
- ✅ **Implement caching where appropriate**
- ✅ **Use connection pooling**
- ✅ **Optimize database queries**

### Frontend Performance
- ✅ **Lazy load routes and components**
- ✅ **Code split by route**
- ✅ **Optimize images (use WebP, lazy load)**
- ✅ **Minimize bundle size**
- ✅ **Use React.memo, useMemo, useCallback appropriately**

---

## Accessibility Standards

### WCAG Compliance
- ✅ **Meet WCAG 2.1 Level AA standards**
- ✅ **Keyboard navigation for all interactive elements**
- ✅ **Screen reader support**
- ✅ **Sufficient color contrast (4.5:1 for text)**
- ✅ **Focus indicators visible**

### Implementation
- ✅ **Use semantic HTML**
- ✅ **Provide ARIA labels**
- ✅ **Ensure proper heading hierarchy**
- ✅ **Provide alt text for images**

---

## Code Review Checklist

Before submitting code for review, ensure:

### Security
- [ ] All inputs validated and sanitized
- [ ] No sensitive data in logs
- [ ] Authentication/authorization checks in place
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention (output sanitization)

### Code Quality
- [ ] Type hints/TypeScript types used
- [ ] No hardcoded values (use config)
- [ ] Error handling implemented
- [ ] Code follows naming conventions
- [ ] No commented-out code
- [ ] Functions are focused and testable

### Performance
- [ ] Database queries optimized
- [ ] No N+1 queries
- [ ] Appropriate use of caching
- [ ] Frontend components optimized

### Testing
- [ ] Tests written for new functionality
- [ ] Edge cases covered
- [ ] Error cases tested

### Documentation
- [ ] Public functions documented
- [ ] Complex logic explained
- [ ] API endpoints documented

---

## Tools & Automation

### Linting & Formatting
- **Python**: Black (formatting), Ruff (linting), mypy (type checking)
- **TypeScript**: ESLint, Prettier, TypeScript compiler

### Pre-commit Hooks
- Run linters before commit
- Format code automatically
- Run type checkers
- Run tests

### CI/CD
- Run tests on every PR
- Check code coverage
- Run security scans
- Deploy to staging on merge to main

---

**Last Updated**: 2025-12-12
**Version**: 2.0
