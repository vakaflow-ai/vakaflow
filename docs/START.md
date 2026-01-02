# 🚀 Quick Start Guide

## Services Status

Check if services are running:
```bash
docker-compose ps
```

All services should show "Up" and "healthy" status.

## Start Development

### Terminal 1: Backend
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

Backend will run on: http://localhost:8000
API docs: http://localhost:8000/api/docs

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

Frontend will run on: http://localhost:3000

## First Steps

1. **Create a test user**:
   - Visit http://localhost:8000/api/docs
   - Use `/api/v1/auth/register` endpoint:
   ```json
   {
     "email": "vendor@example.com",
     "name": "Test Vendor",
     "password": "test1234",
     "role": "vendor_user"
   }
   ```

2. **Login**:
   - Visit http://localhost:3000/login
   - Use: vendor@example.com / test1234

3. **Submit an agent**:
   - Click "Submit New Agent"
   - Fill in the form
   - Submit!

## Troubleshooting

**Database connection error**:
```bash
docker-compose restart postgres
```

**Port already in use**:
- Change ports in docker-compose.yml
- Or kill existing processes

**Module not found**:
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

## Next Development Tasks

1. Implement RAG infrastructure
2. Add review workflow
3. Build compliance checking
4. Add file upload UI

---

**Happy coding! 🎉**

