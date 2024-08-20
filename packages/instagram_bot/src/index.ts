import { type Inspector } from './models'
import { createImage } from './image'
import { createMediaContainer, publishMedia } from './instagram'
import { getInstagramUserToken, getValidAccessToken } from './auth'

import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import fs from 'fs/promises'
import cron from 'node-cron'
import path from 'path'
import fetch from 'node-fetch'

const app = new Hono()

app.use('/images/*', serveStatic({ root: './' }))

async function fetchInspectorData() {
    const response = await fetch(`${process.env.API_URL}/basics/inspectors`)
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as Inspector[]
}

async function createAndPostStory(inspectors: Inspector[]) {
    try {
        const imgBuffer = await createImage(inspectors)

        // Save the image to a file
        const folderPath = './images'
        await fs.mkdir(folderPath, { recursive: true })
        const imageName = `story_${Date.now()}.jpg`
        const imagePath = path.join(folderPath, imageName)
        await fs.writeFile(imagePath, Uint8Array.from(imgBuffer))
        
        let count = 0
        while(!(await fetch(`${process.env.APP_URL}/images/${imageName}`)).ok && count < 10) {
            console.log('Waiting for image to be available...')
            await new Promise((resolve) => setTimeout(resolve, 1000))
            count++
        }

        // public URL of the image, as required by Instagram Graph API
        const imageUrl = `${process.env.APP_URL}/images/${imageName}`

        const accessToken = await getValidAccessToken()
        const { pageAccessToken, instagramAccountId } = await getInstagramUserToken(accessToken)

        // Create media container
        const creationId = await createMediaContainer(instagramAccountId, pageAccessToken, imageUrl)

        const mediaId = await publishMedia(instagramAccountId, pageAccessToken, creationId)
        console.log('Story posted successfully:', mediaId)
    } catch (error) {
        console.error('Error creating and posting story:', error)
    }
}

setTimeout(() => {
    throw new Error('Code execution timed out after 5 seconds')
}, 5000);

// run once initially
try {
    const inspectors = await fetchInspectorData()
    await createAndPostStory(inspectors)
} catch (error) {
    console.error('Error in hourly cron job:', error)
}

// Hourly cron job to fetch data and post story
cron.schedule('0 * * * *', async () => {
    try {
        const inspectors = await fetchInspectorData()
        await createAndPostStory(inspectors)
    } catch (error) {
        console.error('Error in hourly cron job:', error)
    }
})

// Daily cron job to delete old images
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
        }
    }
})

export default {
    port: 8000,
    fetch: app.fetch,
}

console.log('Instagram Bot is running on port 8000')
