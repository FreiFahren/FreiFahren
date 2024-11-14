import { Box, View } from 'native-base'

import { useAppStore } from '../../app.store'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Disclaimer } from '../Disclaimer'
import { Attribution } from './Attribution'
import { LayerSwitcher } from './LayerSwitcher'
import { ReportButton } from './ReportButton'
import { ReportDetailsNotification } from './ReportDetailsNotification'
import { ReportListButton } from './ReportListButton'
import { SettingsButton } from './SettingsButton'

export const UIOverlay = () => {
    const { reportToShow, update } = useAppStore()

    return (
        <Box
            flex={1}
            position="absolute"
            top={0}
            left={0}
            bottom={0}
            right={0}
            px={2}
            pb={5}
            pointerEvents="box-none"
            justifyContent="space-between"
            safeArea
        >
            <View>
                <Attribution />
                <View flexDir="row" justifyContent="space-between" alignItems="flex-start" mt={3}>
                    <SettingsButton />
                    <LayerSwitcher />
                </View>
            </View>
            <View>
                {reportToShow && (
                    <ReportDetailsNotification
                        report={reportToShow}
                        onClose={() => update({ reportToShow: null })}
                        mb={4}
                    />
                )}
                <View pointerEvents="box-none" flexDir="row" justifyContent="space-between" alignItems="flex-end">
                    <ReportListButton />
                    <ReportButton />
                    <Disclaimer />
                </View>
            </View>
        </Box>
    )
}
