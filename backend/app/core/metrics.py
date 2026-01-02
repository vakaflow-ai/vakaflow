"""
Prometheus metrics
"""
from prometheus_client import Counter, Histogram, Gauge
import time

# Request metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

# Business metrics
agents_total = Gauge('agents_total', 'Total number of agents', ['status'])
reviews_total = Gauge('reviews_total', 'Total number of reviews', ['stage', 'status'])
compliance_checks_total = Counter(
    'compliance_checks_total',
    'Total compliance checks',
    ['status']
)

# Performance metrics
rag_queries_total = Counter('rag_queries_total', 'Total RAG queries')
rag_query_duration_seconds = Histogram('rag_query_duration_seconds', 'RAG query duration')

# Integration metrics
integration_requests_total = Counter(
    'integration_requests_total',
    'Total integration requests',
    ['integration_type', 'status']
)

