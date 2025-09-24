import React, { useEffect, useRef } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

function RoomBParticipantTile({ participantId }) {
  const { webcamStream, micStream, isLocal } = useParticipant(participantId);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new window.MediaStream([webcamStream.track]);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [webcamStream]);

  useEffect(() => {
    if (audioRef.current && micStream && !isLocal) {
      const mediaStream = new window.MediaStream([micStream.track]);
      audioRef.current.srcObject = mediaStream;
      audioRef.current.play().catch(() => {});
    }
  }, [micStream, isLocal]);

  return (
    <div className={`tile ${isLocal ? 'local' : ''}`}>
      <video ref={videoRef} muted={isLocal} autoPlay playsInline />
      <audio ref={audioRef} autoPlay playsInline />
      <div className="label">{isLocal ? 'Relay (You)' : participantId}</div>
    </div>
  );
}


export default function RoomBRelayView({ token, meetingId }) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return <div className="relay-error">Error: Token is missing. Cannot join Room B.</div>;
  }
  if (!meetingId || typeof meetingId !== 'string' || meetingId.trim() === '') {
    return <div className="relay-error">Error: Meeting ID is missing. Cannot join Room B.</div>;
  }
  return (
    <MeetingProvider
      // Join Room B in a separate provider to preview/verify relay in-app.
      // In practice, you should open a new tab and join there.
      config={{ meetingId, micEnabled: false, webcamEnabled: false, name: 'Room B Preview' }}
      token={token}
      joinWithoutUserInteraction={true}
    >
      <RoomBRelayInner />
    </MeetingProvider>
  );
}

function RoomBRelayInner() {
  const { participants } = useMeeting();
  const participantIds = Array.from(participants.keys());
  return (
    <div className="relay-container">
      <h3>Room B (Relay Preview)</h3>
      <div className="grid">
        {participantIds.length === 0 ? (
          <div className="empty">No participants in Room B.</div>
        ) : (
          participantIds.map((pid) => <RoomBParticipantTile key={pid} participantId={pid} />)
        )}
      </div>
    </div>
  );
}
