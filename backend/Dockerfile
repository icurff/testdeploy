# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY requirements.txt .

# Install torch CPU-only
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu

# Install transformers + sentence-transformers (no deps to avoid pulling torchvision)
RUN pip install --no-cache-dir transformers>=4.41.2
RUN pip install --no-cache-dir --no-deps sentence-transformers

# Install other dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Start app
CMD ["uvicorn", "myapi:app", "--host", "0.0.0.0", "--port", "8000"]
