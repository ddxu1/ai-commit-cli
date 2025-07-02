# AI Commit CLI (ag)

An AI-powered CLI tool that generates intelligent git commit messages using Claude AI.

## Features

- 🤖 Generates conventional commit messages using Claude AI
- 📊 Analyzes project context and file changes
- 🔄 Interactive options to accept, edit, or regenerate messages
- 🎯 Supports multiple project types (React, Vue, Node.js, Python, etc.)

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd ai-commit-cli
```

2. Install dependencies:
```bash
npm install
```

3. Install globally:
```bash
npm install -g .
```

## Setup

1. Get your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

2. Run the tool for the first time - it will prompt you to enter your API key:
```bash
ag
```

Your API key will be saved to `~/.ai-commit-config.json`

## Usage

1. Stage your changes:
```bash
git add .
```

2. Generate and commit with AI:
```bash
ag
```

3. Choose from the interactive options:
   - `[a]` Accept the suggested message
   - `[e]` Edit the message
   - `[r]` Regenerate a new message
   - `[c]` Cancel

## Requirements

- Node.js 14+
- Git repository
- Anthropic API key

## License

ISC