# Cursor AI Workflow Guide

## Using Cursor for VAKA Platform Development

### Getting Started with Cursor

1. **Open the project in Cursor**
   - Open the `/Users/vikasc/vaka` directory in Cursor
   - Cursor will automatically detect the project structure

2. **Reference Design Documents**
   - All design documents are in the root directory
   - Use Cursor's chat to reference specific features
   - Example: "Based on AGENT_ONBOARDING_DESIGN.md, implement the agent submission API"

### Common Cursor Commands

#### Backend Development

**Create API endpoints**:
```
@Cursor: Create a FastAPI endpoint for submitting agents based on the design doc
```

**Implement models**:
```
@Cursor: Add the Review model based on DATABASE_SCHEMA.sql
```

**Add business logic**:
```
@Cursor: Implement the compliance checking service using RAG as described in the design
```

#### Frontend Development

**Create components**:
```
@Cursor: Create a compact agent card component based on UI_MOCKUPS.md
```

**Implement pages**:
```
@Cursor: Build the vendor dashboard page from the mockups
```

**Add forms**:
```
@Cursor: Create the agent submission form with validation
```

### Workflow Tips

1. **Start with Design Docs**
   - Always reference the design documents first
   - Ask Cursor to implement based on specifications

2. **Iterative Development**
   - Build features incrementally
   - Test as you go
   - Use Cursor to refactor and optimize

3. **Code Generation**
   - Use Cursor to generate boilerplate
   - Ask for tests
   - Request documentation

4. **Debugging**
   - Ask Cursor to explain errors
   - Request fixes
   - Get optimization suggestions

### Example Prompts

**Backend**:
- "Create a FastAPI router for agent management with CRUD operations"
- "Implement RAG-based compliance checking service"
- "Add authentication middleware using JWT"
- "Create database models for reviews and approvals"

**Frontend**:
- "Create a compact, modern dashboard component"
- "Build the agent submission form with file upload"
- "Implement the review interface with AI recommendations panel"
- "Add a compact status badge component"

**Integration**:
- "Implement ServiceNow integration for workflow triggers"
- "Add Jira integration for issue creation"
- "Create Slack notification service"

### Best Practices

1. **Be Specific**: Reference exact files and line numbers when needed
2. **Use Context**: Mention which design doc or mockup you're following
3. **Iterate**: Build in small increments, test, then expand
4. **Review**: Always review Cursor-generated code before committing
5. **Test**: Ask Cursor to generate tests for new features

### Project Structure Reference

```
vaka/
├── backend/
│   ├── app/
│   │   ├── api/v1/     # API endpoints
│   │   ├── core/       # Config, database
│   │   ├── models/     # Database models
│   │   └── services/   # Business logic
│   └── alembic/        # Migrations
├── frontend/
│   └── src/
│       ├── components/ # Reusable components
│       ├── pages/      # Page components
│       └── lib/        # Utilities
└── docs/              # Design documents
```

### Quick Reference

- **Design**: See `AGENT_ONBOARDING_DESIGN.md`
- **API Spec**: See `API_SPECIFICATIONS.md`
- **Database**: See `DATABASE_SCHEMA.sql`
- **UI Mockups**: See `UI_MOCKUPS.md`
- **Project Plan**: See `PROJECT_PLAN.md`

---

**Happy coding with Cursor! 🚀**

