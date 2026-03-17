// Simple test game for STM32F4 compilation
game.splash("Hello STM32F4!")

let mySprite = sprites.create(img`
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . 5 5 5 5 . . . . . .
    . . . . . 5 5 5 5 5 5 . . . . .
    . . . . . 5 5 5 5 5 5 . . . . .
    . . . . . 5 5 5 5 5 5 . . . . .
    . . . . . . 5 5 5 5 . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
`, SpriteKind.Player)

controller.moveSprite(mySprite)