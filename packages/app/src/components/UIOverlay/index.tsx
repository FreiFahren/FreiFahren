import { Blocker } from '../Blocker'
import { FFSafeAreaView, FFView } from '../common/base'
import { Attribution } from './Attribution'
import { LayerSwitcher } from './LayerSwitcher'
import { ReportButton } from './Report/ReportButton'
import { ReportDetailsSheet } from './ReportDetailsSheet'
import { ReportListButton } from './ReportList/ReportListButton'
import { SettingsButton } from './SettingsButton'

export const UIOverlay = () => (
    <FFView
        flex={1}
        position="absolute"
        top={0}
        left={0}
        bottom={0}
        right={0}
        px="xxs"
        pb="xs"
        justifyContent="space-between"
        pointerEvents="box-none"
    >
        <FFSafeAreaView flex={1} pointerEvents="box-none" justifyContent="space-between">
            <Attribution />
            <FFView>
                <FFView flexDirection="row" justifyContent="space-between" alignItems="flex-start" mt="xxs">
                    <SettingsButton />
                    <LayerSwitcher />
                </FFView>
            </FFView>
            <FFView>
                <FFView
                    pointerEvents="box-none"
                    flexDirection="row"
                    justifyContent="space-between"
                    alignItems="flex-end"
                    gap="xs"
                >
                    <ReportListButton flex={1} />
                    <ReportButton flex={1} />
                </FFView>
                <Blocker />
                <ReportDetailsSheet />
            </FFView>
        </FFSafeAreaView>
    </FFView>
)
