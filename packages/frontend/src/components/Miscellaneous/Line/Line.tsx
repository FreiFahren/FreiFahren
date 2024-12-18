import './Line.css'

import React from 'react'
import { getLineColor } from 'src/utils/uiUtils'

const Line: React.FC<{ line: string }> = ({ line }) => (
        <span className="line" style={{ backgroundColor: getLineColor(line) }}>
            <strong>{line}</strong>
        </span>
    )

export { Line }
