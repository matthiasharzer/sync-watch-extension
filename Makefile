install-dependencies:
	@npm ci

qa: install-dependencies analyze typecheck

typecheck:
	@npm run typecheck

analyze:
	@npm run analyze

build: install-dependencies
	@npm run build

.PHONY: qa \
				analyze \
				typecheck \
				build \
				install-dependencies
