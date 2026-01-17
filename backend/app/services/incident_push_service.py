"""
Incident Push Service - Pushes incidents to third-party systems (ServiceNow, Jira)
"""
import logging
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.incident_report import IncidentReport, IncidentStatus, IncidentType
from app.models.integration import Integration
from datetime import datetime

logger = logging.getLogger(__name__)


class IncidentPushService:
    """Service for pushing incidents to external systems"""
    
    @staticmethod
    def push_to_servicenow(
        incident: IncidentReport,
        integration: Integration,
        db: Session
    ) -> Dict[str, Any]:
        """Push incident to ServiceNow"""
        try:
            # Get ServiceNow configuration from integration
            config = integration.config or {}
            instance_url = config.get('instance_url')
            username = config.get('username')
            password = config.get('password')
            table_name = config.get('incident_table', 'incident')
            
            if not all([instance_url, username, password]):
                raise ValueError("ServiceNow integration not properly configured")
            
            # Map VAKA incident to ServiceNow incident
            servicenow_data = {
                'short_description': incident.title,
                'description': incident.description or '',
                'urgency': IncidentPushService._map_severity_to_urgency(incident.severity),
                'impact': IncidentPushService._map_severity_to_impact(incident.severity),
                'category': incident.incident_type,
                'subcategory': incident.entity_type,
                'work_notes': f"Entity: {incident.entity_type} ({incident.entity_id})\n"
                            f"VAKA Incident ID: {incident.id}\n"
                            f"Incident Data: {incident.incident_data or {}}"
            }
            
            # Make API call to ServiceNow
            import requests
            from requests.auth import HTTPBasicAuth
            
            url = f"{instance_url}/api/now/table/{table_name}"
            auth = HTTPBasicAuth(username, password)
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
            
            response = requests.post(url, json=servicenow_data, auth=auth, headers=headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            ticket_id = result.get('result', {}).get('number')
            ticket_url = f"{instance_url}/nav_to.do?uri={table_name}.do?sys_id={result.get('result', {}).get('sys_id')}"
            
            # Update incident with external ticket info
            incident.external_system = 'servicenow'
            incident.external_ticket_id = ticket_id
            incident.external_ticket_url = ticket_url
            incident.push_status = IncidentStatus.PUSHED.value
            incident.push_attempts += 1
            incident.last_push_attempt = datetime.utcnow()
            incident.push_error = None
            
            db.commit()
            
            logger.info(f"Successfully pushed incident {incident.id} to ServiceNow as {ticket_id}")
            
            return {
                'success': True,
                'ticket_id': ticket_id,
                'ticket_url': ticket_url
            }
            
        except Exception as e:
            logger.error(f"Failed to push incident {incident.id} to ServiceNow: {e}", exc_info=True)
            
            # Update incident with error
            incident.push_status = IncidentStatus.FAILED.value
            incident.push_attempts += 1
            incident.last_push_attempt = datetime.utcnow()
            incident.push_error = str(e)
            db.commit()
            
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def push_to_jira(
        incident: IncidentReport,
        integration: Integration,
        db: Session
    ) -> Dict[str, Any]:
        """Push incident to Jira"""
        try:
            # Get Jira configuration from integration
            config = integration.config or {}
            instance_url = config.get('instance_url')
            email = config.get('email')
            api_token = config.get('api_token')
            project_key = config.get('project_key')
            issue_type = config.get('issue_type', 'Bug')
            
            if not all([instance_url, email, api_token, project_key]):
                raise ValueError("Jira integration not properly configured")
            
            # Map VAKA incident to Jira issue
            jira_data = {
                'fields': {
                    'project': {'key': project_key},
                    'summary': incident.title,
                    'description': {
                        'type': 'doc',
                        'version': 1,
                        'content': [
                            {
                                'type': 'paragraph',
                                'content': [
                                    {
                                        'type': 'text',
                                        'text': incident.description or ''
                                    }
                                ]
                            },
                            {
                                'type': 'paragraph',
                                'content': [
                                    {
                                        'type': 'text',
                                        'text': f"\n\nEntity: {incident.entity_type} ({incident.entity_id})\n"
                                               f"VAKA Incident ID: {incident.id}\n"
                                               f"Severity: {incident.severity or 'N/A'}"
                                    }
                                ]
                            }
                        ]
                    },
                    'issuetype': {'name': issue_type},
                    'priority': {'name': IncidentPushService._map_severity_to_jira_priority(incident.severity)}
                }
            }
            
            # Make API call to Jira
            import requests
            from requests.auth import HTTPBasicAuth
            
            url = f"{instance_url}/rest/api/3/issue"
            auth = HTTPBasicAuth(email, api_token)
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
            
            response = requests.post(url, json=jira_data, auth=auth, headers=headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            ticket_id = result.get('key')
            ticket_url = f"{instance_url}/browse/{ticket_id}"
            
            # Update incident with external ticket info
            incident.external_system = 'jira'
            incident.external_ticket_id = ticket_id
            incident.external_ticket_url = ticket_url
            incident.push_status = IncidentStatus.PUSHED.value
            incident.push_attempts += 1
            incident.last_push_attempt = datetime.utcnow()
            incident.push_error = None
            
            db.commit()
            
            logger.info(f"Successfully pushed incident {incident.id} to Jira as {ticket_id}")
            
            return {
                'success': True,
                'ticket_id': ticket_id,
                'ticket_url': ticket_url
            }
            
        except Exception as e:
            logger.error(f"Failed to push incident {incident.id} to Jira: {e}", exc_info=True)
            
            # Update incident with error
            incident.push_status = IncidentStatus.FAILED.value
            incident.push_attempts += 1
            incident.last_push_attempt = datetime.utcnow()
            incident.push_error = str(e)
            db.commit()
            
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def push_incident(
        incident_id: UUID,
        external_system: str,
        db: Session
    ) -> Dict[str, Any]:
        """Push incident to specified external system"""
        incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
        if not incident:
            return {'success': False, 'error': 'Incident not found'}
        
        # Get integration for external system
        integration = db.query(Integration).filter(
            Integration.integration_type == external_system,
            Integration.tenant_id == incident.tenant_id
        ).first()
        
        if not integration:
            return {'success': False, 'error': f'{external_system} integration not configured'}
        
        if external_system == 'servicenow':
            return IncidentPushService.push_to_servicenow(incident, integration, db)
        elif external_system == 'jira':
            return IncidentPushService.push_to_jira(incident, integration, db)
        else:
            return {'success': False, 'error': f'Unsupported external system: {external_system}'}
    
    @staticmethod
    def _map_severity_to_urgency(severity: Optional[str]) -> str:
        """Map VAKA severity to ServiceNow urgency"""
        mapping = {
            'critical': '1',
            'high': '2',
            'medium': '3',
            'low': '4'
        }
        return mapping.get(severity or 'medium', '3')
    
    @staticmethod
    def _map_severity_to_impact(severity: Optional[str]) -> str:
        """Map VAKA severity to ServiceNow impact"""
        mapping = {
            'critical': '1',
            'high': '2',
            'medium': '3',
            'low': '4'
        }
        return mapping.get(severity or 'medium', '3')
    
    @staticmethod
    def _map_severity_to_jira_priority(severity: Optional[str]) -> str:
        """Map VAKA severity to Jira priority"""
        mapping = {
            'critical': 'Highest',
            'high': 'High',
            'medium': 'Medium',
            'low': 'Low'
        }
        return mapping.get(severity or 'medium', 'Medium')


