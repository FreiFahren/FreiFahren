/* eslint-disable no-console */
import { db } from '../index'

import { seedBaseData, seedReports } from './seed'

const seed = async () => {
    console.log('Starting seed...')

    await seedBaseData(db)
    await seedReports(db)

    console.log('Seed completed successfully!')
}

seed()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('Seed failed:', error)
        process.exit(1)
    })
