# VAKA Agent Platform

RAG-powered AI agent onboarding and offboarding platform.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose

### Setup

1. **Start infrastructure**:
```bash
docker-compose up -d postgres redis qdrant
```

2. **Setup backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
alembic upgrade head
```

3. **Setup frontend**:
```bash
cd frontend
npm install
```

4. **Run development servers**:
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit http://localhost:3000

## Development

### Using Cursor AI
- Use Cursor's AI features for code generation
- Reference design docs in `/docs` folder
- Ask Cursor to implement features based on specifications

### Code Style
- **Python**: Black + Ruff
- **TypeScript**: ESLint + Prettier

## Project Structure

```
vaka/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/     # API routes
│   │   ├── core/    # Core config
│   │   ├── models/  # Database models
│   │   └── services/# Business logic
│   └── alembic/     # Database migrations
├── frontend/         # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
└── docs/            # Documentation
```

## Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Detailed setup instructions
- [PROJECT_RULES.md](./PROJECT_RULES.md) - Project rules, guidelines, and seed data management
- [README_SEED_DATA.md](./README_SEED_DATA.md) - Seed data guide and usage
- [SEED_DATA_SUMMARY.md](./SEED_DATA_SUMMARY.md) - Seed data summary and details

## Seed Data

After initial setup, seed the database with policies, compliance rules, and review stages:

```bash
cd backend
source venv/bin/activate
python3 scripts/seed_data.py
```

This creates:
- 8 compliance policies (GDPR, HIPAA, SOC 2, ISO 27001, PCI DSS, CCPA, etc.)
- 4 review stages (Security, Compliance, Technical, Business)
- Compliance rules embedded in policies

See [README_SEED_DATA.md](./README_SEED_DATA.md) for details.
