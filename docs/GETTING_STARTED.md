# Getting Started: Development Setup

## Tech Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI (modern, fast, async)
- **Database**: PostgreSQL 15+
- **Vector DB**: Qdrant (lightweight, self-hostable)
- **Cache**: Redis
- **Task Queue**: Celery with Redis
- **ORM**: SQLAlchemy 2.0

### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Library**: shadcn/ui (compact, modern components)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **API Client**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod

### Infrastructure
- **Cloud**: DigitalOcean/Linode/Vultr (small cloud vendor)
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Docker Swarm (simpler than K8s for small scale)
- **CI/CD**: GitHub Actions

### AI/ML
- **RAG**: LangChain
- **Embeddings**: OpenAI embeddings or Sentence Transformers
- **LLM**: OpenAI GPT-4 or Anthropic Claude

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis

### Setup Steps

1. **Clone and setup backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Setup database**:
```bash
docker-compose up -d postgres redis qdrant
```

3. **Run migrations**:
```bash
cd backend
alembic upgrade head
```

4. **Setup frontend**:
```bash
cd frontend
npm install
```

5. **Start development servers**:
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## Development Workflow

### Using Cursor AI
- Use Cursor's AI features for code generation
- Ask Cursor to implement features based on our design docs
- Use Cursor for refactoring and optimization
- Leverage Cursor for test generation

### Code Style
- **Python**: Black formatter, Ruff linter
- **TypeScript**: ESLint + Prettier
- **Commits**: Conventional commits

---

## Project Structure

```
vaka/
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── docs/            # Documentation
├── docker-compose.yml
└── README.md
```

