"""
RAG (Retrieval-Augmented Generation) service for agent knowledge base
"""
from typing import List, Dict, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import hashlib
import json
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class RAGService:
    """Service for RAG operations with Qdrant"""
    
    def __init__(self):
        """Initialize Qdrant client"""
        try:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
            )
            self.collection_name = "agent_knowledge_base"
            self._ensure_collection_exists()
            logger.info("RAG service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize RAG service: {e}")
            self.client = None
    
    def _ensure_collection_exists(self):
        """Ensure the collection exists in Qdrant"""
        if not self.client:
            return
        
        try:
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            if self.collection_name not in collection_names:
                # Create collection with 384-dimensional vectors (sentence-transformers default)
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=384,  # Default for all-MiniLM-L6-v2
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"Created collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Error ensuring collection exists: {e}")
    
    def _generate_document_id(self, agent_id: str, document_type: str, content_hash: str) -> str:
        """Generate a unique document ID"""
        combined = f"{agent_id}:{document_type}:{content_hash}"
        return hashlib.sha256(combined.encode()).hexdigest()
    
    async def ingest_document(
        self,
        agent_id: str,
        document_type: str,
        content: str,
        metadata: Optional[Dict] = None,
        embedding: Optional[List[float]] = None
    ) -> str:
        """
        Ingest a document into the knowledge base
        
        Args:
            agent_id: ID of the agent
            document_type: Type of document (e.g., 'description', 'documentation', 'code')
            content: Text content of the document
            metadata: Additional metadata
            embedding: Pre-computed embedding (if None, will be generated)
        
        Returns:
            Document ID
        """
        if not self.client:
            raise Exception("RAG service not initialized")
        
        # Generate content hash
        content_hash = hashlib.md5(content.encode()).hexdigest()
        doc_id = self._generate_document_id(agent_id, document_type, content_hash)
        
        # Generate embedding if not provided
        if embedding is None:
            embedding = await self._generate_embedding(content)
        
        # Prepare metadata - Qdrant only supports specific types
        # Convert all values to Qdrant-compatible types (str, int, float, bool, list, dict)
        def sanitize_metadata(value):
            """Convert metadata values to Qdrant-compatible types"""
            from datetime import datetime, date
            import uuid
            
            if value is None:
                return None
            elif isinstance(value, (str, int, float, bool)):
                return value
            elif isinstance(value, (datetime, date)):
                # Convert datetime/date to ISO format string
                return value.isoformat() if isinstance(value, datetime) else str(value)
            elif isinstance(value, uuid.UUID):
                return str(value)
            elif isinstance(value, (list, tuple)):
                return [sanitize_metadata(item) for item in value]
            elif isinstance(value, dict):
                return {k: sanitize_metadata(v) for k, v in value.items()}
            else:
                # Convert other types to string
                return str(value)
        
        base_metadata = {
            "agent_id": str(agent_id),
            "document_type": str(document_type),
            "content_hash": str(content_hash),
            "content": str(content[:1000]) if content else "",  # Store first 1000 chars for preview
        }
        
        # Merge and sanitize additional metadata
        additional_metadata = {}
        if metadata:
            for key, value in metadata.items():
                sanitized_value = sanitize_metadata(value)
                if sanitized_value is not None:
                    additional_metadata[str(key)] = sanitized_value
        
        doc_metadata = {**base_metadata, **additional_metadata}
        
        # Upsert point
        try:
            point = PointStruct(
                id=doc_id,
                vector=embedding,
                payload=doc_metadata
            )
            
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
        except Exception as e:
            logger.error(
                f"Qdrant upsert error: {e} - "
                f"Agent ID: {agent_id} - Document Type: {document_type} - "
                f"Metadata keys: {list(doc_metadata.keys())} - "
                f"Content length: {len(content)}",
                exc_info=True  # Include full traceback
            )
            # Try with minimal metadata if full metadata fails
            minimal_metadata = {
                "agent_id": str(agent_id),
                "document_type": str(document_type),
                "content_hash": str(content_hash),
            }
            point = PointStruct(
                id=doc_id,
                vector=embedding,
                payload=minimal_metadata
            )
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            logger.warning(f"Ingested with minimal metadata due to error")
        
        logger.info(f"Ingested document {doc_id} for agent {agent_id}")
        return doc_id
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using production embedding service
        """
        from app.services.embedding_service import embedding_service
        return await embedding_service.generate_embedding(text)
    
    async def search(
        self,
        query: str,
        agent_id: Optional[str] = None,
        limit: int = 5,
        score_threshold: float = 0.7
    ) -> List[Dict]:
        """
        Search the knowledge base
        
        Args:
            query: Search query
            agent_id: Filter by agent ID (optional)
            limit: Maximum number of results
            score_threshold: Minimum similarity score
        
        Returns:
            List of matching documents with scores
        """
        if not self.client:
            raise Exception("RAG service not initialized")
        
        # Generate query embedding
        query_embedding = await self._generate_embedding(query)
        
        # Build filter
        filter_condition = None
        if agent_id:
            filter_condition = {
                "must": [
                    {"key": "agent_id", "match": {"value": agent_id}}
                ]
            }
        
        # Search
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            query_filter=filter_condition,
            limit=limit,
            score_threshold=score_threshold
        )
        
        # Format results
        formatted_results = []
        for result in results:
            formatted_results.append({
                "id": result.id,
                "score": result.score,
                "metadata": result.payload,
                "content": result.payload.get("content", "")
            })
        
        return formatted_results
    
    async def get_agent_knowledge(self, agent_id: str) -> List[Dict]:
        """Get all knowledge for a specific agent"""
        if not self.client:
            return []
        
        try:
            # Scroll through all points for this agent
            results = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter={
                    "must": [
                        {"key": "agent_id", "match": {"value": agent_id}}
                    ]
                },
                limit=100
            )
            
            return [
                {
                    "id": point.id,
                    "metadata": point.payload,
                    "content": point.payload.get("content", "")
                }
                for point in results[0]
            ]
        except Exception as e:
            logger.error(f"Error getting agent knowledge: {e}")
            return []
    
    async def delete_agent_knowledge(self, agent_id: str) -> bool:
        """Delete all knowledge for a specific agent"""
        if not self.client:
            return False
        
        try:
            # Get all points for this agent
            results = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter={
                    "must": [
                        {"key": "agent_id", "match": {"value": agent_id}}
                    ]
                },
                limit=1000
            )
            
            if results[0]:
                point_ids = [point.id for point in results[0]]
                self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=point_ids
                )
                logger.info(f"Deleted {len(point_ids)} documents for agent {agent_id}")
            
            return True
        except Exception as e:
            logger.error(f"Error deleting agent knowledge: {e}")
            return False


# Global instance
rag_service = RAGService()

