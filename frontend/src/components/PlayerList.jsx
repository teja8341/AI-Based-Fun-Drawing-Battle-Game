import React from 'react';
import './PlayerList.css';

const PlayerList = ({ players, hostId }) => {
  return (
    <div className="player-list-container">
      <h3>Players</h3>
      {players.length === 0 ? (
        <p>No other players yet.</p>
      ) : (
        <ul>
          {players.map((player) => {
            const isHost = player.id === hostId;
            return (
              <li key={player.id} className={isHost ? 'player-list-item host' : 'player-list-item'}>
                {player.nickname}
                {isHost && <span className="host-indicator"> (Host)</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PlayerList; 