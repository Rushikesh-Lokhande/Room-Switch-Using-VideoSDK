import React, { useEffect, useMemo, useState } from 'react';
import { MeetingProvider } from '@videosdk.live/react-sdk';
import { RoomView } from './components/RoomView.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { createMeeting } from './utils/videosdk.js';

// Read env vars via import.meta.env for Vite
const TOKEN = import.meta.env.VITE_VIDEOSDK_TOKEN;
const TOKEN_B = import.meta.env.VITE_VIDEOSDK_TOKEN_B || TOKEN;
const ROOM_B_ID = import.meta.env.VITE_ROOM_B_ID || '';

// For demo purposes, we hardcode two room IDs.
const ROOM_A_LABEL = 'Room A';
const ROOM_B_LABEL = 'Room B';

export default function App() {
  const [meetingId, setMeetingId] = useState(null);
  const [status, setStatus] = useState('Idle');
  const [tokenOverride, setTokenOverride] = useState(null);

  // Support auto-join via URL params, e.g. ?meetingId=XXXX&autoJoin=1&token=YYY
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMeetingId = params.get('meetingId');
    const autoJoin = params.get('autoJoin');
    const urlToken = params.get('token');
    if (urlToken && urlToken.trim()) {
      setTokenOverride(urlToken.trim());
    }
    const effectiveToken = (urlToken && urlToken.trim()) || TOKEN_B || TOKEN;
    const setFromId = (id) => {
      setMeetingId(id);
      const url = new URL(window.location.href);
      url.searchParams.set('meetingId', id);
      window.history.replaceState({}, '', url.toString());
    };
    (async () => {
      if (urlMeetingId && urlMeetingId.trim()) {
        setFromId(urlMeetingId.trim());
        if (autoJoin) setStatus('Preparing to join...');
      } else if (autoJoin) {
        try {
          setStatus('Creating Room B...');
          const id = await createMeeting(effectiveToken);
          setFromId(id);
          setStatus('Preparing to join...');
        } catch (e) {
          setStatus(`Failed to create Room B: ${e?.message || e}`);
        }
      }
    })();
  }, []);

  const providerConfig = useMemo(
    () => ({
      meetingId,
      micEnabled: true,
      webcamEnabled: true,
      name: 'React Demo User'
    }),
    [meetingId]
  );

  return (
    <div className="app">
      <header className="header">
        <h1>VideoSDK: Seamless Room Switch + Media Relay</h1>
      </header>
      {!meetingId ? (
        <div className="container">
          <div className="controls">
            <button
              className="btn"
              onClick={async () => {
                try {
                  setStatus(`Creating ${ROOM_A_LABEL}...`);
                  const id = await createMeeting(TOKEN);
                  setMeetingId(id);
                  setStatus(`Ready. Click Join to enter ${ROOM_A_LABEL}.`);
                } catch (e) {
                  setStatus(`Failed to create room: ${e?.message || e}`);
                }
              }}
            >
              Join Room A
            </button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  // Use env ID if provided, else create a fresh Room B
                  const roomBId = ROOM_B_ID && ROOM_B_ID.trim() ? ROOM_B_ID.trim() : await createMeeting(TOKEN_B);
                  const url = new URL(window.location.href);
                  url.searchParams.set('meetingId', roomBId);
                  url.searchParams.set('autoJoin', '1');
                  // pass token in URL only for local demo purposes
                  if (TOKEN_B) url.searchParams.set('token', TOKEN_B);
                  window.location.assign(url.toString());
                } catch (e) {
                  setStatus(`Failed to open Room B: ${e?.message || e}`);
                }
              }}
            >
              Join Room B
            </button>
          </div>
        </div>
      ) : (
        <MeetingProvider config={providerConfig} token={tokenOverride || TOKEN}>
          <StatusBar status={status} currentRoom={meetingId} />
          <RoomView
            token={tokenOverride || TOKEN}
            roomALabel={ROOM_A_LABEL}
            roomBLabel={ROOM_B_LABEL}
            roomBId={ROOM_B_ID}
            roomBToken={TOKEN_B}
            meetingId={meetingId}
            setMeetingId={setMeetingId}
            setStatus={setStatus}
          />
        </MeetingProvider>
      )}
      <footer className="footer">Powered by VideoSDK</footer>
    </div>
  );
}


