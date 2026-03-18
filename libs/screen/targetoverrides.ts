// This file would be usually overridden by the target.
// set palette before creating screen, so the JS version has the right BPP
image.setPalette(hex`__palette`)
const screen = image.create(178, 128) as ScreenImage

namespace _screen_internal {
    //% shim=pxt::updateScreen
    function updateScreen(img: Image): void {}
    //% shim=pxt::updateStats
    function updateStats(msg: string): void {}
    control.__screen.setupUpdate(() => updateScreen(screen))
    control.EventContext.onStats = function(msg: string) {
        updateStats(msg);
    }
}
