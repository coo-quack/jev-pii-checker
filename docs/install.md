# Installation

## Global Install (npm)

Install globally with Bun:

```bash
bun install -g @coo-quack/jev-pii-checker
jev-pii-checker --version
```

Use it anywhere:

```bash
export TYPESAFE_API_KEY="your-key"
jev-pii-checker myfile.txt
```

## Run Without Installing (bunx)

```bash
bunx @coo-quack/jev-pii-checker myfile.txt
```

## Install From Source

Clone the repository and build locally:

```bash
git clone https://github.com/coo-quack/jev-pii-checker.git
cd jev-pii-checker
bun install
bun run build
```

The binary is at `dist/cli.js`. Run it directly:

```bash
export TYPESAFE_API_KEY="your-key"
node dist/cli.js myfile.txt
```

Or make it globally available:

```bash
chmod +x dist/cli.js
export PATH="$(pwd)/dist:$PATH"
jev-pii-checker myfile.txt
```

## Requirements

- **Bun** (recommended for development and installation)
- **Node.js 20+** (to run the CLI from a built binary)

Bun is the build runtime and used in the `bun install` / `bun run` commands. However, once built, the CLI is a Node.js script and runs on Node.js 20 or newer.

## Verify Installation

Check that the CLI is available and can print its version:

```bash
jev-pii-checker --version
# jev-pii-checker 0.1.0
```

## API Key Setup

Before you can scan, set your TypeSafe API key:

```bash
export TYPESAFE_API_KEY="your-api-key"
jev-pii-checker --help
```

See [Getting Started](./getting-started) for detailed API key setup and alternative methods.
