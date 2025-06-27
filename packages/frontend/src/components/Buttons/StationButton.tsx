import { Station } from 'src/utils/types'

interface StationButtonProps {
    station: Station
    'data-select-value'?: string
}

const StationButton = ({ station, ...props }: StationButtonProps) => {
    return (
        <button
            key={station.id}
            type="button"
            data-select-value={station.id}
            className="m-0 flex h-fit min-w-0 flex-1 items-center justify-start p-0"
            {...props}
        >
            <p className="m-0 p-0 text-sm font-semibold">{station.name}</p>
        </button>
    )
}

export default StationButton
