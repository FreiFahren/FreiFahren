import './Line.css'

import React from 'react'
import { getLineColor } from 'src/hooks/getLineColor'

const Line: React.FC<{ line: string }> = ({ line }) => {
    if (line === '') {
        return null
    }
    return (
        <span className="line" style={{ backgroundColor: getLineColor(line) }} data-select-value={line}>
            <strong>{line}</strong>
        </span>
    )
}

export { Line }
