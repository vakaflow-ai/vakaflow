"""
Jira integration client
"""
import httpx
from typing import Dict, Any, Optional
import base64
import logging

logger = logging.getLogger(__name__)


class JiraClient:
    """Jira API client"""
    
    def __init__(self, base_url: str, email: str, api_token: str):
        """
        Initialize Jira client
        
        Args:
            base_url: Jira base URL (e.g., https://yourdomain.atlassian.net)
            email: Jira account email
            api_token: Jira API token
        """
        self.base_url = base_url.rstrip('/')
        self.email = email
        self.api_token = api_token
        # Create basic auth header
        credentials = f"{email}:{api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        self.auth_header = f"Basic {encoded}"
    
    async def create_issue(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str = "Task",
        additional_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a Jira issue
        
        Args:
            project_key: Jira project key
            summary: Issue summary
            description: Issue description
            issue_type: Issue type (Task, Story, Bug, etc.)
            additional_fields: Additional fields to set
        
        Returns:
            Created issue data
        """
        url = f"{self.base_url}/rest/api/3/issue"
        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": description}
                            ]
                        }
                    ]
                },
                "issuetype": {"name": issue_type},
                **(additional_fields or {})
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": self.auth_header,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                logger.info(f"Created Jira issue: {result.get('key')}")
                return result
        except httpx.HTTPError as e:
            logger.error(f"Jira API error: {e}")
            raise Exception(f"Jira API error: {str(e)}")
    
    async def update_issue(
        self,
        issue_key: str,
        fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update a Jira issue
        
        Args:
            issue_key: Issue key (e.g., PROJ-123)
            fields: Fields to update
        
        Returns:
            Updated issue data
        """
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        payload = {"fields": fields}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    url,
                    json=payload,
                    headers={
                        "Authorization": self.auth_header,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                return {}
        except httpx.HTTPError as e:
            logger.error(f"Jira API error: {e}")
            raise Exception(f"Jira API error: {str(e)}")
    
    async def add_comment(
        self,
        issue_key: str,
        comment: str
    ) -> Dict[str, Any]:
        """
        Add a comment to a Jira issue
        
        Args:
            issue_key: Issue key
            comment: Comment text
        
        Returns:
            Comment data
        """
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/comment"
        payload = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": comment}]
                    }
                ]
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": self.auth_header,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                return result
        except httpx.HTTPError as e:
            logger.error(f"Jira API error: {e}")
            raise Exception(f"Jira API error: {str(e)}")
    
    async def get_issue(self, issue_key: str) -> Dict[str, Any]:
        """
        Get a Jira issue
        
        Args:
            issue_key: Issue key
        
        Returns:
            Issue data
        """
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers={
                        "Authorization": self.auth_header,
                        "Accept": "application/json"
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Jira API error: {e}")
            raise Exception(f"Jira API error: {str(e)}")
    
    async def test_connection(self) -> bool:
        """Test Jira connection"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/api/3/myself",
                    headers={
                        "Authorization": self.auth_header,
                        "Accept": "application/json"
                    },
                    timeout=10.0
                )
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Jira connection test failed: {e}")
            return False

