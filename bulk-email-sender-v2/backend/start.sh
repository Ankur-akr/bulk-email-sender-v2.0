#!/bin/bash
# Used by Render as the start command
exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
