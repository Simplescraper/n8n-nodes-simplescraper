# n8n-nodes-simplescraper

n8n community node for [Simplescraper](https://simplescraper.io). Scrape any URL, run saved scrape recipes, extract structured data with AI, capture screenshots, and discover URLs from sitemaps - without writing scraping code.

## Install

In n8n: **Settings → Community Nodes → Install** → enter `n8n-nodes-simplescraper` and confirm.

Self-hosted instances can also `npm install n8n-nodes-simplescraper` in their custom-nodes directory. The package follows the standard n8n community node convention.

## Credentials

Get your API key from your [Simplescraper account page](https://simplescraper.io/dashboard/account). In n8n: **Credentials → New → Simplescraper API**, paste the key, save. The credential test hits `GET /recipes` - a green check means the key is valid.

## Operations

### Recipe

Work with saved Simplescraper recipes.

| Operation | What it does |
|---|---|
| **Run** | Runs a saved recipe. Optionally override the recipe's saved URL. Returns immediately with a `results_id` for long-running scrapes. |
| **Get Latest Results** | Fetches the most recent scrape results for a recipe. |
| **Get History** | Lists the last 100 runs of a recipe. |

### Page

Scrape any URL without a saved recipe.

| Operation | What it does |
|---|---|
| **Extract Data** | One-shot scrape of any URL. Optionally returns Markdown, raw HTML, and a screenshot URL. |
| **AI Extract** | Uses AI to extract structured data from a URL given a schema (e.g. `name, price, availability`). |
| **Screenshot** | Captures a pixel-perfect screenshot of any URL (1 credit). Returns a hosted URL by default. |

### URL

| Operation | What it does |
|---|---|
| **Extract URLs** | Discovers all URLs from a website's sitemap. No credits consumed. |

## Example: scrape every blog post on a site

Combine three operations to discover blog URLs and extract their content as clean markdown:

1. **URL > Extract URLs** with `https://simplescraper.io` - returns every URL in the site's sitemap. No credits consumed.
2. **Split Out** (n8n core node) on the `urls` field - turns the array into one item per URL.
3. **Filter** (n8n core node) keeping items where the URL contains `"blog"`.
4. **Page > Extract Data** with `Include Markdown` enabled, URL set to `{{ $json.urls }}` - pulls clean markdown from each filtered blog URL.

Useful for content audits, SEO inventories, or building a RAG corpus from a public site's blog. The Extract URLs step is free; each blog scrape costs 1 credit.

## Long-running scrapes

For recipes that take more than ~30 seconds, the **Run** operation uses async mode by default and returns immediately with a `results_id` and `status: "running"`. Use the **Get Latest Results** operation (or an HTTP Request node hitting `GET /v1/results/{results_id}`) to poll until `status` becomes `completed`.

AI Extract follows the same pattern - if the response status is `running`, poll `GET /v1/smart-extract/{extract_uid}`.

## Links

- [Simplescraper](https://simplescraper.io) - the service
- [API documentation](https://simplescraper.io/docs/api-guide) - endpoint reference
- [Report a bug or request a feature](https://github.com/simplescraper/n8n-nodes-simplescraper/issues)
- [npm package](https://www.npmjs.com/package/n8n-nodes-simplescraper)

## License

[MIT](LICENSE)
