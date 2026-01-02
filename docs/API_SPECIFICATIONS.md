# API Specifications

## Base URL
```
https://api.agent-platform.company.com/v1
```

## Authentication
All API requests require authentication via Bearer token:
```
Authorization: Bearer <token>
```

## Endpoints

### Agent Management

#### 1. Submit Agent
```http
POST /agents
Content-Type: multipart/form-data

Request Body:
{
  "name": "string",
  "type": "string",
  "category": "string",
  "description": "string",
  "version": "string",
  "vendorId": "string",
  "metadata": {
    "capabilities": ["string"],
    "dataTypes": ["string"],
    "regions": ["string"],
    "integrations": [...]
  },
  "documents": [File],
  "codeRepository": "string (optional)",
  "certifications": [...]
}

Response: 201 Created
{
  "agentId": "uuid",
  "status": "SUBMITTED",
  "submissionDate": "2024-01-15T10:00:00Z",
  "estimatedReviewTime": "5-7 business days"
}
```

#### 2. Get Agent Status
```http
GET /agents/{agentId}

Response: 200 OK
{
  "agentId": "uuid",
  "name": "string",
  "status": "IN_REVIEW",
  "currentStage": "SECURITY_REVIEW",
  "progress": {
    "completedStages": 2,
    "totalStages": 5,
    "percentage": 40
  },
  "reviews": [...],
  "complianceScore": 85,
  "riskScore": 3,
  "submissionDate": "2024-01-15T10:00:00Z"
}
```

#### 3. List Agents
```http
GET /agents?status={status}&vendorId={vendorId}&page={page}&limit={limit}

Response: 200 OK
{
  "agents": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Compliance & Review

#### 4. Run Compliance Check
```http
POST /agents/{agentId}/compliance/check

Response: 200 OK
{
  "complianceScore": 85,
  "checks": [
    {
      "policyId": "uuid",
      "policyName": "GDPR Data Protection",
      "status": "PASS",
      "details": "Agent meets GDPR requirements for data processing",
      "evidence": ["document1.pdf", "certification.pdf"],
      "ragContext": {
        "retrievedDocuments": [...],
        "confidenceScore": 0.92,
        "citations": [...]
      }
    }
  ],
  "gaps": [
    {
      "policyId": "uuid",
      "policyName": "ISO 27001",
      "gap": "Missing security audit documentation",
      "severity": "MEDIUM",
      "recommendation": "Provide SOC 2 Type II certification"
    }
  ],
  "recommendations": [...]
}
```

#### 5. Get AI Recommendations
```http
GET /agents/{agentId}/recommendations?stage={reviewStage}

Response: 200 OK
{
  "recommendations": [
    {
      "type": "REVIEW_FOCUS",
      "title": "Check API authentication mechanism",
      "description": "Based on similar agents, ensure OAuth 2.0 is properly implemented",
      "confidence": 0.88,
      "source": "Historical approval data",
      "relatedPolicies": ["POL-001", "POL-002"]
    }
  ],
  "similarAgents": [
    {
      "agentId": "uuid",
      "name": "Similar Agent",
      "similarityScore": 0.85,
      "approvalStatus": "APPROVED"
    }
  ]
}
```

#### 6. Submit Review
```http
POST /agents/{agentId}/reviews
Content-Type: application/json

Request Body:
{
  "stage": "SECURITY_REVIEW",
  "status": "APPROVED",
  "comments": "string",
  "complianceChecks": [
    {
      "policyId": "uuid",
      "status": "PASS",
      "notes": "string"
    }
  ],
  "riskAssessments": [...],
  "conditions": ["string"] // For conditional approvals
}

Response: 200 OK
{
  "reviewId": "uuid",
  "status": "COMPLETED",
  "nextStage": "COMPLIANCE_REVIEW",
  "workflowProgress": 60
}
```

### Offboarding

#### 7. Initiate Offboarding
```http
POST /agents/{agentId}/offboard
Content-Type: application/json

Request Body:
{
  "reason": "CONTRACT_END|SECURITY_INCIDENT|REPLACEMENT|OTHER",
  "reasonDetails": "string",
  "targetDate": "2024-06-30",
  "replacementAgentId": "uuid (optional)"
}

Response: 200 OK
{
  "offboardingId": "uuid",
  "status": "INITIATED",
  "impactAnalysis": {
    "dependentSystems": [...],
    "businessImpact": "MEDIUM",
    "estimatedDowntime": "2 hours"
  },
  "timeline": [...]
}
```

#### 8. Extract Knowledge
```http
POST /agents/{agentId}/offboard/knowledge-extraction

Response: 200 OK
{
  "extractionId": "uuid",
  "status": "IN_PROGRESS",
  "extractedDocuments": [...],
  "knowledgeBase": {
    "documentation": [...],
    "integrations": [...],
    "dependencies": [...],
    "operationalKnowledge": "..."
  }
}
```

### RAG Queries

#### 9. Query Knowledge Base
```http
POST /rag/query
Content-Type: application/json

Request Body:
{
  "query": "What are the compliance requirements for agents processing PII data?",
  "filters": {
    "category": "compliance",
    "region": "EU",
    "agentType": "data_processor"
  },
  "topK": 5
}

Response: 200 OK
{
  "answer": "Agents processing PII data in the EU must comply with GDPR...",
  "sources": [
    {
      "documentId": "uuid",
      "documentName": "GDPR Policy",
      "section": "Article 32 - Security of processing",
      "relevanceScore": 0.95,
      "excerpt": "..."
    }
  ],
  "confidence": 0.92,
  "relatedQueries": [...]
}
```

### Analytics & Reporting

#### 10. Get Dashboard Metrics
```http
GET /analytics/dashboard?timeRange={7d|30d|90d|1y}

Response: 200 OK
{
  "metrics": {
    "totalAgents": 150,
    "pendingReview": 12,
    "approved": 120,
    "rejected": 18,
    "averageReviewTime": "4.5 days",
    "compliancePassRate": 0.95,
    "adoptionRate": 0.82
  },
  "trends": {
    "submissions": [...],
    "approvals": [...],
    "rejections": [...]
  }
}
```

#### 11. Generate Compliance Report
```http
POST /agents/{agentId}/reports/compliance

Response: 200 OK
{
  "reportId": "uuid",
  "status": "GENERATED",
  "downloadUrl": "https://...",
  "generatedAt": "2024-01-15T10:00:00Z",
  "sections": [
    "Executive Summary",
    "Compliance Assessment",
    "Risk Analysis",
    "Recommendations"
  ]
}
```

### Webhooks

#### 12. Register Webhook
```http
POST /webhooks
Content-Type: application/json

Request Body:
{
  "url": "https://vendor.com/webhook",
  "events": [
    "agent.submitted",
    "agent.approved",
    "agent.rejected",
    "review.completed",
    "compliance.check.completed"
  ],
  "secret": "string"
}

Response: 201 Created
{
  "webhookId": "uuid",
  "status": "ACTIVE"
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2024-01-15T10:00:00Z",
    "requestId": "uuid"
  }
}
```

### Common Error Codes
- `400 BAD_REQUEST`: Invalid request parameters
- `401 UNAUTHORIZED`: Missing or invalid authentication
- `403 FORBIDDEN`: Insufficient permissions
- `404 NOT_FOUND`: Resource not found
- `409 CONFLICT`: Resource conflict (e.g., duplicate submission)
- `422 UNPROCESSABLE_ENTITY`: Validation errors
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded
- `500 INTERNAL_SERVER_ERROR`: Server error
- `503 SERVICE_UNAVAILABLE`: Service temporarily unavailable

## Rate Limiting
- Standard: 100 requests per minute per API key
- Premium: 500 requests per minute per API key
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Pagination
All list endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- Response includes pagination metadata

## Filtering & Sorting
- `filter`: JSON object with field filters
- `sort`: Field and direction (e.g., `sort=createdAt:desc`)
- `search`: Full-text search query

