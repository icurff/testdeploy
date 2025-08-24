
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY requirements.txt .

# Install torch + torchvision CPU-only (version khớp nhau)
RUN pip install --no-cache-dir torch==2.8.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cpu

# Install sentence-transformers và transformers
RUN pip install --no-cache-dir "transformers>=4.41.2"
RUN pip install --no-cache-dir sentence-transformers

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Start app
CMD ["uvicorn", "myapi:app", "--host", "0.0.0.0", "--port", "8000"]
