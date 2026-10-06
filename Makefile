.PHONY: all build install test clean

all: build

build:
	$(MAKE) -C cli build

install:
	$(MAKE) -C cli install

test:
	$(MAKE) -C cli test

clean:
	$(MAKE) -C cli clean
