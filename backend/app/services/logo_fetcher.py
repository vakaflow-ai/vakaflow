"""
Service to fetch logo from website
"""
import re
import httpx
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class LogoFetcher:
    """Service to fetch logo from website"""
    
    @staticmethod
    def normalize_url(url: str) -> str:
        """Normalize URL - add http:// if missing, handle www."""
        url = url.strip()
        if not url:
            return url
        
        # Remove trailing slash
        url = url.rstrip('/')
        
        # If no protocol, add http://
        if not url.startswith(('http://', 'https://')):
            # If starts with www., add http://
            if url.startswith('www.'):
                url = f"http://{url}"
            else:
                url = f"http://{url}"
        
        return url
    
    @staticmethod
    async def fetch_logo_from_website(website_url: str, timeout: int = 10) -> Optional[str]:
        """
        Fetch logo URL from website
        
        Returns:
            Logo URL if found, None otherwise
        """
        try:
            # Normalize URL
            website_url = LogoFetcher.normalize_url(website_url)
            
            # Parse URL
            parsed = urlparse(website_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            
            logger.info(f"Fetching logo from {website_url}")
            
            # Fetch the page
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                try:
                    response = await client.get(website_url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    response.raise_for_status()
                    html = response.text
                except httpx.HTTPError as e:
                    logger.warning(f"Failed to fetch {website_url}: {e}")
                    return None
            
            # Parse HTML
            soup = BeautifulSoup(html, 'html.parser')
            
            # Try multiple methods to find logo
            
            # Method 1: Look for favicon in <link> tags
            favicon_url = None
            for link in soup.find_all('link', rel=True):
                rel = link.get('rel', [])
                if isinstance(rel, list):
                    rel = ' '.join(rel)
                rel = rel.lower()
                
                if 'icon' in rel or 'shortcut' in rel:
                    href = link.get('href')
                    if href:
                        favicon_url = urljoin(base_url, href)
                        # Prefer larger icons (apple-touch-icon, etc.)
                        if 'apple-touch-icon' in rel or 'icon' in rel:
                            break
            
            # Method 2: Look for Open Graph image
            og_image = None
            og_tag = soup.find('meta', property='og:image')
            if og_tag:
                og_image = og_tag.get('content')
                if og_image:
                    og_image = urljoin(base_url, og_image)
            
            # Method 3: Look for logo in common locations
            logo_url = None
            logo_selectors = [
                'img[class*="logo"]',
                'img[id*="logo"]',
                'img[alt*="logo" i]',
                'img[alt*="brand" i]',
                '.logo img',
                '#logo img',
                'header img',
                'nav img'
            ]
            
            for selector in logo_selectors:
                img = soup.select_one(selector)
                if img and img.get('src'):
                    src = img.get('src')
                    if src:
                        logo_url = urljoin(base_url, src)
                        # Prefer larger images (check width/height)
                        width = img.get('width')
                        height = img.get('height')
                        if width and height:
                            try:
                                w, h = int(width), int(height)
                                if w >= 100 and h >= 100:  # Prefer larger logos
                                    break
                            except (ValueError, TypeError):
                                pass
                        break
            
            # Method 4: Try common logo paths
            if not logo_url:
                common_paths = [
                    '/logo.png',
                    '/logo.svg',
                    '/logo.jpg',
                    '/images/logo.png',
                    '/images/logo.svg',
                    '/assets/logo.png',
                    '/assets/logo.svg',
                    '/static/logo.png',
                    '/static/logo.svg',
                    '/favicon.ico',
                    '/favicon.png'
                ]
                
                for path in common_paths:
                    test_url = urljoin(base_url, path)
                    try:
                        async with httpx.AsyncClient(timeout=5) as test_client:
                            test_response = await test_client.head(test_url)
                            if test_response.status_code == 200:
                                content_type = test_response.headers.get('content-type', '')
                                if 'image' in content_type:
                                    logo_url = test_url
                                    break
                    except:
                        continue
            
            # Priority: og:image > logo img > favicon
            result = og_image or logo_url or favicon_url
            
            if result:
                logger.info(f"Found logo: {result}")
                return result
            else:
                logger.warning(f"No logo found for {website_url}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching logo from {website_url}: {e}", exc_info=True)
            return None
    
    @staticmethod
    async def download_logo(logo_url: str, tenant_id: str, timeout: int = 10) -> Optional[Tuple[str, bytes]]:
        """
        Download logo image and return (filename, content)
        
        Returns:
            Tuple of (filename, content) if successful, None otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(logo_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                response.raise_for_status()
                
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'image' not in content_type:
                    logger.warning(f"URL {logo_url} is not an image (content-type: {content_type})")
                    return None
                
                # Determine file extension
                ext_map = {
                    'image/png': '.png',
                    'image/jpeg': '.jpg',
                    'image/jpg': '.jpg',
                    'image/gif': '.gif',
                    'image/webp': '.webp',
                    'image/svg+xml': '.svg',
                    'image/x-icon': '.ico'
                }
                
                ext = ext_map.get(content_type.split(';')[0].strip(), '.png')
                
                # Or try to get from URL
                if ext == '.png':
                    parsed = urlparse(logo_url)
                    path = parsed.path.lower()
                    if path.endswith('.svg'):
                        ext = '.svg'
                    elif path.endswith('.jpg') or path.endswith('.jpeg'):
                        ext = '.jpg'
                    elif path.endswith('.gif'):
                        ext = '.gif'
                    elif path.endswith('.webp'):
                        ext = '.webp'
                    elif path.endswith('.ico'):
                        ext = '.ico'
                
                filename = f"logo{ext}"
                content = response.content
                
                # Validate size (max 5MB)
                if len(content) > 5 * 1024 * 1024:
                    logger.warning(f"Logo too large: {len(content)} bytes")
                    return None
                
                logger.info(f"Downloaded logo: {filename}, size: {len(content)} bytes")
                return (filename, content)
                
        except Exception as e:
            logger.error(f"Error downloading logo from {logo_url}: {e}", exc_info=True)
            return None

