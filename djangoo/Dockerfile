FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV DJANGO_SETTINGS_MODULE=config.settings

EXPOSE 8000

CMD ["sh", "-c", \
     "python manage.py migrate --noinput && \
      python manage.py collectstatic --noinput && \
      uvicorn config.asgi:application --host 0.0.0.0 --port 8000"]
