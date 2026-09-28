# ☁️ Noir Backend — AWS Cloud Deployment Guide (Docker)

This guide provides end-to-end instructions for deploying the containerized **Noir Backend** (Django REST + Daphne ASGI WebSockets) to **Amazon Web Services (AWS)** using Docker.

---

## 🏛 Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              Internet / Clients              │
                      └───────┬──────────────────────────────┬───────┘
                              │ HTTPS (443) / WSS            │
                              ▼                              ▼
                 ┌─────────────────────────┐    ┌─────────────────────────┐
                 │     Frontend Web UI     │    │     Noir CLI Agent      │
                 └────────────┬────────────┘    └────────────┬────────────┘
                              │                              │
                              ▼ REST APIs & WebSockets       ▼
               ┌─────────────────────────────────────────────────────────────┐
               │              AWS Compute / Container Runtime                │
               │   (Option 1: App Runner | Option 2: ECS Fargate | Option 3: EC2)│
               │                                                             │
               │   ┌─────────────────────────────────────────────────────┐   │
               │   │                noir-backend Container               │   │
               │   │  - Daphne ASGI Server (Port 8000)                   │   │
               │   │  - Django REST Framework (REST APIs)                │   │
               │   │  - Channels WebSocket Router (`/ws/...`)            │   │
               │   │  - WhiteNoise Static File Engine                    │   │
               │   └───────────────┬─────────────────────┬───────────────┘   │
               └───────────────────┼─────────────────────┼───────────────────┘
                                   │                     │
                     Port 5432 (TLS)                     │ Port 6379 (TLS)
                                   ▼                     ▼
               ┌─────────────────────────┐ ┌─────────────────────────┐
               │   Amazon RDS Postgres   │ │ Amazon ElastiCache /    │
               │   Database (`noir_db`)  │ │ Redis (`ChannelLayer`)  │
               └─────────────────────────┘ └─────────────────────────┘
```

---

## 📋 Prerequisites

Before proceeding, ensure you have:
1. An active **AWS Account** with administrative or appropriate IAM permissions.
2. **AWS CLI v2** installed and configured:
   ```bash
   aws configure
   ```
3. **Docker** and **Docker Compose** installed locally.
4. Git repository cloned locally:
   ```bash
   git clone <repo-url>
   cd noir/backend
   ```

---

## 📦 Step 1: Build & Push Docker Image to Amazon ECR

Amazon Elastic Container Registry (ECR) stores your Docker images securely within AWS.

### 1. Set Environment Variables
```bash
export AWS_REGION="us-east-1"                 # Change to your AWS region
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPO_NAME="noir-backend"
export IMAGE_TAG="latest"
export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
```

### 2. Create the ECR Repository
```bash
aws ecr create-repository \
    --repository-name ${ECR_REPO_NAME} \
    --region ${AWS_REGION} \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256
```

### 3. Authenticate Docker with Amazon ECR
```bash
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

### 4. Build and Push the Docker Image
```bash
cd backend

# Build Docker image
docker build -t ${ECR_REPO_NAME}:${IMAGE_TAG} .

# Tag image for ECR
docker tag ${ECR_REPO_NAME}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

# Push image to Amazon ECR
docker push ${ECR_URI}:${IMAGE_TAG}
```

Verify that the image is in your repository:
```bash
aws ecr list-images --repository-name ${ECR_REPO_NAME} --region ${AWS_REGION}
```

---

## 🗄 Step 2: Database & Redis Provisioning

The Noir backend requires PostgreSQL for relational data and Redis for Django Channels WebSocket broadcasts.

### Option A: Fully Managed AWS Services (Recommended for Production)

#### 1. Amazon RDS PostgreSQL
1. Open the **Amazon RDS Console** → Click **Create database**.
2. Engine: **PostgreSQL** (version 15 or 16).
3. Template: **Free tier** (or **Production** based on budget).
4. DB instance identifier: `noir-postgres-db`.
5. Master username: `noir_user`.
6. Master password: `<secure-password>`.
7. Initial database name (under Additional configuration): `noir_db`.
8. VPC & Security Group:
   - Ensure the Security Group allows inbound traffic on **Port 5432** from your compute instance or security group.
9. Note down the **RDS Endpoint** (e.g. `noir-postgres-db.xxxxxx.us-east-1.rds.amazonaws.com`).

#### 2. Amazon ElastiCache for Redis
1. Open **Amazon ElastiCache Console** → **Redis OSS clusters** → **Create cluster**.
2. Node type: `cache.t4g.micro` (or `cache.t3.micro`).
3. Number of replicas: 0 (for dev/staging) or 1+ (for prod).
4. Subnet & Security Group:
   - Allow inbound traffic on **Port 6379** from your backend security group.
5. Note down the **Primary Endpoint** (e.g. `noir-redis.xxxxxx.cache.amazonaws.com`).

---

## 🚀 Step 3: Choose Your AWS Deployment Strategy

Select one of the following 3 deployment methods depending on your requirements:

| Strategy | Complexity | Cost | Best For |
| :--- | :--- | :--- | :--- |
| **Method 1: AWS App Runner** | ⭐ Lowest (Zero-DevOps) | Low / Pay-as-you-go | Fast production deployment, automatic HTTPS, native WebSockets |
| **Method 2: AWS ECS Fargate** | ⭐⭐⭐ Moderate | Pay-per-vCPU/RAM | Enterprise architectures, VPC isolation, autoscaling |
| **Method 3: AWS EC2 + Docker Compose** | ⭐ Low | Fixed ($3–$15/mo) | College projects, MVP demos, single VM all-in-one |

---

### 🌟 Method 1: AWS App Runner (Fastest & Simplest Managed Service)

AWS App Runner runs containerized applications directly with automated HTTPS/TLS termination, auto-scaling, and built-in WebSocket support.

#### Steps:
1. Open **AWS App Runner Console** → Click **Create service**.
2. **Source**:
   - Repository type: **Container registry**
   - Provider: **Amazon ECR**
   - Container image URI: Click **Browse** and select `noir-backend:latest`.
   - Deployment trigger: Choose **Automatic** (deploys whenever a new image is pushed) or **Manual**.
   - ECR access role: Click **Create new service role** (or select existing).
3. **Configure Service**:
   - Service name: `noir-backend-service`
   - Virtual CPU & Memory: `1 vCPU, 2 GB`
   - Port: `8000`
4. **Environment Variables**:
   Add the following under **Environment variables**:
   | Key | Value |
   | :--- | :--- |
   | `DEBUG` | `False` |
   | `SECRET_KEY` | `<generate-a-random-50-character-key>` |
   | `ALLOWED_HOSTS` | `*` |
   | `BACKEND_BASE_URL` | `https://<your-apprunner-domain>.awsapprunner.com` |
   | `FRONTEND_BASE_URL` | `https://<your-frontend-domain>` |
   | `CORS_ALLOWED_ORIGINS` | `https://<your-frontend-domain>,http://localhost:3000` |
   | `CSRF_TRUSTED_ORIGINS` | `https://<your-apprunner-domain>.awsapprunner.com,https://<your-frontend-domain>` |
   | `PSQL_HOST` | `<your-rds-endpoint>` |
   | `PSQL_PORT` | `5432` |
   | `PSQL_NAME` | `noir_db` |
   | `PSQL_USER` | `noir_user` |
   | `PSQL_PASSWORD` | `<your-db-password>` |
   | `PSQL_SSLMODE` | `require` |
   | `REDIS_HOST` | `<your-elasticache-endpoint>` |
   | `REDIS_PORT` | `6379` |
   | `RUN_MIGRATIONS` | `true` |
   | `COLLECT_STATIC` | `true` |
5. **VPC Connectivity** (Crucial for RDS/ElastiCache):
   - Under **Security** → **Networking** → Select **Custom VPC**.
   - Create or select an **App Runner VPC Connector** pointing to the same VPC and Subnets as your RDS instance and ElastiCache cluster.
6. **Health Check**:
   - Protocol: `HTTP`
   - Path: `/api/health/`
   - Interval: `20` seconds
   - Timeout: `5` seconds
   - Healthy threshold: `1`
   - Unhealthy threshold: `5`
7. Click **Next** → Review and click **Create & deploy**.

App Runner will deploy the container, verify health at `/api/health/`, and provision a secure URL like `https://xxxxxx.us-east-1.awsapprunner.com`.

---

### 🛡 Method 2: AWS ECS (Elastic Container Service) with Fargate

For production teams needing fine-grained VPC controls, CloudWatch integration, and Application Load Balancer routing.

#### 1. Create CloudWatch Log Group
```bash
aws logs create-log-group --log-group-name /ecs/noir-backend --region ${AWS_REGION}
```

#### 2. Create ECS Task Execution IAM Role (if not existing)
```bash
aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "ecs-tasks.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }'

aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

#### 3. Store Sensitive Secrets in AWS Secrets Manager
```bash
# Store Secret Key
aws secretsmanager create-secret \
    --name "noir/backend/SECRET_KEY" \
    --secret-string "$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')" \
    --region ${AWS_REGION}

# Store Database Password
aws secretsmanager create-secret \
    --name "noir/backend/PSQL_PASSWORD" \
    --secret-string "your-secure-rds-password" \
    --region ${AWS_REGION}
```

#### 4. Register the ECS Task Definition
Edit `backend/aws/ecs-task-definition.json.example` with your AWS Account ID, Region, and endpoints, then register:
```bash
aws ecs register-task-definition \
    --cli-input-json file://aws/ecs-task-definition.json.example \
    --region ${AWS_REGION}
```

#### 5. Create ECS Cluster and Service with ALB
1. Create an ECS Cluster:
   ```bash
   aws ecs create-cluster --cluster-name noir-cluster --region ${AWS_REGION}
   ```
2. Create an **Application Load Balancer (ALB)**:
   - Listener: HTTP (80) & HTTPS (443).
   - Target Group: Port `8000`, Target Type `IP`, Protocol `HTTP`.
   - Health check path: `/api/health/`.
   - **Important for WebSockets**: Set Target Group **Stickiness** to enabled (Duration: 1 day), and ALB **Idle timeout** to `3600` seconds (under ALB attributes) so long-running CLI log streams aren't abruptly terminated.
3. Create the ECS Fargate Service:
   ```bash
   aws ecs create-service \
       --cluster noir-cluster \
       --service-name noir-backend-service \
       --task-definition noir-backend-task \
       --desired-count 1 \
       --launch-type FARGATE \
       --network-configuration "awsvpcConfiguration={subnets=[<subnet-1>,<subnet-2>],securityGroups=[<security-group-id>],assignPublicIp=ENABLED}" \
       --load-balancers "targetGroupArn=<target-group-arn>,containerName=noir-backend,containerPort=8000" \
       --region ${AWS_REGION}
   ```

---

### 💻 Method 3: AWS EC2 Instance with Docker Compose (Budget & Demo Friendly)

This approach runs the complete stack (Backend + PostgreSQL + Redis) on a single Amazon EC2 instance using `docker-compose.prod.yml`.

#### 1. Launch EC2 Instance
- **AMI**: Ubuntu 24.04 LTS or Amazon Linux 2023.
- **Instance Type**: `t3.small` (2 vCPU, 2 GB RAM) or `t3.medium`.
- **Storage**: 20–30 GB gp3 SSD.
- **Security Group Inbound Rules**:
  - `SSH (22)`: Your IP
  - `HTTP (80)`: `0.0.0.0/0`
  - `HTTPS (443)`: `0.0.0.0/0`
  - `Custom TCP (8000)`: `0.0.0.0/0` (or restricted to frontend)

#### 2. SSH into EC2 Instance & Install Docker
```bash
ssh -i your-key.pem ubuntu@<ec2-public-ip>

# Update packages and install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git curl
sudo usermod -aG docker ubuntu
newgrp docker
```

#### 3. Clone Repository & Setup Environment
```bash
git clone <your-repository-url> noir
cd noir/backend

# Create production .env file
cp .env.example .env
nano .env
```

Configure `.env` with:
```env
DEBUG=False
SECRET_KEY=generate-a-strong-random-key-here
ALLOWED_HOSTS=<ec2-public-ip>,<ec2-dns-name>,localhost,127.0.0.1
BACKEND_BASE_URL=http://<ec2-public-ip>:8000
FRONTEND_BASE_URL=http://<your-frontend-ip-or-domain>
CORS_ALLOWED_ORIGINS=http://<your-frontend-ip-or-domain>,http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://<ec2-public-ip>:8000,http://<your-frontend-ip-or-domain>

PSQL_NAME=noir_db
PSQL_USER=noir_user
PSQL_PASSWORD=a-secure-database-password-123
PSQL_HOST=db
PSQL_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

RUN_MIGRATIONS=true
COLLECT_STATIC=true
```

#### 4. Launch Production Containers
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

#### 5. Verify Running Containers
```bash
docker compose -f docker-compose.prod.yml ps
```
Output should show `noir-backend-prod`, `noir-postgres-prod`, and `noir-redis-prod` all running and healthy!

Check logs:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 🔒 Optional: Add Free SSL via Nginx & Certbot (EC2)

To bind standard port 80/443 with automated HTTPS on EC2:

1. Install Nginx and Certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
2. Configure Nginx (`/etc/nginx/sites-available/noir`):
   ```nginx
   server {
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 3600s;
           proxy_send_timeout 3600s;
       }
   }
   ```
3. Enable and activate SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/noir /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

---

## ✅ Step 4: Verification & Day-2 Operations

### 1. Test Health Checks
- **Basic Container Health**:
  ```bash
  curl -i https://<your-backend-domain>/api/health/
  ```
  Expected Response:
  ```json
  {"status": "healthy", "service": "noir-backend"}
  ```

- **Deep Health Check (Tests DB & Redis connectivity)**:
  ```bash
  curl -i "https://<your-backend-domain>/api/health/?deep=1"
  ```
  Expected Response:
  ```json
  {"status": "healthy", "service": "noir-backend", "database": "connected", "cache": "connected"}
  ```

### 2. Create Django Admin Superuser
- **On EC2 / Local Docker**:
  ```bash
  docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
  ```
- **On AWS ECS**:
  Run a one-off task using ECS Exec:
  ```bash
  aws ecs execute-command \
      --cluster noir-cluster \
      --task <task-id> \
      --container noir-backend \
      --interactive \
      --command "python manage.py createsuperuser"
  ```

### 3. Connect Noir CLI Agent to Cloud Backend
On your local machine or developer terminal:
```bash
# Link CLI to the deployed AWS backend
noir connect <PROJECT_CONNECTION_CODE> --server https://<your-backend-domain>
```

---

## 🛠 Troubleshooting & FAQ

### 1. Database Connection Timeout (`OperationalError: connection to server failed: Connection timed out`)
- **Cause**: Security Group misconfiguration or VPC routing.
- **Fix**:
  - If using RDS, ensure the RDS Security Group allows inbound TCP traffic on port `5432` from your compute security group (ECS task or EC2 instance).
  - Verify that both RDS and your compute service reside in the same VPC and have accessible subnets.
  - Test connectivity from within the container: `docker exec -it noir-backend-prod nc -zv <rds-host> 5432`.

### 2. WebSockets Disconnect After 60 Seconds
- **Cause**: Application Load Balancer or reverse proxy default idle timeout (usually 60 seconds).
- **Fix**:
  - Increase ALB idle timeout to `3600` seconds in the AWS Console (EC2 → Load Balancers → Attributes).
  - In Nginx, set `proxy_read_timeout 3600s;` and `proxy_send_timeout 3600s;`.

### 3. CSRF Verification Failed (`403 Forbidden: Origin checking failed`)
- **Cause**: Django 4+ checks the request `Origin` header against `CSRF_TRUSTED_ORIGINS`.
- **Fix**: Add your domain (with scheme `https://`) to `CSRF_TRUSTED_ORIGINS` in `.env`:
  ```env
  CSRF_TRUSTED_ORIGINS=https://api.yourdomain.com,https://app.yourdomain.com
  ```

### 4. `DisallowedHost at /` (`Invalid HTTP_HOST header: 'xxxx.amazonaws.com'`)
- **Cause**: The incoming hostname is not present in `ALLOWED_HOSTS`.
- **Fix**: The backend automatically allows `.amazonaws.com`, `.awsapprunner.com`, and `.elb.amazonaws.com` by default. If using a custom domain, add it to `ALLOWED_HOSTS` in `.env`:
  ```env
  ALLOWED_HOSTS=api.yourdomain.com,.amazonaws.com
  ```
