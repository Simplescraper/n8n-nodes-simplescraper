# n8n-nodes-simplescraper

An n8n community node for [Simplescraper](https://simplescraper.io) - a web scraping API that lets you run saved recipes, extract data from any URL, capture screenshots, and discover site URLs without writing scraping code.

## Operations

| Resource | Operation | Endpoint |
|----------|-----------|----------|
| Recipe | Run | `POST /recipes/:id/run` |
| Recipe | Get Latest Results | `GET /recipes/:id/results-latest` |
| Recipe | Get History | `GET /recipes/:id/results-history` |
| URL | Extract URLs | `POST /extract-urls` |
| Page | Extract Data | `POST /extract` |
| Page | AI Extract | `POST /smart-extract` |
| Page | Screenshot | `POST /screenshot` |

---

## Step-by-step setup

### Prerequisites

- Node.js 18 or higher
- An npm account at [npmjs.com](https://www.npmjs.com) (for publishing)
- A GitHub repository for the package source (required for provenance publishing — see step 4)

---

### Step 1 - Scaffold via the official n8n node CLI (recommended)

Rather than starting from this repo from scratch, the official way to create a community node is:

```bash
npm create @n8n/node@latest
```

Follow the prompts to choose a node name and type. The CLI scaffolds the exact file structure and configuration that n8n's automated verification checks expect. This repo follows those same conventions, so you can use it as a reference or copy files into a CLI-scaffolded project.

If the command above fails, check the [n8n node creation docs](https://docs.n8n.io/integrations/creating-nodes/) for the current scaffolding command — it can change between releases.

---

### Step 2 - Install, build, and lint

```bash
# Install all dependencies (including the @n8n/node-cli build toolchain)
npm install

# Compile TypeScript and copy assets (svg, json) to dist/
npm run build

# Run the verification linter - must be clean before submitting
npm run lint
```

`npm run lint` runs the same `@n8n/node-cli` checks n8n uses for verification. Fix every error (warnings are reviewed but don't block). `npm run lint:fix` autofixes the simple ones - but check its output, because its action-casing autofix mangles acronyms (it will rewrite "URLs" to "ur ls"). Both build and lint are currently clean.

This is the automated test layer for the node: the TypeScript compiler type-checks the routing/field config and the recipe-list mapping, and the linter enforces n8n's node conventions. (There is no separate unit-test suite here, unlike the Zapier folder - an n8n declarative node is configuration the compiler and linter already validate; behaviour is verified by loading it in a real n8n, below.)

> Note: `package.json` pins `eslint` to `9.29.0` to match the `@n8n/node-cli` peer dependency. Bumping eslint past that breaks `npm install` with a peer conflict.

---

### Step 3 - Test in a local n8n instance

The quickest way is the n8n CLI's dev server, which launches a local n8n with this node loaded and hot-reloads on change:

```bash
npm run dev
```

Open the n8n editor it prints (default http://localhost:5678), add a Simplescraper credential with your API key, then build a workflow exercising each operation (Recipe > Run / Get Latest / Get History, URL > Map all pages, Page > Extract Data / AI Extract / Screenshot).

Manual alternative - link the built package into n8n's custom folder:

```bash
# From this package root
npm link

# Then in your n8n custom nodes directory (default: ~/.n8n/custom)
cd ~/.n8n/custom
npm link n8n-nodes-simplescraper
```

Restart n8n; the node appears under "Community Nodes". Or set `N8N_CUSTOM_EXTENSIONS` to the absolute path of this package's `dist/` folder.

---

### Step 4 - Publish to npm with provenance (required for n8n verification)

From 2026-05-01, n8n only verifies community nodes that were published to npm via GitHub Actions with npm provenance attestation. Locally-published packages (`npm publish` from your machine) will not pass n8n's verification check.

**One-time setup:**

1. Push this repo to GitHub.
2. Go to your GitHub repo - Settings - Secrets and variables - Actions.
3. Add a repository secret named `NPM_TOKEN` containing an npm access token with publish permissions. Generate one at [npmjs.com](https://www.npmjs.com) under Account - Access Tokens.
4. Make sure your npm account has two-factor authentication set to "Authorization only" (not "Authorization and publishing"), or use a granular token scoped to this package.

**Publishing a release:**

```bash
# Bump the version in package.json, then tag and push
git tag v0.1.0
git push origin v0.1.0
```

The `.github/workflows/publish.yml` workflow triggers on the tag push, runs `npm ci`, `npm run build`, then `npm publish --provenance --access public`. The provenance attestation links the published package to the specific GitHub Actions run, which is what n8n's verification system checks.

---

### Step 5 - Submit for n8n verification

Once your package is on npm with provenance, submit it for listing in n8n's community node registry:

[Submit a community node](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)

**Verification requirements and constraints:**

- Package name must follow the pattern `n8n-nodes-<name>` and the `keywords` array in `package.json` must include `n8n-community-node-package`. Both are already set in this repo.
- Each package must cover exactly one third-party service. A trigger node for the same service may ship in the same package, but multiple unrelated services in one package will be rejected.
- Do not build Logic or Flow-control nodes (e.g., IF, Switch, Merge) — those are reserved for n8n core.
- Your node must not duplicate a node that already ships with n8n or is already in the verified community registry.
- Nodes that compete directly with n8n's paid or enterprise features may be rejected.
- The package must be published via GitHub Actions with provenance (see step 4) — not published locally.
- Review the full [verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/) before submitting.

---

## Credentials

The node uses an API key credential. In n8n, go to Credentials - New - Simplescraper API, and paste your API key from [My Account in the Simplescraper dashboard](https://simplescraper.io/dashboard/account).

The credential sends `Authorization: Bearer <key>` on every request and tests connectivity against `GET /recipes` (on the `https://api.simplescraper.io/v1` base).

---

## Long-running operations

Recipe runs and AI extractions can take longer than n8n's default HTTP timeout. The Run operation sends `runAsync: true` by default, which returns immediately with a `results_id`. Use a subsequent HTTP Request node to poll `GET https://api.simplescraper.io/v1/results/:resultsId` until `status` is no longer `running`.

---

## Reference links

- [n8n community node documentation](https://docs.n8n.io/integrations/creating-nodes/)
- [Simplescraper API guide](https://simplescraper.io/docs/api-guide)
- [n8n node verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)
- [Submit a community node](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)
