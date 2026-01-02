"""
Agent Selection Expander - Expands agent selection rules into actual agent IDs
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.vendor import Vendor
import logging

logger = logging.getLogger(__name__)


class AgentSelectionExpander:
    """Expands agent selection rules into actual agent IDs"""
    
    def __init__(self, db: Session, tenant_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
    
    def expand_selection(self, selection: Any) -> List[str]:
        """
        Expand agent selection into list of agent IDs
        
        Args:
            selection: Can be:
                - String (single agent ID)
                - List of strings (multiple agent IDs)
                - Dict with selection rules
        
        Returns:
            List of agent IDs (UUIDs as strings)
        """
        if not selection:
            return []
        
        # Single agent ID (string)
        if isinstance(selection, str):
            if selection.startswith('${trigger_data.'):
                return [selection]
            return [selection]
        
        # List of agent IDs
        if isinstance(selection, list):
            return [str(agent_id) for agent_id in selection]
        
        # Selection rule object
        if isinstance(selection, dict):
            mode = selection.get('mode', 'agent')
            
            if mode == 'all':
                return self._expand_all_agents(selection)
            elif mode == 'category':
                return self._expand_by_categories(selection)
            elif mode == 'vendor':
                return self._expand_by_vendors(selection)
            elif mode == 'agent':
                return self._expand_by_agents(selection)
        
        return []
    
    def _expand_all_agents(self, selection: Dict[str, Any]) -> List[str]:
        """Expand 'all agents' selection"""
        query = self.db.query(Agent).filter(Agent.status == 'approved')
        
        if self.tenant_id:
            vendors = self.db.query(Vendor).filter(Vendor.tenant_id == self.tenant_id).all()
            vendor_ids = [v.id for v in vendors]
            if vendor_ids:
                query = query.filter(Agent.vendor_id.in_(vendor_ids))
            else:
                return []
        
        agents = query.all()
        return [str(agent.id) for agent in agents]
    
    def _expand_by_categories(self, selection: Dict[str, Any]) -> List[str]:
        """Expand selection by categories"""
        categories = selection.get('categories', [])
        if not categories:
            return []
        
        query = self.db.query(Agent).filter(
            Agent.category.in_(categories),
            Agent.status == 'approved'
        )
        
        if self.tenant_id:
            vendors = self.db.query(Vendor).filter(Vendor.tenant_id == self.tenant_id).all()
            vendor_ids = [v.id for v in vendors]
            if vendor_ids:
                query = query.filter(Agent.vendor_id.in_(vendor_ids))
            else:
                return []
        
        agents = query.all()
        agent_ids = [str(agent.id) for agent in agents]
        
        condition = selection.get('condition', 'all')
        if condition == 'select_one' and agent_ids:
            return [agent_ids[0]]
        return agent_ids
    
    def _expand_by_vendors(self, selection: Dict[str, Any]) -> List[str]:
        """Expand selection by vendors"""
        vendor_ids = selection.get('vendors', [])
        if not vendor_ids:
            return []
        
        query = self.db.query(Agent).filter(
            Agent.vendor_id.in_(vendor_ids),
            Agent.status == 'approved'
        )
        
        agents = query.all()
        agent_ids = [str(agent.id) for agent in agents]
        
        condition = selection.get('condition', 'all')
        if condition == 'select_one' and agent_ids:
            return [agent_ids[0]]
        return agent_ids
    
    def _expand_by_agents(self, selection: Dict[str, Any]) -> List[str]:
        """Expand selection by specific agent IDs"""
        agent_ids = selection.get('agent_ids', [])
        if not agent_ids:
            return []
        
        query = self.db.query(Agent).filter(
            Agent.id.in_(agent_ids),
            Agent.status == 'approved'
        )
        
        if self.tenant_id:
            vendors = self.db.query(Vendor).filter(Vendor.tenant_id == self.tenant_id).all()
            vendor_ids = [v.id for v in vendors]
            if vendor_ids:
                query = query.filter(Agent.vendor_id.in_(vendor_ids))
            else:
                return []
        
        agents = query.all()
        return [str(agent.id) for agent in agents]
    
    def expand_for_skill_input(self, input_data: Dict[str, Any], field_name: str = 'agent_selection') -> Dict[str, Any]:
        """Expand agent selection in skill input data"""
        if field_name not in input_data:
            return input_data
        
        selection = input_data[field_name]
        agent_ids = self.expand_selection(selection)
        
        updated_input = input_data.copy()
        
        if len(agent_ids) == 1:
            updated_input['agent_id'] = agent_ids[0]
        elif len(agent_ids) > 1:
            updated_input['agent_ids'] = agent_ids
        
        updated_input[f'{field_name}_original'] = selection
        del updated_input[field_name]
        
        return updated_input
