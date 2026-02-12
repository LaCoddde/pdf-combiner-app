#!/bin/bash

# start.sh — Start both the backend and frontend servers

# Exit on error
set -e

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting PDF Combiner App..."
echo ""

# ── Backend ──────────────────────────────────────────────
echo "📦 Starting Flask backend on port 5000..."
(
  cd "$SCRIPT_DIR/backend"
  source pdf_venv/bin/activate
  python app.py
) &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────
echo "⚛️  Starting Vite frontend dev server..."
(
  cd "$SCRIPT_DIR/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are starting up!"
echo "   Backend  → http://localhost:5000"
echo "   Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# ── Cleanup on exit ──────────────────────────────────────
cleanup() {
  echo ""
  echo "🛑 Shutting down servers..."
  kill "$BACKEND_PID" 2>/dev/null
  kill "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" 2>/dev/null
  wait "$FRONTEND_PID" 2>/dev/null
  echo "👋 Goodbye!"
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
