"""
Flow Execution Service - Executes agentic AI flows
"""
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
import logging
import time
import asyncio
from datetime import datetime, timedelta

from app.models.agentic_flow import (
    AgenticFlow, FlowExecution, FlowNodeExecution,
    FlowStatus, FlowExecutionStatus, FlowNodeType
)
from app.services.agentic.agent_registry import AgentRegistry
from app.services.studio_service import StudioService
from app.services.agent_selection_expander import AgentSelectionExpander
from app.services.business_rules_engine import BusinessRulesEngine
from app.core.audit import audit_service, AuditAction

logger = logging.getLogger(__name__)


class FlowExecutionService:
    """Service for executing agentic AI flows"""
    
    def __init__(self, db_session):
        """
        Initialize flow execution service
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.registry = AgentRegistry(db_session)
        self.studio_service = StudioService(db_session)
    
    async def execute_flow(
        self,
        flow_id: UUID,
        tenant_id: UUID,
        context_id: Optional[str] = None,
        context_type: Optional[str] = None,
        trigger_data: Optional[Dict[str, Any]] = None,
        triggered_by: Optional[UUID] = None,
        execution_id: Optional[UUID] = None
    ) -> FlowExecution:
        """
        Execute an agentic AI flow
        
        Args:
            flow_id: Flow ID
            tenant_id: Tenant ID
            context_id: Context ID (e.g., agent_id, assessment_id)
            context_type: Context type
            trigger_data: Data that triggered execution
            triggered_by: User who triggered execution
            execution_id: Optional execution ID (if execution already created)
            
        Returns:
            Flow execution instance
        """
        # Get flow (allow draft and active flows to execute)
        flow = self.db.query(AgenticFlow).filter(
            AgenticFlow.id == flow_id,
            AgenticFlow.tenant_id == tenant_id,
            AgenticFlow.status.in_([FlowStatus.ACTIVE.value, FlowStatus.DRAFT.value])
        ).first()
        
        if not flow:
            raise ValueError(f"Flow {flow_id} not found or not executable (must be draft or active)")
        
        # Use flow's configured context if not provided in execution request
        final_context_id = context_id or flow.context_id_template
        final_context_type = context_type or flow.context_type_default
        
        # Get or create execution instance
        if execution_id:
            execution = self.db.query(FlowExecution).filter(
                FlowExecution.id == execution_id
            ).first()
            if not execution:
                raise ValueError(f"Execution {execution_id} not found")
        else:
            # Create execution instance
            execution = FlowExecution(
                id=uuid4(),
                flow_id=flow_id,
                tenant_id=tenant_id,
                context_id=final_context_id,
                context_type=final_context_type,
                status=FlowExecutionStatus.PENDING.value,
                trigger_data=trigger_data,
                triggered_by=triggered_by,
                execution_data={},
                started_at=datetime.utcnow()
            )
            
            self.db.add(execution)
            self.db.commit()
            self.db.refresh(execution)
        
        # Update status to running
        execution.status = FlowExecutionStatus.RUNNING.value
        self.db.commit()
        
        # Log audit: Flow execution started
        try:
            audit_service.log_action(
                db=self.db,
                user_id=str(triggered_by) if triggered_by else None,
                action=AuditAction.EXECUTE,
                resource_type="flow_execution",
                resource_id=str(execution.id),
                tenant_id=str(tenant_id),
                details={
                    "flow_id": str(flow.id),
                    "flow_name": flow.name,
                    "status": execution.status,
                    "context_id": execution.context_id,
                    "context_type": execution.context_type,
                    "trigger_data": execution.trigger_data
                }
            )
        except Exception as audit_error:
            logger.warning(f"Failed to log flow execution start audit: {audit_error}", exc_info=True)
        
        # Evaluate business rules before execution
        try:
            rules_engine = BusinessRulesEngine(self.db, tenant_id)
            context = {
                "flow": {
                    "id": str(flow.id),
                    "name": flow.name,
                    "category": flow.category,
                    "status": flow.status
                },
                "execution": {
                    "id": str(execution.id),
                    "context_id": execution.context_id,
                    "context_type": execution.context_type
                },
                "trigger_data": trigger_data or {}
            }
            
            # Evaluate workflow rules
            rule_results = rules_engine.evaluate_rules(
                context=context,
                entity_type="workflow",
                screen="flow_execution",
                rule_type="workflow"
            )
            
            # Execute automatic actions
            if rule_results:
                action_results = rules_engine.execute_actions(
                    rule_results,
                    context,
                    auto_execute=True
                )
                # Store rule execution results in execution_data
                if execution.execution_data is None:
                    execution.execution_data = {}
                execution.execution_data["business_rules"] = action_results
                self.db.commit()
        except Exception as e:
            logger.warning(f"Error evaluating business rules for flow execution: {e}", exc_info=True)
            # Continue with execution even if rules evaluation fails
        
        # Execute flow with timeout and retry logic
        try:
            # Set up timeout if configured
            timeout_seconds = flow.timeout_seconds
            if timeout_seconds:
                await asyncio.wait_for(
                    self._execute_flow_nodes(execution, flow),
                    timeout=timeout_seconds
                )
            else:
                await self._execute_flow_nodes(execution, flow)
            
            execution.status = FlowExecutionStatus.COMPLETED.value
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                execution.duration_seconds = int((execution.completed_at - execution.started_at).total_seconds())
            
            # Log audit: Flow execution completed
            try:
                audit_service.log_action(
                    db=self.db,
                    user_id=str(execution.triggered_by) if execution.triggered_by else None,
                    action=AuditAction.UPDATE,
                    resource_type="flow_execution",
                    resource_id=str(execution.id),
                    tenant_id=str(tenant_id),
                    details={
                        "flow_id": str(flow.id),
                        "flow_name": flow.name,
                        "status": execution.status,
                        "duration_seconds": execution.duration_seconds,
                        "nodes_executed": len(execution_data)
                    }
                )
            except Exception as audit_error:
                logger.warning(f"Failed to log flow execution completion audit: {audit_error}", exc_info=True)
        except asyncio.TimeoutError:
            logger.error(f"Flow execution timed out after {timeout_seconds} seconds")
            execution.status = FlowExecutionStatus.FAILED.value
            execution.error_message = f"Flow execution timed out after {timeout_seconds} seconds"
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                execution.duration_seconds = int((execution.completed_at - execution.started_at).total_seconds())
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Provide more detailed error messages
            if isinstance(e, ValueError):
                error_message = f"Validation error: {error_message}"
            elif isinstance(e, KeyError):
                error_message = f"Missing required field: {error_message}"
            elif isinstance(e, AttributeError):
                error_message = f"Configuration error: {error_message}"
            else:
                error_message = f"Execution error: {error_message}"
            
            logger.error(
                f"Flow execution failed: {error_type}: {error_message}",
                exc_info=True,
                extra={
                    "flow_id": str(flow.id),
                    "execution_id": str(execution.id),
                    "error_type": error_type
                }
            )
            
            execution.status = FlowExecutionStatus.FAILED.value
            execution.error_message = error_message
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                execution.duration_seconds = int((execution.completed_at - execution.started_at).total_seconds())
            
            # Log audit: Flow execution failed
            try:
                audit_service.log_action(
                    db=self.db,
                    user_id=str(execution.triggered_by) if execution.triggered_by else None,
                    action=AuditAction.UPDATE,
                    resource_type="flow_execution",
                    resource_id=str(execution.id),
                    tenant_id=str(tenant_id),
                    details={
                        "flow_id": str(flow.id),
                        "flow_name": flow.name,
                        "status": execution.status,
                        "error_type": error_type,
                        "error_message": error_message,
                        "duration_seconds": execution.duration_seconds
                    }
                )
            except Exception as audit_error:
                logger.warning(f"Failed to log flow execution failure audit: {audit_error}", exc_info=True)
        finally:
            try:
                self.db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to commit execution status: {commit_error}", exc_info=True)
                self.db.rollback()
        
        return execution
    
    async def _execute_flow_nodes(
        self,
        execution: FlowExecution,
        flow: AgenticFlow
    ):
        """Execute flow nodes"""
        # Status already set to RUNNING in execute_flow
        # Just ensure started_at is set
        if not execution.started_at:
            execution.started_at = datetime.utcnow()
            self.db.commit()
        
        flow_def = flow.flow_definition
        nodes = flow_def.get("nodes", [])
        edges = flow_def.get("edges", [])
        
        # Build node map
        node_map = {node["id"]: node for node in nodes}
        
        # Find start nodes (nodes with no incoming edges)
        start_nodes = [
            node_id for node_id in node_map.keys()
            if not any(edge["to"] == node_id for edge in edges)
        ]
        
        if not start_nodes:
            raise ValueError("No start nodes found in flow")
        
        # Execute nodes (simple sequential execution for now)
        # In production, implement proper graph traversal with parallel execution
        execution_data = {}
        
        # Track visited nodes to prevent infinite loops
        visited_nodes = set()
        current_nodes = start_nodes
        
        while current_nodes:
            next_nodes = []
            
            for node_id in current_nodes:
                # Update current node being executed
                execution.current_node_id = node_id
                self.db.commit()
                
                node = node_map[node_id]
                node_execution = await self._execute_node(
                    execution, node, execution_data, flow
                )
                
                # Update execution data with node output
                if node_execution.output_data:
                    execution_data[node_id] = node_execution.output_data
                
                # Find next nodes
                for edge in edges:
                    if edge["from"] == node_id:
                        # Check condition if present
                        if edge.get("condition"):
                            if self._evaluate_condition(
                                edge["condition"], execution_data
                            ):
                                next_nodes.append(edge["to"])
                        else:
                            next_nodes.append(edge["to"])
            
            current_nodes = list(set(next_nodes))  # Remove duplicates
        
        # Flow completed (status will be set in execute_flow, but set execution_data here)
        execution.execution_data = execution_data
        execution.current_node_id = None  # Clear current node
        self.db.commit()
    
    async def _execute_node(
        self,
        execution: FlowExecution,
        node: Dict[str, Any],
        execution_data: Dict[str, Any],
        flow: Optional[AgenticFlow] = None
    ) -> FlowNodeExecution:
        """Execute a single flow node with retry logic"""
        # Get retry settings from flow or node
        retry_on_failure = False
        retry_count = 0
        if flow:
            retry_on_failure = flow.retry_on_failure
            retry_count = flow.retry_count
        
        # Check node-level retry override
        node_retry = node.get("retry", {})
        if node_retry:
            retry_on_failure = node_retry.get("enabled", retry_on_failure)
            retry_count = node_retry.get("count", retry_count)
        
        last_exception = None
        node_execution = None
        
        # Retry loop
        for attempt in range(retry_count + 1):
            try:
                # Create node execution record (or reuse on retry)
                if node_execution is None:
                    node_execution = FlowNodeExecution(
                        id=uuid4(),
                        execution_id=execution.id,
                        node_id=node["id"],
                        status=FlowExecutionStatus.PENDING.value,
                        input_data=self._resolve_node_input(node, execution_data, execution),
                        retry_attempt=attempt
                    )
                    self.db.add(node_execution)
                    self.db.commit()
                    self.db.refresh(node_execution)
                else:
                    # On retry, update status and add retry info
                    node_execution.status = FlowExecutionStatus.PENDING.value
                    node_execution.retry_attempt = attempt
                    if not node_execution.error_message:
                        node_execution.error_message = ""
                    node_execution.error_message += f"\n[Retry {attempt}/{retry_count}]"
                    self.db.commit()
                
                # Execute node
                node_execution.status = FlowExecutionStatus.RUNNING.value
                if attempt == 0:
                    node_execution.started_at = datetime.utcnow()
                self.db.commit()
                
                # Log audit: Node execution started
                try:
                    audit_service.log_action(
                        db=self.db,
                        user_id=str(execution.triggered_by) if execution.triggered_by else None,
                        action=AuditAction.EXECUTE,
                        resource_type="flow_node_execution",
                        resource_id=str(node_execution.id),
                        tenant_id=str(execution.tenant_id),
                        details={
                            "execution_id": str(execution.id),
                            "flow_id": str(execution.flow_id),
                            "node_id": node.get("id"),
                            "node_type": node.get("type"),
                            "agent_id": node.get("agent_id"),
                            "skill": node.get("skill"),
                            "retry_attempt": attempt
                        }
                    )
                except Exception as audit_error:
                    logger.warning(f"Failed to log node execution start audit: {audit_error}", exc_info=True)
                
                start_time = time.time()
                
                if node["type"] == FlowNodeType.AGENT.value:
                    result = await self._execute_agent_node(
                        execution, node, node_execution
                    )
                elif node["type"] == FlowNodeType.CONDITION.value:
                    result = await self._execute_condition_node(
                        execution, node, node_execution
                    )
                elif node["type"] == FlowNodeType.DELAY.value:
                    result = await self._execute_delay_node(
                        execution, node, node_execution
                    )
                else:
                    raise ValueError(f"Unknown node type: {node['type']}")
                
                node_execution.status = FlowExecutionStatus.COMPLETED.value
                node_execution.output_data = result
                node_execution.error_message = None  # Clear error on success
                
                # Log audit: Node execution completed
                try:
                    audit_service.log_action(
                        db=self.db,
                        user_id=str(execution.triggered_by) if execution.triggered_by else None,
                        action=AuditAction.UPDATE,
                        resource_type="flow_node_execution",
                        resource_id=str(node_execution.id),
                        tenant_id=str(execution.tenant_id),
                        details={
                            "execution_id": str(execution.id),
                            "flow_id": str(execution.flow_id),
                            "node_id": node.get("id"),
                            "status": node_execution.status,
                            "duration_ms": node_execution.duration_ms,
                            "retry_attempt": attempt
                        }
                    )
                except Exception as audit_error:
                    logger.warning(f"Failed to log node execution completion audit: {audit_error}", exc_info=True)
                
                # Success - break retry loop
                break
                
            except Exception as e:
                last_exception = e
                error_type = type(e).__name__
                error_message = str(e)
                
                # Provide more detailed error messages based on error type
                if isinstance(e, ValueError):
                    error_message = f"Validation error: {error_message}"
                elif isinstance(e, KeyError):
                    error_message = f"Missing required field: {error_message}"
                elif isinstance(e, AttributeError):
                    error_message = f"Configuration error: {error_message}"
                elif isinstance(e, TimeoutError):
                    error_message = f"Timeout error: {error_message}"
                else:
                    error_message = f"Execution error: {error_message}"
                
                logger.error(
                    f"Node execution failed (attempt {attempt + 1}/{retry_count + 1}): {error_type}: {error_message}",
                    exc_info=True,
                    extra={
                        "node_id": node.get("id"),
                        "execution_id": str(execution.id),
                        "error_type": error_type,
                        "attempt": attempt + 1
                    }
                )
                
                if node_execution:
                    node_execution.status = FlowExecutionStatus.FAILED.value
                    error_msg = error_message
                    if retry_on_failure and attempt < retry_count:
                        error_msg += f" (Will retry {retry_count - attempt} more times)"
                    node_execution.error_message = error_msg
                    try:
                        self.db.commit()
                    except Exception as commit_error:
                        logger.error(f"Failed to commit node execution status: {commit_error}", exc_info=True)
                        self.db.rollback()
                    
                    # Log audit: Node execution failed
                    try:
                        audit_service.log_action(
                            db=self.db,
                            user_id=str(execution.triggered_by) if execution.triggered_by else None,
                            action=AuditAction.UPDATE,
                            resource_type="flow_node_execution",
                            resource_id=str(node_execution.id),
                            tenant_id=str(execution.tenant_id),
                            details={
                                "execution_id": str(execution.id),
                                "flow_id": str(execution.flow_id),
                                "node_id": node.get("id"),
                                "status": node_execution.status,
                                "error_type": error_type,
                                "error_message": error_msg,
                                "retry_attempt": attempt,
                                "will_retry": retry_on_failure and attempt < retry_count
                            }
                        )
                    except Exception as audit_error:
                        logger.warning(f"Failed to log node execution failure audit: {audit_error}", exc_info=True)
                
                # If retry is enabled and we have attempts left, wait before retrying
                if retry_on_failure and attempt < retry_count:
                    # Exponential backoff: 1s, 2s, 4s, 8s, etc.
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying node {node['id']} after {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    # No more retries or retry disabled - wrap exception with more context
                    raise RuntimeError(
                        f"Node {node.get('id', 'unknown')} execution failed after {attempt + 1} attempt(s): {error_message}"
                    ) from e
        
        # Finalize node execution
        if node_execution:
            node_execution.completed_at = datetime.utcnow()
            if node_execution.started_at:
                duration = (node_execution.completed_at - node_execution.started_at).total_seconds()
                node_execution.duration_ms = int(duration * 1000)
            self.db.commit()
        
        return node_execution
    
    async def _execute_agent_node(
        self,
        execution: FlowExecution,
        node: Dict[str, Any],
        node_execution: FlowNodeExecution
    ) -> Dict[str, Any]:
        """Execute an agent node with agentic configuration"""
        from app.services.agentic.agentic_action_service import AgenticActionService
        
        agent_id = node.get("agent_id")
        source = node.get("source", "vaka")
        skill = node.get("skill")
        input_data = node_execution.input_data or {}
        agentic_config = node.get("agenticConfig") or node.get("agentic_config") or {}
        
        if not agent_id or not skill:
            raise ValueError("Agent node must have agent_id and skill")
        
        # Collect data before execution (if configured)
        collected_data = {}
        if agentic_config.get("collect_data", {}).get("enabled"):
            action_service = AgenticActionService(self.db, execution.tenant_id)
            collect_result = await action_service.execute_collect_data_action(
                agentic_config["collect_data"],
                context={
                    "execution_id": str(execution.id),
                    "flow_id": str(execution.flow_id),
                    **input_data
                }
            )
            if collect_result.get("collected"):
                collected_data = collect_result.get("data", {})
                # Merge collected data into input_data
                input_data = {**input_data, **collected_data}
        
        # Send email before execution (if configured)
        if agentic_config.get("email", {}).get("enabled") and agentic_config["email"].get("send_on") in ["before", "both"]:
            action_service = AgenticActionService(self.db, execution.tenant_id)
            await action_service.execute_email_action(
                agentic_config["email"],
                execution_result=None,  # Before execution, no result yet
                context={
                    "execution_id": str(execution.id),
                    "flow_id": str(execution.flow_id),
                    "node_id": node.get("id"),
                    **input_data
                }
            )
        
        # Expand agent selection if present in input_data
        # Check for agent_selection in various possible field names (including _original for re-expansion)
        agent_selection_field = None
        agent_selection_value = None
        for field_name in ['agent_selection', 'agentSelection', 'agent_selection_config', 'agent_selection_original']:
            if field_name in input_data:
                agent_selection_field = field_name
                agent_selection_value = input_data[field_name]
                break
        
        if agent_selection_field and agent_selection_value:
            try:
                expander = AgentSelectionExpander(self.db, execution.tenant_id)
                
                # If it's _original, we need to expand it directly (not using expand_for_skill_input)
                if agent_selection_field == 'agent_selection_original':
                    expanded_agent_ids = expander.expand_selection(agent_selection_value)
                    if expanded_agent_ids:
                        if len(expanded_agent_ids) == 1:
                            input_data['agent_id'] = expanded_agent_ids[0]
                        else:
                            input_data['agent_ids'] = expanded_agent_ids
                            input_data['agent_id'] = expanded_agent_ids[0]  # Use first for single-agent skills
                        logger.info(f"Re-expanded agent_selection_original. Result: agent_id={input_data.get('agent_id')}, agent_ids={input_data.get('agent_ids')}")
                    else:
                        # Expansion failed - provide helpful error
                        if isinstance(agent_selection_value, dict):
                            mode = agent_selection_value.get("mode", "unknown")
                            if mode == "category":
                                categories = agent_selection_value.get("categories", [])
                                if not categories:
                                    raise ValueError(
                                        f"agent_selection with category mode requires at least one category. "
                                        f"Please select categories in the flow node configuration. "
                                        f"Received: {agent_selection_value}"
                                    )
                                else:
                                    raise ValueError(
                                        f"No agents found matching the selected categories: {categories}. "
                                        f"Please ensure there are approved agents in these categories for your tenant."
                                    )
                            elif mode == "vendor":
                                vendors = agent_selection_value.get("vendors", [])
                                if not vendors:
                                    raise ValueError(
                                        f"agent_selection with vendor mode requires at least one vendor_id. "
                                        f"Received: {agent_selection_value}"
                                    )
                                else:
                                    raise ValueError(
                                        f"No approved agents found for vendors: {vendors}. "
                                        f"Please ensure there are approved agents for these vendors."
                                    )
                            elif mode == "agent":
                                agent_ids = agent_selection_value.get("agent_ids", [])
                                if not agent_ids:
                                    raise ValueError(
                                        f"agent_selection with agent mode requires at least one agent_id. "
                                        f"Received: {agent_selection_value}"
                                    )
                                else:
                                    raise ValueError(
                                        f"None of the specified agents were found or approved: {agent_ids}. "
                                        f"Please ensure the agent IDs are correct and the agents are approved."
                                    )
                            else:
                                raise ValueError(
                                    f"agent_selection expansion failed. No agents matched the selection criteria. "
                                    f"Mode: {mode}, Selection: {agent_selection_value}"
                                )
                        else:
                            raise ValueError(
                                f"agent_selection expansion failed. Invalid selection format or no agents found. "
                                f"Selection: {agent_selection_value}"
                            )
                else:
                    # Use the standard expand_for_skill_input method
                    input_data = expander.expand_for_skill_input(input_data, agent_selection_field)
                    logger.info(f"Expanded agent selection from field '{agent_selection_field}'. Result: agent_id={input_data.get('agent_id')}, agent_ids={input_data.get('agent_ids')}")
            except ValueError as e:
                # Re-raise ValueError with context (these are user-facing validation errors)
                raise
            except Exception as e:
                logger.warning(f"Failed to expand agent selection: {e}. Continuing with original input_data.", exc_info=True)
                # Continue with original input_data if expansion fails for non-validation errors
        
        # If agent_id is still missing, try to get it from trigger_data or context_id
        if not input_data.get('agent_id') and not input_data.get('agent_ids'):
            # Check trigger_data first
            trigger_data = execution.trigger_data or {}
            if trigger_data.get('agent_id'):
                input_data['agent_id'] = trigger_data['agent_id']
                logger.info(f"Using agent_id from trigger_data: {trigger_data['agent_id']}")
            elif execution.context_id:
                # Check if context_id is a valid UUID (likely an agent_id)
                try:
                    UUID(execution.context_id)
                    input_data['agent_id'] = execution.context_id
                    logger.info(f"Using context_id as agent_id: {execution.context_id}")
                except (ValueError, TypeError):
                    pass
        
        # Log final input_data for debugging
        logger.debug(f"Final input_data for agent execution: {input_data}")
        
        # Validate that agent_id is present for skills that require it
        # Some skills (like risk_analysis) require agent_id to be set
        if skill in ['realtime_risk_analysis', 'risk_analysis'] and not input_data.get('agent_id') and not input_data.get('agent_ids'):
            error_msg = (
                f"agent_id is required for {skill} skill. "
                f"Please configure agent selection in the flow node input. "
                f"Available input_data keys: {list(input_data.keys())}, "
                f"trigger_data keys: {list(execution.trigger_data.keys()) if execution.trigger_data else []}, "
                f"context_id: {execution.context_id}"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Execute agent via studio service
        try:
            result = await self.studio_service.execute_agent_in_studio(
                tenant_id=execution.tenant_id,
                agent_id=str(agent_id),
                source=source,
                skill=skill,
                input_data=input_data,
                mcp_connection_id=UUID(node.get("mcp_connection_id")) if node.get("mcp_connection_id") else None
            )
        except ValueError as e:
            # Re-raise validation errors with more context
            raise ValueError(
                f"Agent execution validation failed for node {node.get('id', 'unknown')}: {str(e)}"
            ) from e
        except Exception as e:
            # Wrap other errors with context
            error_type = type(e).__name__
            raise RuntimeError(
                f"Agent execution failed for node {node.get('id', 'unknown')} "
                f"(agent_id={agent_id}, skill={skill}, source={source}): {error_type}: {str(e)}"
            ) from e
        
        # Include collected data in result
        if collected_data:
            result["_collected_data"] = collected_data
        
        # Push data after execution (if configured)
        if agentic_config.get("push_data", {}).get("enabled"):
            action_service = AgenticActionService(self.db, execution.tenant_id)
            push_result = await action_service.execute_push_data_action(
                agentic_config["push_data"],
                result,
                context={
                    "execution_id": str(execution.id),
                    "flow_id": str(execution.flow_id),
                    "node_id": node.get("id")
                }
            )
            result["_push_data"] = push_result
        
        # Send email after execution (if configured)
        if agentic_config.get("email", {}).get("enabled") and agentic_config["email"].get("send_on") in ["after", "both"]:
            action_service = AgenticActionService(self.db, execution.tenant_id)
            email_result = await action_service.execute_email_action(
                agentic_config["email"],
                execution_result=result,
                context={
                    "execution_id": str(execution.id),
                    "flow_id": str(execution.flow_id),
                    "node_id": node.get("id")
                }
            )
            result["_email_sent"] = email_result
        
        # Send email on error (if configured)
        if agentic_config.get("email", {}).get("enabled") and agentic_config["email"].get("send_on") == "error" and result.get("error"):
            action_service = AgenticActionService(self.db, execution.tenant_id)
            await action_service.execute_email_action(
                agentic_config["email"],
                execution_result=result,
                context={
                    "execution_id": str(execution.id),
                    "flow_id": str(execution.flow_id),
                    "node_id": node.get("id")
                }
            )
        
        try:
            node_execution.agent_id = UUID(agent_id) if source == "vaka" else None
        except (ValueError, TypeError):
            node_execution.agent_id = None
        node_execution.skill_used = skill
        
        return result
    
    async def _execute_condition_node(
        self,
        execution: FlowExecution,
        node: Dict[str, Any],
        node_execution: FlowNodeExecution
    ) -> Dict[str, Any]:
        """Execute a condition node"""
        condition = node.get("condition", {})
        execution_data = {}
        
        # Get execution data from previous nodes
        prev_executions = self.db.query(FlowNodeExecution).filter(
            FlowNodeExecution.execution_id == execution.id,
            FlowNodeExecution.status == FlowExecutionStatus.COMPLETED.value
        ).all()
        
        for prev_exec in prev_executions:
            if prev_exec.output_data:
                execution_data[prev_exec.node_id] = prev_exec.output_data
        
        result = self._evaluate_condition(condition, execution_data)
        
        return {"condition_result": result}
    
    async def _execute_delay_node(
        self,
        execution: FlowExecution,
        node: Dict[str, Any],
        node_execution: FlowNodeExecution
    ) -> Dict[str, Any]:
        """Execute a delay node"""
        delay_seconds = node.get("delay_seconds", 0)
        
        if delay_seconds > 0:
            import asyncio
            await asyncio.sleep(delay_seconds)
        
        return {"delayed": delay_seconds}
    
    def _resolve_node_input(
        self,
        node: Dict[str, Any],
        execution_data: Dict[str, Any],
        execution: FlowExecution
    ) -> Dict[str, Any]:
        """Resolve node input from execution data and trigger_data"""
        input_template = node.get("input", {})
        
        # Get trigger_data from execution
        trigger_data = execution.trigger_data or {}
        
        # Simple template resolution (can be enhanced)
        resolved = {}
        for key, value in input_template.items():
            if isinstance(value, str) and value.startswith("${"):
                # Reference to trigger_data or previous node output
                ref = value[2:-1]  # Remove ${}
                
                # Handle trigger_data references (e.g., ${trigger_data.agent_id})
                if ref.startswith("trigger_data."):
                    field_name = ref.replace("trigger_data.", "", 1)
                    resolved_value = trigger_data.get(field_name)
                    if resolved_value is None:
                        logger.warning(
                            f"Template variable ${{{ref}}} resolved to None. "
                            f"trigger_data keys: {list(trigger_data.keys())}"
                        )
                    resolved[key] = resolved_value
                # Handle previous node output references (e.g., ${node1.field})
                elif "." in ref:
                    node_id, field = ref.split(".", 1)
                    if node_id in execution_data:
                        resolved[key] = execution_data[node_id].get(field)
                    else:
                        logger.warning(
                            f"Template variable ${{{ref}}} references unknown node '{node_id}'. "
                            f"Available nodes: {list(execution_data.keys())}"
                        )
                        resolved[key] = None
                else:
                    # Try execution_data first, then trigger_data
                    if ref in execution_data:
                        resolved[key] = execution_data[ref]
                    elif ref in trigger_data:
                        resolved[key] = trigger_data[ref]
                    else:
                        logger.warning(
                            f"Template variable ${{{ref}}} not found in execution_data or trigger_data"
                        )
                        resolved[key] = None
            else:
                resolved[key] = value
        
        return resolved
    
    def _evaluate_condition(
        self,
        condition: Dict[str, Any],
        execution_data: Dict[str, Any]
    ) -> bool:
        """Evaluate a condition"""
        # Simple condition evaluation
        # Can be enhanced with more complex logic
        condition_type = condition.get("type", "equals")
        field = condition.get("field")
        value = condition.get("value")
        
        # Resolve field value from execution data
        field_value = None
        if "." in field:
            node_id, field_name = field.split(".", 1)
            if node_id in execution_data:
                field_value = execution_data[node_id].get(field_name)
        else:
            field_value = execution_data.get(field)
        
        if condition_type == "equals":
            return field_value == value
        elif condition_type == "not_equals":
            return field_value != value
        elif condition_type == "greater_than":
            return field_value > value
        elif condition_type == "less_than":
            return field_value < value
        else:
            return False
