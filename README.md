# VideoSDK Room Switching + Media Relay (React)

This shows how to join Room A, switch to Room B without a full page reload, and demonstrate Media Relay using VideoSDK React SDK (but as of now it not happening).

## Requirements

- Node.js 18+
- A VideoSDK developer account
- A developer token

## Setup

1. Open a terminal in this folder `videosdk-room-switch`.
2. Create a `.env` file with:
   
   ```env
   VITE_VIDEOSDK_TOKEN=YOUR_VIDEOSDK_DEV_TOKEN
   # Optional: If Room B uses a different token, set it here
   VITE_VIDEOSDK_TOKEN_B=YOUR_VIDEOSDK_DEV_TOKEN
   # Set a static Room B meeting id if you want predictable testing across tabs
   # If not set, you can still relay by generating it via the UI.
   VITE_ROOM_B_ID=YOUR_ROOM_B_ID
   ```
3. Install deps and run:
   
   ```bash
   npm install
   npm run dev
   ```
4. Open `http://localhost:5173`.

## What this includes

- Join Room A
- Seamless switch to Room B
- Media Relay (relay your A/V from current room to Room B)
- Status bar and simple responsive UI
- Error handling for join/switch/relay

## Room switching vs media relay

**Switching**: Leave Room A and join Room B as the same session.

**Relaying**: Stay in Room A and forward your media into Room B. Participants in Room B can see/hear your forwarded feed. Implementing using `requestMediaRelay({ destinationMeetingId, token, kinds })` and monitored via `onMediaRelayStateChanged`.


## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview build locally

## Environment variables

- `VITE_VIDEOSDK_TOKEN` - VideoSDK token used by the client. For production, mint scoped, short-lived tokens server-side and inject via your backend.

## File structure

```
src/
  App.jsx
  main.jsx
  styles.css
  components/
    RoomView.jsx
    StatusBar.jsx
    RoomBRelayView.jsx
  utils/
     videosdk.js
.env
index.html
package.josn
package-lock.json
vite.config.js      
```



