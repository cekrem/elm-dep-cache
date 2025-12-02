# elm-dep-cache

A Node.js tool to cache Elm dependencies and avoid CI/CD connection timeouts.

## Problem

CI/CD pipelines sometimes experience connection timeouts when fetching Elm dependencies from package.elm-lang.org. This tool solves that by caching dependencies locally based on your `elm.json` checksum.

## Installation

### Global Installation

```bash
npm install -g elm-dep-cache
```

### Use with npx (no installation required)

```bash
npx elm-dep-cache
```

### Use in CI/CD

Add to your CI/CD pipeline before running Elm commands:

```bash
npx elm-dep-cache
```

## How It Works

1. **Calculates checksum** of your `elm.json` file
2. **Checks for cache**: Looks for `.elm-dep-cache/{checksum}/`
3. **Restores from cache** if found: Copies cached dependencies to `$ELM_HOME`
4. **Falls back to installation** if no cache: Runs Elm to fetch dependencies, then caches them

## Usage

Simply run in your Elm project directory (where `elm.json` exists):

```bash
npx elm-dep-cache
```

The tool will:

- Print what it's doing at each step
- Use cached dependencies when available (fast!)
- Fetch and cache dependencies when needed (slow first time, fast afterwards)

### Cleaning Old Caches

To remove all cached entries that don't match your current `elm.json`:

```bash
npx elm-dep-cache --clean
```

This is useful when:
- You've changed your `elm.json` multiple times and want to clean up old caches
- You want to free up disk space by removing unused dependency caches
- Your cache directory has accumulated many old versions

## Cache Location

Dependencies are cached in `./.elm-dep-cache/{checksum}/` relative to your project directory.

You can commit this directory to version control, or add it to your CI cache configuration.

## Environment Variables

- `ELM_HOME`: If set, uses this as the Elm home directory. Otherwise uses the default location:
  - macOS/Linux: `~/.elm`
  - Windows: `%APPDATA%/elm`

## Example Output

### Normal Run

```
[elm-dep-cache] Starting elm-dep-cache
[elm-dep-cache] elm.json checksum: a3f2c8b1...
[elm-dep-cache] ELM_HOME: /Users/username/.elm
[elm-dep-cache] Cache directory: ./.elm-dep-cache/a3f2c8b1...
[elm-dep-cache] Cache found!
[elm-dep-cache] Restoring Elm dependencies from cache: ./.elm-dep-cache/a3f2c8b1...
[elm-dep-cache] ✓ Successfully restored dependencies from cache
[elm-dep-cache] ✓ Done! Dependencies restored from cache.
```

### Clean Run

```
[elm-dep-cache] Starting elm-dep-cache
[elm-dep-cache] elm.json checksum: a3f2c8b1...
[elm-dep-cache] Cleaning old cache entries...
[elm-dep-cache]   Removing old cache: b4e7d9a2...
[elm-dep-cache]   Removing old cache: c8f1e3b5...
[elm-dep-cache]   Keeping current cache: a3f2c8b1...
[elm-dep-cache] ✓ Cleaned 2 old cache entries
[elm-dep-cache] ✓ Kept 1 current cache entry
[elm-dep-cache] ✓ Done!
```

## CI/CD Integration Examples

### GitHub Actions

```yaml
- name: Cache Elm dependencies
  run: npx elm-dep-cache

- name: Build Elm
  run: elm make src/Main.elm --output=main.js
```

### GitLab CI

```yaml
build:
  script:
    - npx elm-dep-cache
    - elm make src/Main.elm --output=main.js
```

### CircleCI

```yaml
- run:
    name: Cache Elm dependencies
    command: npx elm-dep-cache

- run:
    name: Build Elm
    command: elm make src/Main.elm --output=main.js
```

## Committing Cache to Git

If you want to commit the cache to your repository:

```bash
git add .elm-dep-cache
git commit -m "Add Elm dependencies cache"
```

This ensures the cache is available immediately on CI without any downloads.

## Adding to .gitignore

If you prefer to use CI's caching mechanism instead:

```
.elm-dep-cache/
```

Then configure your CI to cache the `.elm-dep-cache` directory.

## License

MIT
