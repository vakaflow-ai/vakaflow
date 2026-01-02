"""
Background scheduler service for auto-triggering assessment schedules
"""
from typing import List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.assessment import Assessment, AssessmentSchedule, AssessmentAssignment
from app.services.assessment_service import AssessmentService
import logging

logger = logging.getLogger(__name__)


class AssessmentScheduler:
    """Service for auto-triggering scheduled assessments"""
    
    def __init__(self, db: Session):
        self.db = db
        self.service = AssessmentService(db)
    
    def trigger_due_schedules(self) -> List[AssessmentAssignment]:
        """Trigger all assessment schedules that are due
        
        Returns:
            List of created AssessmentAssignment instances
        """
        now = datetime.utcnow()
        
        # Find schedules that are due (scheduled_date <= now and status is pending/scheduled)
        due_schedules = self.db.query(AssessmentSchedule).join(Assessment).filter(
            AssessmentSchedule.scheduled_date <= now,
            AssessmentSchedule.status.in_(['pending', 'scheduled']),
            Assessment.is_active == True
        ).all()
        
        assignments = []
        for schedule in due_schedules:
            try:
                # Get vendors from schedule or from last schedule
                vendors = self.service.get_vendors_matching_rules(
                    schedule.assessment,
                    last_schedule_id=schedule.id
                )
                
                # Create assignments for each vendor
                for vendor in vendors:
                    assignment_data = {
                        'assignment_type': 'scheduled',
                        'status': 'pending',
                        'vendor_id': vendor.id,
                        'due_date': schedule.due_date,
                    }
                    
                    assignment = self.service.create_assignment(
                        assessment_id=schedule.assessment_id,
                        assignment_data=assignment_data,
                        tenant_id=schedule.tenant_id,
                        assigned_by=schedule.assessment.owner_id,
                        schedule_id=schedule.id
                    )
                    assignments.append(assignment)
                
                # Update schedule status
                schedule.status = 'triggered'
                schedule.triggered_at = now
                
                # Calculate next scheduled date if recurring
                if schedule.frequency != 'one_time':
                    next_date = self.service.calculate_next_scheduled_date(
                        schedule.scheduled_date,
                        schedule.frequency,
                        schedule.assessment.schedule_interval_months
                    )
                    # Create new schedule for next occurrence
                    new_schedule = AssessmentSchedule(
                        assessment_id=schedule.assessment_id,
                        tenant_id=schedule.tenant_id,
                        created_by=schedule.created_by,
                        scheduled_date=next_date,
                        due_date=schedule.due_date + timedelta(days=(next_date - schedule.scheduled_date).days) if schedule.due_date else None,
                        frequency=schedule.frequency,
                        selected_vendor_ids=schedule.selected_vendor_ids,
                        status='scheduled'
                    )
                    self.db.add(new_schedule)
                
                self.db.commit()
                logger.info(f"Triggered schedule {schedule.id} for assessment {schedule.assessment_id}, created {len(vendors)} assignments")
                
            except Exception as e:
                self.db.rollback()
                logger.error(f"Error triggering schedule {schedule.id}: {e}", exc_info=True)
        
        return assignments
    
    def check_overdue_assignments(self) -> int:
        """Mark assignments as overdue if past due date
        
        Returns:
            Number of assignments marked as overdue
        """
        now = datetime.utcnow()
        
        overdue = self.db.query(AssessmentAssignment).filter(
            AssessmentAssignment.due_date < now,
            AssessmentAssignment.status.in_(['pending', 'in_progress'])
        ).all()
        
        count = 0
        for assignment in overdue:
            assignment.status = 'overdue'
            count += 1
        
        if count > 0:
            self.db.commit()
            logger.info(f"Marked {count} assignments as overdue")
        
        return count
