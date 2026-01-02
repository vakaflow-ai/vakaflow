"""
Slack integration client
"""
import httpx
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class SlackClient:
    """Slack API client"""
    
    def __init__(self, bot_token: str):
        """
        Initialize Slack client
        
        Args:
            bot_token: Slack bot token (xoxb-...)
        """
        self.bot_token = bot_token
        self.base_url = "https://slack.com/api"
        self.headers = {
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json"
        }
    
    async def send_message(
        self,
        channel: str,
        text: str,
        blocks: Optional[List[Dict[str, Any]]] = None,
        thread_ts: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a message to a Slack channel
        
        Args:
            channel: Channel ID or name (e.g., #general or C1234567890)
            text: Message text
            blocks: Optional Slack blocks for rich formatting
            thread_ts: Optional thread timestamp to reply in thread
        
        Returns:
            Message data
        """
        url = f"{self.base_url}/chat.postMessage"
        payload = {
            "channel": channel,
            "text": text,
            **(blocks and {"blocks": blocks} or {}),
            **(thread_ts and {"thread_ts": thread_ts} or {})
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self.headers,
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                
                if not result.get("ok"):
                    error = result.get("error", "Unknown error")
                    raise Exception(f"Slack API error: {error}")
                
                logger.info(f"Sent Slack message to {channel}")
                return result
        except httpx.HTTPError as e:
            logger.error(f"Slack API error: {e}")
            raise Exception(f"Slack API error: {str(e)}")
    
    async def send_notification(
        self,
        channel: str,
        title: str,
        message: str,
        color: str = "good",  # good, warning, danger
        fields: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Send a formatted notification to Slack
        
        Args:
            channel: Channel ID or name
            title: Notification title
            message: Notification message
            color: Color for the attachment (good=green, warning=yellow, danger=red)
            fields: Optional fields to display
        
        Returns:
            Message data
        """
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": title
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": message
                }
            }
        ]
        
        if fields:
            fields_block = {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*{field['title']}*\n{field['value']}"
                    }
                    for field in fields
                ]
            }
            blocks.append(fields_block)
        
        return await self.send_message(channel, message, blocks=blocks)
    
    async def test_connection(self) -> bool:
        """Test Slack connection"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/auth.test",
                    headers=self.headers,
                    timeout=10.0
                )
                response.raise_for_status()
                result = response.json()
                return result.get("ok", False)
        except Exception as e:
            logger.error(f"Slack connection test failed: {e}")
            return False

