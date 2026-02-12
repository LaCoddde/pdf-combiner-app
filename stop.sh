#!/bin/bash

# stop.sh — Stop the backend and frontend servers

echo "🛑 Stopping PDF Combiner App..."
echo ""

# Kill Flask backend (python app.py on port 5000)
BACKEND_PIDS=$(lsof -ti :5000 2>/dev/null)
if [ -n "$BACKEND_PIDS" ]; then
  echo "📦 Stopping backend (port 5000)..."
  echo "$BACKEND_PIDS" | xargs kill 2>/dev/null
  echo "   ✅ Backend stopped."
else
  echo "📦 Backend is not running."
fi

# Kill Vite frontend dev server (port 5173)
FRONTEND_PIDS=$(lsof -ti :5173 2>/dev/null)
if [ -n "$FRONTEND_PIDS" ]; then
  echo "⚛️  Stopping frontend (port 5173)..."
  echo "$FRONTEND_PIDS" | xargs kill 2>/dev/null
  echo "   ✅ Frontend stopped."
else
  echo "⚛️  Frontend is not running."
fi

echo ""
echo "👋 All servers stopped."
