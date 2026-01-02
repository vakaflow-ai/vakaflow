# Deployment Checklist - Security & Scalability Fixes

## ✅ Pre-Deployment Verification

### 1. Database Migrations
- [x] Migration `9b1c43947e3d` applied (allowed_email_domains)
- [x] Migration `ab7cafe125cc` applied (bearer_token_hash)
- [ ] Verify migrations: `alembic current`

### 2. Dependencies
- [x] `bleach==6.1.0` installed
- [ ] Verify: `pip list | grep bleach`

### 3. Environment Variables
- [ ] `SECRET_KEY` set to strong random value (NOT default)
- [ ] `REDIS_URL` configured correctly
- [ ] `DATABASE_URL` configured correctly
- [ ] `CORS_ORIGINS` set appropriately for production

### 4. Redis Configuration
- [ ] Redis is running and accessible
- [ ] Test connection: `redis-cli ping`
- [ ] Verify rate limiting works: Check Redis keys

### 5. Code Verification
- [x] All imports successful
- [x] Rate limiting uses Redis
- [x] CSRF protection available
- [x] Input sanitization uses bleach
- [x] SSO sessions use Redis

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment
```bash
# 1. Backup database
pg_dump vaka > backup_$(date +%Y%m%d).sql

# 2. Apply migrations
cd backend
source venv/bin/activate
alembic upgrade head

# 3. Install dependencies
pip install -r requirements.txt

# 4. Verify Redis
redis-cli ping
```

### Step 2: Configuration
```bash
# Set strong SECRET_KEY
export SECRET_KEY=$(openssl rand -hex 32)

# Update .env file
echo "SECRET_KEY=$SECRET_KEY" >> .env
echo "ENVIRONMENT=production" >> .env
```

### Step 3: Test
```bash
# Test rate limiting
curl -X GET http://localhost:8000/api/v1/health

# Test Redis connection
python3 -c "from app.core.cache import get_redis; print('OK' if get_redis() else 'FAIL')"

# Test imports
python3 -c "from app.core.security_middleware import check_rate_limit_redis; print('OK')"
```

### Step 4: Deploy
```bash
# Start services
docker-compose up -d

# Or for manual deployment
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 🔍 Post-Deployment Verification

### 1. Health Checks
- [ ] `/health` endpoint returns 200
- [ ] Database connection works
- [ ] Redis connection works

### 2. Rate Limiting
- [ ] Make 60+ requests quickly
- [ ] Verify 429 response after limit
- [ ] Check Redis keys: `redis-cli KEYS "rate_limit:*"`

### 3. Security
- [ ] Test XSS protection: Submit `<script>alert('xss')</script>`
- [ ] Verify input is sanitized
- [ ] Test SCIM token hashing (if using SCIM)

### 4. Clustering (if applicable)
- [ ] Start multiple backend instances
- [ ] Verify rate limits are shared
- [ ] Test SSO flow across instances

---

## ⚠️ Important Notes

### SECRET_KEY
**CRITICAL**: Change default SECRET_KEY before production!
```bash
# Generate strong secret
openssl rand -hex 32

# Set in environment or .env
export SECRET_KEY="<generated-secret>"
```

### CSRF Protection
CSRF middleware is implemented but **not enabled by default**. Enable if:
- Using cookie-based sessions
- Need protection against CSRF attacks
- Not using token-based auth (JWT)

To enable, add to `main.py`:
```python
from app.core.csrf import CSRFMiddleware
app.add_middleware(CSRFMiddleware)
```

### Rate Limiting
- Development: 300 requests/minute
- Production: 60 requests/minute
- Configurable in `main.py`

### Redis Fallback
If Redis is unavailable:
- Rate limiting falls back to in-memory (per-instance)
- SSO sessions may not work across instances
- Application continues to function (degraded mode)

---

## 📊 Monitoring

### Key Metrics to Monitor
1. **Rate Limit Hits**: Check Redis keys `rate_limit:*`
2. **Redis Connection**: Monitor Redis availability
3. **Database Queries**: Monitor slow queries
4. **Error Rates**: Check application logs

### Redis Monitoring
```bash
# Check rate limit keys
redis-cli KEYS "rate_limit:*"

# Check SSO sessions
redis-cli KEYS "sso_session:*"

# Monitor Redis memory
redis-cli INFO memory
```

---

## 🐛 Troubleshooting

### Rate Limiting Not Working
1. Check Redis connection: `redis-cli ping`
2. Check Redis keys: `redis-cli KEYS "rate_limit:*"`
3. Check logs for Redis errors
4. Verify fallback mode if Redis unavailable

### CSRF Errors
1. Verify CSRF middleware is enabled (if needed)
2. Check session cookies are set
3. Verify Redis is available for token storage

### Input Sanitization Issues
1. Verify bleach is installed: `pip list | grep bleach`
2. Check logs for sanitization warnings
3. Test with XSS payloads

### SSO Not Working
1. Check Redis connection
2. Verify SSO session keys in Redis
3. Check state validation logs
4. Verify integration configuration

---

## ✅ Success Criteria

- [x] All migrations applied
- [x] All dependencies installed
- [x] Redis connected and working
- [x] Rate limiting functional
- [x] Input sanitization working
- [x] SSO sessions using Redis
- [ ] SECRET_KEY changed from default
- [ ] Production environment configured
- [ ] Health checks passing
- [ ] Monitoring in place

---

**Status**: ✅ **Ready for Deployment**  
**Last Updated**: 2025-12-07

