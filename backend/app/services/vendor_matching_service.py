"""
Vendor Matching Service - Matches security incidents to vendors
"""
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from difflib import SequenceMatcher
import logging
from app.models.vendor import Vendor
from app.models.security_incident import SecurityIncident, VendorSecurityTracking, SecurityMonitoringConfig

logger = logging.getLogger(__name__)


class VendorMatchingService:
    """Service for matching security incidents to vendors"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def match_incident_to_vendors(
        self,
        incident: SecurityIncident,
        tenant_id: str,
        config: Optional[SecurityMonitoringConfig] = None
    ) -> List[VendorSecurityTracking]:
        """
        Match a security incident to vendors in the tenant
        
        Args:
            incident: SecurityIncident to match
            tenant_id: Tenant ID
            config: Security monitoring configuration (optional)
        
        Returns:
            List of VendorSecurityTracking records created
        """
        min_confidence = config.min_match_confidence if config else 0.5
        
        # Get all vendors for this tenant
        vendors = self.db.query(Vendor).filter(
            Vendor.tenant_id == tenant_id
        ).all()
        
        if not vendors:
            return []
        
        matches = []
        
        # Extract identifiers from incident
        affected_vendors = incident.affected_vendors or []
        affected_products = incident.affected_products or []
        
        # Also extract vendors from product_details in incident_metadata
        product_details_vendors = []
        if incident.incident_metadata and isinstance(incident.incident_metadata, dict):
            product_details = incident.incident_metadata.get("product_details", [])
            if product_details:
                for product_detail in product_details:
                    if isinstance(product_detail, dict):
                        vendor_name = product_detail.get("vendor")
                        if vendor_name and vendor_name not in product_details_vendors:
                            product_details_vendors.append(vendor_name)
        
        # Combine all vendor sources
        all_affected_vendors = list(set(affected_vendors + product_details_vendors))
        
        # Also check CVE description for vendor mentions (do this per vendor for better context)
        # We'll check description in the _match_vendor method instead
        
        for vendor in vendors:
            match_result = self._match_vendor(
                vendor=vendor,
                incident=incident,
                affected_vendors=all_affected_vendors,
                affected_products=affected_products,
                product_details=incident.incident_metadata.get("product_details", []) if incident.incident_metadata else []
            )
            
            if match_result and match_result["confidence"] >= min_confidence:
                # Convert tenant_id to UUID if it's a string for consistent comparison
                from uuid import UUID as UUIDType
                tenant_uuid = UUIDType(tenant_id) if isinstance(tenant_id, str) else tenant_id
                
                # Check if tracking already exists
                existing = self.db.query(VendorSecurityTracking).filter(
                    VendorSecurityTracking.vendor_id == vendor.id,
                    VendorSecurityTracking.incident_id == incident.id,
                    VendorSecurityTracking.tenant_id == tenant_uuid
                ).first()
                
                if not existing:
                    tracking = VendorSecurityTracking(
                        tenant_id=tenant_uuid,
                        vendor_id=vendor.id,
                        incident_id=incident.id,
                        match_confidence=match_result["confidence"],
                        match_method=match_result["method"],
                        match_details=match_result.get("details"),
                        status="active",
                        risk_qualification_status="pending"
                    )
                    self.db.add(tracking)
                    matches.append(tracking)
        
        try:
            self.db.commit()
            logger.info(f"Matched incident {incident.external_id} to {len(matches)} vendors")
        except Exception as e:
            logger.error(f"Error matching incident to vendors: {str(e)}", exc_info=True)
            self.db.rollback()
        
        return matches
    
    def _match_vendor(
        self,
        vendor: Vendor,
        incident: SecurityIncident,
        affected_vendors: List[str],
        affected_products: List[str],
        product_details: List[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Match a vendor to an incident
        
        Returns:
            Match result dict with confidence, method, and details, or None
        """
        vendor_name_lower = vendor.name.lower()
        vendor_domain = self._extract_domain(vendor.website) if vendor.website else None
        
        # Method 1: Exact name match (highest confidence)
        for affected_vendor in affected_vendors:
            if vendor_name_lower == affected_vendor.lower():
                return {
                    "confidence": 1.0,
                    "method": "exact_name",
                    "details": {"matched_name": affected_vendor}
                }
        
        # Method 1b: Partial name match (vendor name contains affected vendor or vice versa)
        for affected_vendor in affected_vendors:
            affected_vendor_lower = affected_vendor.lower().strip()
            if not affected_vendor_lower:
                continue
            # Check if vendor name contains affected vendor name or vice versa
            # e.g., "Telenium Online" contains "Telenium", or "Telenium" matches "Telenium Online"
            # Also handle cases like "Telenium Online" matching "Telenium Online Web"
            if (affected_vendor_lower in vendor_name_lower or 
                vendor_name_lower in affected_vendor_lower):
                # Calculate confidence based on how much of the name matches
                shorter = min(len(vendor_name_lower), len(affected_vendor_lower))
                longer = max(len(vendor_name_lower), len(affected_vendor_lower))
                match_ratio = shorter / longer if longer > 0 else 0
                # High confidence if most of the name matches
                if match_ratio >= 0.7:
                    logger.debug(f"Partial name match: '{vendor.name}' matches '{affected_vendor}' (ratio: {match_ratio:.2f})")
                    return {
                        "confidence": 0.95,
                        "method": "partial_name",
                        "details": {"matched_name": affected_vendor, "match_ratio": match_ratio}
                    }
                elif match_ratio >= 0.5:
                    logger.debug(f"Partial name match (lower confidence): '{vendor.name}' matches '{affected_vendor}' (ratio: {match_ratio:.2f})")
                    return {
                        "confidence": 0.85,
                        "method": "partial_name",
                        "details": {"matched_name": affected_vendor, "match_ratio": match_ratio}
                    }
        
        # Method 1c: Word-based match (check if key words match)
        # e.g., "Telenium Online" should match "Telenium Online Web" or "Telenium"
        vendor_words = set(vendor_name_lower.split())
        for affected_vendor in affected_vendors:
            affected_vendor_lower = affected_vendor.lower().strip()
            if not affected_vendor_lower:
                continue
            affected_words = set(affected_vendor_lower.split())
            # If vendor name words are a subset of affected vendor words or vice versa
            if vendor_words and affected_words:
                # Check if all vendor words appear in affected vendor (or vice versa)
                if vendor_words.issubset(affected_words) or affected_words.issubset(vendor_words):
                    # Calculate overlap ratio
                    common_words = vendor_words.intersection(affected_words)
                    total_words = vendor_words.union(affected_words)
                    overlap_ratio = len(common_words) / len(total_words) if total_words else 0
                    if overlap_ratio >= 0.6:
                        logger.debug(f"Word-based match: '{vendor.name}' matches '{affected_vendor}' (overlap: {overlap_ratio:.2f})")
                        return {
                            "confidence": 0.9,
                            "method": "word_based",
                            "details": {"matched_name": affected_vendor, "overlap_ratio": overlap_ratio, "common_words": list(common_words)}
                        }
        
        # Method 2: Domain match (high confidence)
        if vendor_domain and incident.source_url:
            incident_domain = self._extract_domain(incident.source_url)
            if incident_domain and vendor_domain == incident_domain:
                return {
                    "confidence": 0.9,
                    "method": "domain",
                    "details": {"matched_domain": vendor_domain}
                }
        
        # Check vendor website domain against affected vendors
        if vendor_domain:
            for affected_vendor in affected_vendors:
                if vendor_domain in affected_vendor.lower() or affected_vendor.lower() in vendor_domain:
                    return {
                        "confidence": 0.85,
                        "method": "domain",
                        "details": {"matched_domain": vendor_domain, "matched_vendor": affected_vendor}
                    }
        
        # Method 3: Product/Software match (medium confidence)
        if vendor.description:
            vendor_desc_lower = vendor.description.lower()
            for product in affected_products:
                if product.lower() in vendor_desc_lower or vendor_desc_lower in product.lower():
                    return {
                        "confidence": 0.7,
                        "method": "product",
                        "details": {"matched_product": product}
                    }
        
        # Method 4: Check product_details for vendor matches
        if product_details:
            for product_detail in product_details:
                if isinstance(product_detail, dict):
                    product_vendor = product_detail.get("vendor")
                    if product_vendor:
                        # Exact match in product_details
                        if vendor_name_lower == product_vendor.lower():
                            return {
                                "confidence": 0.95,
                                "method": "product_detail_vendor",
                                "details": {
                                    "matched_name": product_vendor,
                                    "product": product_detail.get("product"),
                                    "version": product_detail.get("version")
                                }
                            }
                        # Fuzzy match in product_details
                        similarity = SequenceMatcher(None, vendor_name_lower, product_vendor.lower()).ratio()
                        if similarity >= 0.7:
                            return {
                                "confidence": similarity * 0.85,
                                "method": "product_detail_vendor_fuzzy",
                                "details": {
                                    "matched_name": product_vendor,
                                    "product": product_detail.get("product"),
                                    "version": product_detail.get("version"),
                                    "similarity": similarity
                                }
                            }
        
        # Method 5: Check if vendor name appears in incident description
        if incident.description:
            desc_lower = incident.description.lower()
            vendor_name_variations = [
                vendor.name.lower(),
                vendor.name.lower().replace(" ", ""),
                vendor.name.lower().replace(" ", "-"),
                vendor.name.lower().replace(" ", "_"),
            ]
            for variation in vendor_name_variations:
                if variation and len(variation) > 2:
                    if variation in desc_lower:
                        # Check context to ensure it's actually referring to the vendor
                        pos = desc_lower.find(variation)
                        context_start = max(0, pos - 50)
                        context_end = min(len(desc_lower), pos + len(variation) + 50)
                        context = desc_lower[context_start:context_end]
                        # If vendor name appears in meaningful context (not just random text)
                        if any(keyword in context for keyword in ["vendor", "company", "software", "product", "application", "system", "platform"]):
                            return {
                                "confidence": 0.75,
                                "method": "description_mention",
                                "details": {"matched_name": vendor.name, "context": context.strip()}
                            }
        
        # Method 6: Fuzzy name match (lower confidence)
        best_match = None
        best_confidence = 0.0
        
        for affected_vendor in affected_vendors:
            similarity = SequenceMatcher(None, vendor_name_lower, affected_vendor.lower()).ratio()
            if similarity > best_confidence:
                best_confidence = similarity
                best_match = affected_vendor
        
        # Only return fuzzy match if confidence is reasonable (lowered threshold)
        if best_confidence >= 0.5:  # Lowered from 0.6 to catch more matches
            return {
                "confidence": best_confidence * 0.8,  # Reduce confidence for fuzzy matches
                "method": "fuzzy",
                "details": {"matched_name": best_match, "similarity": best_confidence}
            }
        
        return None
    
    def _extract_vendors_from_description(self, description: str, vendor_names: List[str]) -> List[str]:
        """
        Extract vendor names from CVE description that match known vendors
        
        Args:
            description: CVE description text
            vendor_names: List of vendor names to search for
        
        Returns:
            List of matched vendor names
        """
        if not description or not vendor_names:
            return []
        
        found_vendors = []
        desc_lower = description.lower()
        
        for vendor_name in vendor_names:
            if not vendor_name:
                continue
            
            vendor_lower = vendor_name.lower()
            # Check for exact match (case-insensitive)
            if vendor_lower in desc_lower:
                # Check context to ensure it's actually referring to the vendor
                pos = desc_lower.find(vendor_lower)
                context_start = max(0, pos - 30)
                context_end = min(len(desc_lower), pos + len(vendor_lower) + 30)
                context = desc_lower[context_start:context_end]
                
                # If vendor name appears in meaningful context
                if any(keyword in context for keyword in ["vendor", "company", "software", "product", "application", "system", "platform", "in", "from", "by"]):
                    if vendor_name not in found_vendors:
                        found_vendors.append(vendor_name)
            
            # Also check for variations (without spaces, with different separators)
            vendor_variations = [
                vendor_lower.replace(" ", ""),
                vendor_lower.replace(" ", "-"),
                vendor_lower.replace(" ", "_"),
            ]
            for variation in vendor_variations:
                if variation and len(variation) > 2 and variation in desc_lower:
                    if vendor_name not in found_vendors:
                        found_vendors.append(vendor_name)
                    break
        
        return found_vendors
    
    def _extract_domain(self, url: str) -> Optional[str]:
        """Extract domain from URL"""
        if not url:
            return None
        
        try:
            # Remove protocol
            if "://" in url:
                url = url.split("://")[1]
            
            # Remove path
            if "/" in url:
                url = url.split("/")[0]
            
            # Remove port
            if ":" in url:
                url = url.split(":")[0]
            
            # Remove www.
            if url.startswith("www."):
                url = url[4:]
            
            return url.lower()
        except:
            return None

