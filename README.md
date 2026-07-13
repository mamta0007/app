# AI Interview Preparation Assistant (AIPA)

## Overview

AI Interview Preparation Assistant (AIPA) is a web application that helps job seekers prepare for interviews by analyzing their resume against a job description (JD). It provides skill gap analysis, interview questions, a personalized learning roadmap, and downloadable reports.

The application is built using **FastAPI**, **PostgreSQL**, **HTML/CSS/JavaScript**, and **Large Language Models (LLMs)**.

---

## Features

* User Registration and Login
* JWT Authentication (Access & Refresh Tokens)
* Email Account Activation
* Forgot Password & Reset Password
* Resume Upload
* Job Description (JD) Upload
* AI-based Resume vs JD Analysis
* Skill Gap Identification
* Personalized Learning Roadmap
* AI-generated Interview Questions
* Dashboard
* Download Analysis Report

---

## Tech Stack

### Backend

* FastAPI
* SQLAlchemy
* PostgreSQL
* JWT Authentication
* Passlib (Password Hashing)
* Python

### Frontend

* HTML
* CSS
* JavaScript

### AI

* LangChain
* LLM Integration
* Resume & JD Analysis

---

## Project Structure

```text
app/
│
├── models/
├── routers/
├── services/
├── schemas/
├── utils/
│
├── main.py
├── serve.py
├── index.html
├── app.js
├── style.css
└── requirements.txt
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/mamta0007/app.git
cd app
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

### 3. Activate the virtual environment

Windows

```bash
venv\Scripts\activate
```

Linux/macOS

```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure environment variables

Create a `.env` file in the project root and add the required configuration, for example:

```env
DATABASE_URL=your_database_url
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

SMTP_EMAIL=your_email
SMTP_PASSWORD=your_password

BASE_URL=http://YOUR_LOCAL_IP
```

---

## Running the Backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend:

```
http://localhost:8000
```

Swagger Documentation:

```
http://localhost:8000/docs
```

---

## Running the Frontend

```bash
python serve.py
```

Frontend:

```
http://localhost:5500
```

---

## API Modules

* Authentication

  * Register
  * Login
  * Refresh Token
  * Logout

* Account Management

  * Email Activation
  * Forgot Password
  * Reset Password

* Resume

  * Upload Resume

* Job Description

  * Upload JD

* AI Services

  * Resume vs JD Analysis
  * Skill Gap Analysis
  * Interview Question Generation
  * Learning Roadmap

* Reports

  * Download Analysis Report

---

## Authentication Flow

```
Register
    │
    ▼
Activation Email
    │
    ▼
Activate Account
    │
    ▼
Login
    │
    ▼
Access Token + Refresh Token
    │
    ▼
Protected APIs
```

---

## Future Improvements

* Interview Chatbot
* AI Resume Builder
* ATS Resume Scoring
* Company-wise Interview Preparation
* Admin Dashboard
* Interview Progress Tracking
* Deployment on Cloud

---

## Author

**Mamta Choudhary**

GitHub: https://github.com/mamta0007
