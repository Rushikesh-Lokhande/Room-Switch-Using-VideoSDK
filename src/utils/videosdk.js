// Media Relay fallback using JS SDK when React SDK relay API is unavailable.
import { Meeting } from '@videosdk.live/js-sdk';

let manualRelay = {
  meeting: null,
  tracks: [],
};

export async function startManualRelayToRoomB({ destinationMeetingId, token }) {
  if (manualRelay.meeting) return manualRelay.meeting.meetingId;
  if (!destinationMeetingId || !token) throw new Error('Missing destinationMeetingId or token');
  const meetingB = new Meeting({
    meetingId: destinationMeetingId,
    micEnabled: false,
    webcamEnabled: false,
    token,
  });
  await meetingB.join();
  // Try to capture fresh devices; may fail if already in use. That's okay per requirement.
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch (e) {
    // Try audio-only
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (_) {}
  }
  if (stream) {
    for (const track of stream.getTracks()) {
      try {
        if (track.kind === 'audio') await meetingB.enableMic(track);
        if (track.kind === 'video') await meetingB.enableWebcam(track);
        manualRelay.tracks.push(track);
      } catch (_) {}
    }
  }
  manualRelay.meeting = meetingB;
  return destinationMeetingId;
}

export async function stopManualRelay() {
  if (!manualRelay.meeting) return;
  try {
    for (const track of manualRelay.tracks) {
      try { track.stop(); } catch (_) {}
    }
    manualRelay.tracks = [];
    await manualRelay.meeting.leave();
  } finally {
    manualRelay.meeting = null;
  }
}
// Minimal client helpers for VideoSDK REST APIs used in this demo.

const BASE_URL = 'https://api.videosdk.live/v2';

export async function createMeeting(token, region) {
  const url = `${BASE_URL}/rooms${region ? `?region=${encodeURIComponent(region)}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Create meeting failed (${res.status}): ${text || res.statusText}`);
  }
  const data = await res.json();
  // API returns { roomId: 'xxxx' }
  return data.roomId || data.meetingId || data.id;
}

export async function validateMeeting(token, meetingId) {
  const res = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(meetingId)}`, {
    headers: { Authorization: token }
  });
  return res.ok;
}



