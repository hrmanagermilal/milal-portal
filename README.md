# milal-room-reservation

Milal Portal web application with React frontend and FastAPI backend.

This project can run as a single Docker container where FastAPI serves both API and built React static files.
For production-like local run, use Docker Compose with MySQL.

## Features

- No user login required
- User must provide phone number and email when creating reservation request
- Admin can approve, change, or reject reservation requests
- Everyone can view reservation status, including other users' reservations

## Project Structure

- `backend/` FastAPI API with MySQL support (via SQLAlchemy)
- `frontend/` React + Vite web app

## Backend Run

```bash
cd backend
python -m venv .venv
. .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Admin key is read from `ADMIN_API_KEY` environment variable (default: `milal-admin-key`).

## Frontend Run

```bash
cd frontend
npm install
npm run dev
```

Set API endpoint in `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Main API Endpoints

- `GET /api/rooms`
- `POST /api/reservations`
- `GET /api/reservations`
- `PATCH /api/admin/reservations/{reservation_id}` with header `X-Admin-Key`

## Single Container (Frontend + Backend)

Build image:

```bash
docker build -t milal-room-reservation .
```

Run container:

```bash
docker run --name milal-room-reservation -p 8000:8000 -e ADMIN_API_KEY=your-admin-key milal-room-reservation
```

Then open:

- `http://localhost:8000` for frontend
- `http://localhost:8000/docs` for API docs

## Docker Compose (Recommended: App + MySQL)

1. Create env file from sample:

```bash
cp .env.compose.example .env
```

2. Start services:

```bash
docker compose up --build -d
```

3. Open:

- `http://localhost:8000` for frontend
- `http://localhost:8000/docs` for API docs

4. Stop services:

```bash
docker compose down
```
