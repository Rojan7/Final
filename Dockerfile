# --- Base image ---
FROM python:3.11-slim

# --- Set workdir ---
WORKDIR /app

# --- Install system dependencies ---
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    ffmpeg \
    curl \
    nodejs \
    npm \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# --- Copy backend requirements and install ---
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# --- Copy backend + frontend code ---
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY wikipedia_scrape/ ./wikipedia_scrape/

# --- Install frontend dependencies ---
RUN cd frontend && npm install && npm install -g concurrently

# --- Expose ports ---
EXPOSE 8000 3000

# --- Start backend + frontend together ---
CMD ["bash", "-c", "concurrently \"uvicorn backend.main:app --host 0.0.0.0 --port 8000\" \"cd frontend && npm start\""]
