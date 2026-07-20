

<img width="1200" height="475" alt="Portfolio Banner" src="/docs/image/noir.png" />

## Noir: AI-Driven Autonomous Reliability Engineering Platform

## Project Description

- Noir is an AI-assisted reliability engineering platform for Dockerized backend and microservice applications.
    
- It helps developers discover intermittent software failures that are difficult to reproduce manually.
    
- The Noir Agent executes controlled fault injection, runs existing test suites, collects logs and metrics, and sends the results to the backend.
    
- The AI continuously analyzes previous experiments, identifies failure patterns, intelligently plans the next experiments, and discovers the minimum conditions required to reproduce failures.
    
- The system finally generates reliability reports containing failure conditions, confidence level, supporting evidence, and recommendations.
    

---

# User Modules

### 1. Admin

- Manage users
    
- Manage organizations
    
- Manage subscriptions
    
- Monitor projects and agents
    
- View system analytics
    

### 2. Company (Organization)

- Create organization
    
- Manage teams
    
- Manage projects
    
- Manage organization members
    
- View organization reports
    

### 3. Team

- Manage team members
    
- Manage assigned projects
    
- Execute analysis
    
- View reports
    

### 4. Developer

- Login to Noir
    
- Create projects
    
- Connect Noir Agent
    
- Execute analysis
    
- View reports
    
- Manage connected devices
    

---

# Technologies Used

## Frontend

- React.js
    
- TypeScript
    
- Tailwind CSS
    
- Chart.js / Recharts
    

## Backend

- Django
    
- Django REST Framework
    
- PostgreSQL
    
- Redis
    
- Celery
    
- JWT Authentication (SimpleJWT)
    

## Noir Agent (CLI)

- Python
    
- Typer
    
- HTTPX
    
- Rich
    
- Docker SDK
    
- PyYAML
    

## Infrastructure

- Docker
    
- Docker Compose
    
- Git
    
- GitHub
    

## AI & Data Processing

- Scikit-learn
    
- Scikit-Optimize (Bayesian Optimization)
    
- NumPy
    
- Pandas
    

---

# AI Functionalities

### 1. Intelligent Experiment Planning

- Learns from previous experiments and selects the next most informative fault injection automatically.
    

### 2. Failure Probability Prediction

- Predicts the likelihood of failure under different combinations of system conditions.
    

### 3. Failure Boundary Discovery

- Identifies the transition point between successful and failed executions.
    

### 4. Failure Trigger Minimization

- Finds the minimum combination of conditions required to reproduce an intermittent failure.
    

### 5. AI-Based Reliability Report Generation

- Generates evidence-backed reports containing probable causes, confidence scores, and recommended investigation areas.
    

---

# Phase 1 (Semester 1)

### Title

**Autonomous Reliability Testing Platform**

### Features

- User Authentication (JWT)
    
- Organization & Team Management
    
- Project Management
    
- Noir CLI Agent
    
- Docker Integration
    
- Fault Injection
    
- Test Execution
    
- Metrics & Log Collection
    
- Dashboard & Reports
    
- Project Connection (`noir init`, `noir connect`, `noir analyze`)
    

### Deliverable

A complete reliability testing platform capable of executing controlled experiments and generating detailed reliability reports.

---

# Phase 2 (Semester 2)

### Title

**AI-Driven Autonomous Experimentation**

### Features

- Intelligent Experiment Planning
    
- Failure Probability Prediction
    
- Failure Boundary Discovery
    
- Trigger Minimization
    
- AI Reliability Analysis
    
- AI-Generated Reports
    
- Experiment Optimization using Active Learning & Bayesian Optimization
    

### Deliverable

An intelligent reliability engineering platform that autonomously learns from experiments, optimizes testing strategies, discovers intermittent failures efficiently, and produces evidence-backed failure analysis reports.

