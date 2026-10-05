FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
# Migratsiyalar -> admin (faqat birinchi marta) -> server.
# Eslatma: eslatma SMS'lari fon jarayonida yuboriladi, shuning uchun bitta worker yetarli.
CMD ["sh", "-c", "alembic upgrade head && python seed.py --admin-password \"$ADMIN_PASSWORD\" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
