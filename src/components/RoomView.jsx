import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RoomBRelayView from './RoomBRelayView.jsx';
import { useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { createMeeting, startManualRelayToRoomB, stopManualRelay } from '../utils/videosdk.js';

function AudioLevelBar({ track }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!track) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let rafId;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 3));
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      try { src.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    };
  }, [track]);
  return (
    <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
      <div style={{ height: '100%', width: `${Math.round(level * 100)}%`, background: '#22c55e', borderRadius: 4 }} />
    </div>
  );
}

function ParticipantTile({ participantId }) {
  const { webcamStream, micStream, isLocal } = useParticipant(participantId);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoElement.srcObject = mediaStream;
      videoElement
        .play()
        .catch(() => {
          // Autoplay might be blocked; surface minimal error silently.
        });
    } else {
      videoElement.srcObject = null;
    }
  }, [webcamStream]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    if (micStream && !isLocal) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(micStream.track);
      audioElement.srcObject = mediaStream;
      audioElement
        .play()
        .catch(() => {
          // Autoplay may block; user interaction will allow playback.
        });
    } else {
      audioElement.srcObject = null;
    }
  }, [micStream, isLocal]);

  return (
    <div className={`tile ${isLocal ? 'local' : ''}`}>
      <video ref={videoRef} muted={isLocal} autoPlay playsInline />
      <audio ref={audioRef} autoPlay playsInline />
      <div className="label">{isLocal ? 'You' : participantId}</div>
      {micStream?.track ? <AudioLevelBar track={micStream.track} /> : null}
    </div>
  );
}

export function RoomView({ token, roomALabel, roomBLabel, roomBId, roomBToken, meetingId, setMeetingId, setStatus }) {
  const { join, leave, participants, changeMeeting, meetingId: activeMeetingId, enableMic, enableWebcam, requestMediaRelay, stopMediaRelay } = useMeeting({
    onError: (err) => {
      setStatus(`Error: ${err?.message || 'Unknown error'}`);
    },
    onMeetingJoined: async () => {
      // Ensure mic/webcam are active on join regardless of provider flags
      try {
        if (typeof enableMic === 'function') await enableMic();
        if (typeof enableWebcam === 'function') await enableWebcam();
      } catch (_) {
        // If enabling fails (permissions or unsupported), keep going
      }
      setStatus(`Connected to ${meetingId}`);
    },
    onMeetingLeft: () => {
      setStatus('Left meeting');
      setMeetingId(null);
    },
    onMediaRelayStateChanged: (data) => {
      
      if (!data) return;
      const { status: relayStatus, destinationMeetingId, reason } = data;
      if (relayStatus === 'REQUESTED' || relayStatus === 'RELAYER_JOINED') {
        setStatus(`Relaying media to Room B (${destinationMeetingId})`);
        setIsRelaying(true);
        setRoomBRelayId(destinationMeetingId);
      } else if (relayStatus === 'RELAYER_LEFT') {
        setStatus('Stopped relaying media');
        setIsRelaying(false);
      } else if (relayStatus === 'FAILED') {
        setStatus(`Relay failed: ${reason || 'Unknown error'}`);
        setIsRelaying(false);
      }
    }
  });

    const [isJoining, setIsJoining] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [isRelaying, setIsRelaying] = useState(false);
  const [roomBRelayId, setRoomBRelayId] = useState(null);

  // Auto-join when opened via URL params (used for "Join Room B (new tab)")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoJoin = params.get('autoJoin');
    if (autoJoin && !activeMeetingId) {
      join().catch(() => {});
    }
  }, [join, activeMeetingId]);

  // Media relay: keep participant in Room A, forward media to Room B via SDK
  const handleMediaRelay = useCallback(async () => {
    try {
      if (!roomBId) throw new Error('Room B ID is not configured');
      setIsRelaying(true);
      setStatus('Relaying media to Room B...');
      // Prefer the SDK-provided relay method as per docs
      if (typeof requestMediaRelay === 'function') {
        await requestMediaRelay({ destinationMeetingId: roomBId, token: roomBToken || token, kinds: ['audio', 'video'] });
        setRoomBRelayId(roomBId);
      } else {
        // Fallback: attempt manual relay via JS SDK by joining Room B and publishing fresh devices
        await startManualRelayToRoomB({ destinationMeetingId: roomBId, token: roomBToken || token });
        setRoomBRelayId(roomBId);
      }
    } catch (e) {
      setStatus(`Relay failed: ${e?.message || e}`);
      setIsRelaying(false);
    }
  }, [requestMediaRelay, roomBId, roomBToken, token, setStatus]);

  const handleStopRelay = useCallback(async () => {
    try {
      if (typeof stopMediaRelay === 'function') {
        await stopMediaRelay();
      }
      // Fallback cleanup
      await stopManualRelay();
      setIsRelaying(false);
      setStatus('Stopped relaying media');
    } catch (e) {
      setStatus(`Stop relay failed: ${e?.message || e}`);
    }
  }, [stopMediaRelay, setStatus]);

  const handleJoinA = useCallback(async () => {
    try {
      setStatus(`Joining ${roomALabel}...`);
      setIsJoining(true);
      // meetingId is already created by App before mounting provider
      await join();
    } catch (e) {
      setStatus(`Join failed: ${e?.message || e}`);
    } finally {
      setIsJoining(false);
    }
  }, [join, roomALabel, setStatus]);

  const handleSwitchToB = useCallback(async () => {
    try {
      setIsSwitching(true);
      setStatus(`Switching to ${roomBLabel}...`);

      // Some SDK versions expose changeMeeting(newMeetingId, token).
      // Fallback: leave and rejoin using provider re-render if not available.
      if (typeof changeMeeting === 'function') {
        const newId = await createMeeting(token);
        await changeMeeting(newId, token);
        setMeetingId(newId);
        // Re-enable devices after seamless switch
        try {
          // Small delay to let new peer connection settle
          await new Promise((r) => setTimeout(r, 200));
          if (typeof enableMic === 'function') await enableMic();
          if (typeof enableWebcam === 'function') await enableWebcam();
        } catch (_) {}
      } else {
        // Avoid tearing down provider; prefer changeMeeting path
        // If changeMeeting is missing, we can still attempt SDK join on new id
        const newId = await createMeeting(token);
        try {
          await changeMeeting?.(newId, token);
        } catch (_) {}
        setMeetingId(newId);
        try {
          if (typeof enableMic === 'function') await enableMic();
          if (typeof enableWebcam === 'function') await enableWebcam();
        } catch (_) {}
      }
      setStatus(`Connected to ${roomBLabel}`);
    } catch (e) {
      setStatus(`Switch failed: ${e?.message || e}`);
    } finally {
      setIsSwitching(false);
    }
  }, [changeMeeting, token, setMeetingId, setStatus, roomBLabel]);

  const participantIds = useMemo(() => Array.from(participants.keys()), [participants]);

  const handleLeave = useCallback(async () => {
    try {
      setStatus('Leaving room...');
      await leave();
      // onMeetingLeft will clean up
    } catch (e) {
      setStatus(`Leave failed: ${e?.message || e}`);
    }
  }, [leave, setStatus]);

  return (
    <div className="container">
      <div className="controls">
        <button className="btn" onClick={handleJoinA} disabled={isJoining || !!activeMeetingId}>
          {isJoining ? 'Joining…' : 'Join Room A'}
        </button>
        <button className="btn" onClick={handleSwitchToB} disabled={isSwitching || !activeMeetingId}>
          {isSwitching ? 'Switching…' : 'Switch to Room B'}
        </button>
        <button className="btn outline" onClick={handleLeave} disabled={!activeMeetingId}>
          Leave Room
        </button>
        {/* Relaying keeps you in Room A and forwards A/V to Room B. Switching leaves A and joins B. */}
        <button className="btn" onClick={handleMediaRelay} disabled={isRelaying || !activeMeetingId}>
          {isRelaying ? 'Relaying…' : 'Relay Media to Room B'}
        </button>
        <button className="btn" onClick={handleStopRelay} disabled={!isRelaying}>
          Stop Relay
        </button>
      </div>
      <div className="grid">
        {participantIds.length === 0 ? (
          <div className="empty">No participants yet. Join to start.</div>
        ) : (
          participantIds.map((pid) => <ParticipantTile key={pid} participantId={pid} />)
        )}
      </div>
      {/* Show Room B relay preview if active */}
      {roomBRelayId && (
        <RoomBRelayView token={token} meetingId={roomBRelayId} />
      )}
    </div>
  );
}


