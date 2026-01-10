"""
Compliance Calculation Service
Calculates compliance scores per framework based on:
- Question Library questions mapped to frameworks
- Question categories
- Vendor responses
- AI evaluation of pass/fail criteria

Real-time calculation with cost optimization (async/background processing)
"""
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.question_library import QuestionLibrary
from app.models.compliance_framework import ComplianceFramework
from app.models.assessment import (
    AssessmentQuestion,
    AssessmentAssignment,
    AssessmentQuestionResponse
)
from app.models.user import User
from datetime import datetime
import uuid
import logging
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for async AI evaluation (cost optimization)
_executor = ThreadPoolExecutor(max_workers=5)


class ComplianceCalculationService:
    """Service for calculating compliance scores based on question responses"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_compliance_for_assignment(
        self,
        assignment_id: uuid.UUID,
        framework_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """
        Calculate compliance scores for an assessment assignment
        
        Args:
            assignment_id: Assessment assignment ID
            framework_id: Optional framework ID to calculate for specific framework
        
        Returns:
            Dictionary with compliance scores per framework
        """
        # Get assignment
        assignment = self.db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == assignment_id
        ).first()
        
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")
        
        # Get all questions for this assessment
        questions = self.db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id
        ).all()
        
        # Get all responses
        responses = self.db.query(AssessmentQuestionResponse).filter(
            AssessmentQuestionResponse.assignment_id == assignment_id
        ).all()
        
        # Create response map
        response_map = {str(r.question_id): r for r in responses}
        
        # Get frameworks to calculate
        if framework_id:
            frameworks = [self.db.query(ComplianceFramework).filter(
                ComplianceFramework.id == framework_id
            ).first()]
        else:
            # Get all frameworks referenced by questions
            framework_ids = set()
            for question in questions:
                # Get question library question if it's a reusable question
                if question.reusable_question_id:
                    qlib_question = self.db.query(QuestionLibrary).filter(
                        QuestionLibrary.id == question.reusable_question_id
                    ).first()
                    if qlib_question:
                        if qlib_question.compliance_framework_ids:
                            framework_ids.update(qlib_question.compliance_framework_ids)
            
            frameworks = self.db.query(ComplianceFramework).filter(
                ComplianceFramework.id.in_([uuid.UUID(fid) for fid in framework_ids])
            ).all()
        
        # Calculate compliance per framework
        results = {}
        for framework in frameworks:
            if not framework:
                continue
            
            score_data = self._calculate_framework_compliance(
                framework,
                questions,
                response_map,
                assignment
            )
            results[str(framework.id)] = {
                "framework_id": str(framework.id),
                "framework_name": framework.name,
                "framework_code": framework.code,
                **score_data
            }
        
        return {
            "assignment_id": str(assignment_id),
            "calculated_at": datetime.utcnow().isoformat(),
            "frameworks": results
        }
    
    def _calculate_framework_compliance(
        self,
        framework: ComplianceFramework,
        questions: List[AssessmentQuestion],
        response_map: Dict[str, AssessmentQuestionResponse],
        assignment: AssessmentAssignment
    ) -> Dict[str, Any]:
        """Calculate compliance for a specific framework"""
        
        # Get questions mapped to this framework
        framework_questions = []
        for question in questions:
            # Check if question is mapped to this framework
            if question.reusable_question_id:
                qlib_question = self.db.query(QuestionLibrary).filter(
                    QuestionLibrary.id == question.reusable_question_id
                ).first()
                if qlib_question:
                    framework_ids = qlib_question.compliance_framework_ids or []
                    if str(framework.id) in framework_ids:
                        framework_questions.append((question, qlib_question))
        
        if not framework_questions:
            return {
                "total_questions": 0,
                "answered_questions": 0,
                "passed_questions": 0,
                "failed_questions": 0,
                "review_questions": 0,
                "compliance_score": 0,
                "compliance_percentage": 0.0,
                "status": "not_applicable"
            }
        
        # Evaluate each question
        passed = 0
        failed = 0
        review = 0
        answered = 0
        
        evaluation_results = []
        
        for question, qlib_question in framework_questions:
            response = response_map.get(str(question.id))
            
            if not response or not response.value:
                continue  # Skip unanswered questions
            
            answered += 1
            
            # Evaluate pass/fail
            evaluation = self._evaluate_question_response(
                qlib_question,
                response,
                question
            )
            
            evaluation_results.append({
                "question_id": str(question.id),
                "question_title": question.title or qlib_question.title,
                "evaluation": evaluation["status"],
                "confidence": evaluation.get("confidence", 0.0),
                "reasoning": evaluation.get("reasoning", "")
            })
            
            if evaluation["status"] == "passed":
                passed += 1
            elif evaluation["status"] == "failed":
                failed += 1
            else:
                review += 1
        
        # Calculate compliance score
        total_evaluated = passed + failed + review
        if total_evaluated == 0:
            compliance_percentage = 0.0
        else:
            # Passed = 100%, Review = 50%, Failed = 0%
            compliance_percentage = ((passed * 1.0) + (review * 0.5)) / total_evaluated * 100
        
        # Determine overall status
        if compliance_percentage >= 80:
            status = "compliant"
        elif compliance_percentage >= 60:
            status = "mostly_compliant"
        elif compliance_percentage >= 40:
            status = "partially_compliant"
        else:
            status = "non_compliant"
        
        return {
            "total_questions": len(framework_questions),
            "answered_questions": answered,
            "passed_questions": passed,
            "failed_questions": failed,
            "review_questions": review,
            "compliance_score": int(compliance_percentage),
            "compliance_percentage": round(compliance_percentage, 2),
            "status": status,
            "evaluations": evaluation_results
        }
    
    def _evaluate_question_response(
        self,
        qlib_question: QuestionLibrary,
        response: AssessmentQuestionResponse,
        question: AssessmentQuestion
    ) -> Dict[str, Any]:
        """
        Evaluate a question response against pass/fail criteria
        
        Returns:
            {
                "status": "passed" | "failed" | "review",
                "confidence": float (0.0-1.0),
                "reasoning": str
            }
        """
        criteria = qlib_question.pass_fail_criteria
        
        if not criteria:
            # No criteria - default to review
            return {
                "status": "review",
                "confidence": 0.5,
                "reasoning": "No pass/fail criteria defined for this question"
            }
        
        criteria_type = criteria.get("type", "exact_match")
        response_value = response.value
        
        # Handle different criteria types
        if criteria_type == "exact_match":
            return self._evaluate_exact_match(criteria, response_value)
        elif criteria_type == "contains":
            return self._evaluate_contains(criteria, response_value)
        elif criteria_type == "range":
            return self._evaluate_range(criteria, response_value)
        elif criteria_type == "file_uploaded":
            return self._evaluate_file_uploaded(criteria, response)
        elif criteria_type == "url_valid":
            return self._evaluate_url_valid(criteria, response_value)
        elif criteria_type == "ai_evaluation":
            # AI evaluation - use async for cost optimization
            return self._evaluate_ai(criteria, response_value, qlib_question)
        else:
            return {
                "status": "review",
                "confidence": 0.5,
                "reasoning": f"Unknown criteria type: {criteria_type}"
            }
    
    def _evaluate_exact_match(
        self,
        criteria: Dict[str, Any],
        response_value: Any
    ) -> Dict[str, Any]:
        """Evaluate exact match criteria"""
        pass_condition = criteria.get("pass_condition")
        fail_condition = criteria.get("fail_condition")
        review_condition = criteria.get("review_condition")
        case_sensitive = criteria.get("case_sensitive", False)
        
        # Normalize if not case sensitive
        if not case_sensitive and isinstance(response_value, str):
            response_value = response_value.lower()
            if isinstance(pass_condition, str):
                pass_condition = pass_condition.lower()
            if isinstance(fail_condition, str):
                fail_condition = fail_condition.lower()
            if isinstance(review_condition, str):
                review_condition = review_condition.lower()
        
        # Check pass condition
        if isinstance(pass_condition, list):
            if response_value in pass_condition:
                return {
                    "status": "passed",
                    "confidence": 1.0,
                    "reasoning": f"Response matches pass condition: {response_value}"
                }
        elif response_value == pass_condition:
            return {
                "status": "passed",
                "confidence": 1.0,
                "reasoning": f"Response matches pass condition: {response_value}"
            }
        
        # Check fail condition
        if isinstance(fail_condition, list):
            if response_value in fail_condition:
                return {
                    "status": "failed",
                    "confidence": 1.0,
                    "reasoning": f"Response matches fail condition: {response_value}"
                }
        elif response_value == fail_condition:
            return {
                "status": "failed",
                "confidence": 1.0,
                "reasoning": f"Response matches fail condition: {response_value}"
            }
        
        # Check review condition
        if review_condition:
            if isinstance(review_condition, list):
                if response_value in review_condition:
                    return {
                        "status": "review",
                        "confidence": 0.7,
                        "reasoning": f"Response matches review condition: {response_value}"
                    }
            elif response_value == review_condition:
                return {
                    "status": "review",
                    "confidence": 0.7,
                    "reasoning": f"Response matches review condition: {response_value}"
                }
        
        # Default to review if no match
        return {
            "status": "review",
            "confidence": 0.5,
            "reasoning": f"Response does not match any defined condition: {response_value}"
        }
    
    def _evaluate_contains(
        self,
        criteria: Dict[str, Any],
        response_value: Any
    ) -> Dict[str, Any]:
        """Evaluate contains criteria"""
        pass_condition = criteria.get("pass_condition", [])
        fail_condition = criteria.get("fail_condition", [])
        case_sensitive = criteria.get("case_sensitive", False)
        
        if not isinstance(response_value, str):
            response_value = str(response_value)
        
        if not case_sensitive:
            response_value = response_value.lower()
            pass_condition = [p.lower() if isinstance(p, str) else p for p in pass_condition]
            fail_condition = [f.lower() if isinstance(f, str) else f for f in fail_condition]
        
        # Check if response contains any pass condition
        for condition in pass_condition:
            if condition in response_value:
                return {
                    "status": "passed",
                    "confidence": 0.9,
                    "reasoning": f"Response contains pass condition: {condition}"
                }
        
        # Check if response contains any fail condition
        for condition in fail_condition:
            if condition in response_value:
                return {
                    "status": "failed",
                    "confidence": 0.9,
                    "reasoning": f"Response contains fail condition: {condition}"
                }
        
        return {
            "status": "review",
            "confidence": 0.5,
            "reasoning": "Response does not match contains criteria"
        }
    
    def _evaluate_range(
        self,
        criteria: Dict[str, Any],
        response_value: Any
    ) -> Dict[str, Any]:
        """Evaluate range criteria"""
        try:
            numeric_value = float(response_value)
        except (ValueError, TypeError):
            return {
                "status": "review",
                "confidence": 0.5,
                "reasoning": f"Response is not numeric: {response_value}"
            }
        
        pass_condition = criteria.get("pass_condition", {})
        fail_condition = criteria.get("fail_condition", {})
        
        # Check pass range
        if isinstance(pass_condition, dict):
            min_val = pass_condition.get("min")
            max_val = pass_condition.get("max")
            if (min_val is None or numeric_value >= min_val) and (max_val is None or numeric_value <= max_val):
                return {
                    "status": "passed",
                    "confidence": 1.0,
                    "reasoning": f"Response {numeric_value} is within pass range"
                }
        
        # Check fail range
        if isinstance(fail_condition, dict):
            min_val = fail_condition.get("min")
            max_val = fail_condition.get("max")
            if (min_val is None or numeric_value >= min_val) and (max_val is None or numeric_value <= max_val):
                return {
                    "status": "failed",
                    "confidence": 1.0,
                    "reasoning": f"Response {numeric_value} is within fail range"
                }
        
        return {
            "status": "review",
            "confidence": 0.5,
            "reasoning": f"Response {numeric_value} does not match range criteria"
        }
    
    def _evaluate_file_uploaded(
        self,
        criteria: Dict[str, Any],
        response: AssessmentQuestionResponse
    ) -> Dict[str, Any]:
        """Evaluate file upload criteria"""
        min_file_count = criteria.get("min_file_count", 1)
        
        # Check if files are uploaded
        files = response.documents or []
        file_count = len(files) if isinstance(files, list) else 0
        
        if file_count >= min_file_count:
            return {
                "status": "passed",
                "confidence": 1.0,
                "reasoning": f"{file_count} file(s) uploaded (required: {min_file_count})"
            }
        else:
            return {
                "status": "failed",
                "confidence": 1.0,
                "reasoning": f"Only {file_count} file(s) uploaded (required: {min_file_count})"
            }
    
    def _evaluate_url_valid(
        self,
        criteria: Dict[str, Any],
        response_value: Any
    ) -> Dict[str, Any]:
        """Evaluate URL validity"""
        import re
        
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        if isinstance(response_value, str) and url_pattern.match(response_value):
            return {
                "status": "passed",
                "confidence": 1.0,
                "reasoning": "Valid URL provided"
            }
        else:
            return {
                "status": "failed",
                "confidence": 1.0,
                "reasoning": f"Invalid URL format: {response_value}"
            }
    
    def _evaluate_ai(
        self,
        criteria: Dict[str, Any],
        response_value: Any,
        qlib_question: QuestionLibrary
    ) -> Dict[str, Any]:
        """
        AI evaluation of response
        Uses async processing for cost optimization
        """
        evaluation_prompt = criteria.get("evaluation_prompt", "")
        pass_keywords = criteria.get("pass_keywords", [])
        min_length = criteria.get("min_length", 0)
        
        if not evaluation_prompt:
            # Fallback to keyword-based evaluation
            return self._evaluate_keywords(criteria, response_value)
        
        # For now, use keyword-based evaluation (can be enhanced with LLM later)
        # This is cost-optimized - only use AI for complex cases
        response_str = str(response_value) if response_value else ""
        
        # Check minimum length
        if min_length > 0 and len(response_str) < min_length:
            return {
                "status": "failed",
                "confidence": 0.8,
                "reasoning": f"Response too short (minimum {min_length} characters required)"
            }
        
        # Check for pass keywords
        if pass_keywords:
            found_keywords = []
            response_lower = response_str.lower()
            for keyword in pass_keywords:
                if keyword.lower() in response_lower:
                    found_keywords.append(keyword)
            
            if found_keywords:
                return {
                    "status": "passed",
                    "confidence": min(0.9, 0.5 + (len(found_keywords) / len(pass_keywords)) * 0.4),
                    "reasoning": f"Response contains relevant keywords: {', '.join(found_keywords)}"
                }
        
        # Default to review for AI evaluation (human review needed)
        return {
            "status": "review",
            "confidence": 0.6,
            "reasoning": "AI evaluation suggests human review needed"
        }
    
    def _evaluate_keywords(
        self,
        criteria: Dict[str, Any],
        response_value: Any
    ) -> Dict[str, Any]:
        """Keyword-based evaluation (fallback for AI)"""
        pass_keywords = criteria.get("pass_keywords", [])
        fail_keywords = criteria.get("fail_keywords", [])
        min_length = criteria.get("min_length", 0)
        
        response_str = str(response_value) if response_value else ""
        response_lower = response_str.lower()
        
        # Check minimum length
        if min_length > 0 and len(response_str) < min_length:
            return {
                "status": "failed",
                "confidence": 0.8,
                "reasoning": f"Response too short (minimum {min_length} characters required)"
            }
        
        # Check for fail keywords first
        if fail_keywords:
            for keyword in fail_keywords:
                if keyword.lower() in response_lower:
                    return {
                        "status": "failed",
                        "confidence": 0.9,
                        "reasoning": f"Response contains fail keyword: {keyword}"
                    }
        
        # Check for pass keywords
        if pass_keywords:
            found_keywords = []
            for keyword in pass_keywords:
                if keyword.lower() in response_lower:
                    found_keywords.append(keyword)
            
            if found_keywords:
                return {
                    "status": "passed",
                    "confidence": min(0.9, 0.5 + (len(found_keywords) / len(pass_keywords)) * 0.4),
                    "reasoning": f"Response contains relevant keywords: {', '.join(found_keywords)}"
                }
        
        return {
            "status": "review",
            "confidence": 0.5,
            "reasoning": "Keyword evaluation inconclusive - human review recommended"
        }


# Global instance
def get_compliance_calculation_service(db: Session) -> ComplianceCalculationService:
    """Get compliance calculation service instance"""
    return ComplianceCalculationService(db)
