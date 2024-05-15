function Initialiser () {
    manege.startInPause()
    joueur.position = 16.5
    ennemi.position = 0
    manege.drawEntities(strip)
}
manege.setOnCollisionStart(function (a, b) {
    if (manege.sameEntities(a, b, joueur, ennemi)) {
        manege.pauseGame()
        Perdu()
        basic.pause(1000)
        Initialiser()
        basic.pause(1000)
        manege.resume()
    }
})
function Perdu () {
    strip.showColor(neopixel.colors(NeoPixelColors.Black))
    strip.show()
}
let dt = 0
let ennemi: manege.Entity = null
let joueur: manege.Entity = null
let strip: neopixel.Strip = null
strip = neopixel.create(DigitalPin.P0, 30, NeoPixelMode.RGB)
joueur = manege.createEntity(0x00ff00, 16.5)
joueur.zindex = 1
ennemi = manege.createEntity(0xff0000, 0)
manege.startGame()
basic.forever(function () {
    dt = manege.updateTimes()
    joueur.speed = Math.map(pins.analogReadPin(AnalogPin.P1), 0, 1023, -20, 20)
    joueur.updateMotion(dt)
    ennemi.speed = manege.noiseA(-19, 19)
    ennemi.updateMotion(dt)
    manege.updateEntities()
    manege.drawEntities(strip)
})
