"""
Webhook service for sending webhook notifications
"""
import httpx
import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.webhook import Webhook, WebhookDelivery, WebhookEvent, WebhookStatus

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for managing webhook deliveries"""
    
    @staticmethod
    def generate_signature(payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook payload"""
        return hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    @staticmethod
    async def trigger_webhook(
        db: Session,
        webhook: Webhook,
        event_type: str,
        payload: Dict[str, Any]
    ) -> WebhookDelivery:
        """
        Trigger a webhook delivery
        
        Args:
            db: Database session
            webhook: Webhook configuration
            event_type: Event type
            payload: Payload to send
        
        Returns:
            WebhookDelivery record
        """
        if webhook.status != WebhookStatus.ACTIVE.value or not webhook.is_active:
            logger.warning(f"Webhook {webhook.id} is not active")
            return None
        
        # Check if webhook subscribes to this event
        if event_type not in webhook.events:
            logger.debug(f"Webhook {webhook.id} does not subscribe to {event_type}")
            return None
        
        # Create delivery record
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            tenant_id=webhook.tenant_id,
            event_type=event_type,
            payload=payload,
            attempted_at=datetime.utcnow()
        )
        db.add(delivery)
        db.flush()
        
        # Prepare payload
        payload_json = json.dumps(payload)
        payload_bytes = payload_json.encode('utf-8')
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event_type,
            "X-Webhook-ID": str(webhook.id),
            **(webhook.headers or {})
        }
        
        # Add signature if secret is configured
        if webhook.secret:
            signature = WebhookService.generate_signature(payload_json, webhook.secret)
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        # Send webhook
        start_time = datetime.utcnow()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook.url,
                    content=payload_bytes,
                    headers=headers,
                    timeout=webhook.timeout
                )
                
                # Calculate duration
                end_time = datetime.utcnow()
                duration_ms = int((end_time - start_time).total_seconds() * 1000)
                
                # Update delivery record
                delivery.status_code = response.status_code
                delivery.completed_at = end_time
                delivery.duration_ms = duration_ms
                
                # Try to parse response
                try:
                    delivery.response_body = response.text[:1000]  # Limit to 1000 chars
                except:
                    pass
                
                # Update webhook statistics
                if 200 <= response.status_code < 300:
                    webhook.success_count += 1
                    webhook.last_triggered_at = end_time
                else:
                    webhook.failure_count += 1
                    webhook.last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    delivery.error_message = f"HTTP {response.status_code}"
                
                response.raise_for_status()
                logger.info(f"Webhook {webhook.id} delivered successfully")
                
        except httpx.TimeoutException:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            delivery.status_code = 408
            delivery.completed_at = end_time
            delivery.duration_ms = duration_ms
            delivery.error_message = "Request timeout"
            webhook.failure_count += 1
            webhook.last_error = "Request timeout"
            logger.error(f"Webhook {webhook.id} timed out")
            
        except Exception as e:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            delivery.status_code = 500
            delivery.completed_at = end_time
            delivery.duration_ms = duration_ms
            delivery.error_message = str(e)
            webhook.failure_count += 1
            webhook.last_error = str(e)
            logger.error(f"Webhook {webhook.id} failed: {e}")
        
        db.commit()
        return delivery
    
    @staticmethod
    async def trigger_event(
        db: Session,
        event_type: str,
        payload: Dict[str, Any],
        tenant_id: Optional[str] = None
    ):
        """
        Trigger webhooks for an event
        
        Args:
            db: Database session
            event_type: Event type
            payload: Event payload
            tenant_id: Optional tenant ID to filter webhooks
        """
        # Find active webhooks that subscribe to this event
        query = db.query(Webhook).filter(
            Webhook.status == WebhookStatus.ACTIVE.value,
            Webhook.is_active == True
        )
        
        if tenant_id:
            query = query.filter(Webhook.tenant_id == tenant_id)
        
        webhooks = query.all()
        
        # Trigger each webhook
        for webhook in webhooks:
            if event_type in webhook.events:
                try:
                    await WebhookService.trigger_webhook(db, webhook, event_type, payload)
                except Exception as e:
                    logger.error(f"Failed to trigger webhook {webhook.id}: {e}")

