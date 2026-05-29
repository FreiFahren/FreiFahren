import './Line.css'

import React from 'react'
import { useLines } from 'src/api/queries'
import { getLineColor } from 'src/hooks/getLineColor'

const Line: React.FC<{ line: string }> = ({ line }) => {
    const { data: lines } = useLines()

    if (line === '') {
        return null
    }

    const displayLine = lines?.find((candidate) => candidate.id === line)?.name ?? line

    return (
        <span className="line" style={{ backgroundColor: getLineColor(displayLine) }} data-select-value={line}>
            <strong>{displayLine}</strong>
        </span>
    )
}

export { Line }
