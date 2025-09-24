import React from 'react';

export function StatusBar({ status, currentRoom }) {
  return (
    <div className="status">
      <div className="pill">Room: {currentRoom || '—'}</div>
      <div className="text">{status}</div>
    </div>
  );
}



