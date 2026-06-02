import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/* Base URL used both here for the connection test and in the node requestDefaults */
const BASE_URL = 'https://api.simplescraper.io/v1';

export class SimpleScraperApi implements ICredentialType {
	name = 'simpleScraperApi';

	displayName = 'Simplescraper API';

	icon: Icon = 'file:simplescraper.svg';

	documentationUrl = 'https://simplescraper.io/docs/api-guide';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Simplescraper API key. Find it at https://simplescraper.io/dashboard/account (My Account then API Keys).',
		},
	];

	/* Generic auth — injects the Authorization header on every request */
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	/* Connection test: GET /recipes returns 200 for a valid key, 403 for invalid */
	test: ICredentialTestRequest = {
		request: {
			baseURL: BASE_URL,
			url: '/recipes',
			method: 'GET',
		},
	};
}
