# Noir CLI Agent (Go Implementation)

[![Go Version](https://img.shields.io/badge/go-1.22%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Binary Size](https://img.shields.io/badge/binary-9.4MB-blue)]()
[![Startup Latency](https://img.shields.io/badge/startup-<8ms-success)]()

The **Noir CLI Agent** is an autonomous, AI-powered reliability engineering agent engineered for developer workspaces and CI/CD pipelines. This directory contains the production-grade, zero-dependency Go implementation that replaces the Python Typer agent.

---

## ⚡ Why Go? (Architecture Decision Record)

| Dimension | Python Agent (`agent/noir`) | Go Agent (`cli/noir`) | Improvement |
| :--- | :--- | :--- | :--- |
| **Startup Latency** | 450ms – 800ms (interpreter + import overhead) | **~8ms** (native binary) | **~100x faster** |
| **Memory Footprint (RSS)** | 48MB – 75MB | **~9MB** | **~8x less memory** |
| **Distribution** | Requires Python >=3.10, `pip`, virtualenv, compiled wheels | **Single statically-linked binary** | **Zero host dependencies** |
| **Filesystem Traversal** | GIL-bound sequential walker | **Parallel goroutine directory scanner** | **~10x faster AST profile** |
| **Docker Streaming** | Blocking subprocess loop | **Concurrent multiplexed stdout/stderr goroutine pipeline** | **Zero dropped frame telemetry** |
| **Chaos Fault Engine** | Synchronous requests/time loops | **Lock-free concurrent probe loops with microsecond timers** | **Sub-millisecond RTO measurement** |

---

## 🏗️ Directory Architecture

```text
cli/
├── cmd/                          # Cobra CLI command controllers
│   ├── root.go                   # Root command definition & global flag registration
│   ├── connect.go                # 'noir connect <code>' & 'noir init'
│   ├── disconnect.go             # 'noir disconnect'
│   ├── status.go                 # 'noir status'
│   ├── whoami.go                 # 'noir whoami'
│   ├── login.go                  # 'noir login', 'noir login github', 'noir login google'
│   ├── logout.go                 # 'noir logout'
│   ├── config.go                 # 'noir config get|set|show'
│   ├── doctor.go                 # 'noir doctor' diagnostic system check
│   ├── scan.go                   # 'noir scan' Lynx profiler & container detector
│   ├── sync.go                   # 'noir sync' remote sync with backend
│   ├── analyze.go                # 'noir analyze' static code & architecture scan
│   ├── test.go                   # 'noir test' multi-stack test detector & runner
│   ├── run.go                    # 'noir run' containerized test execution & telemetry
│   └── fault.go                  # 'noir fault' chaos injection & resilience scorer
│
├── internal/                     # Private, decoupled core packages
│   ├── api/                      # HTTP client, token refresh loop & local OAuth server
│   │   ├── client.go             # Authenticated REST client with Bearer tokens
│   │   └── oauth.go              # Embedded HTTP listener (127.0.0.1:53145) with styled UI
│   ├── auth/                     # Dual-layer credential storage
│   │   ├── storage.go            # OS Keyring + ~/.noir/credentials.json fallback (0600)
│   │   └── storage_test.go       # Auth storage unit test suite
│   ├── config/                   # Workspace configuration manager (.noir/)
│   │   ├── config.go             # config.json, config.yaml, project.json, cache/, logs/
│   │   └── config_test.go        # Workspace config unit test suite
│   ├── detector/                 # Multi-stack test & docker compose discovery
│   │   ├── test_detector.go      # Pytest/Django/Node/Go/Rust/Java test detector
│   │   ├── test_detector_test.go # Test detector unit tests
│   │   └── docker_detector.go    # Docker Compose YAML & Dockerfile parser
│   ├── docker/                   # Docker daemon & container lifecycle orchestrator
│   │   └── manager.go            # Container lifecycle, exec, tc netem, stress-ng
│   ├── faults/                   # Chaos engineering fault injection engine
│   │   ├── experiment.go         # SteadyStateEvaluator, ChaosProbe, ResilienceScorer
│   │   ├── experiment_test.go    # Chaos distribution & resilience scorer unit tests
│   │   ├── registry.go           # Supported faults registry
│   │   ├── types/                # Fault interfaces & execution context
│   │   └── executors/            # Restart, stop, latency, loss, CPU & memory stress
│   ├── lynx/                     # Lynx AST & stack profiler
│   │   ├── collector.go          # Fast filesystem walker & keyword regex scanner
│   │   ├── data.go               # Language keywords, extensions, & weights
│   │   ├── identify.go           # Confidence threshold classifier
│   │   ├── profiler.go           # Full project profiling pipeline
│   │   ├── profiler_test.go      # Lynx profiler unit test suite
│   │   └── scoring.go            # Language, framework, and library scoring engine
│   └── ui/                       # Lipgloss design system & terminal styling
│       └── banner.go             # ASCII banner, lipgloss tables, panels, badges
│
├── go.mod                        # Go module dependencies
├── go.sum                        # Checksums
├── main.go                       # Application entrypoint
└── noir                          # Compiled native binary
```

---

## 🚀 Installation & Build

### Prerequisites
- Go 1.22 or higher (only needed to build from source)
- Docker (optional, needed for container execution and chaos fault injection)

### Build Locally
```bash
cd cli

# Run tests
go test -v ./...

# Build optimized production binary
go build -ldflags="-s -w" -o noir main.go
```

### Cross-Compilation (Zero Dependencies)
Because Noir CLI does not depend on CGO, you can compile static binaries for any OS and architecture directly:

```bash
# Linux (AMD64)
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o dist/noir-linux-amd64 main.go

# Linux (ARM64 / Raspberry Pi / AWS Graviton)
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o dist/noir-linux-arm64 main.go

# macOS (Apple Silicon M1/M2/M3)
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o dist/noir-darwin-arm64 main.go

# macOS (Intel)
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o dist/noir-darwin-amd64 main.go

# Windows (AMD64)
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o dist/noir-windows-amd64.exe main.go
```

---

## 📖 Command Reference

### 1. Diagnostic & Environment
```bash
./noir doctor
```
Runs comprehensive health checks on:
- Go / Host Runtime
- Git executable & branch state
- Docker daemon connectivity & container status
- Stored developer credentials (Keyring & `~/.noir/credentials.json`)
- Backend reachability & latency (`http://127.0.0.1:8000`)
- Current workspace connection state

### 2. Authentication
```bash
# Interactive terminal login
./noir login

# OAuth browser flow with GitHub
./noir login github

# OAuth browser flow with Google
./noir login google

# Check authenticated identity
./noir whoami

# Logout and revoke session
./noir logout
```

### 3. Project Connection & Workspace Management
```bash
# Connect workspace to a Noir cloud project code
./noir connect <PROJECT_CODE>

# Check current connection & telemetry status
./noir status

# View or update configuration keys
./noir config show
./noir config get backend
./noir config set backend http://api.production.noir.sh

# Disconnect workspace
./noir disconnect
```

### 4. Lynx AST Profiler & Static Analysis
```bash
# Scan technologies, runtime stack, and detect containers
./noir scan
./noir scan --path /path/to/project

# Full architecture and static reliability analysis
./noir analyze

# Force immediate profile synchronization with backend
./noir sync
```

### 5. Multi-Stack Test Detection & Execution
The test detector automatically identifies the test runner and virtual environment for:
- **Python**: pytest, unittest, Django `manage.py test` (prioritizing `.venv`, `venv`, `env`)
- **JavaScript / TypeScript**: Jest, Vitest, Mocha, npm test, yarn test, pnpm test
- **Go**: `go test ./...`
- **Rust**: `cargo test`
- **Java**: Maven (`mvn test`), Gradle (`./gradlew test`)
- **PHP**: PHPUnit (`./vendor/bin/phpunit`)
- **Ruby**: RSpec (`bundle exec rspec`), Rake test

```bash
# Run host test suite with live telemetry recording
./noir test

# Custom test command override
./noir test --command "pytest -v tests/"
```

### 6. Containerized Run & Live Telemetry
Builds or uses an existing Docker container, executes tests inside the container, streams live stdout/stderr telemetry, and cleanly tears down resources:
```bash
./noir run
./noir run --image myapp:latest --port 8080:8080
```

### 7. Chaos Engineering & Fault Injection Engine
Inject allowlisted, safe, reversible faults into local Docker containers with automated steady-state evaluation, latency percentiles, and resilience scoring:

```bash
# List supported faults and parameters
./noir fault list

# Inspect running project containers
./noir fault containers

# Inject Network Latency with HTTP steady-state probe
./noir fault inject network_delay \
  --target web-service \
  --latency 300 \
  --jitter 50 \
  --duration 15 \
  --probe-url http://localhost:8000/health

# Simulate 25% Packet Loss
./noir fault inject network_loss \
  --target db-service \
  --loss 25 \
  --duration 20

# Stress CPU with 4 workers
./noir fault inject cpu_stress \
  --target api-server \
  --workers 4 \
  --duration 30

# Memory Pressure Stress
./noir fault inject memory_stress \
  --target cache-service \
  --memory 512 \
  --duration 15

# Container Stop & Auto-Recovery
./noir fault inject container_stop \
  --target redis \
  --duration 10
```

#### Resilience Scoring Metrics
The fault engine computes:
- **Steady-State Availability**: Success rate before, during, and after fault
- **Sample-Gated Tail Latency**: P50, P75, P90, P95 (min 10 samples), P99 (min 20 samples)
- **Degradation Multiplier**: `In-Fault Mean Latency / Baseline Mean Latency`
- **Recovery Time Objective (RTO)**: Microsecond-precision time from fault rollback to full health recovery
- **Overall Resilience Score (0–100)**: Categorized as `Resilient (Production Grade)`, `Gracefully Degraded`, or `Fragile / High Risk`

---

## 🧪 Testing

Run the full automated test suite:
```bash
cd cli
go test -v ./...
```

Coverage includes:
- **Lynx Profiler**: Django, Node/React, and custom stack identification tests
- **Test Detector**: Go, Node, custom config, and empty directory abort tests
- **Chaos Engine**: Latency percentile gating, steady-state evaluation, and resilience scoring calculations
- **Auth Storage**: Keyring and `~/.noir/credentials.json` fallback isolation tests
- **Workspace Config**: Directory tree initialization, config serialization, and workspace removal tests
