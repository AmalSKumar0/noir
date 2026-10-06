.PHONY: all build install test clean

BINARY_NAME=noir
INSTALL_DIR=$(HOME)/.local/bin
LDFLAGS=-ldflags="-s -w"

all: test build

build:
	go build $(LDFLAGS) -o $(BINARY_NAME) main.go

install:
	mkdir -p $(INSTALL_DIR)
	go build $(LDFLAGS) -o $(INSTALL_DIR)/$(BINARY_NAME) main.go
	@echo "Installed noir binary to $(INSTALL_DIR)/$(BINARY_NAME)"

test:
	go test -v ./...

clean:
	rm -f $(BINARY_NAME)
