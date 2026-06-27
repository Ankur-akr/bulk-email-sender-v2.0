#!/bin/bash
# Convenience script to start both backend and frontend

echo "Starting Bulk Email Sender..."

# Start backend
cd backend
if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
uvicorn app:app --reload --port 8000 &
BACKEND_PID=$!
echo "Backend started (PID $BACKEND_PID) on http://localhost:8000"

# Start frontend
cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID $FRONTEND_PID) on http://localhost:3000"

echo ""
echo "Open http://localhost:3000 in your browser"
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit 0" INT
wait
