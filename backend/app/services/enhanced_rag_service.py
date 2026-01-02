"""
Enhanced RAG Service with query expansion, reranking, and citations
"""
from typing import List, Dict, Optional, Tuple
from app.services.rag_service import rag_service, RAGService
import logging

logger = logging.getLogger(__name__)


class EnhancedRAGService:
    """Enhanced RAG service with advanced features"""
    
    def __init__(self, base_rag_service: RAGService = None):
        """Initialize enhanced RAG service"""
        self.rag_service = base_rag_service or rag_service
    
    def expand_query(self, query: str) -> List[str]:
        """
        Expand a query into multiple related queries
        
        Args:
            query: Original query
        
        Returns:
            List of expanded queries
        """
        expanded = [query]  # Always include original
        
        # Simple query expansion strategies
        # In production, use LLM or synonym expansion
        
        # Add variations
        if "compliance" in query.lower():
            expanded.append(query.replace("compliance", "regulatory requirements"))
            expanded.append(query.replace("compliance", "policy adherence"))
        
        if "security" in query.lower():
            expanded.append(query.replace("security", "vulnerability"))
            expanded.append(query.replace("security", "threat"))
        
        if "review" in query.lower():
            expanded.append(query.replace("review", "assessment"))
            expanded.append(query.replace("review", "evaluation"))
        
        # Add question variations
        if "?" not in query:
            expanded.append(f"What are {query}?")
            expanded.append(f"How to {query}?")
        
        return expanded[:5]  # Limit to 5 queries
    
    def rerank_results(
        self,
        results: List[Dict],
        query: str,
        agent_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Rerank search results using multiple signals
        
        Args:
            results: Initial search results
            query: Original query
            agent_id: Optional agent ID for context
        
        Returns:
            Reranked results with updated scores
        """
        if not results:
            return results
        
        reranked = []
        for result in results:
            score = result.get("score", 0.0)
            
            # Boost score based on various factors
            metadata = result.get("metadata", {})
            
            # Boost if document type matches query intent
            doc_type = metadata.get("document_type", "")
            if "compliance" in query.lower() and "compliance" in doc_type.lower():
                score += 0.1
            if "security" in query.lower() and "security" in doc_type.lower():
                score += 0.1
            if "technical" in query.lower() and "technical" in doc_type.lower():
                score += 0.1
            
            # Boost if agent_id matches (if provided)
            if agent_id and metadata.get("agent_id") == agent_id:
                score += 0.15
            
            # Boost based on content length (longer content often more informative)
            content = result.get("content", "")
            if len(content) > 500:
                score += 0.05
            
            # Normalize score to [0, 1]
            score = min(1.0, max(0.0, score))
            
            reranked.append({
                **result,
                "score": score,
                "original_score": result.get("score", 0.0)
            })
        
        # Sort by new score
        reranked.sort(key=lambda x: x["score"], reverse=True)
        return reranked
    
    def generate_citations(self, results: List[Dict]) -> List[Dict]:
        """
        Generate citations for search results
        
        Args:
            results: Search results
        
        Returns:
            Results with citations
        """
        cited_results = []
        for idx, result in enumerate(results, 1):
            metadata = result.get("metadata", {})
            
            citation = {
                "id": f"citation-{idx}",
                "number": idx,
                "source": metadata.get("document_type", "document"),
                "agent_id": metadata.get("agent_id"),
                "content_hash": metadata.get("content_hash"),
                "excerpt": result.get("content", "")[:200] + "..." if len(result.get("content", "")) > 200 else result.get("content", "")
            }
            
            cited_results.append({
                **result,
                "citation": citation
            })
        
        return cited_results
    
    async def enhanced_search(
        self,
        query: str,
        agent_id: Optional[str] = None,
        limit: int = 5,
        score_threshold: float = 0.5,
        use_query_expansion: bool = True,
        use_reranking: bool = True,
        include_citations: bool = True
    ) -> Dict[str, any]:
        """
        Enhanced search with query expansion, reranking, and citations
        
        Args:
            query: Search query
            agent_id: Filter by agent ID (optional)
            limit: Maximum number of results
            score_threshold: Minimum similarity score
            use_query_expansion: Whether to expand the query
            use_reranking: Whether to rerank results
            include_citations: Whether to include citations
        
        Returns:
            Enhanced search results with metadata
        """
        # Step 1: Query expansion
        queries = [query]
        if use_query_expansion:
            expanded = self.expand_query(query)
            queries = expanded[:3]  # Use top 3 expanded queries
        
        # Step 2: Multi-query search
        all_results = []
        seen_ids = set()
        
        for q in queries:
            try:
                results = await self.rag_service.search(
                    query=q,
                    agent_id=agent_id,
                    limit=limit * 2,  # Get more results for reranking
                    score_threshold=score_threshold
                )
                
                # Deduplicate by document ID
                for result in results:
                    doc_id = result.get("id")
                    if doc_id and doc_id not in seen_ids:
                        seen_ids.add(doc_id)
                        all_results.append(result)
            except Exception as e:
                logger.error(f"Error in query expansion search: {e}")
                # Fallback to original query
                if q == query:
                    results = await self.rag_service.search(
                        query=query,
                        agent_id=agent_id,
                        limit=limit,
                        score_threshold=score_threshold
                    )
                    all_results = results
                    break
        
        # Step 3: Reranking
        if use_reranking and all_results:
            all_results = self.rerank_results(all_results, query, agent_id)
        
        # Step 4: Limit results
        final_results = all_results[:limit]
        
        # Step 5: Generate citations
        if include_citations:
            final_results = self.generate_citations(final_results)
        
        # Return enhanced results
        return {
            "query": query,
            "expanded_queries": queries if use_query_expansion else [query],
            "total_results": len(all_results),
            "returned_results": len(final_results),
            "results": final_results,
            "metadata": {
                "query_expansion_used": use_query_expansion,
                "reranking_used": use_reranking,
                "citations_included": include_citations
            }
        }
    
    async def search_with_context(
        self,
        query: str,
        context: Dict[str, any],
        agent_id: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, any]:
        """
        Search with additional context for better results
        
        Args:
            query: Search query
            context: Additional context (e.g., agent type, category, stage)
            agent_id: Filter by agent ID (optional)
            limit: Maximum number of results
        
        Returns:
            Context-aware search results
        """
        # Enhance query with context
        enhanced_query = query
        
        if context.get("agent_type"):
            enhanced_query += f" for {context['agent_type']} agent"
        
        if context.get("category"):
            enhanced_query += f" in {context['category']} category"
        
        if context.get("review_stage"):
            enhanced_query += f" for {context['review_stage']} review"
        
        # Perform enhanced search
        return await self.enhanced_search(
            query=enhanced_query,
            agent_id=agent_id,
            limit=limit,
            use_query_expansion=True,
            use_reranking=True,
            include_citations=True
        )


# Global instance
enhanced_rag_service = EnhancedRAGService()

