"""
Integration help documentation and configuration guides
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List

router = APIRouter(prefix="/integration-help", tags=["integration-help"])


class IntegrationHelpGuide(BaseModel):
    """Integration help guide"""
    provider: str
    name: str
    description: str
    steps: List[Dict[str, Any]]
    prerequisites: List[str]
    configuration_fields: List[Dict[str, Any]]  # Changed to Any to allow bool for required
    troubleshooting: List[Dict[str, str]]


# Help guides for each integration
HELP_GUIDES: Dict[str, IntegrationHelpGuide] = {
    "azure_entra_id": IntegrationHelpGuide(
        provider="azure_entra_id",
        name="Microsoft Azure Entra ID (Azure AD)",
        description="Configure SSO and user provisioning with Microsoft Azure Entra ID",
        prerequisites=[
            "Azure AD administrator access",
            "Application registration permissions in Azure AD"
        ],
        steps=[
            {
                "title": "Register Application in Azure AD",
                "description": "Create a new app registration in Azure Entra ID",
                "details": [
                    "1. Go to Azure Portal → Azure Active Directory → App registrations",
                    "2. Click 'New registration'",
                    "3. Enter a name (e.g., 'VAKA Platform')",
                    "4. Select 'Accounts in any organizational directory and personal Microsoft accounts'",
                    "5. Set Redirect URI: https://your-domain.com/api/v1/sso/callback",
                    "6. Click 'Register'"
                ]
            },
            {
                "title": "Configure API Permissions",
                "description": "Grant necessary permissions for user sync",
                "details": [
                    "1. Go to 'API permissions' in your app registration",
                    "2. Click 'Add a permission'",
                    "3. Select 'Microsoft Graph'",
                    "4. Add the following permissions:",
                    "   - User.Read.All (Application permission)",
                    "   - Group.Read.All (Application permission)",
                    "   - Directory.Read.All (Application permission)",
                    "5. Click 'Grant admin consent'"
                ]
            },
            {
                "title": "Create Client Secret",
                "description": "Generate a client secret for authentication",
                "details": [
                    "1. Go to 'Certificates & secrets' in your app registration",
                    "2. Click 'New client secret'",
                    "3. Enter a description and select expiration",
                    "4. Click 'Add'",
                    "5. Copy the secret value immediately (you won't see it again)"
                ]
            },
            {
                "title": "Configure SSO (SAML)",
                "description": "Set up SAML SSO for authentication",
                "details": [
                    "1. Go to 'Enterprise applications' in Azure AD",
                    "2. Click 'New application' → 'Non-gallery application'",
                    "3. Enter application name",
                    "4. Go to 'Single sign-on' → 'SAML'",
                    "5. Configure:",
                    "   - Identifier (Entity ID): urn:vaka:your-tenant-id",
                    "   - Reply URL: https://your-domain.com/api/v1/sso/callback",
                    "6. Download the Federation Metadata XML",
                    "7. Copy the SSO URL and X.509 Certificate"
                ]
            },
            {
                "title": "Enter Configuration in VAKA",
                "description": "Add the configuration details to VAKA platform",
                "details": [
                    "1. In VAKA, go to Integration Management → SSO Config",
                    "2. Select provider: 'Azure Entra ID'",
                    "3. Enter the following:",
                    "   - Client ID (from App registration Overview)",
                    "   - Client Secret (from step 3)",
                    "   - Tenant ID (from Azure AD Overview)",
                    "   - SSO URL (from Enterprise application SAML config)",
                    "   - X.509 Certificate (from SAML config)",
                    "4. Configure attribute mapping",
                    "5. Enable user sync if needed",
                    "6. Click 'Save'"
                ]
            }
        ],
        configuration_fields=[
            {"field": "client_id", "label": "Application (Client) ID", "required": True, "help": "Found in Azure AD App registration Overview"},
            {"field": "client_secret", "label": "Client Secret", "required": True, "help": "Created in Certificates & secrets"},
            {"field": "tenant_id", "label": "Directory (Tenant) ID", "required": True, "help": "Found in Azure AD Overview"},
            {"field": "saml_sso_url", "label": "SAML SSO URL", "required": True, "help": "From Enterprise application SAML configuration"},
            {"field": "saml_x509_cert", "label": "X.509 Certificate", "required": True, "help": "From Enterprise application SAML configuration"}
        ],
        troubleshooting=[
            {"issue": "Authentication fails", "solution": "Verify client ID, secret, and tenant ID are correct. Check redirect URI matches exactly."},
            {"issue": "User sync not working", "solution": "Ensure API permissions are granted and admin consent is provided. Check service principal has correct permissions."},
            {"issue": "SAML assertion errors", "solution": "Verify Entity ID and Reply URL match exactly. Check certificate is valid and not expired."}
        ]
    ),
    "google": IntegrationHelpGuide(
        provider="google",
        name="Google Workspace",
        description="Configure SSO and user provisioning with Google Workspace",
        prerequisites=[
            "Google Workspace administrator access",
            "Super admin or delegated admin permissions"
        ],
        steps=[
            {
                "title": "Create OAuth 2.0 Credentials",
                "description": "Set up OAuth credentials in Google Cloud Console",
                "details": [
                    "1. Go to Google Cloud Console → APIs & Services → Credentials",
                    "2. Click 'Create Credentials' → 'OAuth client ID'",
                    "3. If prompted, configure OAuth consent screen first:",
                    "   - Choose 'Internal' or 'External'",
                    "   - Enter application name and support email",
                    "   - Add scopes: https://www.googleapis.com/auth/admin.directory.user.readonly",
                    "4. Select application type: 'Web application'",
                    "5. Add authorized redirect URI: https://your-domain.com/api/v1/sso/callback",
                    "6. Click 'Create' and copy Client ID and Client Secret"
                ]
            },
            {
                "title": "Enable Admin SDK API",
                "description": "Enable the Admin SDK API for user provisioning",
                "details": [
                    "1. Go to Google Cloud Console → APIs & Services → Library",
                    "2. Search for 'Admin SDK API'",
                    "3. Click 'Enable'"
                ]
            },
            {
                "title": "Configure Domain-Wide Delegation (Optional)",
                "description": "Set up domain-wide delegation for service account access",
                "details": [
                    "1. Create a service account in Google Cloud Console",
                    "2. Enable domain-wide delegation",
                    "3. Add the following scopes:",
                    "   - https://www.googleapis.com/auth/admin.directory.user.readonly",
                    "   - https://www.googleapis.com/auth/admin.directory.group.readonly",
                    "4. Authorize the service account in Google Workspace Admin Console"
                ]
            },
            {
                "title": "Enter Configuration in VAKA",
                "description": "Add the configuration details to VAKA platform",
                "details": [
                    "1. In VAKA, go to Integration Management → SSO Config",
                    "2. Select provider: 'Google Workspace'",
                    "3. Enter the following:",
                    "   - Client ID (from OAuth credentials)",
                    "   - Client Secret (from OAuth credentials)",
                    "   - Authorization URL: https://accounts.google.com/o/oauth2/v2/auth",
                    "   - Token URL: https://oauth2.googleapis.com/token",
                    "   - UserInfo URL: https://www.googleapis.com/oauth2/v2/userinfo",
                    "4. Configure attribute mapping",
                    "5. Enable user sync if needed",
                    "6. Click 'Save'"
                ]
            }
        ],
        configuration_fields=[
            {"field": "oidc_client_id", "label": "Client ID", "required": True, "help": "From Google Cloud Console OAuth credentials"},
            {"field": "oidc_client_secret", "label": "Client Secret", "required": True, "help": "From Google Cloud Console OAuth credentials"},
            {"field": "oidc_authorization_url", "label": "Authorization URL", "required": True, "help": "https://accounts.google.com/o/oauth2/v2/auth"},
            {"field": "oidc_token_url", "label": "Token URL", "required": True, "help": "https://oauth2.googleapis.com/token"},
            {"field": "oidc_userinfo_url", "label": "UserInfo URL", "required": True, "help": "https://www.googleapis.com/oauth2/v2/userinfo"}
        ],
        troubleshooting=[
            {"issue": "OAuth consent screen errors", "solution": "Ensure OAuth consent screen is configured and scopes are added. For external apps, verify domain verification."},
            {"issue": "User sync fails", "solution": "Check Admin SDK API is enabled. Verify service account has correct permissions if using domain-wide delegation."},
            {"issue": "Redirect URI mismatch", "solution": "Ensure redirect URI in Google Console exactly matches the callback URL in VAKA."}
        ]
    ),
    "okta": IntegrationHelpGuide(
        provider="okta",
        name="OKTA",
        description="Configure SSO and user provisioning with OKTA",
        prerequisites=[
            "OKTA administrator access",
            "Super admin or org admin role"
        ],
        steps=[
            {
                "title": "Create SAML Application",
                "description": "Set up a SAML 2.0 application in OKTA",
                "details": [
                    "1. Go to OKTA Admin Console → Applications → Applications",
                    "2. Click 'Create App Integration'",
                    "3. Select 'SAML 2.0'",
                    "4. Enter app name: 'VAKA Platform'",
                    "5. Click 'Next'"
                ]
            },
            {
                "title": "Configure SAML Settings",
                "description": "Configure SAML settings for the application",
                "details": [
                    "1. In SAML Settings, configure:",
                    "   - Single sign on URL: https://your-domain.com/api/v1/sso/callback",
                    "   - Audience URI (SP Entity ID): urn:vaka:your-tenant-id",
                    "   - Name ID format: EmailAddress",
                    "   - Application username: Email",
                    "2. Add attribute statements:",
                    "   - email → user.email",
                    "   - firstName → user.firstName",
                    "   - lastName → user.lastName",
                    "   - department → user.department",
                    "3. Click 'Next' → 'Finish'"
                ]
            },
            {
                "title": "Assign Users",
                "description": "Assign users or groups to the application",
                "details": [
                    "1. Go to 'Assignments' tab",
                    "2. Click 'Assign' → 'Assign to People' or 'Assign to Groups'",
                    "3. Select users/groups and click 'Assign'"
                ]
            },
            {
                "title": "Get SAML Metadata",
                "description": "Download or view SAML metadata",
                "details": [
                    "1. Go to 'Sign On' tab",
                    "2. Click 'View SAML 2.0 Setup Instructions'",
                    "3. Copy the following:",
                    "   - Identity Provider Single Sign-On URL",
                    "   - X.509 Certificate",
                    "   - Entity ID"
                ]
            },
            {
                "title": "Enable SCIM Provisioning (Optional)",
                "description": "Set up SCIM for automatic user provisioning",
                "details": [
                    "1. Go to 'Provisioning' tab",
                    "2. Click 'Edit' in Provisioning section",
                    "3. Enable 'Create Users', 'Update User Attributes', 'Deactivate Users'",
                    "4. Go to 'Integration' tab",
                    "5. Click 'Edit' and enter:",
                    "   - SCIM connector base URL: https://your-domain.com/api/v1/scim/v2",
                    "   - Unique identifier field for users: userName",
                    "   - Supported provisioning actions: Push New Users, Push Profile Updates, Push Groups",
                    "6. Generate API token and save it"
                ]
            },
            {
                "title": "Enter Configuration in VAKA",
                "description": "Add the configuration details to VAKA platform",
                "details": [
                    "1. In VAKA, go to Integration Management → SSO Config",
                    "2. Select provider: 'OKTA'",
                    "3. Enter the following:",
                    "   - SSO URL (from SAML setup instructions)",
                    "   - Entity ID (from SAML setup instructions)",
                    "   - X.509 Certificate (from SAML setup instructions)",
                    "4. If using SCIM, configure SCIM settings with the API token",
                    "5. Configure attribute mapping",
                    "6. Enable user sync if needed",
                    "7. Click 'Save'"
                ]
            }
        ],
        configuration_fields=[
            {"field": "saml_sso_url", "label": "SSO URL", "required": True, "help": "Identity Provider Single Sign-On URL from OKTA"},
            {"field": "saml_entity_id", "label": "Entity ID", "required": True, "help": "Entity ID from OKTA SAML setup"},
            {"field": "saml_x509_cert", "label": "X.509 Certificate", "required": True, "help": "Certificate from OKTA SAML setup instructions"},
            {"field": "scim_bearer_token", "label": "SCIM Bearer Token (Optional)", "required": False, "help": "API token from OKTA SCIM configuration"}
        ],
        troubleshooting=[
            {"issue": "SAML assertion not received", "solution": "Verify SSO URL and Entity ID are correct. Check that users are assigned to the application."},
            {"issue": "Attribute mapping issues", "solution": "Ensure attribute statements in OKTA match the attribute mapping in VAKA. Check Name ID format."},
            {"issue": "SCIM sync not working", "solution": "Verify SCIM connector base URL is correct. Check API token is valid and has not expired."}
        ]
    ),
    "ping": IntegrationHelpGuide(
        provider="ping",
        name="Ping Identity",
        description="Configure SSO and user provisioning with Ping Identity",
        prerequisites=[
            "Ping Identity administrator access",
            "Configuration access to PingFederate or PingOne"
        ],
        steps=[
            {
                "title": "Create SAML Application Connection",
                "description": "Set up SAML connection in Ping Identity",
                "details": [
                    "1. Log in to PingFederate Admin Console (or PingOne)",
                    "2. Go to Applications → SAML Applications",
                    "3. Click 'Create New Application'",
                    "4. Select 'SAML 2.0'",
                    "5. Enter application name: 'VAKA Platform'"
                ]
            },
            {
                "title": "Configure SAML Settings",
                "description": "Configure SAML connection settings",
                "details": [
                    "1. Configure Connection Settings:",
                    "   - Entity ID: urn:vaka:your-tenant-id",
                    "   - Assertion Consumer Service URL: https://your-domain.com/api/v1/sso/callback",
                    "   - Name ID Format: EmailAddress",
                    "2. Configure Attribute Contract:",
                    "   - Add attributes: email, firstName, lastName, department",
                    "3. Map attributes from user data store"
                ]
            },
            {
                "title": "Get SSO URL and Certificate",
                "description": "Retrieve SSO URL and signing certificate",
                "details": [
                    "1. Go to 'SSO Configuration'",
                    "2. Copy the SSO URL (Single Sign-On Service URL)",
                    "3. Export or copy the signing certificate (X.509)",
                    "4. Note the Entity ID"
                ]
            },
            {
                "title": "Enter Configuration in VAKA",
                "description": "Add the configuration details to VAKA platform",
                "details": [
                    "1. In VAKA, go to Integration Management → SSO Config",
                    "2. Select provider: 'Ping Identity'",
                    "3. Enter the following:",
                    "   - SSO URL (from Ping Identity)",
                    "   - Entity ID (from Ping Identity)",
                    "   - X.509 Certificate (from Ping Identity)",
                    "4. Configure attribute mapping",
                    "5. Enable user sync if needed",
                    "6. Click 'Save'"
                ]
            }
        ],
        configuration_fields=[
            {"field": "saml_sso_url", "label": "SSO URL", "required": True, "help": "Single Sign-On Service URL from Ping Identity"},
            {"field": "saml_entity_id", "label": "Entity ID", "required": True, "help": "Entity ID from Ping Identity configuration"},
            {"field": "saml_x509_cert", "label": "X.509 Certificate", "required": True, "help": "Signing certificate from Ping Identity"}
        ],
        troubleshooting=[
            {"issue": "SAML response validation fails", "solution": "Verify certificate is correct and not expired. Check Entity ID matches exactly."},
            {"issue": "Attribute not received", "solution": "Ensure attributes are configured in Attribute Contract and mapped correctly."},
            {"issue": "SSO redirect not working", "solution": "Verify ACS URL matches exactly. Check for URL encoding issues."}
        ]
    ),
    "servicenow": IntegrationHelpGuide(
        provider="servicenow",
        name="ServiceNow",
        description="Configure integration with ServiceNow for workflow automation",
        prerequisites=[
            "ServiceNow administrator access",
            "Integration user credentials"
        ],
        steps=[
            {
                "title": "Create Integration User",
                "description": "Create a dedicated user for VAKA integration",
                "details": [
                    "1. Go to ServiceNow → User Administration → Users",
                    "2. Click 'New'",
                    "3. Create user with:",
                    "   - User ID: vaka_integration",
                    "   - Roles: itil, admin (or custom role with required permissions)",
                    "4. Set password and save"
                ]
            },
            {
                "title": "Generate API Token (OAuth)",
                "description": "Set up OAuth for API access",
                "details": [
                    "1. Go to System OAuth → Application Registry",
                    "2. Click 'New'",
                    "3. Configure:",
                    "   - Name: VAKA Platform",
                    "   - Client ID: (auto-generated or custom)",
                    "   - Client Secret: (generate and save)",
                    "   - Redirect URL: https://your-domain.com/api/v1/integrations/servicenow/callback",
                    "4. Grant OAuth scope: user_impersonation",
                    "5. Save and note Client ID and Secret"
                ]
            },
            {
                "title": "Configure REST API Access",
                "description": "Enable REST API access for the integration user",
                "details": [
                    "1. Go to System Security → Access Control (ACL)",
                    "2. Create ACL rules if needed for:",
                    "   - Table: incident, change_request, etc.",
                    "   - Operation: read, write",
                    "   - Roles: itil, admin"
                ]
            },
            {
                "title": "Get Instance URL",
                "description": "Note your ServiceNow instance URL",
                "details": [
                    "1. Your instance URL format: https://your-instance.service-now.com",
                    "2. Note this for configuration"
                ]
            },
            {
                "title": "Enter Configuration in VAKA",
                "description": "Add the configuration details to VAKA platform",
                "details": [
                    "1. In VAKA, go to Integration Management → Add Integration",
                    "2. Select type: 'ServiceNow'",
                    "3. Enter the following:",
                    "   - Name: ServiceNow Integration",
                    "   - Instance URL: https://your-instance.service-now.com",
                    "   - Username: vaka_integration (or your integration user)",
                    "   - Password: (integration user password)",
                    "   - Client ID: (from OAuth application)",
                    "   - Client Secret: (from OAuth application)",
                    "4. Configure workflow mappings if needed",
                    "5. Click 'Create' and then 'Test Connection'"
                ]
            }
        ],
        configuration_fields=[
            {"field": "instance_url", "label": "ServiceNow Instance URL", "required": True, "help": "Your ServiceNow instance URL (e.g., https://instance.service-now.com)"},
            {"field": "username", "label": "Username", "required": True, "help": "Integration user username"},
            {"field": "password", "label": "Password", "required": True, "help": "Integration user password"},
            {"field": "client_id", "label": "OAuth Client ID", "required": False, "help": "OAuth client ID if using OAuth"},
            {"field": "client_secret", "label": "OAuth Client Secret", "required": False, "help": "OAuth client secret if using OAuth"}
        ],
        troubleshooting=[
            {"issue": "Authentication fails", "solution": "Verify username and password are correct. Check user has required roles."},
            {"issue": "API calls fail", "solution": "Ensure ACL rules allow access. Check REST API is enabled for the instance."},
            {"issue": "OAuth errors", "solution": "Verify Client ID and Secret are correct. Check redirect URL matches exactly."}
        ]
    ),
    "jira": IntegrationHelpGuide(
        provider="jira",
        name="Atlassian Jira",
        description="Configure integration with Jira for issue tracking and workflow automation",
        prerequisites=[
            "Jira administrator access",
            "API token or OAuth app credentials"
        ],
        steps=[
            {
                "title": "Generate API Token",
                "description": "Create an API token for authentication",
                "details": [
                    "1. Log in to Jira (Cloud or Server)",
                    "2. Go to Account Settings → Security",
                    "3. Click 'Create API token' (or 'API tokens' in older versions)",
                    "4. Enter a label: 'VAKA Platform Integration'",
                    "5. Click 'Create'",
                    "6. Copy the API token immediately (you won't see it again)",
                    "7. Save it securely"
                ]
            },
            {
                "title": "Create OAuth App (Alternative Method)",
                "description": "Set up OAuth 2.0 application for authentication",
                "details": [
                    "1. Go to Jira Settings → Applications → OAuth apps",
                    "2. Click 'Create OAuth app'",
                    "3. Configure:",
                    "   - Name: VAKA Platform",
                    "   - Application type: 3LO (3-legged OAuth)",
                    "   - Callback URL: https://your-domain.com/api/v1/integrations/jira/callback",
                    "   - Scopes: read:jira-work, write:jira-work, read:jira-user",
                    "4. Click 'Create'",
                    "5. Copy Client ID and Client Secret"
                ]
            },
            {
                "title": "Configure Jira Permissions",
                "description": "Ensure integration user has necessary permissions",
                "details": [
                    "1. Go to Jira Settings → System → Global permissions",
                    "2. Verify the user has:",
                    "   - Browse Projects",
                    "   - Create Issues",
                    "   - Edit Issues",
                    "   - Delete Issues (if needed)",
                    "3. For project-specific permissions:",
                    "   - Go to Project Settings → Permissions",
                    "   - Add integration user to appropriate permission schemes"
                ]
            },
            {
                "title": "Get Jira Instance URL",
                "description": "Note your Jira instance URL",
                "details": [
                    "1. For Jira Cloud: https://your-domain.atlassian.net",
                    "2. For Jira Server/Data Center: https://your-jira-server.com",
                    "3. Note the base URL for configuration"
                ]
            },
            {
                "title": "Configure Webhooks (Optional)",
                "description": "Set up webhooks for real-time updates",
                "details": [
                    "1. Go to Jira Settings → System → Webhooks",
                    "2. Click 'Create a webhook'",
                    "3. Configure:",
                    "   - Name: VAKA Platform Webhook",
                    "   - URL: https://your-domain.com/api/v1/webhooks/jira",
                    "   - Events: Issue created, Issue updated, Issue deleted",
                    "   - JQL filter: (optional) Filter specific issues",
                    "4. Click 'Create'"
                ]
            },
            {
                "title": "Enter Configuration in VAKA",
                "description": "Add the configuration details to VAKA platform",
                "details": [
                    "1. In VAKA, go to Integration Management → Add Integration",
                    "2. Select type: 'Jira'",
                    "3. Enter the following:",
                    "   - Name: Jira Integration",
                    "   - Jira URL: https://your-domain.atlassian.net (or your Jira server URL)",
                    "   - Email/Username: your-jira-email@example.com",
                    "   - API Token: (from step 1)",
                    "   OR",
                    "   - OAuth Client ID: (if using OAuth)",
                    "   - OAuth Client Secret: (if using OAuth)",
                    "4. Configure project mappings if needed:",
                    "   - Map VAKA workflows to Jira projects",
                    "   - Map agent statuses to Jira issue types",
                    "5. Configure webhook URL if using webhooks",
                    "6. Click 'Create' and then 'Test Connection'"
                ]
            }
        ],
        configuration_fields=[
            {"field": "jira_url", "label": "Jira URL", "required": True, "help": "Your Jira instance URL (Cloud: https://domain.atlassian.net, Server: https://your-server.com)"},
            {"field": "email", "label": "Email/Username", "required": True, "help": "Your Jira account email address"},
            {"field": "api_token", "label": "API Token", "required": True, "help": "API token generated from Jira account settings"},
            {"field": "oauth_client_id", "label": "OAuth Client ID (Optional)", "required": False, "help": "OAuth client ID if using OAuth instead of API token"},
            {"field": "oauth_client_secret", "label": "OAuth Client Secret (Optional)", "required": False, "help": "OAuth client secret if using OAuth"},
            {"field": "webhook_url", "label": "Webhook URL (Optional)", "required": False, "help": "Webhook URL for receiving Jira events"}
        ],
        troubleshooting=[
            {"issue": "Authentication fails with API token", "solution": "Verify email and API token are correct. Ensure API token hasn't expired. For Jira Cloud, use email + API token. For Jira Server, check if basic auth is enabled."},
            {"issue": "Permission denied errors", "solution": "Check user has necessary permissions in Jira. Verify project permissions if accessing specific projects. Check global permissions in Jira settings."},
            {"issue": "OAuth callback errors", "solution": "Verify callback URL matches exactly. Check OAuth app scopes include required permissions. Ensure redirect URI is whitelisted."},
            {"issue": "Webhook not receiving events", "solution": "Verify webhook URL is accessible from Jira. Check webhook events are selected. Test webhook manually from Jira settings."},
            {"issue": "API rate limit errors", "solution": "Jira Cloud has rate limits. Implement retry logic with exponential backoff. Consider using webhooks instead of polling for real-time updates."}
        ]
    )
}


@router.get("/{provider}", response_model=IntegrationHelpGuide)
async def get_integration_help(provider: str):
    """Get help guide for a specific integration provider"""
    provider_key = provider.lower().replace(" ", "_").replace("-", "_")
    
    if provider_key not in HELP_GUIDES:
        # Return a generic guide if provider not found
        return IntegrationHelpGuide(
            provider=provider_key,
            name=provider,
            description=f"Configuration guide for {provider}",
            steps=[],
            prerequisites=[],
            configuration_fields=[],
            troubleshooting=[]
        )
    
    return HELP_GUIDES[provider_key]


@router.get("", response_model=List[Dict[str, str]])
async def list_integration_help():
    """List all available integration help guides"""
    return [
        {
            "provider": guide.provider,
            "name": guide.name,
            "description": guide.description
        }
        for guide in HELP_GUIDES.values()
    ]

