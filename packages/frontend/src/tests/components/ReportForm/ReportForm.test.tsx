/* eslint-disable no-extra-semi */
import React from 'react'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import ReportForm from '../../../components/Form/ReportForm/ReportForm'
import * as dbUtils from '../../../utils/dbUtils'

jest.mock('../../../utils/dbUtils', () => ({
    getAllLinesList: jest.fn().mockResolvedValue({
        /* mock return value for getAllLinesList */
    }),
    getAllStationsList: jest.fn().mockResolvedValue({
        /* mock return value for getAllStationsList */
    }),
    reportInspector: jest.fn().mockResolvedValue(undefined), // Corrected mock for reportInspector
}))

describe('ReportForm Submission', () => {
    beforeEach(() => {
        // Provide initial mock returns for utility functions
        ;(dbUtils.getAllLinesList as jest.Mock).mockResolvedValue({})
        ;(dbUtils.getAllStationsList as jest.Mock).mockResolvedValue({})
    })

    test('does not submit form without station selection and privacy agreement', async () => {
        const closeModalMock = jest.fn()
        const onFormSubmitMock = jest.fn()

        render(<ReportForm closeModal={closeModalMock} onFormSubmit={onFormSubmitMock} />)

        // Attempt to submit the form without filling in necessary information
        fireEvent.click(screen.getByText('Melden'))

        await waitFor(() => {
            expect(dbUtils.reportInspector).not.toHaveBeenCalled()
        })

        await waitFor(() => {
            expect(onFormSubmitMock).not.toHaveBeenCalled()
        })
    })
})
