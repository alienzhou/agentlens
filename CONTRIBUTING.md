# Contributing to AgentLens

Thank you for your interest in contributing to AgentLens! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22.15.1
- pnpm >= 9.5.0
- Git

### Setting Up Development Environment

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone git@github.com:YOUR_USERNAME/agentlens.git
   cd agentlens
   ```
3. Install dependencies:

   ```bash
   pnpm install
   ```
4. Build all packages:

   ```bash
   pnpm build
   ```
5. Run tests to verify setup:

   ```bash
   pnpm test:run
   ```

## 📝 Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### Making Changes

1. Make your changes in the appropriate package(s)
2. Add tests for new functionality
3. Ensure all tests pass: `pnpm test:run`
4. Ensure code passes linting: `pnpm lint`
5. Format code: `pnpm format`

### Package Structure

- `packages/core/` - Core library (data models, Git, detection)
- `packages/hook/` - Hook system (adapters, session monitoring)
- `packages/cli/` - CLI tool (commands, renderer)
- `packages/vscode/` - VS Code extension (blame annotations, sidebar views)

### Running Package-Specific Commands

```bash
# Run tests for a specific package
pnpm --filter @agentlens/core test

# Build a specific package
pnpm --filter @agentlens/cli build

# Run CLI in dev mode
pnpm --filter @agentlens/cli dev
```

## 🧪 Testing

### Writing Tests

- Place tests in `tests/` directory within each package
- Use descriptive test names
- Follow the existing test patterns
- Aim for good test coverage

### Running Tests

```bash
# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test

# Generate coverage report
pnpm test:coverage
```

## 📐 Code Style

We use ESLint and Prettier to maintain code quality:

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Code Style Guidelines

- Use TypeScript for all code
- Follow the existing code structure
- Add JSDoc comments for public APIs
- Use meaningful variable and function names
- Keep functions small and focused

## 📋 Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
feat(cli): add support for markdown output format
fix(core): correct similarity calculation for empty strings
docs: update README with installation instructions
test(hook): add tests for session watcher
```

## 🔍 Pull Request Process

1. **Update Documentation**: If your changes affect user-facing functionality, update the relevant documentation
2. **Add Tests**: Ensure your changes are covered by tests
3. **Update CHANGELOG**: Add an entry to the unreleased section
4. **Create Pull Request**:

   - Use a descriptive title following commit message conventions
   - Provide a clear description of the changes
   - Link related issues
   - Ensure CI passes
5. **Code Review**: Address reviewer feedback promptly
6. **Merge**: Once approved, a maintainer will merge your PR

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the behavior
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment**:
   - OS and version
   - Node.js version
   - pnpm version
   - AgentLens version
6. **Logs/Screenshots**: Any relevant logs or screenshots

## 💡 Suggesting Features

We welcome feature suggestions! Please:

1. Check if the feature has already been requested
2. Provide a clear use case
3. Explain how it aligns with the project goals
4. Consider implementation complexity
5. Be open to discussion and alternative solutions

## 📚 Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add examples
- Improve API documentation
- Translate documentation (future)

## 🏆 Recognition

Contributors will be:

- Listed in the project's contributors
- Mentioned in release notes for significant contributions
- Credited in the documentation

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check [docs/](./docs/) for detailed information

## 📜 License

By contributing to AgentLens, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Thank you for contributing to AgentLens! Your efforts help make code review better for everyone in the Vibe Coding era.
