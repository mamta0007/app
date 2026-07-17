# AI Resume Analyzer

AI Resume Analyzer is a web application that analyzes a candidate's resume against a Job Description (JD). It extracts technical skills, compares them with the required skills, calculates an ATS match score, and generates a detailed analysis report.

---

## 🚀 Features

- User Registration & Login (JWT Authentication)
- Resume Upload (PDF)
- Job Description Upload
- AI-Powered ATS Resume Analysis
- Technical Skill Extraction
- Skill Matching & Missing Skill Detection
- ATS Match Score Calculation
- Resume Analysis History
- Dockerized Backend & Frontend

---

## 🛠️ Tech Stack

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- JWT Authentication

### Frontend
- HTML
- CSS
- JavaScript
- Nginx

### AI
- LLM
- Prompt Engineering

### DevOps
- Docker
- Docker Compose

---

## 📁 Project Structure

```text
project/
│
├── backend/
│   ├── dockerfile.backend
│   ├── requirements.txt
│   ├── main.py
│   ├── routers/
│   ├── models/
│   ├── services/
│   ├── schemas/
│   ├── utils/
│   └── ...
│
├── frontend/
│   ├── dockerfile.frontend
│   ├── nginx.conf
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── ...
│
├── docker-compose.yml
└── README.md
```

---

## 📋 Prerequisites

Before running the project, install:

- Docker Desktop
- PostgreSQL
- Git

---

## 🗄️ PostgreSQL Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE chatdata;
```

---

## ⚙️ Environment Variables

Create a `.env` file inside the **backend** directory.

```env
DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@host.docker.internal:5432/chatdata

SECRET_KEY=<YOUR_SECRET_KEY>

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30
```

> **Note:** The backend runs inside a Docker container, while PostgreSQL runs on the host machine. Therefore, `host.docker.internal` is used instead of `localhost`.

---

## 🐳 Build & Run

Build images and start containers:

```bash
docker compose up --build -d
```

Stop and remove containers:

```bash
docker compose down
```

View running containers:

```bash
docker ps
```

View backend logs:

```bash
docker compose logs -f backend
```

---

## 🌐 Application URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5500 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

---

## 🏗️ Docker Architecture

```text
                    Browser
                        │
                        ▼
             http://localhost:5500
                        │
                        ▼
          Frontend Container (Nginx)
                        │
            HTML / CSS / JavaScript
                        │
                        ▼
          HTTP API Requests (JSON)
                        │
                        ▼
             http://localhost:8000
                        │
                        ▼
        Backend Container (FastAPI)
                        │
                        ▼
      PostgreSQL (Host Machine)
```

---

## 🐳 Docker Components

### Backend

- Built using `dockerfile.backend`
- Runs FastAPI with Uvicorn
- Exposes port **8000**

### Frontend

- Built using `dockerfile.frontend`
- Uses Nginx to serve static files
- Exposes port **5500**

### Database

- PostgreSQL runs on the host machine
- Backend connects using:

```text
host.docker.internal
```

---

## 🔧 Useful Docker Commands

Build images

```bash
docker compose up --build
```

Start containers

```bash
docker compose up -d
```

Stop containers

```bash
docker compose stop
```

Start stopped containers

```bash
docker compose start
```

Remove containers and network

```bash
docker compose down
```

View running containers

```bash
docker ps
```

View Docker images

```bash
docker images
```

View backend logs

```bash
docker compose logs -f backend
```

---

## 📝 Notes

- Frontend is served using **Nginx**.
- Backend runs inside a **Docker container** using **FastAPI (Uvicorn)**.
- PostgreSQL runs on the **host machine**.
- Backend connects to PostgreSQL using `host.docker.internal`.
- Docker Compose automatically creates a network for communication between the frontend and backend containers.

---

## 👩‍💻 Author

**Mamta Choudhary**