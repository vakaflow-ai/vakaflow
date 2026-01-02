"""
SSO Service for SAML 2.0 and OIDC integration
"""
from typing import Optional, Dict, Any
import logging

# Optional imports for SSO
try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    from onelogin.saml2.utils import OneLogin_Saml2_Utils  # type: ignore
    SAML_AVAILABLE = True
except ImportError:
    SAML_AVAILABLE = False
    OneLogin_Saml2_Auth = None  # type: ignore
    OneLogin_Saml2_Utils = None  # type: ignore

try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    jwt = None

from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class SSOService:
    """Service for SSO operations (SAML 2.0 and OIDC)"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize SSO service
        
        Args:
            config: SSO configuration (SAML or OIDC)
        """
        self.config = config
        self.sso_type = config.get("type", "saml")  # saml or oidc
    
    def prepare_saml_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare SAML authentication request
        
        Args:
            request_data: Request data (headers, URL, etc.)
        
        Returns:
            SAML auth object and redirect URL
        """
        if not SAML_AVAILABLE:
            raise Exception("SAML support not available. Install python3-saml: pip install python3-saml")
        
        try:
            saml_auth = OneLogin_Saml2_Auth(request_data, self.config.get("saml_settings", {}))
            redirect_url = saml_auth.login()
            return {
                "redirect_url": redirect_url,
                "auth": saml_auth
            }
        except Exception as e:
            logger.error(f"SAML request preparation failed: {e}")
            raise Exception(f"SAML authentication failed: {str(e)}")
    
    def process_saml_response(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process SAML authentication response
        
        Args:
            request_data: Request data with SAML response
        
        Returns:
            User attributes from SAML response
        """
        if not SAML_AVAILABLE:
            raise Exception("SAML support not available. Install python3-saml: pip install python3-saml")
        
        try:
            saml_auth = OneLogin_Saml2_Auth(request_data, self.config.get("saml_settings", {}))
            saml_auth.process_response()
            
            if saml_auth.is_authenticated():
                attributes = saml_auth.get_attributes()
                name_id = saml_auth.get_nameid()
                
                return {
                    "authenticated": True,
                    "name_id": name_id,
                    "attributes": attributes,
                    "session_index": saml_auth.get_session_index()
                }
            else:
                errors = saml_auth.get_errors()
                return {
                    "authenticated": False,
                    "errors": errors
                }
        except Exception as e:
            logger.error(f"SAML response processing failed: {e}")
            raise Exception(f"SAML authentication failed: {str(e)}")
    
    def get_oidc_authorization_url(self, state: str, nonce: str) -> str:
        """
        Get OIDC authorization URL
        
        Args:
            state: State parameter for CSRF protection
            nonce: Nonce parameter for replay protection
        
        Returns:
            Authorization URL
        """
        oidc_config = self.config.get("oidc", {})
        client_id = oidc_config.get("client_id")
        redirect_uri = oidc_config.get("redirect_uri")
        authorization_endpoint = oidc_config.get("authorization_endpoint")
        scopes = oidc_config.get("scopes", "openid profile email")
        
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": scopes,
            "state": state,
            "nonce": nonce
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{authorization_endpoint}?{query_string}"
    
    async def exchange_oidc_code(
        self,
        code: str,
        state: str,
        nonce: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exchange OIDC authorization code for tokens
        
        Args:
            code: Authorization code
            state: State parameter
            nonce: Nonce parameter for validation (optional)
        
        Returns:
            Token response with user info
        """
        import httpx
        
        oidc_config = self.config.get("oidc", {})
        token_endpoint = oidc_config.get("token_endpoint")
        client_id = oidc_config.get("client_id")
        client_secret = oidc_config.get("client_secret")
        redirect_uri = oidc_config.get("redirect_uri")
        
        try:
            async with httpx.AsyncClient() as client:
                # Exchange code for tokens
                token_response = await client.post(
                    token_endpoint,
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": redirect_uri,
                        "client_id": client_id,
                        "client_secret": client_secret
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=30.0
                )
                token_response.raise_for_status()
                tokens = token_response.json()
                
                # Get user info
                userinfo_endpoint = oidc_config.get("userinfo_endpoint")
                if userinfo_endpoint:
                    userinfo_response = await client.get(
                        userinfo_endpoint,
                        headers={"Authorization": f"Bearer {tokens['access_token']}"},
                        timeout=30.0
                    )
                    userinfo_response.raise_for_status()
                    user_info = userinfo_response.json()
                else:
                    # Decode ID token
                    id_token = tokens.get("id_token")
                    if id_token and JWT_AVAILABLE:
                        # Decode without verification (in production, verify signature)
                        user_info = jwt.decode(id_token, options={"verify_signature": False})
                    else:
                        user_info = {}
                
                return {
                    "authenticated": True,
                    "tokens": tokens,
                    "user_info": user_info
                }
        except Exception as e:
            logger.error(f"OIDC token exchange failed: {e}")
            raise Exception(f"OIDC authentication failed: {str(e)}")
    
    def map_user_attributes(self, sso_attributes: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
        """
        Map SSO attributes to platform user attributes
        
        Args:
            sso_attributes: Attributes from SSO provider
            mapping: Attribute mapping configuration
        
        Returns:
            Mapped user attributes
        """
        mapped = {}
        for platform_key, sso_key in mapping.items():
            if sso_key in sso_attributes:
                mapped[platform_key] = sso_attributes[sso_key]
            elif isinstance(sso_key, list):
                # Try multiple keys
                for key in sso_key:
                    if key in sso_attributes:
                        mapped[platform_key] = sso_attributes[key]
                        break
        
        return mapped

