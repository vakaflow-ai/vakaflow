"""
Production embedding service
"""
from typing import List, Optional
import logging
import os

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating embeddings using production models"""
    
    def __init__(self):
        """Initialize embedding service"""
        self.model_name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load embedding model"""
        try:
            # Try to use sentence-transformers if available
            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer(self.model_name)
                logger.info(f"Loaded embedding model: {self.model_name}")
            except ImportError:
                logger.warning("sentence-transformers not installed, using placeholder")
                self.model = None
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.model = None
    
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text
        
        Args:
            text: Text to embed
        
        Returns:
            Embedding vector
        """
        if self.model:
            try:
                # Use sentence-transformers
                embedding = self.model.encode(text, normalize_embeddings=True)
                return embedding.tolist()
            except Exception as e:
                logger.error(f"Embedding generation failed: {e}")
                # Fallback to placeholder
                return await self._generate_placeholder_embedding(text)
        else:
            # Fallback to placeholder
            return await self._generate_placeholder_embedding(text)
    
    async def _generate_placeholder_embedding(self, text: str) -> List[float]:
        """Generate placeholder embedding (fallback)"""
        import hashlib
        hash_obj = hashlib.sha256(text.encode())
        hash_bytes = hash_obj.digest()
        
        # Convert to 384-dimensional vector
        embedding = []
        for i in range(384):
            byte_val = hash_bytes[i % len(hash_bytes)]
            embedding.append((byte_val / 255.0) * 2 - 1)
        
        return embedding
    
    async def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
        
        Returns:
            List of embedding vectors
        """
        if self.model:
            try:
                embeddings = self.model.encode(texts, normalize_embeddings=True)
                return embeddings.tolist()
            except Exception as e:
                logger.error(f"Batch embedding generation failed: {e}")
                # Fallback
                return [await self._generate_placeholder_embedding(text) for text in texts]
        else:
            return [await self._generate_placeholder_embedding(text) for text in texts]


# Global instance
embedding_service = EmbeddingService()

