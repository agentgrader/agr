# Agentgrader - Developer Task Runner
set shell := ["bash", "-cu"]

default: build

# Install dependencies across all packages
install:
	bun install

# Build the entire monorepo using Turborepo and Bun
build:
	bun run build

# Run the benchmark matrix
# Usage: just bench
# Usage: just bench configs=examples/configs/baseline.yaml suite=examples/suites/typescript-bugs
bench configs="examples/configs/baseline.yaml" suite="examples/suites/typescript-bugs" concurrency="2":
	bun packages/cli/dist/index.js bench --configs {{configs}} --suite {{suite}} --concurrency {{concurrency}}

# Run an optimizer matrix sweep (model/temperature/etc. comparison + Pareto summary)
# Usage: just optimize
# Usage: just optimize matrix=examples/matrices/model-comparison.yaml suite=examples/suites/typescript-bugs
optimize matrix="examples/matrices/model-comparison.yaml" suite="examples/suites/typescript-bugs" concurrency="2":
	bun packages/cli/dist/index.js bench --matrix {{matrix}} --suite {{suite}} --concurrency {{concurrency}}

# Run a single test case
# Usage: just run examples/suites/typescript-bugs/add-error-handling/agr.yaml
# Usage: just run examples/suites/typescript-bugs/add-error-handling/agr.yaml config=examples/configs/baseline.yaml
run testcase config="":
	if [ -n "{{config}}" ]; then \
	  bun packages/cli/dist/index.js run {{testcase}} --config {{config}}; \
	else \
	  bun packages/cli/dist/index.js run {{testcase}}; \
	fi

# Clean all Docker containers and build artifacts
clean:
	docker ps -aq --filter "ancestor=node:20" | xargs docker rm -f 2>/dev/null || true
	rm -rf packages/*/dist packages/*/node_modules node_modules .turbo .agr

# Lint codebase using Biome
lint:
	bun run lint

# Format codebase using Biome
format:
	bun run format
