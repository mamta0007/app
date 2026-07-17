# AI Resume Analyzer

## 📌 Project Overview
AI Resume Analyzer is a web application that analyzes a candidate's resume against a Job Description (JD). It provides ATS score, matching skills, missing skills, and detailed analysis.

---

## 🚀 Features

- User Authentication (JWT)
- Resume Upload (PDF)
- Job Description Upload
- ATS Resume Analysis
- Skill Matching
- Match Score
- History
- Docker Support

---

## 🛠️ Tech Stack

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT Authentication
- Pydantic

### Frontend
- HTML
- CSS
- JavaScript

### AI
- LLM
- Prompt Engineering

### DevOps
- Docker
- Docker Compose

---

## 📂 Project Structure

project/
│
├── backend/
├── frontend/
├── docker-compose.yml
└── README.md

---

## ⚙️ Installation

### Clone Repository

```bash
git clone <repository-url>
cd project
```

### Create Virtual Environment

```bash
python -m venv venv
```

Activate:

Windows

```bash
venv\Scripts\activate
```

Linux/Mac

```bash
source venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

---

## 🐳 Run with Docker

Build and start containers

```bash
docker compose up --build -d
```

Stop containers

```bash
docker compose down
```

---

## ▶️ Run Backend

```bash
uvicorn main:app --reload
```

---

## 🌐 Application URLs

Frontend

```
http://localhost:5500
```

Backend

```
http://localhost:8000
```

Swagger Docs

```
http://localhost:8000/docs
```

## 👩‍💻 Author

Mamta Choudhary