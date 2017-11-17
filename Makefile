SHA1 := $(shell git rev-parse --short HEAD)

all: build

push:
	docker push chrissearle/verisure:$(SHA1)
	docker push chrissearle/verisure:latest

build:
	make check
	docker build . -t chrissearle/verisure:$(SHA1)
	docker tag chrissearle/verisure:$(SHA1) chrissearle/verisure:latest

check: install
	yarn lint

install: node_modules

node_modules: package.json yarn.lock
	yarn