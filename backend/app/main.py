"""
Main FastAPI application entry point
"""
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.config import settings
from app.core.security_middleware import SecurityHeadersMiddleware, RateLimitMiddleware
from app.middleware.metrics_middleware import MetricsMiddleware
from app.core.logging_config import setup_logging
import logging
import os

# Set up logging first, before anything else
setup_logging(log_level=settings.ENVIRONMENT.upper() if hasattr(settings, 'ENVIRONMENT') else "INFO")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VAKA Agent Platform API",
    description="RAG-powered AI agent onboarding and offboarding platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS middleware (must be first to handle preflight requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting middleware (higher limit in development)
rate_limit = 300 if settings.ENVIRONMENT == "development" else 60
app.add_middleware(RateLimitMiddleware, requests_per_minute=rate_limit)

# Metrics middleware
app.add_middleware(MetricsMiddleware)

# Create uploads directory if it doesn't exist
uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
logger.info(f"Uploads directory: {uploads_dir}")


# Exception handlers to ensure CORS headers are included in error responses
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with CORS headers"""
    logger.warning(
        f"HTTP {exc.status_code} error: {exc.detail} - "
        f"Path: {request.url.path} - Method: {request.method} - "
        f"Client: {request.client.host if request.client else 'unknown'}"
    )
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    # Add CORS headers
    origin = request.headers.get("origin")
    if origin in settings.cors_origins_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with CORS headers"""
    # Try to get request body, but handle client disconnect gracefully
    body = "N/A"
    try:
        if hasattr(request, 'body'):
            body = await request.body()
            if body:
                body = body.decode('utf-8')[:500]  # Limit length and decode
    except Exception as e:
        # Client disconnected or other error reading body
        body = f"Error reading body: {type(e).__name__}"
    
    logger.warning(
        f"Validation error: {exc.errors()} - "
        f"Path: {request.url.path} - Method: {request.method} - "
        f"Body: {body}"
    )
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )
    # Add CORS headers
    origin = request.headers.get("origin")
    if origin in settings.cors_origins_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions with CORS headers"""
    # Skip logging for ClientDisconnect - it's a normal occurrence when client disconnects
    from starlette.requests import ClientDisconnect
    if isinstance(exc, ClientDisconnect):
        return
    
    import traceback
    error_details = {
        "exception_type": type(exc).__name__,
        "exception_message": str(exc),
        "path": request.url.path,
        "method": request.method,
        "client": request.client.host if request.client else "unknown",
        "traceback": traceback.format_exc()
    }
    logger.error(
        f"Unhandled exception: {error_details['exception_type']} - {error_details['exception_message']} - "
        f"Path: {error_details['path']} - Method: {error_details['method']}",
        exc_info=True  # This includes full traceback
    )
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )
    # Add CORS headers
    origin = request.headers.get("origin")
    if origin in settings.cors_origins_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "VAKA Agent Platform API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/uploads/{file_path:path}")
async def serve_upload_file(file_path: str, request: Request):
    """Serve uploaded files with CORS headers"""
    import os
    from pathlib import Path
    
    # Security: Prevent directory traversal
    safe_path = Path(file_path)
    if ".." in safe_path.parts or safe_path.is_absolute():
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    # Construct full file path
    full_path = os.path.join(settings.UPLOAD_DIR, file_path)
    
    # Check if file exists
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type
    import mimetypes
    media_type, _ = mimetypes.guess_type(full_path)
    if not media_type:
        media_type = "application/octet-stream"
    
    # Create response with CORS headers
    response = FileResponse(
        full_path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600",
        }
    )
    
    # Add CORS headers
    origin = request.headers.get("origin")
    if origin in settings.cors_origins_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response


# Include routers
from app.api.v1 import auth, agents, knowledge, reviews, tenants, onboarding, compliance, audit, analytics, messages, approvals, offboarding, adoption, integrations, webhooks, recommendations, export, mfa, sso, oauth2, integration_config, predictive, marketplace, cross_tenant, fine_tuning, metrics, logs, tickets, vendors, users, submission_requirements, assessments, agent_connections, frameworks, workflow_config, workflow_actions, workflow_stage_settings, workflow_orchestration, reminders, vendor_invitations, otp, smtp_settings, sso_settings, scim, api_gateway, api_token_management, integration_help, user_sync, platform_config, cluster_nodes, agentic_agents, studio, external_agents, presentation, actions, question_library, assessment_rules, business_rules, role_permissions, role_configurations, security_incidents, custom_fields, entity_fields, suppliers_master, products, services, incident_reports, workflow_templates, ecosystem_map, qualifications, incident_configs, workflow_analytics

# Import form_layouts with error handling
try:
    from app.api.v1 import form_layouts
    logger.info("Form layouts module imported successfully")
except Exception as e:
    logger.error(f"Failed to import form_layouts module: {e}", exc_info=True)
    form_layouts = None

# Import assessment_table_layouts with error handling
try:
    from app.api.v1 import assessment_table_layouts
    logger.info("Assessment table layouts module imported successfully")
except Exception as e:
    logger.error(f"Failed to import assessment_table_layouts module: {e}", exc_info=True)
    assessment_table_layouts = None

# Import form_types with error handling
try:
    from app.api.v1 import form_types
    logger.info("Form types module imported successfully")
except Exception as e:
    logger.error(f"Failed to import form_types module: {e}", exc_info=True)
    form_types = None

# Import master_data_lists with error handling
try:
    from app.api.v1 import master_data_lists
    logger.info("Master data lists module imported successfully")
except Exception as e:
    logger.error(f"Failed to import master_data_lists module: {e}", exc_info=True)
    master_data_lists = None

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(mfa.router, prefix="/api/v1")
app.include_router(sso.router, prefix="/api/v1")
app.include_router(oauth2.router, prefix="/api/v1")
app.include_router(integration_config.router, prefix="/api/v1")
app.include_router(predictive.router, prefix="/api/v1")
app.include_router(marketplace.router, prefix="/api/v1")
app.include_router(cross_tenant.router, prefix="/api/v1")
app.include_router(fine_tuning.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(compliance.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(approvals.router, prefix="/api/v1")
app.include_router(offboarding.router, prefix="/api/v1")
app.include_router(adoption.router, prefix="/api/v1")
app.include_router(integrations.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(vendors.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(services.router, prefix="/api/v1")
app.include_router(incident_reports.router, prefix="/api/v1")
app.include_router(incident_configs.router, prefix="/api/v1")
app.include_router(submission_requirements.router, prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")
app.include_router(assessments.template_router, prefix="/api/v1")
app.include_router(question_library.router, prefix="/api/v1")
app.include_router(assessment_rules.router, prefix="/api/v1")
if assessment_table_layouts:
    app.include_router(assessment_table_layouts.router, prefix="/api/v1")
app.include_router(business_rules.router, prefix="/api/v1")
app.include_router(agent_connections.router, prefix="/api/v1")
app.include_router(frameworks.router, prefix="/api/v1")
app.include_router(workflow_config.router, prefix="/api/v1")
app.include_router(workflow_templates.router, prefix="/api/v1")
app.include_router(workflow_analytics.router, prefix="/api/v1")
app.include_router(ecosystem_map.router, prefix="/api/v1")
app.include_router(qualifications.router, prefix="/api/v1")
app.include_router(workflow_actions.router, prefix="/api/v1")
app.include_router(workflow_stage_settings.router, prefix="/api/v1")
app.include_router(workflow_orchestration.router, prefix="/api/v1/workflow")  # Generic workflow orchestration
app.include_router(reminders.router, prefix="/api/v1")  # Workflow reminders
app.include_router(vendor_invitations.router, prefix="/api/v1")
app.include_router(otp.router, prefix="/api/v1")
app.include_router(smtp_settings.router, prefix="/api/v1")
app.include_router(sso_settings.router, prefix="/api/v1")
app.include_router(scim.router, prefix="/api/v1")  # SCIM endpoints at /api/v1/scim/v2
app.include_router(api_gateway.router, prefix="/api/v1")  # API Gateway endpoints
app.include_router(api_token_management.router, prefix="/api/v1")  # Admin token management
app.include_router(integration_help.router, prefix="/api/v1")  # Integration help guides
app.include_router(user_sync.router, prefix="/api/v1")  # User sync endpoints
app.include_router(platform_config.router, prefix="/api/v1")  # Platform configuration (platform admin only)
app.include_router(cluster_nodes.router, prefix="/api/v1")  # Cluster node management (platform admin only)
app.include_router(agentic_agents.router, prefix="/api/v1")  # Agentic AI Agents
app.include_router(studio.router, prefix="/api/v1")  # Studio - Agent collection and flow building
app.include_router(external_agents.router, prefix="/api/v1")  # External Agents - Cross-tenant communication
app.include_router(presentation.router, prefix="/api/v1")  # Presentation Layer - Business pages and widgets
app.include_router(actions.router, prefix="/api/v1")  # Action Items - User inbox
app.include_router(role_permissions.router, prefix="/api/v1")  # Role Permissions Management
app.include_router(role_configurations.router, prefix="/api/v1")  # Role Configurations (including role-level data filter rules)
app.include_router(security_incidents.router, prefix="/api/v1")  # Security Incidents & CVE Tracking (feature-gated)
app.include_router(custom_fields.router, prefix="/api/v1")  # Entity and Fields Catalog
app.include_router(entity_fields.router, prefix="/api/v1")  # Entity Field Registry & Permissions
app.include_router(suppliers_master.router, prefix="/api/v1")  # Suppliers Master View
if form_layouts:
    app.include_router(form_layouts.router, prefix="/api/v1")  # Form layouts and field access control
    logger.info("Form layouts router registered successfully")
else:
    logger.warning("Form layouts router not registered")

if form_types:
    app.include_router(form_types.router, prefix="/api/v1")  # Form types configuration
    logger.info("Form types router registered successfully")
else:
    logger.warning("Form types router not registered")

if master_data_lists:
    app.include_router(master_data_lists.router, prefix="/api/v1")  # Master data lists management
    logger.info("Master data lists router registered successfully")
else:
    logger.warning("Master data lists router not registered")
    logger.warning("Form layouts router not registered due to import error")


@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    import asyncio
    
    logger.info("=" * 60)
    logger.info("VAKA Agent Platform API Starting Up")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    logger.info("=" * 60)
    
    # Seed platform configurations from environment variables (with timeout)
    try:
        from app.core.seed_configs import seed_on_startup
        # Run in executor to avoid blocking, with timeout
        await asyncio.wait_for(
            asyncio.to_thread(seed_on_startup),
            timeout=5.0  # 5 second timeout
        )
    except asyncio.TimeoutError:
        logger.warning("Seeding configurations timed out - continuing startup")
    except Exception as e:
        logger.warning(f"Failed to seed configurations on startup: {e}")
        # Don't fail startup if seeding fails
    
    # Seed integration metadata from environment variables (with timeout)
    try:
        from app.core.seed_integration_metadata import seed_on_startup as seed_integration_metadata
        # Run in executor to avoid blocking, with timeout
        await asyncio.wait_for(
            asyncio.to_thread(seed_integration_metadata),
            timeout=5.0  # 5 second timeout
        )
    except asyncio.TimeoutError:
        logger.warning("Seeding integration metadata timed out - continuing startup")
    except Exception as e:
        logger.warning(f"Failed to seed integration metadata on startup: {e}")
        # Don't fail startup if seeding fails
    
    # Seed default role permissions (always ensure all permissions exist) (with timeout)
    try:
        from app.core.database import SessionLocal
        from app.services.role_permission_service import RolePermissionService
        
        async def seed_permissions():
            db = SessionLocal()
            try:
                counts = await RolePermissionService.seed_default_permissions(db)
                if counts["created"] > 0 or counts["updated"] > 0:
                    logger.info(f"Seeded role permissions on startup: {counts['created']} created, {counts['updated']} updated")
                else:
                    logger.debug("All role permissions already exist, no seeding needed")
            finally:
                db.close()
        
        await asyncio.wait_for(seed_permissions(), timeout=5.0)  # 5 second timeout
    except asyncio.TimeoutError:
        logger.warning("Seeding role permissions timed out - continuing startup")
    except Exception as e:
        logger.warning(f"Failed to seed role permissions on startup: {e}")
        # Don't fail startup if seeding fails
    
    logger.info("Startup completed successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    logger.info("=" * 60)
    logger.info("VAKA Agent Platform API Shutting Down")
    logger.info("=" * 60)


if __name__ == "__main__":
    import uvicorn
    # Configure uvicorn with timeout settings that prevent server shutdown
    # Note: These are connection timeouts, NOT server shutdown timeouts
    # The server will continue running even if individual connections timeout
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        timeout_keep_alive=75,  # Keep connections alive for 75 seconds (prevents premature connection closure)
        timeout_graceful_shutdown=30,  # Graceful shutdown timeout (only used on explicit shutdown signal)
        # Note: Session timeouts (JWT expiration) are handled separately in auth.py
        # and do not affect server operation
    )

