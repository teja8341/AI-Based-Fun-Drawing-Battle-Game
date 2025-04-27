import React from 'react';
import './PlayerList.css';

const PlayerList = ({ players }) => {
  return (
    <div className="player-list-container">
      <h3>Players</h3>
      {players.length === 0 ? (
        <p>No other players yet.</p>
      ) : (
        <ul>
          {players.map((player) => (
            <li key={player.id}>{player.nickname}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlayerList; 