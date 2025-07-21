# CMVC VSCode Extension Makefile

# Variables
EXTENSION_NAME = cmvc-source-control
NODE_MODULES = node_modules
OUT_DIR = out
DIST_DIR = dist
PACKAGE_LOCK = package-lock.json

# Default target
.PHONY: all
all: build

# Install dependencies
.PHONY: install
install:
	@echo "Installing dependencies..."
	npm install

# Build the extension
.PHONY: build
build: install
	@echo "Building extension..."
	npm run compile

# Watch mode for development
.PHONY: watch
watch: install
	@echo "Starting watch mode..."
	npm run watch

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(OUT_DIR)
	rm -rf $(DIST_DIR)
	rm -f *.vsix

# Clean all (including node_modules)
.PHONY: clean-all
clean-all: clean
	@echo "Cleaning all dependencies..."
	rm -rf $(NODE_MODULES)
	rm -f $(PACKAGE_LOCK)

# Package the extension
.PHONY: package
package: build
	@echo "Packaging extension..."
	@if command -v vsce >/dev/null 2>&1; then \
		vsce package; \
	else \
		echo "Error: vsce not found. Install with: npm install -g @vscode/vsce"; \
		exit 1; \
	fi

# Install vsce globally (required for packaging)
.PHONY: install-vsce
install-vsce:
	@echo "Installing vsce globally..."
	npm install -g @vscode/vsce

# Run tests (placeholder for future test implementation)
.PHONY: test
test:
	@echo "Running tests..."
	@echo "No tests implemented yet."

# Lint the code (placeholder for future linting)
.PHONY: lint
lint:
	@echo "Linting code..."
	@echo "No linting configured yet."

# Format code (placeholder for future formatting)
.PHONY: format
format:
	@echo "Formatting code..."
	@echo "No formatting configured yet."

# Show help
.PHONY: help
help:
	@echo "CMVC VSCode Extension Makefile"
	@echo "=============================="
	@echo ""
	@echo "Available targets:"
	@echo "  all          - Build the extension (default)"
	@echo "  install      - Install npm dependencies"
	@echo "  build        - Build the extension"
	@echo "  watch        - Start watch mode for development"
	@echo "  clean        - Clean build artifacts"
	@echo "  clean-all    - Clean everything including dependencies"
	@echo "  package      - Package the extension (.vsix file)"
	@echo "  install-vsce - Install vsce globally for packaging"
	@echo "  test         - Run tests (placeholder)"
	@echo "  lint         - Lint code (placeholder)"
	@echo "  format       - Format code (placeholder)"
	@echo "  help         - Show this help message"
	@echo ""
	@echo "Examples:"
	@echo "  make build     # Build the extension"
	@echo "  make watch     # Start development mode"
	@echo "  make clean     # Clean build files"
	@echo "  make package   # Create .vsix package"

# Development workflow
.PHONY: dev
dev: build
	@echo "Development build complete. Press F5 in VSCode to debug."

# Production build
.PHONY: prod
prod: clean build package
	@echo "Production build complete."

# Quick rebuild (skip npm install if node_modules exists)
.PHONY: rebuild
rebuild:
	@if [ ! -d "$(NODE_MODULES)" ]; then \
		echo "Installing dependencies..."; \
		npm install; \
	fi
	@echo "Rebuilding extension..."
	npm run compile

# Check if extension is ready for packaging
.PHONY: check
check:
	@echo "Checking extension readiness..."
	@if [ ! -f "package.json" ]; then \
		echo "Error: package.json not found"; \
		exit 1; \
	fi
	@if [ ! -d "$(OUT_DIR)" ]; then \
		echo "Error: Extension not built. Run 'make build' first"; \
		exit 1; \
	fi
	@echo "Extension is ready for packaging."
