FROM python:3.12-slim

LABEL org.opencontainers.image.title="HR KPI Platform — Backend"
LABEL org.opencontainers.image.description="FastAPI backend for the HR KPI management system (Jalali calendar, role-based access, PDF/Excel reports)"
LABEL org.opencontainers.image.authors="Meysam Ijadi <ijadi8498@gmail.com>"
LABEL org.opencontainers.image.source="https://github.com/meysam8498/hr-kpi-platform"
LABEL org.opencontainers.image.documentation="https://github.com/meysam8498/hr-kpi-platform#readme"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Apply Alembic migrations before starting the API server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
