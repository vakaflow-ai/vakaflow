"""
Agentic Action Service - Handles email, push data, and collect data actions
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import httpx
import os

from app.services.email_service import EmailService
from app.services.agentic.mcp_server import MCPServer
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class AgenticActionService:
    """Service for executing agentic actions (email, push, collect)"""
    
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.email_service = EmailService()
        self.mcp_server = MCPServer(db)
    
    async def execute_email_action(
        self,
        email_config: Dict[str, Any],
        execution_result: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute email notification action
        
        Args:
            email_config: Email configuration from node
            execution_result: Result from agent execution (if sending after)
            context: Execution context (vendor_id, agent_id, etc.)
            
        Returns:
            Email send result
        """
        if not email_config.get("enabled"):
            return {"sent": False, "reason": "Email not enabled"}
        
        send_on = email_config.get("send_on", "after")
        
        # Check if we should send based on send_on timing
        if send_on == "before" and execution_result:
            return {"sent": False, "reason": "Send on 'before' but execution already completed"}
        if send_on == "after" and not execution_result:
            return {"sent": False, "reason": "Send on 'after' but no execution result"}
        if send_on == "error" and (not execution_result or not execution_result.get("error")):
            return {"sent": False, "reason": "Send on 'error' but no error occurred"}
        
        # Load email config from database integration (always use /integrations page config)
        config_loaded = self.email_service.load_config_from_db(self.db, str(self.tenant_id))
        if not config_loaded:
            logger.warning(f"SMTP integration not found for tenant {self.tenant_id}. Email will not be sent. Please configure SMTP in /integrations page.")
            return {
                "sent": False,
                "reason": "SMTP integration not configured. Please configure SMTP in /integrations page.",
                "results": []
            }
        
        # Resolve recipients
        recipients = []
        for recipient in email_config.get("recipients", []):
            # First replace variables in recipient value
            recipient_value = recipient.get("value", "")
            if recipient_value:
                recipient_value = self._replace_variables(recipient_value, execution_result, context)
                # Update recipient dict with resolved value
                recipient = {**recipient, "value": recipient_value}
            
            email_address = await self._resolve_recipient(recipient, execution_result, context)
            if email_address:
                recipients.append(email_address)
        
        if not recipients:
            return {"sent": False, "reason": "No valid recipients found"}
        
        # Build email content
        subject = email_config.get("subject", "Agent Execution Notification")
        # Replace variables in subject
        subject = self._replace_variables(subject, execution_result, context)
        
        # Build email body
        html_body = self._build_email_body(email_config, execution_result, context)
        text_body = self._build_email_body(email_config, execution_result, context, html=False)
        
        # Send emails
        results = []
        for recipient in recipients:
            try:
                logger.info(f"Attempting to send email to {recipient} with subject: {subject}")
                sent, error_msg = await self.email_service.send_email(
                    to_email=recipient,
                    subject=subject,
                    html_body=html_body,
                    text_body=text_body
                )
                if sent:
                    logger.info(f"Successfully sent email to {recipient}")
                    results.append({
                        "recipient": recipient,
                        "sent": True
                    })
                else:
                    # Email service returned False with error message
                    if not error_msg:
                        error_msg = "Email sending failed. Please check SMTP configuration in /integrations page."
                    logger.warning(f"Email sending failed for {recipient}: {error_msg}")
                    results.append({
                        "recipient": recipient,
                        "sent": False,
                        "error": error_msg
                    })
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to send email to {recipient}: {error_msg}", exc_info=True)
                # Provide more helpful error messages
                if "SMTP" in error_msg or "smtp" in error_msg.lower() or "connection" in error_msg.lower():
                    error_msg = f"SMTP connection error: {error_msg}. Please check SMTP configuration in /integrations page."
                elif "authentication" in error_msg.lower() or "login" in error_msg.lower():
                    error_msg = f"SMTP authentication failed: {error_msg}. Please verify SMTP credentials in /integrations page."
                results.append({
                    "recipient": recipient,
                    "sent": False,
                    "error": error_msg
                })
        
        sent_count = sum(1 for r in results if r.get("sent"))
        total_count = len(results)
        any_sent = sent_count > 0
        
        logger.info(f"Email action completed: {sent_count}/{total_count} emails sent successfully")
        
        # Build comprehensive error message if all emails failed
        if not any_sent and results:
            error_messages = []
            for r in results:
                if r.get("error"):
                    error_messages.append(r.get("error"))
                elif not r.get("sent"):
                    # If no error but not sent, check for reason
                    error_messages.append(r.get("reason", "Email sending failed (no error details available)"))
            
            if error_messages:
                # Use the first error message as the primary reason
                primary_error = error_messages[0]
                logger.warning(f"Email sending failed for all recipients. Primary error: {primary_error}")
            else:
                logger.warning(f"Email sending failed for all recipients, but no error details available")
        
        # Include reason in return value for better error reporting
        reason = None
        if not any_sent and results:
            # Get the first error or reason from results
            for r in results:
                if r.get("error"):
                    reason = r.get("error")
                    break
                elif r.get("reason"):
                    reason = r.get("reason")
                    break
            if not reason:
                reason = "Email sending failed. Please check SMTP configuration in /integrations page."
        
        return {
            "sent": any_sent,
            "results": results,
            "sent_count": sent_count,
            "total_count": total_count,
            "reason": reason  # Include reason for better error reporting
        }
    
    async def execute_push_data_action(
        self,
        push_config: Dict[str, Any],
        execution_result: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute push data action
        
        Args:
            push_config: Push configuration from node
            execution_result: Result from agent execution
            context: Execution context
            
        Returns:
            Push results
        """
        if not push_config.get("enabled"):
            return {"pushed": False, "reason": "Push data not enabled"}
        
        targets = push_config.get("targets", [])
        if not targets:
            return {"pushed": False, "reason": "No push targets configured"}
        
        results = []
        for target in targets:
            try:
                if target["type"] == "webhook" or target["type"] == "api":
                    result = await self._push_to_webhook(target, execution_result, context)
                elif target["type"] == "mcp":
                    result = await self._push_to_mcp(target, execution_result, context)
                elif target["type"] == "database":
                    result = await self._push_to_database(target, execution_result, context)
                else:
                    result = {"pushed": False, "error": f"Unknown target type: {target['type']}"}
                
                results.append({
                    "target": target,
                    **result
                })
            except Exception as e:
                logger.error(f"Failed to push to target {target}: {e}")
                results.append({
                    "target": target,
                    "pushed": False,
                    "error": str(e)
                })
        
        return {
            "pushed": any(r.get("pushed", False) for r in results),
            "results": results
        }
    
    async def execute_collect_data_action(
        self,
        collect_config: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute collect data action
        
        Args:
            collect_config: Collect configuration from node
            context: Execution context
            
        Returns:
            Collected data
        """
        if not collect_config.get("enabled"):
            return {"collected": False, "reason": "Collect data not enabled"}
        
        sources = collect_config.get("sources", [])
        if not sources:
            return {"collected": False, "reason": "No data sources configured"}
        
        collected_data = {}
        results = []
        
        for source in sources:
            try:
                if source["type"] == "api":
                    data = await self._collect_from_api(source, context)
                elif source["type"] == "database":
                    data = await self._collect_from_database(source, context)
                elif source["type"] == "mcp":
                    data = await self._collect_from_mcp(source, context)
                elif source["type"] == "rag":
                    data = await self._collect_from_rag(source, context)
                elif source["type"] == "file":
                    data = await self._collect_from_file(source, context)
                else:
                    data = None
                
                if data:
                    merge_strategy = source.get("merge_strategy", "merge")
                    collected_data = self._merge_data(collected_data, data, merge_strategy)
                
                results.append({
                    "source": source,
                    "collected": data is not None,
                    "data": data
                })
            except Exception as e:
                logger.error(f"Failed to collect from source {source}: {e}")
                results.append({
                    "source": source,
                    "collected": False,
                    "error": str(e)
                })
        
        return {
            "collected": any(r.get("collected", False) for r in results),
            "data": collected_data,
            "results": results
        }
    
    async def _resolve_recipient(
        self,
        recipient: Dict[str, Any],
        execution_result: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Resolve recipient to email address"""
        recipient_type = recipient.get("type")
        recipient_value = recipient.get("value", "")
        
        # Variables should already be replaced, but double-check
        if "${" in recipient_value:
            recipient_value = self._replace_variables(recipient_value, execution_result, context)
        
        if recipient_type == "custom":
            return recipient_value if "@" in recipient_value else None
        
        elif recipient_type == "user":
            from app.models.user import User
            user = self.db.query(User).filter(User.id == UUID(recipient_value)).first()
            return user.email if user else None
        
        elif recipient_type == "vendor":
            from app.models.vendor import Vendor
            vendor = self.db.query(Vendor).filter(Vendor.id == UUID(recipient_value)).first()
            return vendor.contact_email if vendor else None
        
        return None
    
    def _replace_variables(
        self,
        template: str,
        execution_result: Optional[Dict[str, Any]],
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Replace ${variable} syntax in template"""
        result = template
        
        # Replace from context
        if context:
            for key, value in context.items():
                result = result.replace(f"${{context.{key}}}", str(value))
        
        # Replace from execution result
        if execution_result:
            for key, value in execution_result.items():
                result = result.replace(f"${{result.{key}}}", str(value))
        
        return result
    
    def _build_email_body(
        self,
        email_config: Dict[str, Any],
        execution_result: Optional[Dict[str, Any]],
        context: Optional[Dict[str, Any]],
        html: bool = True
    ) -> str:
        """Build email body"""
        # Use custom body_template if provided
        body_template = email_config.get("body_template")
        if body_template:
            # Replace variables in template
            body = self._replace_variables(body_template, execution_result, context)
            return body
        
        # Default template if no body_template provided
        if html:
            body = f"""
            <html>
            <body>
                <h2>Agent Execution Notification</h2>
                <p>This is an automated notification from VAKA Platform.</p>
            """
            if email_config.get("include_result") and execution_result:
                body += f"""
                <h3>Execution Result:</h3>
                <pre>{str(execution_result)}</pre>
                """
            body += """
            </body>
            </html>
            """
            return body
        else:
            body = "Agent Execution Notification\n\n"
            if email_config.get("include_result") and execution_result:
                body += f"Execution Result:\n{str(execution_result)}\n"
            return body
    
    async def _push_to_webhook(
        self,
        target: Dict[str, Any],
        execution_result: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push data to webhook"""
        endpoint = target.get("endpoint")
        if not endpoint:
            return {"pushed": False, "error": "No endpoint specified"}
        
        method = target.get("method", "POST")
        headers = target.get("headers", {})
        data_mapping = target.get("data_mapping", {})
        
        # Map data if mapping specified
        payload = execution_result
        if data_mapping:
            payload = {}
            for target_key, source_key in data_mapping.items():
                payload[target_key] = execution_result.get(source_key)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=endpoint,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                response.raise_for_status()
                return {
                    "pushed": True,
                    "status_code": response.status_code
                }
        except Exception as e:
            logger.error(f"Webhook push failed: {e}")
            return {"pushed": False, "error": str(e)}
    
    async def _push_to_mcp(
        self,
        target: Dict[str, Any],
        execution_result: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push data via MCP"""
        mcp_connection_id = target.get("mcp_connection_id")
        if not mcp_connection_id:
            return {"pushed": False, "error": "No MCP connection ID specified"}
        
        try:
            result = await self.mcp_server.handle_mcp_request(
                UUID(mcp_connection_id),
                "push_data",
                {
                    "data": execution_result,
                    "context": context
                },
                self.tenant_id
            )
            return {
                "pushed": result.get("success", False),
                "result": result
            }
        except Exception as e:
            logger.error(f"MCP push failed: {e}")
            return {"pushed": False, "error": str(e)}
    
    async def _push_to_database(
        self,
        target: Dict[str, Any],
        execution_result: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push data to database (store in custom table or log)"""
        # This would store execution results in a custom table
        # For now, we'll log it
        logger.info(f"Database push: {execution_result}")
        return {"pushed": True, "note": "Data logged (database push not fully implemented)"}
    
    async def _collect_from_api(
        self,
        source: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Collect data from external API"""
        endpoint = source.get("endpoint")
        if not endpoint:
            return None
        
        params = source.get("params", {})
        # Replace variables in params
        if context:
            for key, value in params.items():
                if isinstance(value, str) and "${" in value:
                    params[key] = self._replace_variables(value, None, context)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(endpoint, params=params, timeout=30.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"API collection failed: {e}")
            return None
    
    async def _collect_from_database(
        self,
        source: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Collect data from database"""
        query = source.get("query")
        if not query:
            return None
        
        # This would execute a database query
        # For now, placeholder
        logger.info(f"Database collection: {query}")
        return {"note": "Database collection not fully implemented"}
    
    async def _collect_from_mcp(
        self,
        source: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Collect data via MCP"""
        mcp_connection_id = source.get("mcp_connection_id")
        if not mcp_connection_id:
            return None
        
        request_type = source.get("query", "get_data")
        params = source.get("params", {})
        
        try:
            result = await self.mcp_server.handle_mcp_request(
                UUID(mcp_connection_id),
                request_type,
                {**params, **context} if context else params,
                self.tenant_id
            )
            return result.get("data") if result.get("success") else None
        except Exception as e:
            logger.error(f"MCP collection failed: {e}")
            return None
    
    async def _collect_from_rag(
        self,
        source: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Optional[List[Dict[str, Any]]]:
        """Collect data from RAG"""
        query = source.get("query")
        if not query:
            return None
        
        # Replace variables in query
        if context:
            query = self._replace_variables(query, None, context)
        
        try:
            from app.services.rag_service import RAGService
            
            # Try to create RAG service instance
            try:
                rag_service = RAGService()
            except Exception as e:
                logger.warning(f"RAG service not available: {e}")
                return None
            
            agent_id = context.get("agent_id") if context else None
            results = await rag_service.search(
                query=query,
                agent_id=agent_id,
                limit=source.get("params", {}).get("limit", 5)
            )
            return results
        except Exception as e:
            logger.error(f"RAG collection failed: {e}")
            return None
    
    async def _collect_from_file(
        self,
        source: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Collect data from file"""
        file_path = source.get("query")  # Using query field for file path
        if not file_path:
            return None
        
        # Replace variables in path
        if context:
            file_path = self._replace_variables(file_path, None, context)
        
        try:
            import json
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"File collection failed: {e}")
            return None
    
    def _merge_data(
        self,
        existing: Dict[str, Any],
        new: Dict[str, Any],
        strategy: str
    ) -> Dict[str, Any]:
        """Merge collected data based on strategy"""
        if strategy == "replace":
            return new
        elif strategy == "merge":
            return {**existing, **new}
        elif strategy == "append":
            # Append to arrays if both are lists, otherwise merge
            result = existing.copy()
            for key, value in new.items():
                if key in result and isinstance(result[key], list) and isinstance(value, list):
                    result[key] = result[key] + value
                else:
                    result[key] = value
            return result
        return existing
