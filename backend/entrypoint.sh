#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Waiting for database..."
# The healthcheck in docker-compose handles this, but we can add an extra check here if needed.

# Only run database setup in the main backend container (when no args are passed)
if [ $# -eq 0 ]; then
    echo "Applying database migrations..."
    until python manage.py migrate --noinput; do
      echo "Database is not ready. Retrying in 5 seconds..."
      sleep 5
    done

    echo "Ensuring utf8mb4 charset..."
    python manage.py convert_to_utf8mb4
fi

# If arguments are passed (e.g. for worker), execute them and exit
if [ $# -gt 0 ]; then
    echo "Running custom command: $@"
    exec "$@"
fi

# Check if we should use gunicorn or runserver (addressing Issue #23 as a bonus)
if [ "$DEBUG" = "False" ]; then
    echo "Running in PRODUCTION mode (Gunicorn)"
    exec gunicorn bemailsender.wsgi:application --bind 0.0.0.0:9090
else
    echo "Running in DEVELOPMENT mode (Runserver)"
    exec python manage.py runserver 0.0.0.0:9090
fi
