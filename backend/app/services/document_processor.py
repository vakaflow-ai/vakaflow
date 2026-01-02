"""
Document processing service for agent artifacts
"""
import os
import mimetypes
from typing import List, Dict, Optional
from pathlib import Path
import logging
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Process documents and extract text for RAG ingestion"""
    
    # Supported file types
    SUPPORTED_TYPES = {
        'text/plain': '.txt',
        'text/markdown': '.md',
        'text/csv': '.csv',
        'application/pdf': '.pdf',
        'application/json': '.json',
        'text/x-python': '.py',
        'text/javascript': '.js',
        'text/typescript': '.ts',
        'application/xml': '.xml',
        'text/html': '.html',
    }
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    async def process_file(
        self,
        file_path: str,
        agent_id: str,
        document_type: str,
        metadata: Optional[Dict] = None
    ) -> List[str]:
        """
        Process a file and extract text chunks
        
        Args:
            file_path: Path to the file
            document_type: Type of document
            metadata: Additional metadata
        
        Returns:
            List of text chunks
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size > self.MAX_FILE_SIZE:
            raise ValueError(f"File too large: {file_size} bytes (max: {self.MAX_FILE_SIZE})")
        
        # Detect file type
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            # Try extension-based detection
            ext = Path(file_path).suffix.lower()
            mime_type = mimetypes.types_map.get(ext, 'text/plain')
        
        # Extract text based on file type
        if mime_type == 'text/plain' or mime_type == 'text/markdown':
            return await self._process_text_file(file_path)
        elif mime_type == 'application/json':
            return await self._process_json_file(file_path)
        elif mime_type == 'application/pdf':
            return await self._process_pdf_file(file_path)
        elif mime_type in ['text/x-python', 'text/javascript', 'text/typescript']:
            return await self._process_code_file(file_path)
        else:
            # Default: try as text
            logger.warning(f"Unknown file type {mime_type}, processing as text")
            return await self._process_text_file(file_path)
    
    async def _process_text_file(self, file_path: str) -> List[str]:
        """Process plain text or markdown file"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        return self._chunk_text(content)
    
    async def _process_json_file(self, file_path: str) -> List[str]:
        """Process JSON file"""
        import json
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Convert JSON to readable text
        content = json.dumps(data, indent=2)
        return self._chunk_text(content)
    
    async def _process_pdf_file(self, file_path: str) -> List[str]:
        """Process PDF file"""
        # TODO: Implement PDF parsing (requires PyPDF2 or pdfplumber)
        # For now, return placeholder
        logger.warning("PDF processing not yet implemented")
        return ["PDF content extraction not yet implemented"]
    
    async def _process_code_file(self, file_path: str) -> List[str]:
        """Process code file"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        # For code files, chunk by functions/classes
        return self._chunk_code(content)
    
    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Chunk text into smaller pieces
        
        Args:
            text: Text to chunk
            chunk_size: Size of each chunk
            overlap: Overlap between chunks
        
        Returns:
            List of text chunks
        """
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence endings
                for i in range(end, max(start, end - 100), -1):
                    if text[i] in '.!?\n':
                        end = i + 1
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - overlap
        
        return chunks
    
    def _chunk_code(self, code: str, chunk_size: int = 500) -> List[str]:
        """Chunk code by functions/classes"""
        # Simple chunking for now - can be enhanced with AST parsing
        return self._chunk_text(code, chunk_size=chunk_size, overlap=50)
    
    async def ingest_artifact(
        self,
        agent_id: str,
        artifact_id: str,
        file_path: str,
        document_type: str,
        metadata: Optional[Dict] = None
    ) -> int:
        """
        Process and ingest an artifact file
        
        Returns:
            Number of chunks ingested
        """
        try:
            # Process file into chunks
            chunks = await self.process_file(file_path, agent_id, document_type, metadata)
            
            # Ingest each chunk
            ingested_count = 0
            for i, chunk in enumerate(chunks):
                chunk_metadata = {
                    **(metadata or {}),
                    "artifact_id": artifact_id,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
                
                await rag_service.ingest_document(
                    agent_id=agent_id,
                    document_type=document_type,
                    content=chunk,
                    metadata=chunk_metadata
                )
                ingested_count += 1
            
            logger.info(f"Ingested {ingested_count} chunks from {file_path}")
            return ingested_count
            
        except Exception as e:
            error_msg = str(e)
            logger.error(
                f"Error ingesting artifact: {error_msg} - "
                f"Agent ID: {agent_id} - Artifact ID: {artifact_id} - "
                f"File: {file_path} - Type: {document_type}",
                exc_info=True  # This includes full traceback with timestamps
            )
            # Don't raise - allow upload to succeed even if RAG ingestion fails
            # This prevents blocking artifact uploads due to RAG issues
            return 0


# Global instance
document_processor = DocumentProcessor()

