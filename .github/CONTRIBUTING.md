# Contributing to MuseMelody

Thank you for contributing to MuseMelody.

This repository contains:

- The public-facing product homepage
- The embedded studio experience
- Cloudflare Pages Functions used by the site
- The original `program/Musemelody` source tree retained for reference and continued development

## Before You Start

Please:

- Read the README first
- Check whether an issue or pull request already covers the same work
- Keep changes focused and avoid unrelated cleanup in the same PR

## Development Workflow

### Install root dependencies

```bash
npm install
```

### Install studio frontend dependencies

```bash
cd program/Musemelody/frontend
npm install
```

### Rebuild the embedded studio

```bash
cd ../../..
npm run build:studio
```

### Run the site locally

```bash
npm run dev
```

## Contribution Guidelines

When contributing:

- Preserve the current product direction unless the change explicitly revises it
- Prefer small, reviewable pull requests
- Avoid committing generated junk, local environments, or OS metadata
- Update documentation when behavior or project structure changes

## Pull Requests

Good pull requests usually include:

- A concise summary of what changed
- The reason for the change
- Screenshots for UI work when relevant
- Any manual test notes if the change affects runtime behavior

## File Hygiene

Do not commit:

- `node_modules/`
- Python virtual environments such as `.venv/`
- `__pycache__/`
- `.DS_Store`
- `__MACOSX/`
- zip archives or extracted junk

## Recommended Areas for Contribution

- Product UI refinement
- Better result visualization
- Improved API behavior and validation
- Real model integration
- Export and playback improvements
- Documentation updates
