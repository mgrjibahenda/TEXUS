# Mini FPS v1.1 Fixed

## Fixes

- Added visible error messages when the user opens `index.html` directly.
- Added visible error messages when Socket.io/server is not connected.
- Added Render wake-up message instead of silent button failure.
- Added Three.js load check before entering the game.
- Create Room / Join Room now show feedback like `Creating room...`.
- Added guards so client code does not crash if the server is not running.

## Correct way to run locally

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

Do not open `public/index.html` directly.

## Render settings

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```
