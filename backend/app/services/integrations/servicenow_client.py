"""
ServiceNow integration client
"""
import httpx
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class ServiceNowClient:
    """ServiceNow API client"""
    
    def __init__(self, instance_url: str, username: str, password: str):
        """
        Initialize ServiceNow client
        
        Args:
            instance_url: ServiceNow instance URL (e.g., https://yourinstance.service-now.com)
            username: ServiceNow username
            password: ServiceNow password
        """
        self.instance_url = instance_url.rstrip('/')
        self.username = username
        self.password = password
        self.base_url = f"{self.instance_url}/api/now"
        self.auth = (username, password)
    
    async def create_ticket(
        self,
        table: str,
        short_description: str,
        description: str,
        additional_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a ServiceNow ticket
        
        Args:
            table: Table name (e.g., 'incident', 'task', 'change_request')
            short_description: Short description
            description: Full description
            additional_fields: Additional fields to set
        
        Returns:
            Created ticket data
        """
        url = f"{self.base_url}/table/{table}"
        payload = {
            "short_description": short_description,
            "description": description,
            **(additional_fields or {})
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    auth=self.auth,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                logger.info(f"Created ServiceNow ticket: {result.get('result', {}).get('sys_id')}")
                return result.get("result", {})
        except httpx.HTTPError as e:
            logger.error(f"ServiceNow API error: {e}")
            raise Exception(f"ServiceNow API error: {str(e)}")
    
    async def update_ticket(
        self,
        table: str,
        sys_id: str,
        fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update a ServiceNow ticket
        
        Args:
            table: Table name
            sys_id: Ticket sys_id
            fields: Fields to update
        
        Returns:
            Updated ticket data
        """
        url = f"{self.base_url}/table/{table}/{sys_id}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    url,
                    json=fields,
                    auth=self.auth,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                return result.get("result", {})
        except httpx.HTTPError as e:
            logger.error(f"ServiceNow API error: {e}")
            raise Exception(f"ServiceNow API error: {str(e)}")
    
    async def get_ticket(self, table: str, sys_id: str) -> Dict[str, Any]:
        """
        Get a ServiceNow ticket
        
        Args:
            table: Table name
            sys_id: Ticket sys_id
        
        Returns:
            Ticket data
        """
        url = f"{self.base_url}/table/{table}/{sys_id}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    auth=self.auth,
                    headers={"Accept": "application/json"},
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                return result.get("result", {})
        except httpx.HTTPError as e:
            logger.error(f"ServiceNow API error: {e}")
            raise Exception(f"ServiceNow API error: {str(e)}")
    
    async def test_connection(self) -> bool:
        """Test ServiceNow connection"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/table/sys_user?sysparm_limit=1",
                    auth=self.auth,
                    headers={"Accept": "application/json"},
                    timeout=10.0
                )
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"ServiceNow connection test failed: {e}")
            return False

