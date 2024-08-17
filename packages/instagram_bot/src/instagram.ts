import fetch from 'node-fetch';

export async function createMediaContainer(
	instagramAccountId: string,
	pageAccessToken: string,
	imageUrl: string
): Promise<string> {
	const response = await fetch(
		`https://graph.facebook.com/v20.0/${instagramAccountId}/media`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				image_url: imageUrl,
				media_type: 'STORIES',
				access_token: pageAccessToken,
			}),
		}
	);

	if (!response.ok) {
		const errorData = await response.json();
		console.error('Error creating media container:', errorData);
		throw new Error(
			`Failed to create media container: ${response.status} ${response.statusText}`
		);
	}

	const data = await response.json();
	return data.id;
}

export async function publishMedia(
	instagramAccountId: string,
	pageAccessToken: string,
	creationId: string
): Promise<string> {
	const response = await fetch(
		`https://graph.facebook.com/v20.0/${instagramAccountId}/media_publish`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				creation_id: creationId,
				access_token: pageAccessToken,
			}),
		}
	);

	if (!response.ok) {
		const errorData = await response.json();
		console.error('Error publishing media:', errorData);
		throw new Error(
			`Failed to publish media: ${response.status} ${response.statusText}`
		);
	}

	const data = await response.json();
	return data.id;
}
