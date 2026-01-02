"""
CVE Scanner Service - Scans NVD and CVE.org for new CVEs
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
import requests
import logging
import re
from app.models.security_incident import SecurityIncident, IncidentType, IncidentSeverity, SecurityMonitoringConfig

logger = logging.getLogger(__name__)


# Common vendor name mappings for normalization
VENDOR_NAME_MAPPINGS = {
    "redhat": "Red Hat",
    "red hat": "Red Hat",
    "red_hat": "Red Hat",
    "microsoft": "Microsoft",
    "microsoft corporation": "Microsoft",
    "google": "Google",
    "google llc": "Google",
    "oracle": "Oracle",
    "oracle corporation": "Oracle",
    "apache": "Apache",
    "apache software foundation": "Apache",
    "mozilla": "Mozilla",
    "mozilla foundation": "Mozilla",
    "adobe": "Adobe",
    "adobe systems": "Adobe",
    "apple": "Apple",
    "apple inc": "Apple",
    "github": "GitHub",
    "gitlab": "GitLab",
    "ubuntu": "Ubuntu",
    "canonical": "Canonical",
    "debian": "Debian",
    "openssl": "OpenSSL",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "python": "Python",
    "python software foundation": "Python",
    "php": "PHP",
    "wordpress": "WordPress",
    "drupal": "Drupal",
    "jenkins": "Jenkins",
    "kubernetes": "Kubernetes",
    "docker": "Docker",
    "cisco": "Cisco",
    "cisco systems": "Cisco",
    "ibm": "IBM",
    "intel": "Intel",
    "amd": "AMD",
    "nvidia": "NVIDIA",
    "vmware": "VMware",
    "vmware inc": "VMware",
}


def normalize_vendor_name(vendor: str) -> str:
    """Normalize vendor name to a standard format"""
    if not vendor:
        return ""
    
    # Convert to lowercase for comparison
    vendor_lower = vendor.lower().strip()
    
    # Check if we have a mapping
    if vendor_lower in VENDOR_NAME_MAPPINGS:
        return VENDOR_NAME_MAPPINGS[vendor_lower]
    
    # Clean up the vendor name
    vendor_clean = vendor.replace("\\_", " ").replace("_", " ")
    vendor_clean = re.sub(r'([a-z])([A-Z])', r'\1 \2', vendor_clean)
    vendor_clean = " ".join(vendor_clean.split())
    
    # Title case, but preserve known acronyms
    words = vendor_clean.split()
    normalized_words = []
    for word in words:
        word_lower = word.lower()
        if word_lower in VENDOR_NAME_MAPPINGS:
            normalized_words.append(VENDOR_NAME_MAPPINGS[word_lower])
        elif len(word) > 1 and word.isupper():
            # Preserve acronyms like IBM, AMD, etc.
            normalized_words.append(word)
        else:
            normalized_words.append(word.title())
    
    return " ".join(normalized_words)


class CVEScannerService:
    """Service for scanning and tracking CVEs"""
    
    NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    CVE_ORG_API_BASE = "https://cveawg.mitre.org/api/cve"
    
    def __init__(self, db: Session):
        self.db = db
    
    def scan_new_cves(
        self,
        tenant_id: Optional[str] = None,
        days_back: int = 7,
        config: Optional[SecurityMonitoringConfig] = None
    ) -> List[SecurityIncident]:
        """
        Scan for new CVEs from NVD API
        
        Args:
            tenant_id: Tenant ID (for tenant-specific scanning)
            days_back: Number of days to look back for CVEs
            config: Security monitoring configuration (optional)
        
        Returns:
            List of created SecurityIncident records
        """
        if config:
            # Use config thresholds
            severity_threshold = config.cve_severity_threshold
            cvss_threshold = config.cve_cvss_threshold
        else:
            # Default thresholds
            severity_threshold = IncidentSeverity.MEDIUM
            cvss_threshold = 5.0
        
        created_incidents = []
        
        try:
            # Calculate date range
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days_back)
            
            # Format dates for NVD API (ISO 8601)
            start_date_str = start_date.strftime("%Y-%m-%dT%H:%M:%S.000")
            end_date_str = end_date.strftime("%Y-%m-%dT%H:%M:%S.000")
            
            # Query NVD API
            params = {
                "pubStartDate": start_date_str,
                "pubEndDate": end_date_str,
                "resultsPerPage": 2000,  # Max allowed
                "startIndex": 0
            }
            
            logger.info(f"Scanning NVD API for CVEs from {start_date_str} to {end_date_str}")
            
            response = requests.get(
                self.NVD_API_BASE,
                params=params,
                timeout=30,
                headers={"User-Agent": "VAKA-Security-Monitoring/1.0"}
            )
            
            if response.status_code != 200:
                logger.error(f"NVD API error: {response.status_code} - {response.text}")
                return created_incidents
            
            data = response.json()
            vulnerabilities = data.get("vulnerabilities", [])
            
            logger.info(f"Found {len(vulnerabilities)} CVEs from NVD")
            
            for vuln in vulnerabilities:
                cve = vuln.get("cve", {})
                cve_id = cve.get("id")
                
                if not cve_id:
                    continue
                
                # Check if already exists
                existing = self.db.query(SecurityIncident).filter(
                    SecurityIncident.external_id == cve_id,
                    SecurityIncident.tenant_id == (tenant_id if tenant_id else None)
                ).first()
                
                if existing:
                    continue
                
                # Extract CVE details
                descriptions = cve.get("descriptions", [])
                description = next(
                    (d.get("value") for d in descriptions if d.get("lang") == "en"),
                    descriptions[0].get("value") if descriptions else ""
                )
                
                # Extract metrics (CVSS scores)
                metrics = cve.get("metrics", {})
                cvss_score = None
                cvss_vector = None
                severity = None
                
                # Try CVSS v3.1 first, then v3.0, then v2.0
                for version in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
                    if version in metrics:
                        metric_list = metrics[version]
                        if metric_list:
                            cvss_data = metric_list[0].get("cvssData", {})
                            cvss_score = cvss_data.get("baseScore")
                            cvss_vector = cvss_data.get("vectorString")
                            
                            # Determine severity from CVSS score
                            if cvss_score:
                                if cvss_score >= 9.0:
                                    severity = IncidentSeverity.CRITICAL
                                elif cvss_score >= 7.0:
                                    severity = IncidentSeverity.HIGH
                                elif cvss_score >= 4.0:
                                    severity = IncidentSeverity.MEDIUM
                                else:
                                    severity = IncidentSeverity.LOW
                            break
                
                # Apply filters
                if cvss_score and cvss_score < cvss_threshold:
                    continue
                
                if severity:
                    severity_levels = {
                        IncidentSeverity.CRITICAL: 4,
                        IncidentSeverity.HIGH: 3,
                        IncidentSeverity.MEDIUM: 2,
                        IncidentSeverity.LOW: 1
                    }
                    threshold_level = severity_levels.get(severity_threshold, 2)
                    cve_level = severity_levels.get(severity, 0)
                    if cve_level < threshold_level:
                        continue
                
                # Extract affected products/vendors
                configurations = cve.get("configurations", [])
                affected_products = []
                vendor_set = set()  # Use set to avoid duplicates
                product_details = []
                product_keys_seen = set()  # Track unique product keys to avoid duplicates
                
                # FIRST: Extract from description text (often has vendor/product/version even when CPE is missing)
                if description:
                    # Pattern 1: "[Vendor Name] [Product Name] [Version]" (e.g., "Ross Video DashBoard 8.5.1")
                    # Try to match common patterns where vendor and product are separated
                    patterns = [
                        # Pattern: "[Vendor] [Product] [Version]" - try to split vendor and product intelligently
                        r"([A-Z][a-zA-Z0-9\s&]+?)\s+([A-Z][a-zA-Z0-9\s\-_]+?)\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?)",
                        # Pattern: "[Product] [Version] in [Vendor]" or "[Product] [Version] from [Vendor]"
                        r"([A-Z][a-zA-Z0-9\s\-_]+?)\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?)\s+(?:in|from)\s+([A-Z][a-zA-Z0-9\s&]+?)",
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, description, re.IGNORECASE)
                        if match:
                            if len(match.groups()) == 3:
                                # First pattern: vendor, product, version
                                if pattern == patterns[0]:
                                    vendor_match = match.group(1).strip()
                                    product_match = match.group(2).strip()
                                    version_match = match.group(3).strip()
                                    
                                    # Smart splitting: Handle cases like "Ross Video DashBoard 8.5.1"
                                    # where vendor_match="Ross" and product_match="Video DashBoard"
                                    # We want vendor="Ross Video" and product="DashBoard"
                                    vendor_words = vendor_match.split()
                                    product_words = product_match.split()
                                    
                                    # Common vendor name patterns (multi-word vendors)
                                    common_vendor_patterns = [
                                        'video', 'systems', 'technologies', 'solutions', 'services', 
                                        'software', 'corporation', 'inc', 'llc', 'ltd', 'limited',
                                        'networks', 'security', 'cloud', 'enterprise'
                                    ]
                                    
                                    # If vendor is single word and product has multiple words,
                                    # check if first product word should be part of vendor
                                    if len(vendor_words) == 1 and len(product_words) >= 2:
                                        first_product_word = product_words[0].lower()
                                        # If first product word looks like part of vendor name (common patterns or capitalized)
                                        if (first_product_word in common_vendor_patterns or 
                                            (product_words[0][0].isupper() and len(product_words) > 1)):
                                            # Combine vendor with first product word
                                            vendor_clean = normalize_vendor_name(f"{vendor_match} {product_words[0]}")
                                            product_clean = ' '.join(product_words[1:])
                                        else:
                                            # First product word is likely the product name
                                            vendor_clean = normalize_vendor_name(vendor_match)
                                            product_clean = product_match
                                    elif len(vendor_words) > 1:
                                        # Vendor already has multiple words, use as-is
                                        vendor_clean = normalize_vendor_name(vendor_match)
                                        product_clean = product_match
                                    else:
                                        # Default: use as extracted
                                        vendor_clean = normalize_vendor_name(vendor_match)
                                        product_clean = product_match
                                
                                # Second pattern: product, version, vendor
                                else:
                                    product_match = match.group(1).strip()
                                    version_match = match.group(2).strip()
                                    vendor_match = match.group(3).strip()
                                    vendor_clean = normalize_vendor_name(vendor_match)
                                    product_clean = product_match.replace("_", " ").replace("-", " ").strip()
                                
                                # Normalize and add
                                if vendor_clean:
                                    vendor_set.add(vendor_clean)
                                
                                product_clean = re.sub(r'\s+', ' ', product_clean).strip()
                                if product_clean and product_clean not in affected_products:
                                    affected_products.append(product_clean)
                                
                                # Create product detail
                                product_key = f"desc:{vendor_clean or 'unknown'}:{product_clean}:{version_match}"
                                if product_key not in product_keys_seen:
                                    product_keys_seen.add(product_key)
                                    product_info = {
                                        "vendor": vendor_clean,
                                        "product": product_clean,
                                        "version": version_match,
                                        "version_range": None,
                                        "vulnerable": True,
                                        "source": "description"
                                    }
                                    product_details.append(product_info)
                                    logger.debug(f"Extracted from description: vendor={vendor_clean}, product={product_clean}, version={version_match}")
                                    break  # Found a match, don't try other patterns
                
                # Extract from CPE configurations - do this SECOND to supplement description data
                for config in configurations:
                    nodes = config.get("nodes", [])
                    for node in nodes:
                        cpe_match = node.get("cpeMatch", [])
                        for match in cpe_match:
                            criteria = match.get("criteria", "")
                            version_start = match.get("versionStartIncluding") or match.get("versionStartExcluding")
                            version_end = match.get("versionEndIncluding") or match.get("versionEndExcluding")
                            vulnerable = match.get("vulnerable", True)
                            
                            if criteria:
                                # Parse CPE format: cpe:2.3:part:vendor:product:version:...
                                # CPE format: cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
                                parts = criteria.split(":")
                                if len(parts) >= 5:
                                    vendor_part = parts[3] if parts[3] != "*" and parts[3] != "-" else None
                                    product_part = parts[4] if parts[4] != "*" and parts[4] != "-" else None
                                    version_part = parts[5] if len(parts) > 5 and parts[5] != "*" and parts[5] != "-" else None
                                    
                                    # Normalize vendor
                                    vendor_clean = None
                                    if vendor_part:
                                        vendor_clean = normalize_vendor_name(vendor_part)
                                        if vendor_clean:
                                            vendor_set.add(vendor_clean)
                                    
                                    # Clean up product name
                                    product_clean = None
                                    if product_part:
                                        product_clean = product_part.replace("\\_", " ").replace("_", " ")
                                        product_clean = re.sub(r'([a-z])([A-Z])', r'\1 \2', product_clean)
                                        product_clean = " ".join(product_clean.split())
                                        if product_clean and product_clean not in affected_products:
                                            affected_products.append(product_clean)
                                    
                                    # Clean version
                                    version_clean = None
                                    if version_part:
                                        version_clean = version_part.replace("\\_", " ").strip()
                                    
                                    # Create detailed product info
                                    if product_clean:
                                        # Create unique key for deduplication
                                        product_key = f"{vendor_clean or 'unknown'}:{product_clean}:{version_clean or 'any'}"
                                        
                                        if product_key not in product_keys_seen:
                                            product_keys_seen.add(product_key)
                                            product_info = {
                                                "vendor": vendor_clean,
                                                "product": product_clean,
                                                "version": version_clean,
                                                "version_range": {
                                                    "start": version_start,
                                                    "end": version_end
                                                } if version_start or version_end else None,
                                                "vulnerable": vulnerable
                                            }
                                            product_details.append(product_info)
                                            logger.debug(f"Extracted from CVE {cve_id}: vendor={vendor_clean}, product={product_clean}, version={version_clean}")
                
                # Extract vendor names from references
                references = cve.get("references", [])
                for ref in references:
                    url = ref.get("url", "")
                    tags = ref.get("tags", [])
                    # Look for vendor names in URLs (common patterns)
                    if url:
                        # Extract from common vendor URL patterns
                        url_lower = url.lower()
                        # Check for common vendor domains
                        vendor_domains = {
                            "microsoft.com": "Microsoft",
                            "google.com": "Google",
                            "oracle.com": "Oracle",
                            "apache.org": "Apache",
                            "mozilla.org": "Mozilla",
                            "adobe.com": "Adobe",
                            "apple.com": "Apple",
                            "github.com": "GitHub",
                            "gitlab.com": "GitLab",
                            "redhat.com": "Red Hat",
                            "ubuntu.com": "Ubuntu",
                            "debian.org": "Debian",
                            "openssl.org": "OpenSSL",
                            "nodejs.org": "Node.js",
                            "python.org": "Python",
                            "php.net": "PHP",
                            "wordpress.org": "WordPress",
                            "drupal.org": "Drupal",
                            "jenkins.io": "Jenkins",
                            "kubernetes.io": "Kubernetes",
                            "docker.com": "Docker",
                        }
                        for domain, vendor_name in vendor_domains.items():
                            if domain in url_lower:
                                vendor_set.add(vendor_name)
                
                # Extract vendor and product names from description (enhanced patterns)
                if description:
                    desc_lower = description.lower()
                    
                    # Enhanced vendor extraction patterns
                    vendor_patterns = [
                        # "in [Vendor] [Product]" or "in [Vendor]'s [Product]"
                        r"in\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s+(?:software|product|application|library|framework|system|platform|service|tool|component|package|module)|'s)",
                        # "from [Vendor]" or "from [Vendor] [Product]"
                        r"from\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s+(?:software|product|application|library|framework|system|platform|service|tool|component|package|module)|\.|,|$)",
                        # "[Vendor] [Product]" at start of sentence
                        r"^([A-Z][a-zA-Z0-9\s&]+?)\s+(?:software|product|application|library|framework|system|platform|service|tool|component|package|module)",
                        # "[Vendor] allows" or "[Vendor] contains"
                        r"([A-Z][a-zA-Z0-9\s&]+?)\s+(?:allows|contains|has|enables|provides|supports)",
                        # Common vendor patterns: "[Vendor] Inc", "[Vendor] Corp", "[Vendor] LLC", "[Vendor] Corporation"
                        r"([A-Z][a-zA-Z0-9\s&]+?)\s+(?:Inc|LLC|Corp|Corporation|Ltd|Limited|GmbH|AG|SA|S\.A\.|S\.L\.)",
                    ]
                    
                    for pattern in vendor_patterns:
                        matches = re.findall(pattern, description, re.IGNORECASE | re.MULTILINE)
                        for match in matches:
                            if isinstance(match, tuple):
                                match = match[0] if match else ""
                            match = match.strip()
                            # Filter out common false positives
                            skip_terms = ["the", "this", "that", "these", "those", "a", "an", "all", "any", "some", "each", "every"]
                            if (match and len(match) > 2 and len(match) < 50 and 
                                match.lower() not in skip_terms and
                                not match.lower().startswith(("version", "vulnerability", "issue", "problem", "bug", "flaw"))):
                                vendor_clean = normalize_vendor_name(match)
                                if vendor_clean:
                                    vendor_set.add(vendor_clean)
                    
                    # Enhanced product extraction patterns
                    product_patterns = [
                        # "[Product] [Version]" pattern (e.g., "DashBoard 8.5.1")
                        r"([A-Z][a-zA-Z0-9\s\-_]+?)\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?)",
                        # "[Product] version [Version]" or "[Product] v[Version]"
                        r"([A-Z][a-zA-Z0-9\s\-_]+?)\s+(?:version|v\.?|ver\.?)\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?)",
                        # "[Vendor] [Product]" - extract product part
                        r"(?:^|in|from|by)\s+[A-Z][a-zA-Z0-9\s&]+?\s+([A-Z][a-zA-Z0-9\s\-_]+?)(?:\s+(?:version|v\.?|ver\.?|allows|contains|has|enables|provides|supports|\.|,|$))",
                        # Standalone product names (capitalized, not common words)
                        r"\b([A-Z][a-zA-Z0-9]+(?:[\s\-_][A-Z][a-zA-Z0-9]+)*)\b",
                    ]
                    
                    # Extract products with versions
                    for pattern in product_patterns[:2]:  # Version-specific patterns first
                        matches = re.findall(pattern, description, re.IGNORECASE | re.MULTILINE)
                        for match in matches:
                            if isinstance(match, tuple):
                                product_name = match[0].strip() if match[0] else ""
                                version = match[1].strip() if len(match) > 1 and match[1] else None
                            else:
                                product_name = match.strip() if match else ""
                                version = None
                            
                            if product_name and len(product_name) > 2 and len(product_name) < 100:
                                # Clean product name
                                product_clean = product_name.replace("_", " ").replace("-", " ").strip()
                                product_clean = re.sub(r'\s+', ' ', product_clean)
                                
                                # Skip if it's a common word or too generic
                                skip_products = ["version", "vulnerability", "issue", "problem", "bug", "flaw", "attack", "exploit", "malware"]
                                if product_clean.lower() not in skip_products:
                                    # Add to affected_products if not already there
                                    if product_clean not in affected_products:
                                        affected_products.append(product_clean)
                                    
                                    # Create product detail entry if we have version
                                    if version:
                                        product_key = f"desc:{product_clean}:{version}"
                                        if product_key not in product_keys_seen:
                                            product_keys_seen.add(product_key)
                                            # Try to find matching vendor from description context
                                            vendor_from_desc = None
                                            # Look for vendor before product in nearby text
                                            product_pos = description.lower().find(product_clean.lower())
                                            if product_pos > 0:
                                                context = description[max(0, product_pos-100):product_pos]
                                                for vendor in vendor_set:
                                                    if vendor.lower() in context.lower():
                                                        vendor_from_desc = vendor
                                                        break
                                            
                                            product_info = {
                                                "vendor": vendor_from_desc,
                                                "product": product_clean,
                                                "version": version,
                                                "version_range": None,
                                                "vulnerable": True,
                                                "source": "description"  # Mark as extracted from description
                                            }
                                            product_details.append(product_info)
                                            logger.debug(f"Extracted from description: vendor={vendor_from_desc}, product={product_clean}, version={version}")
                    
                    # Extract standalone product names (without versions)
                    for pattern in product_patterns[2:]:
                        matches = re.findall(pattern, description, re.IGNORECASE | re.MULTILINE)
                        for match in matches:
                            if isinstance(match, tuple):
                                product_name = match[0].strip() if match[0] else ""
                            else:
                                product_name = match.strip() if match else ""
                            
                            if product_name and len(product_name) > 2 and len(product_name) < 100:
                                product_clean = product_name.replace("_", " ").replace("-", " ").strip()
                                product_clean = re.sub(r'\s+', ' ', product_clean)
                                
                                # Skip common words and generic terms
                                skip_products = ["version", "vulnerability", "issue", "problem", "bug", "flaw", "attack", "exploit", 
                                                "malware", "the", "this", "that", "these", "those", "a", "an", "all", "any", "some"]
                                if (product_clean.lower() not in skip_products and
                                    product_clean not in affected_products and
                                    not product_clean.lower().startswith(("version", "vulnerability", "issue"))):
                                    affected_products.append(product_clean)
                                    
                                    # Try to create product detail without version
                                    product_key = f"desc:{product_clean}:no-version"
                                    if product_key not in product_keys_seen:
                                        product_keys_seen.add(product_key)
                                        # Try to find matching vendor
                                        vendor_from_desc = None
                                        product_pos = description.lower().find(product_clean.lower())
                                        if product_pos > 0:
                                            context = description[max(0, product_pos-100):product_pos]
                                            for vendor in vendor_set:
                                                if vendor.lower() in context.lower():
                                                    vendor_from_desc = vendor
                                                    break
                                        
                                        product_info = {
                                            "vendor": vendor_from_desc,
                                            "product": product_clean,
                                            "version": None,
                                            "version_range": None,
                                            "vulnerable": True,
                                            "source": "description"
                                        }
                                        product_details.append(product_info)
                
                # Extract from vendor comments if available
                vendor_comments = cve.get("vendorComments", [])
                for comment in vendor_comments:
                    organization = comment.get("organization", "")
                    if organization:
                        vendor_set.add(organization)
                
                # Extract solutions, workarounds, and remediation information
                solutions = []
                workarounds = []
                remediation_info = {}
                
                # Extract from vendor comments (often contains solutions/workarounds)
                vendor_comments = cve.get("vendorComments", [])
                for comment in vendor_comments:
                    comment_text = comment.get("comment", "")
                    organization = comment.get("organization", "")
                    last_modified = comment.get("lastModified", "")
                    
                    if comment_text:
                        # Check if it's a solution or workaround
                        comment_lower = comment_text.lower()
                        if any(keyword in comment_lower for keyword in ["fix", "patch", "update", "upgrade", "solution", "remediation"]):
                            solutions.append({
                                "text": comment_text,
                                "organization": organization,
                                "last_modified": last_modified
                            })
                        elif any(keyword in comment_lower for keyword in ["workaround", "mitigation", "temporary"]):
                            workarounds.append({
                                "text": comment_text,
                                "organization": organization,
                                "last_modified": last_modified
                            })
                        else:
                            # General vendor comment
                            remediation_info["vendor_comment"] = {
                                "text": comment_text,
                                "organization": organization,
                                "last_modified": last_modified
                            }
                
                # Extract solution information from references
                # Look for patch/fix/advisory URLs
                patch_urls = []
                advisory_urls = []
                for ref in references:
                    url = ref.get("url", "")
                    tags = ref.get("tags", [])
                    ref_text = ref.get("refsource", "")
                    
                    url_lower = url.lower()
                    # Identify patch/fix URLs
                    if any(keyword in url_lower for keyword in ["patch", "fix", "update", "security-update", "security-update"]):
                        patch_urls.append({
                            "url": url,
                            "tags": tags,
                            "source": ref_text
                        })
                    # Identify advisory URLs
                    elif any(keyword in url_lower for keyword in ["advisory", "bulletin", "security-advisory", "cve"]):
                        advisory_urls.append({
                            "url": url,
                            "tags": tags,
                            "source": ref_text
                        })
                
                # Extract solution information from description
                if description:
                    desc_lower = description.lower()
                    # Look for solution patterns in description
                    solution_patterns = [
                        r"(?:fix|patch|update|upgrade|solution).*?version\s+([0-9.]+)",
                        r"update\s+to\s+version\s+([0-9.]+)",
                        r"upgrade\s+to\s+([0-9.]+)",
                        r"patch\s+([0-9.]+)",
                    ]
                    for pattern in solution_patterns:
                        matches = re.findall(pattern, description, re.IGNORECASE)
                        if matches:
                            remediation_info["recommended_version"] = matches[0] if isinstance(matches[0], str) else matches[0][0]
                            break
                
                # Convert vendor_set to list after all extractions are complete
                affected_vendors = []
                for vendor in vendor_set:
                    # Skip generic terms
                    skip_terms = ["unknown", "n/a", "none", "various", "multiple", "other", ""]
                    vendor_lower = vendor.lower().strip()
                    if vendor_lower and vendor_lower not in skip_terms:
                        affected_vendors.append(vendor)
                
                # Log extraction results for debugging
                if affected_vendors or affected_products or product_details:
                    logger.info(f"CVE {cve_id} - Extracted: {len(affected_vendors)} vendors, {len(affected_products)} products, {len(product_details)} product details")
                    if affected_vendors:
                        logger.debug(f"  Vendors: {', '.join(affected_vendors)}")
                    if affected_products:
                        logger.debug(f"  Products: {', '.join(affected_products[:5])}")  # First 5
                    if product_details:
                        logger.debug(f"  Product details: {len(product_details)} entries")
                
                # Extract published date
                published_date = None
                published = cve.get("published")
                if published:
                    try:
                        published_date = datetime.fromisoformat(published.replace("Z", "+00:00"))
                    except:
                        pass
                
                # Create security incident
                incident = SecurityIncident(
                    tenant_id=tenant_id,
                    incident_type=IncidentType.CVE,
                    external_id=cve_id,
                    title=f"{cve_id}: {description[:200]}" if description else cve_id,
                    description=description,
                    severity=severity,
                    cvss_score=cvss_score,
                    cvss_vector=cvss_vector,
                    affected_products=list(set(affected_products)) if affected_products else None,
                    affected_vendors=list(set(affected_vendors)) if affected_vendors else None,
                    source="NVD",
                    source_url=f"https://nvd.nist.gov/vuln/detail/{cve_id}",
                    published_date=published_date,
                    incident_metadata={
                        "cve_id": cve_id,
                        "solutions": solutions if solutions else None,
                        "workarounds": workarounds if workarounds else None,
                        "remediation_info": remediation_info if remediation_info else None,
                        "product_details": product_details if product_details else None,
                        "patch_urls": patch_urls if patch_urls else None,
                        "advisory_urls": advisory_urls if advisory_urls else None,
                        "raw_cve_data": cve
                    },
                    status="active"
                )
                
                self.db.add(incident)
                created_incidents.append(incident)
            
            self.db.commit()
            logger.info(f"Created {len(created_incidents)} new CVE incidents")
            
        except Exception as e:
            logger.error(f"Error scanning CVEs: {str(e)}", exc_info=True)
            self.db.rollback()
        
        return created_incidents
    
    def get_cve_details(self, cve_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific CVE
        
        Args:
            cve_id: CVE identifier (e.g., "CVE-2024-12345")
        
        Returns:
            CVE details dictionary or None
        """
        try:
            response = requests.get(
                f"{self.NVD_API_BASE}?cveId={cve_id}",
                timeout=30,
                headers={"User-Agent": "VAKA-Security-Monitoring/1.0"}
            )
            
            if response.status_code == 200:
                data = response.json()
                vulnerabilities = data.get("vulnerabilities", [])
                if vulnerabilities:
                    return vulnerabilities[0].get("cve", {})
        except Exception as e:
            logger.error(f"Error fetching CVE details for {cve_id}: {str(e)}")
        
        return None

