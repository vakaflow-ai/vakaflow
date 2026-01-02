"""
Microsoft Teams integration client
"""
import httpx
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class TeamsClient:
    """Microsoft Teams webhook client"""
    
    def __init__(self, webhook_url: str):
        """
        Initialize Teams client
        
        Args:
            webhook_url: Teams incoming webhook URL
        """
        self.webhook_url = webhook_url
    
    async def send_message(
        self,
        title: str,
        text: str,
        theme_color: str = "0078D4",
        sections: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Send a message to Teams via webhook
        
        Args:
            title: Message title
            text: Message text
            theme_color: Theme color (hex code)
            sections: Optional sections for rich formatting
        
        Returns:
            Response data
        """
        payload = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": title,
            "themeColor": theme_color,
            "title": title,
            "text": text,
            **(sections and {"sections": sections} or {})
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=30.0
                )
                response.raise_for_status()
                logger.info(f"Sent Teams message: {title}")
                return {"success": True}
        except httpx.HTTPError as e:
            logger.error(f"Teams API error: {e}")
            raise Exception(f"Teams API error: {str(e)}")
    
    async def send_notification(
        self,
        title: str,
        message: str,
        facts: Optional[list] = None,
        color: str = "0078D4"  # Default blue
    ) -> Dict[str, Any]:
        """
        Send a formatted notification to Teams
        
        Args:
            title: Notification title
            message: Notification message
            facts: Optional list of fact items [{"name": "...", "value": "..."}]
            color: Theme color
        
        Returns:
            Response data
        """
        sections = []
        if facts:
            sections.append({
                "facts": facts
            })
        
        return await self.send_message(title, message, theme_color=color, sections=sections)
    
    async def test_connection(self) -> bool:
        """Test Teams connection"""
        try:
            return await self.send_message(
                "Connection Test",
                "Testing Teams webhook connection"
            )
        except Exception as e:
            logger.error(f"Teams connection test failed: {e}")
            return False

