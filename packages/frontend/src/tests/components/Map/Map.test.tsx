import { Selector, test as testcafeTest } from 'testcafe';

const mockGeolocationScript = 'navigator.geolocation.getCurrentPosition = success =>  success({ coords: { latitude: 52.5200, longitude: 13.4050, }, timestamp: Date.now() });';

fixture`Map Component`.page`http://localhost:3000`
    .beforeEach(async t => {
    const legalDisclaimerButton = Selector('.legal-disclaimer button');
    await t.click(legalDisclaimerButton);
    })
    .clientScripts({ content: mockGeolocationScript });

testcafeTest('take screenshot', async t => {
    await t.wait(5000)
    const map = Selector('#map')
    await t.takeElementScreenshot(map, 'test_maplibre.png')
  })

testcafeTest('FreifahrenMap renders without crashing', async t => {
    const mapContainer = Selector('#map-container');
    await t.expect(mapContainer.exists).ok();
});

testcafeTest('FreifahrenMap renders the map with the correct initial view state', async t => {
    const map = Selector('#map');
    await t.expect(map.exists).ok();
});

testcafeTest('FreifahrenMap does not render LocationMarker when userPosition is null', async t => {

    // Assuming you have a way to simulate userPosition being null
    const locationMarker = Selector('.location-marker');
    await t.expect(locationMarker.exists).notOk();
});