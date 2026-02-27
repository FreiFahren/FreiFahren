// This file is a placeholder for the new seeding process.
// Once all of the seeding logic is ported to the new process, this file will replace seed.ts.

import { db } from '../index'

import { seedStations } from './stations'

const seed = async () => {
    console.log('Starting station seed from Overpass...')

    await seedStations(db)

    console.log('Station seed completed successfully!')
}

seed()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('Station seed failed:', error)
        process.exit(1)
    })
