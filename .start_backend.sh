#!/bin/bash
cd "$1"
source venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port $2 --reload
