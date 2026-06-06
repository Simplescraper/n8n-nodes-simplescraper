import type {
	IDataObject,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const BASE_URL = 'https://api.simplescraper.io/v1';

/* ─── Response shaping ───────────────────────────────────────────────────── */

type ScrapeRunResult = {
	results_id?: string;
	date_completed?: string;
	status?: string;
	errors?: IDataObject[];
	data?: IDataObject[];
	screenshots?: Array<{ url_uid?: string | number; screenshot?: string }>;
};

// One item per scraped row. Run-level fields (results_id, status, errors, ...) are
// carried on each row; the row's own fields win on any name clash. The page
// screenshot is attached by url_uid, but only when the run captured screenshots.
async function splitScrapedRows(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const { data = [], screenshots = [], ...run } = (response.body ?? {}) as ScrapeRunResult;
	if (data.length === 0) {
		return [{ json: { ...run } }];
	}
	const screenshotByUid = new Map<string, string | undefined>();
	for (const shot of screenshots) {
		if (shot.url_uid != null) {
			screenshotByUid.set(String(shot.url_uid), shot.screenshot);
		}
	}
	return data.map((row) => {
		const json: IDataObject = { ...run, ...row };
		if (screenshots.length > 0 && row.url_uid != null) {
			json.screenshot = screenshotByUid.get(String(row.url_uid)) ?? null;
		}
		return { json };
	});
}

// One item per discovered URL.
async function splitExtractedUrls(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const data = (response.body as IDataObject)?.data as IDataObject | undefined;
	const urls = (data?.urls as string[] | undefined) ?? [];
	return urls.map((url) => ({ json: { url } }));
}

/* ─── displayOptions helpers ─────────────────────────────────────────────── */

const showForRecipe = { resource: ['recipe'] };
const showForUrl = { resource: ['url'] };
const showForPage = { resource: ['page'] };

const showForRecipeRun = { resource: ['recipe'], operation: ['run'] };
const showForRecipeLatest = { resource: ['recipe'], operation: ['getLatest'] };
const showForRecipeResultsById = { resource: ['recipe'], operation: ['getResultsById'] };

/* The recipe picker only applies to operations that act on a saved recipe.
   Get Results by ID is keyed on a results_id, so it must NOT show the picker. */
const showForRecipeWithRecipeId = {
	resource: ['recipe'],
	operation: ['run', 'getLatest', 'getHistory'],
};
const showForUrlExtract = { resource: ['url'], operation: ['extractUrls'] };
const showForPageExtract = { resource: ['page'], operation: ['extract'] };
const showForPageAiExtract = { resource: ['page'], operation: ['aiExtract'] };
const showForPageScreenshot = { resource: ['page'], operation: ['screenshot'] };

/* ─── Recipe resource ────────────────────────────────────────────────────── */

const recipeOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: showForRecipe },
	options: [
		{
			name: 'Run',
			value: 'run',
			action: 'Run a recipe',
			description: 'Run a saved recipe against a URL and return scraped data',
			routing: {
				request: {
					method: 'POST',
					url: '=/recipes/{{$parameter.recipeId}}/run',
				},
			},
		},
		{
			name: 'Get Latest Results',
			value: 'getLatest',
			action: 'Get latest results for a recipe',
			description: 'Fetch the most recent completed run for a recipe',
			routing: {
				request: {
					method: 'GET',
					url: '=/recipes/{{$parameter.recipeId}}/results-latest',
				},
				output: {
					postReceive: [splitScrapedRows],
				},
			},
		},
		{
			name: 'Get History',
			value: 'getHistory',
			action: 'Get run history for a recipe',
			description: 'List the last 100 runs for a recipe',
			routing: {
				request: {
					method: 'GET',
					url: '=/recipes/{{$parameter.recipeId}}/results-history',
				},
			},
		},
		{
			name: 'Get Results by ID',
			value: 'getResultsById',
			action: 'Get results by ID',
			description: 'Fetch a run\'s results by its results_id (from an async Run or the New Results trigger)',
			routing: {
				request: {
					method: 'GET',
					url: '=/results/{{$parameter.resultsId}}',
				},
				output: {
					postReceive: [splitScrapedRows],
				},
			},
		},
	],
	default: 'run',
};

/* Recipe ID — shown for the recipe operations that act on a saved recipe
   (Run, Get Latest Results, Get History). Get Results by ID is keyed on a
   results_id instead, so it deliberately excludes this picker. */
const recipeIdDescription: INodeProperties = {
	displayName: 'Recipe',
	name: 'recipeId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	displayOptions: { show: showForRecipeWithRecipeId },
	description: 'The saved Simplescraper recipe to use',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'getRecipes',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. abc123',
			validation: [{ type: 'regex', properties: { regex: '.+', errorMessage: 'Recipe ID is required' } }],
		},
	],
};

/* Run operation fields */
const recipeRunDescription: INodeProperties[] = [
	{
		displayName: 'Source URL',
		name: 'sourceUrl',
		type: 'string',
		default: '',
		placeholder: 'https://example.com/page',
		displayOptions: { show: showForRecipeRun },
		description:
			"Optional. Leave blank to scrape the recipe's saved URL. Set this only to override the recipe's URL for this run (for example, to point the same recipe at a different page).",
		routing: {
			send: {
				type: 'body',
				property: 'sourceUrl',
				value: '={{$value || undefined}}',
			},
		},
	},
	{
		displayName: 'URLs',
		name: 'urls',
		type: 'string',
		typeOptions: {
			multipleValues: true,
			multipleValueButtonText: 'Add URL',
		},
		default: [],
		placeholder: 'https://example.com/page',
		displayOptions: { show: showForRecipeRun },
		description:
			"Scrape many pages through this recipe in one run. Returns a results_id to fetch later with Get Results by ID. Replaces the recipe's saved crawler list and always runs asynchronously. Up to 5000 URLs (scrape count is capped by your available credits).",
		routing: {
			send: {
				type: 'body',
				property: 'urls',
				/* Only send the array when the user has added at least one URL */
				value: '={{ $value && $value.length ? $value : undefined }}',
			},
		},
	},
	{
		displayName: 'Run Asynchronously',
		name: 'runAsync',
		type: 'boolean',
		default: true,
		displayOptions: { show: showForRecipeRun },
		description:
			'Whether to return immediately with a results_id you can poll later. Recommended for recipes that take more than 30 seconds.',
		routing: {
			send: {
				type: 'body',
				property: 'runAsync',
			},
		},
	},
	{
		displayName: 'Extract Markdown',
		name: 'extractMarkdown',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForRecipeRun },
		description: 'Whether to include a Markdown representation of the page in the response',
		routing: {
			send: {
				type: 'body',
				property: 'extractMarkdown',
			},
		},
	},
];

/* Get Latest / Get History — optional pagination */
const recipeResultsPaginationDescription: INodeProperties[] = [
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: { show: showForRecipeLatest },
		description: 'Max number of results to return',
		routing: {
			send: {
				type: 'query',
				property: 'limit',
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		displayOptions: { show: showForRecipeLatest },
		description: 'Pagination cursor returned from a previous request',
		routing: {
			send: {
				type: 'query',
				property: 'cursor',
			},
		},
	},
];

/* Get Results by ID — fetch a run by its results_id (not recipe-scoped) */
const recipeResultsByIdDescription: INodeProperties[] = [
	{
		displayName: 'Results ID',
		name: 'resultsId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. abc123',
		displayOptions: { show: showForRecipeResultsById },
		description:
			'The results_id of the run to fetch. Comes from a Run a Recipe async run or the New Results trigger.',
	},
	{
		displayName: 'Limit',
		name: 'resultsByIdLimit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: { show: showForRecipeResultsById },
		description: 'Max number of results to return',
		routing: {
			send: {
				type: 'query',
				property: 'limit',
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'resultsByIdCursor',
		type: 'string',
		default: '',
		displayOptions: { show: showForRecipeResultsById },
		description: 'Pagination cursor returned from a previous request',
		routing: {
			send: {
				type: 'query',
				property: 'cursor',
				value: '={{$value || undefined}}',
			},
		},
	},
];

/* ─── URL resource ───────────────────────────────────────────────────────── */

const urlOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: showForUrl },
	options: [
		{
			name: 'Extract URLs',
			value: 'extractUrls',
			// eslint-disable-next-line n8n-nodes-base/node-param-operation-option-action-miscased -- "URLs" is an acronym
			action: 'Extract all URLs from a website',
			description: 'Discover all URLs on a site via its sitemap. No credits consumed.',
			routing: {
				request: {
					method: 'POST',
					url: '/extract-urls',
				},
				output: {
					postReceive: [splitExtractedUrls],
				},
			},
		},
	],
	default: 'extractUrls',
};

const urlExtractDescription: INodeProperties[] = [
	{
		displayName: 'Website URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com',
		displayOptions: { show: showForUrlExtract },
		description: 'Full URL including protocol of the site to extract URLs from',
		routing: {
			send: {
				type: 'body',
				property: 'domain',
			},
		},
	},
	{
		displayName: 'URL Limit',
		name: 'urlLimit',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: showForUrlExtract },
		description: 'Maximum number of URLs to return. Set to 0 for no limit.',
		routing: {
			send: {
				type: 'body',
				property: 'urlLimit',
				/* Only send when the user provides a non-zero value */
				value: '={{$value > 0 ? $value : undefined}}',
			},
		},
	},
	{
		displayName: 'Sitemap Limit',
		name: 'sitemapLimit',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: showForUrlExtract },
		description:
			'For sitemap-index sites: maximum number of nested sitemaps to traverse. Set to 0 for no limit.',
		routing: {
			send: {
				type: 'body',
				property: 'sitemapLimit',
				value: '={{$value > 0 ? $value : undefined}}',
			},
		},
	},
];

/* ─── Page resource ──────────────────────────────────────────────────────── */

const pageOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: showForPage },
	options: [
		{
			name: 'AI Extract',
			value: 'aiExtract',
			action: 'Extract structured data from a URL with a schema',
			description: 'Use AI to extract structured data from a URL using a schema',
			routing: {
				request: {
					method: 'POST',
					url: '/smart-extract',
				},
			},
		},
		{
			name: 'Extract Data',
			value: 'extract',
			action: 'Extract data from a URL',
			description: 'Scrape a URL without a saved recipe and return content/data',
			routing: {
				request: {
					method: 'POST',
					url: '/extract',
				},
			},
		},
		{
			name: 'Screenshot',
			value: 'screenshot',
			action: 'Capture a screenshot of a URL',
			description: 'Capture a pixel-perfect screenshot of any web page (1 credit)',
			routing: {
				request: {
					method: 'POST',
					url: '/screenshot',
				},
			},
		},
	],
	default: 'extract',
};

/* Extract Data fields */
const pageExtractDescription: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/page',
		displayOptions: { show: showForPageExtract },
		description: 'The page URL to extract data from',
		routing: {
			send: {
				type: 'body',
				property: 'url',
			},
		},
	},
	{
		displayName: 'Include Markdown',
		name: 'markdown',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForPageExtract },
		description: 'Whether to include a Markdown rendering of the page body',
		routing: {
			send: {
				type: 'body',
				property: 'markdown',
			},
		},
	},
	{
		displayName: 'Include HTML',
		name: 'html',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForPageExtract },
		description: 'Whether to include the raw page HTML',
		routing: {
			send: {
				type: 'body',
				property: 'html',
			},
		},
	},
	{
		displayName: 'Include Screenshot',
		name: 'screenshot',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForPageExtract },
		description: 'Whether to capture and return a screenshot of the page',
		routing: {
			send: {
				type: 'body',
				property: 'screenshot',
			},
		},
	},
];

/* AI Extract fields */
const pageAiExtractDescription: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/product',
		displayOptions: { show: showForPageAiExtract },
		description: 'The page URL to extract structured data from',
		routing: {
			send: {
				type: 'body',
				property: 'url',
			},
		},
	},
	{
		displayName: 'Schema',
		name: 'schema',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'name, price, availability, sku, brand',
		displayOptions: { show: showForPageAiExtract },
		description:
			'Comma-separated list of properties to extract, e.g. "name, price, availability, sku"',
		routing: {
			send: {
				type: 'body',
				property: 'schema',
			},
		},
	},
];

/* Screenshot fields */
const pageScreenshotDescription: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com',
		displayOptions: { show: showForPageScreenshot },
		description: 'The page URL to capture',
		routing: {
			send: {
				type: 'body',
				property: 'url',
			},
		},
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		default: 'url',
		options: [
			{
				name: 'Base64',
				value: 'base64',
				description: 'Returns the image as a base64-encoded string inside the response',
			},
			{
				name: 'Hosted URL',
				value: 'url',
				description: 'Saves the image and returns a public URL (30-day TTL). Easiest for downstream nodes.',
			},
		],
		displayOptions: { show: showForPageScreenshot },
		description: 'How the screenshot is delivered',
		routing: {
			send: {
				type: 'body',
				property: 'output',
			},
		},
	},
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		default: 'png',
		options: [
			{ name: 'JPEG', value: 'jpeg' },
			{ name: 'PNG', value: 'png' },
			{ name: 'WebP', value: 'webp' },
		],
		displayOptions: { show: showForPageScreenshot },
		description: 'Image format',
		routing: {
			send: {
				type: 'body',
				property: 'format',
			},
		},
	},
	{
		displayName: 'Full Page',
		name: 'fullPage',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForPageScreenshot },
		description: 'Whether to capture the full scrollable page instead of just the viewport',
		routing: {
			send: {
				type: 'body',
				property: 'full_page',
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showForPageScreenshot },
		options: [
			{
				displayName: 'Delay (Seconds)',
				name: 'delay',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0, maxValue: 15 },
				description: 'Seconds to wait after page load before capture (0-15)',
				routing: { send: { type: 'body', property: 'delay' } },
			},
			{
				displayName: 'Device Scale Factor',
				name: 'deviceScaleFactor',
				type: 'options',
				default: 1,
				options: [
					{ name: '1x', value: 1 },
					{ name: '1.5x', value: 1.5 },
					{ name: '2x', value: 2 },
					{ name: '3x', value: 3 },
				],
				description: 'Pixel density multiplier',
				routing: { send: { type: 'body', property: 'device_scale_factor' } },
			},
			{
				displayName: 'Hide Ads',
				name: 'hideAds',
				type: 'boolean',
				default: true,
				description: 'Whether to hide ad network content during page load',
				routing: { send: { type: 'body', property: 'hide_ads' } },
			},
			{
				displayName: 'Hide Background',
				name: 'hideBackground',
				type: 'boolean',
				default: false,
				description:
					'Whether to make the page background transparent. PNG/WebP only - ignored for JPEG.',
				routing: { send: { type: 'body', property: 'hide_background' } },
			},
			{
				displayName: 'Hide Popups',
				name: 'hidePopups',
				type: 'boolean',
				default: true,
				description: 'Whether to hide cookie consent popups before capture',
				routing: { send: { type: 'body', property: 'hide_popups' } },
			},
			{
				displayName: 'JPEG/WebP Quality',
				name: 'quality',
				type: 'number',
				default: 80,
				typeOptions: { minValue: 1, maxValue: 100 },
				description: 'Compression quality 1-100. Ignored for PNG.',
				routing: { send: { type: 'body', property: 'quality' } },
			},
			{
				displayName: 'Viewport Height',
				name: 'viewportHeight',
				type: 'number',
				default: 1080,
				typeOptions: { minValue: 320, maxValue: 3840 },
				description: 'Browser viewport height in pixels (320-3840)',
				routing: { send: { type: 'body', property: 'viewport_height' } },
			},
			{
				displayName: 'Viewport Width',
				name: 'viewportWidth',
				type: 'number',
				default: 1920,
				typeOptions: { minValue: 320, maxValue: 3840 },
				description: 'Browser viewport width in pixels (320-3840)',
				routing: { send: { type: 'body', property: 'viewport_width' } },
			},
			{
				displayName: 'Wait For Selector',
				name: 'waitForSelector',
				type: 'string',
				default: '',
				placeholder: '#main-content',
				description: 'CSS selector to wait for before capturing',
				routing: {
					send: {
						type: 'body',
						property: 'wait_for_selector',
						value: '={{$value || undefined}}',
					},
				},
			},
			{
				displayName: 'Wait Until',
				name: 'waitUntil',
				type: 'options',
				default: 'load',
				options: [
					{ name: 'DOM Content Loaded', value: 'domcontentloaded' },
					{ name: 'Load (All Resources)', value: 'load' },
					{ name: 'Network Idle (0 Conns)', value: 'networkidle0' },
					{ name: 'Network Idle (≤2 Conns)', value: 'networkidle2' },
				],
				description: 'Page load event to wait for',
				routing: { send: { type: 'body', property: 'wait_until' } },
			},
		],
	},
];

/* ─── Node definition ────────────────────────────────────────────────────── */

export class SimpleScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Simplescraper',
		name: 'simpleScraper',
		icon: 'file:simplescraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Scrape web pages, run saved recipes, and extract structured data via Simplescraper',
		defaults: {
			name: 'Simplescraper',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'simpleScraperApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: BASE_URL,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		},
		properties: [
			/* ── Resource selector ── */
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Page',
						value: 'page',
						description: 'Extract data from any URL without a saved recipe',
					},
					{
						name: 'Recipe',
						value: 'recipe',
						description: 'Work with saved Simplescraper recipes',
					},
					{
						name: 'URL',
						value: 'url',
						description: 'Discover URLs from a website sitemap',
					},
				],
				default: 'recipe',
			},

			/* ── Recipe operations ── */
			recipeOperationDescription,
			recipeIdDescription,
			...recipeRunDescription,
			...recipeResultsPaginationDescription,
			...recipeResultsByIdDescription,

			/* ── URL operations ── */
			urlOperationDescription,
			...urlExtractDescription,

			/* ── Page operations ── */
			pageOperationDescription,
			...pageExtractDescription,
			...pageAiExtractDescription,
			...pageScreenshotDescription,
		],
		usableAsTool: true,
	};

	/* ─── Dynamic list for the recipe picker ──────────────────────────────── */
	methods = {
		listSearch: {
			async getRecipes(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				type RecipeItem = { recipe_id: string; name: string };
				type RecipesResponse = { data: RecipeItem[] };

				const qs: Record<string, string | number> = { limit: 100 };
				if (filter) {
					qs.q = filter;
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'simpleScraperApi',
					{
						method: 'GET',
						url: `${BASE_URL}/recipes`,
						qs,
						json: true,
					},
				);

				const body = response as RecipesResponse;

				const results: INodeListSearchItems[] = (body.data ?? []).map((item: RecipeItem) => ({
					name: item.name,
					value: item.recipe_id,
				}));

				return { results };
			},
		},
	};
}
