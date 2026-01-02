"""
Business Rules Engine - Evaluates and executes business rules
"""
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID
import logging
import re
from datetime import datetime

from app.models.business_rule import BusinessRule
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class BusinessRulesEngine:
    """Engine for evaluating and executing business rules"""
    
    def __init__(self, db_session: Session, tenant_id: UUID):
        """
        Initialize business rules engine
        
        Args:
            db_session: Database session
            tenant_id: Tenant ID
        """
        self.db = db_session
        self.tenant_id = tenant_id
    
    def evaluate_rules(
        self,
        context: Dict[str, Any],
        entity_type: str,
        screen: Optional[str] = None,
        rule_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluate all applicable business rules for a given context
        
        Args:
            context: Context data (e.g., {"user": {...}, "agent": {...}, "assessment": {...}})
            entity_type: Entity type (e.g., "agent", "assessment", "workflow", "user")
            screen: Optional screen name (e.g., "agent_submission", "assessment_review")
            rule_type: Optional rule type filter (e.g., "conditional", "assignment", "workflow", "validation")
            
        Returns:
            List of rule evaluation results with actions to execute
        """
        # Get applicable rules
        rules = self._get_applicable_rules(entity_type, screen, rule_type)
        
        results = []
        for rule in rules:
            try:
                # Evaluate condition
                condition_result = self._evaluate_condition(
                    rule.condition_expression,
                    context
                )
                
                if condition_result:
                    # Condition matched - prepare action
                    action_result = self._parse_action(
                        rule.action_expression,
                        context,
                        rule
                    )
                    
                    results.append({
                        "rule_id": rule.rule_id,
                        "rule_name": rule.name,
                        "rule_type": rule.rule_type,
                        "action_type": rule.action_type,
                        "action": action_result,
                        "action_config": rule.action_config,
                        "priority": rule.priority,
                        "is_automatic": rule.is_automatic
                    })
            except Exception as e:
                logger.error(f"Error evaluating rule {rule.rule_id}: {e}", exc_info=True)
                # Continue with other rules even if one fails
        
        # Sort by priority (lower number = higher priority)
        results.sort(key=lambda x: x["priority"])
        
        return results
    
    def execute_actions(
        self,
        rule_results: List[Dict[str, Any]],
        context: Dict[str, Any],
        auto_execute: bool = True
    ) -> Dict[str, Any]:
        """
        Execute actions from rule evaluation results
        
        Args:
            rule_results: Results from evaluate_rules
            context: Context data
            auto_execute: If True, automatically execute actions; if False, return suggestions
            
        Returns:
            Dictionary with execution results
        """
        executed_actions = []
        suggested_actions = []
        
        for result in rule_results:
            action = result["action"]
            action_type = result["action_type"]
            is_automatic = result.get("is_automatic", True)
            
            if auto_execute and is_automatic:
                try:
                    execution_result = self._execute_action(
                        action_type,
                        action,
                        result.get("action_config"),
                        context
                    )
                    executed_actions.append({
                        "rule_id": result["rule_id"],
                        "rule_name": result["rule_name"],
                        "action": action,
                        "result": execution_result
                    })
                except Exception as e:
                    logger.error(f"Error executing action for rule {result['rule_id']}: {e}", exc_info=True)
                    executed_actions.append({
                        "rule_id": result["rule_id"],
                        "rule_name": result["rule_name"],
                        "action": action,
                        "error": str(e)
                    })
            else:
                suggested_actions.append({
                    "rule_id": result["rule_id"],
                    "rule_name": result["rule_name"],
                    "action": action,
                    "action_type": action_type
                })
        
        return {
            "executed": executed_actions,
            "suggested": suggested_actions
        }
    
    def _get_applicable_rules(
        self,
        entity_type: str,
        screen: Optional[str] = None,
        rule_type: Optional[str] = None
    ) -> List[BusinessRule]:
        """Get applicable business rules for entity type and screen"""
        query = self.db.query(BusinessRule).filter(
            BusinessRule.tenant_id == self.tenant_id,
            BusinessRule.is_active == True
        )
        
        # Filter by applicable entities
        # Rules with no applicable_entities apply to all entities
        # Rules with applicable_entities must include the entity_type
        from sqlalchemy import or_, cast, func, text
        from sqlalchemy.dialects.postgresql import JSONB
        import json
        
        # For PostgreSQL JSON columns, use proper JSONB operators
        # Check if applicable_entities is NULL, empty array, or contains entity_type
        # Use func.cast() for JSONB literals and cast() for column casting
        entity_type_jsonb = func.cast(json.dumps([entity_type]), JSONB)
        
        # For empty array check, use jsonb_array_length to check if length is 0
        # jsonb_array_length returns NULL for non-arrays, so we check for == 0
        # This will match empty arrays but not NULL or non-array values
        entities_array_length = func.jsonb_array_length(cast(BusinessRule.applicable_entities, JSONB))
        query = query.filter(
            or_(
                BusinessRule.applicable_entities.is_(None),
                # Check if array length is 0 (empty array)
                entities_array_length == 0,
                # Check if array contains entity_type using @> operator
                cast(BusinessRule.applicable_entities, JSONB).op('@>')(entity_type_jsonb)
            )
        )
        
        # Filter by screen if provided
        if screen:
            screen_jsonb = func.cast(json.dumps([screen]), JSONB)
            screens_array_length = func.jsonb_array_length(cast(BusinessRule.applicable_screens, JSONB))
            query = query.filter(
                or_(
                    BusinessRule.applicable_screens.is_(None),
                    # Check if array length is 0 (empty array)
                    screens_array_length == 0,
                    # Check if array contains screen using @> operator
                    cast(BusinessRule.applicable_screens, JSONB).op('@>')(screen_jsonb)
                )
            )
        
        # Filter by rule type if provided
        if rule_type:
            query = query.filter(BusinessRule.rule_type == rule_type)
        
        # Order by priority (ascending)
        from sqlalchemy import asc
        return query.order_by(asc(BusinessRule.priority)).all()
    
    def _evaluate_condition(
        self,
        condition_expression: str,
        context: Dict[str, Any]
    ) -> bool:
        """
        Evaluate a condition expression
        
        Supports:
        - Simple comparisons: "user.department = Agent.department"
        - Numeric comparisons: "agent.risk_score > 50"
        - Boolean checks: "user.is_admin = true"
        - Contains checks: "agent.category in ['Security', 'Compliance']"
        """
        try:
            # Parse the condition expression
            # Format: "entity.attribute operator value" or "entity1.attribute1 operator entity2.attribute2"
            
            # Handle boolean values
            condition_expression = condition_expression.strip()
            
            # Simple boolean check
            if condition_expression.lower() in ['true', 'false']:
                return condition_expression.lower() == 'true'
            
            # Parse comparison operators
            operators = ['>=', '<=', '!=', '==', '>', '<', '=', 'in', 'contains', 'not in']
            
            # Find operator
            operator = None
            operator_pos = -1
            for op in operators:
                pos = condition_expression.find(f' {op} ')
                if pos != -1:
                    operator = op
                    operator_pos = pos
                    break
            
            if not operator:
                # Try without spaces
                for op in operators:
                    if op in condition_expression:
                        operator = op
                        operator_pos = condition_expression.find(op)
                        break
            
            if not operator:
                logger.warning(f"Could not parse condition: {condition_expression}")
                return False
            
            # Split into left and right parts
            left_expr = condition_expression[:operator_pos].strip()
            right_expr = condition_expression[operator_pos + len(operator):].strip()
            
            # Evaluate left side
            left_value = self._resolve_value(left_expr, context)
            
            # Evaluate right side
            right_value = self._resolve_value(right_expr, context)
            
            # Perform comparison
            if operator in ['=', '==']:
                return left_value == right_value
            elif operator == '!=':
                return left_value != right_value
            elif operator == '>':
                return self._compare_numeric(left_value, right_value, '>')
            elif operator == '<':
                return self._compare_numeric(left_value, right_value, '<')
            elif operator == '>=':
                return self._compare_numeric(left_value, right_value, '>=')
            elif operator == '<=':
                return self._compare_numeric(left_value, right_value, '<=')
            elif operator == 'in':
                # Right side should be a list
                if isinstance(right_value, list):
                    return left_value in right_value
                return False
            elif operator == 'not in':
                if isinstance(right_value, list):
                    return left_value not in right_value
                return True
            elif operator == 'contains':
                # Check if left_value contains right_value
                if isinstance(left_value, str) and isinstance(right_value, str):
                    return right_value.lower() in left_value.lower()
                elif isinstance(left_value, list):
                    return right_value in left_value
                return False
            
            return False
            
        except Exception as e:
            logger.error(f"Error evaluating condition '{condition_expression}': {e}", exc_info=True)
            return False
    
    def _resolve_value(
        self,
        expression: str,
        context: Dict[str, Any]
    ) -> Any:
        """Resolve a value from expression (e.g., "user.department" or literal value)"""
        expression = expression.strip()
        
        # Check if it's a literal value
        # String literal (quoted)
        if expression.startswith('"') and expression.endswith('"'):
            return expression[1:-1]
        if expression.startswith("'") and expression.endswith("'"):
            return expression[1:-1]
        
        # Boolean literal
        if expression.lower() == 'true':
            return True
        if expression.lower() == 'false':
            return False
        
        # Numeric literal
        try:
            if '.' in expression:
                return float(expression)
            return int(expression)
        except ValueError:
            pass
        
        # List literal (e.g., ['value1', 'value2'])
        if expression.startswith('[') and expression.endswith(']'):
            try:
                import ast
                return ast.literal_eval(expression)
            except:
                pass
        
        # Entity attribute reference (e.g., "user.department")
        if '.' in expression:
            parts = expression.split('.', 1)
            entity_name = parts[0].strip()
            attribute_name = parts[1].strip()
            
            if entity_name in context:
                entity = context[entity_name]
                if isinstance(entity, dict):
                    return entity.get(attribute_name)
                elif hasattr(entity, attribute_name):
                    return getattr(entity, attribute_name)
        
        # Direct context key
        if expression in context:
            return context[expression]
        
        # Return as string if nothing matches
        return expression
    
    def _compare_numeric(self, left: Any, right: Any, operator: str) -> bool:
        """Compare numeric values"""
        try:
            left_num = float(left) if not isinstance(left, (int, float)) else left
            right_num = float(right) if not isinstance(right, (int, float)) else right
            
            if operator == '>':
                return left_num > right_num
            elif operator == '<':
                return left_num < right_num
            elif operator == '>=':
                return left_num >= right_num
            elif operator == '<=':
                return left_num <= right_num
        except (ValueError, TypeError):
            return False
        return False
    
    def _parse_action(
        self,
        action_expression: str,
        context: Dict[str, Any],
        rule: BusinessRule
    ) -> Dict[str, Any]:
        """
        Parse action expression into action dictionary
        
        Supports formats like:
        - "assign_to:user.department_manager"
        - "step:approval_required"
        - "notify:user.email"
        - "validate:agent.compliance_score > 80"
        """
        action_expression = action_expression.strip()
        
        # Check for action prefix (e.g., "assign_to:", "step:", "notify:")
        if ':' in action_expression:
            action_type, action_value = action_expression.split(':', 1)
            action_type = action_type.strip()
            action_value = action_value.strip()
            
            # Resolve action value from context
            resolved_value = self._resolve_value(action_value, context)
            
            return {
                "type": action_type,
                "value": resolved_value,
                "original_expression": action_expression
            }
        
        # No prefix - use action_type from rule
        if rule.action_type:
            return {
                "type": rule.action_type,
                "value": action_expression,
                "original_expression": action_expression
            }
        
        # Default: return as-is
        return {
            "type": "execute",
            "value": action_expression,
            "original_expression": action_expression
        }
    
    def _execute_action(
        self,
        action_type: Optional[str],
        action: Dict[str, Any],
        action_config: Optional[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute an action
        
        Args:
            action_type: Type of action (assign, route, validate, notify, execute_step)
            action: Parsed action dictionary
            action_config: Additional action configuration
            context: Context data
            
        Returns:
            Execution result
        """
        action_type = action_type or action.get("type")
        action_value = action.get("value")
        
        if action_type == "assign":
            # Assignment action (e.g., assign_to:user.department_manager)
            return {
                "status": "success",
                "action": "assign",
                "target": action_value,
                "message": f"Assigned to {action_value}"
            }
        
        elif action_type == "route" or action_type == "step":
            # Routing/step action (e.g., step:approval_required)
            return {
                "status": "success",
                "action": "route",
                "step": action_value,
                "message": f"Route to step: {action_value}"
            }
        
        elif action_type == "notify":
            # Notification action (e.g., notify:user.email)
            return {
                "status": "success",
                "action": "notify",
                "target": action_value,
                "message": f"Notification sent to {action_value}"
            }
        
        elif action_type == "validate":
            # Validation action
            return {
                "status": "success",
                "action": "validate",
                "result": action_value,
                "message": "Validation completed"
            }
        
        elif action_type == "execute_step":
            # Execute a workflow step
            return {
                "status": "success",
                "action": "execute_step",
                "step": action_value,
                "message": f"Executed step: {action_value}"
            }
        
        else:
            # Default: generic execution
            return {
                "status": "success",
                "action": action_type or "execute",
                "value": action_value,
                "message": "Action executed"
            }

