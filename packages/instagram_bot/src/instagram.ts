import { type MediaContainerResponse, type PublishMediaResponse } from './models'

import fetch from 'node-fetch'

/**
 * Creates a media container for an Instagram Story.
 *
 * This is the first step in a two-step process for posting a story to Instagram.
 * It prepares the media (in this case, an image) for publishing without actually posting it.
 *
 * @param {string} instagramAccountId - The Id of the Instagram business account
 * @param {string} pageAccessToken - The access token for the associated Facebook Page
 * @param {string} imageUrl - The URL of the image to be posted as a story
 *
 * @returns {Promise<string>} A promise that resolves to the Id of the created media container
 *
 * @throws {Error} If the API request fails or returns an unexpected response
 *
 * @example
 * const containerId = await createMediaContainer('123456789', 'EAABb...', 'https://example.com/image.jpg');
 */
export async function createMediaContainer(
    instagramAccountId: string,
    pageAccessToken: string,
    imageUrl: string
): Promise<string> {
    const response = await fetch(
        `https://graph.facebook.com/v20.0/${instagramAccountId}/media?image_url=${imageUrl}&media_type=STORIES&access_token=${pageAccessToken}`,
        {
            method: 'POST',
        }
    )

    if (!response.ok) {
        const errorData = await response.json()
        console.error('Error creating media container:', errorData)
        throw new Error(`Failed to create media container: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as MediaContainerResponse
    return data.id
}

/**
 * Publishes a previously created media container as an Instagram Story.
 *
 * This is the second step in the two-step process for posting a story to Instagram.
 * It takes the Id of a media container created by createMediaContainer() and publishes it as a story.
 *
 * @param {string} instagramAccountId - The Id of the Instagram business account
 * @param {string} pageAccessToken - The access token for the associated Facebook Page
 * @param {string} creationId - The Id of the media container to publish, obtained from createMediaContainer()
 *
 * @returns {Promise<string>} A promise that resolves to the Id of the published media
 *
 * @throws {Error} If the API request fails or returns an unexpected response
 *
 * @example
 * const mediaId = await publishMedia('123456789', 'EAABb...', 'media_container_id');
 */
export async function publishMedia(
    instagramAccountId: string,
    pageAccessToken: string,
    creationId: string
): Promise<string> {
    const response = await fetch(`https://graph.facebook.com/v20.0/${instagramAccountId}/media_publish`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            creation_id: creationId,
            access_token: pageAccessToken,
        }),
    })

    if (!response.ok) {
        const errorData = await response.json()
        console.error('Error publishing media:', errorData)
        throw new Error(`Failed to publish media: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as PublishMediaResponse
    return data.id
}
