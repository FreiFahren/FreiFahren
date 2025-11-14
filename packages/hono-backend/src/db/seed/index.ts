/* eslint-disable no-console  */
import { db } from '../index'

import { seedBaseData } from './seed'

const seed = async () => {
    console.log('Starting seed...')

    await seedBaseData(db)

    console.log('Seed completed successfully!')
}

seed().catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
})
