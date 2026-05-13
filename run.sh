#!/bin/bash

# BEmailSender Startup Script
# Runs Backend (Django), WhatsApp Service, and Frontend (Vite)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

echo "========================================="
echo "  BEmailSender v1.0"
echo "========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Stop all existing services
stop_all() {
    echo -e "${YELLOW}[Stop]${NC} Stopping existing services..."
    pkill -f "manage.py runserver" 2>/dev/null
    pkill -f "node server.js" 2>/dev/null
    # Force kill if ports 3001/3002 are still active
    fuser -k 3001/tcp 2>/dev/null
    fuser -k 3002/tcp 2>/dev/null
    sleep 1
}

# Start Backend (Django on port 8000)
start_backend() {
    echo -e "${BLUE}[Backend]${NC} Starting Django on port 8000..."
    cd "$PROJECT_DIR/backend"
    python manage.py runserver 0.0.0.0:8000 > /tmp/bemail_backend.log 2>&1 &
    sleep 2
    echo -e "${GREEN}[Backend]${NC} Started"
}

# Start WhatsApp (Node.js on port 3002)
start_whatsapp() {
    echo -e "${BLUE}[WhatsApp]${NC} Starting WhatsApp service on port 3002..."
    cd "$PROJECT_DIR/whatsapp-service"
    PORT=3002 node server.js > /tmp/bemail_whatsapp.log 2>&1 &
    sleep 2
    echo -e "${GREEN}[WhatsApp]${NC} Started"
}

# Start Frontend (Vite on port 3001)
start_frontend() {
    echo -e "${BLUE}[Frontend]${NC} Starting Vite on port 3001..."
    cd "$PROJECT_DIR/frontend"
    npm run dev -- --port 3001 > /tmp/bemail_frontend.log 2>&1 &
    sleep 3
    echo -e "${GREEN}[Frontend]${NC} Started"
}

# Main
case "${1:-start}" in
    start)
        stop_all
        start_backend
        start_whatsapp
        start_frontend
        echo ""
        echo "========================================="
        echo -e "  ${GREEN}BEmailSender Started!${NC}"
        echo "========================================="
        echo -e "  ${BLUE}Backend:${NC}    http://localhost:8000"
        echo -e "  ${BLUE}Frontend:${NC}   http://localhost:3001"
        echo -e "  ${BLUE}WhatsApp:${NC}   http://localhost:3002"
        echo ""
        echo "  Default credentials:"
        echo "    Email:    admin@example.com"
        echo "    Password: password123"
        echo "========================================="
        ;;
    stop)
        stop_all
        echo -e "${GREEN}All services stopped${NC}"
        ;;
    restart)
        stop_all
        start_backend
        start_whatsapp
        start_frontend
        echo -e "${GREEN}All services restarted${NC}"
        ;;
    status)
        echo "Service Status:"
        pgrep -f "manage.py runserver" > /dev/null && echo -e "  Backend:   ${GREEN}running${NC}" || echo -e "  Backend:   ${RED}stopped${NC}"
        pgrep -f "whatsapp-service" > /dev/null && echo -e "  WhatsApp:  ${GREEN}running${NC}" || echo -e "  WhatsApp:  ${RED}stopped${NC}"
        pgrep -f "vite" > /dev/null && echo -e "  Frontend: ${GREEN}running${NC}" || echo -e "  Frontend: ${RED}stopped${NC}"
        ;;
    logs)
        tail -f /tmp/bemail_${2:-backend}.log 2>/dev/null || echo "Usage: $0 logs [backend|whatsapp|frontend]"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services"
        echo "  stop   - Stop all services"
        echo "  restart- Restart all services"
        echo "  status - Show service status"
        echo "  logs   - Show logs (backend|whatsapp|frontend)"
        exit 1
        ;;
esac