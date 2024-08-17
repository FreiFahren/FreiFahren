import { StoryRequestSchema, type StoryRequest, type Inspector } from './models'
import { createImage } from './image'
import { createMediaContainer, publishMedia } from './instagram'
import { getInstagramUserToken, getValidAccessToken } from './auth'

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { serveStatic } from 'hono/bun'
import fs from 'fs/promises'
import cron from 'node-cron'
import path from 'path'

const app = new Hono()

app.use('/images/*', serveStatic({ root: './' }))

cron.schedule('0 0 * * *', async () => {
    const directory = './images'
    const now = Date.now()
    const files = await fs.readdir(directory)

    for (const file of files) {
        const filePath = path.join(directory, file)
        const stats = await fs.stat(filePath)
        const fileAge = now - stats.mtimeMs

        // Delete files older than 7 days
        if (fileAge > 7 * 24 * 60 * 60 * 1000) {
            await fs.unlink(filePath)
            console.log(`Deleted old file: ${file}`)
        }
    }
})

app.post('/instagram/stories', zValidator('json', StoryRequestSchema), async (c) => {
    try {
        const story: StoryRequest = c.req.valid('json')
        const inspector: Inspector = story

        const imgBuffer = await createImage(inspector)

        // Save the image to a file
        const folderPath = './images'
        await fs.mkdir(folderPath, { recursive: true })
        const imageName = `story_${Date.now()}.jpg`
        const imagePath = path.join(folderPath, imageName)
        await fs.writeFile(imagePath, imgBuffer)

        // Use the URL of your Coolify-hosted application
        const imageUrl = `${process.env.APP_URL}/images/${imageName}`

        const accessToken = await getValidAccessToken()
        const { pageAccessToken, instagramAccountId } = await getInstagramUserToken(accessToken)

        // Create media container
        const creationId = await createMediaContainer(instagramAccountId, pageAccessToken, imageUrl)

        // Publish media
        const mediaId = await publishMedia(instagramAccountId, pageAccessToken, creationId)

        console.log('Story posted successfully. Media ID:', mediaId)

        return c.json({
            status: 'success',
            message: 'Story posted successfully',
            mediaId,
        })
    } catch (error) {
        console.error('Error in /instagram/stories:', error)
        return c.json(
            {
                status: 'error',
                message: error instanceof Error ? error.message : 'An unknown error occurred',
            },
            500
        )
    }
})

export default {
    port: 8000,
    fetch: app.fetch,
}

console.log('Instagram Bot is running on port 8000')
