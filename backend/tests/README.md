# Unit Tests

This directory contains unit tests for the VAKA platform.

## Test Structure

- `test_business_rules_engine.py` - Tests for business rules evaluation and execution
- `test_flow_execution.py` - Tests for flow execution service
- `test_agent_rate_limiter.py` - Tests for agent execution rate limiting
- `test_flow_sharing.py` - Tests for flow sharing between tenants
- `test_flow_versioning.py` - Tests for flow versioning system
- `test_agent_offboarding.py` - Tests for agent offboarding skill
- `test_compliance_review.py` - Tests for compliance review skill
- `test_flow_templates.py` - Tests for flow templates library
- `test_flow_execution_audit.py` - Tests for flow execution audit logging

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_business_rules_engine.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

## Test Coverage

The tests cover:
- Business rules engine evaluation and execution
- Flow execution with error handling
- Agent rate limiting (Redis and database fallback)
- Flow sharing and access control
- Flow versioning and restoration
- Agent offboarding workflow
- Compliance review with frameworks
- Flow template instantiation
- Audit logging for flow executions

