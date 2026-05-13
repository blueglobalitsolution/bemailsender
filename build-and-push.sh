#!/bin/bash

set -e

source production/.env

REGISTRY="$REGISTRY"
BACKEND_IMAGE="$BACKEND_IMAGE"
FRONTEND_IMAGE="$FRONTEND_IMAGE"
WHATSAPP_IMAGE="$WHATSAPP_IMAGE"

echo "Building Docker images..."

echo "Building backend..."
docker build -t $BACKEND_IMAGE -f Dockerfile.backend .

echo "Building frontend..."
docker build -t $FRONTEND_IMAGE -f Dockerfile.frontend .

echo "Building WhatsApp service..."
docker build -t $WHATSAPP_IMAGE -f Dockerfile.whatsapp .

echo "Pushing images to registry..."

echo "Pushing backend..."
docker push $BACKEND_IMAGE

echo "Pushing frontend..."
docker push $FRONTEND_IMAGE

echo "Pushing WhatsApp service..."
docker push $WHATSAPP_IMAGE

echo "All images built and pushed successfully!"
