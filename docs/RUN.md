# 🚀 Run the Platform

## Quick Start

### 1. Start Infrastructure (if not running)
```bash
docker-compose up -d postgres redis qdrant
```

### 2. Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Backend**: http://localhost:8000
**API Docs**: http://localhost:8000/api/docs

### 3. Start Frontend (new terminal)
```bash
cd frontend
npm run dev
```

**Frontend**: http://localhost:3000

## ✅ Status

- ✅ Infrastructure running
- ✅ Backend ready
- ✅ Frontend ready
- ✅ Database migrations ready
- ✅ Security features implemented
- ✅ Performance optimizations in place

## 🧪 Test It

1. Register: http://localhost:8000/api/docs → `/api/v1/auth/register`
2. Login: http://localhost:3000/login
3. Submit Agent: Click "Submit New Agent"

## 📝 Notes

- Database user is created automatically by Docker
- If connection issues, use `127.0.0.1` instead of `localhost` in DATABASE_URL
- All security and performance features are active

**Ready to build! 🎉**

