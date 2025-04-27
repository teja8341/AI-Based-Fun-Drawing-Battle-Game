import React from 'react';
import './GameControls.css';

const GameControls = ({ 
  gamePhase, 
  isHost, 
  onStartGame, 
  onStartNewRound, 
  currentDrawTime, // in ms
  onSetDrawTime 
}) => {

  // Handler for input change - convert ms to seconds for display/input
  const handleTimeChange = (event) => {
    const timeInSeconds = event.target.value;
    onSetDrawTime(timeInSeconds); // Pass seconds to App.jsx handler
  };

  const displayTimeSeconds = currentDrawTime ? Math.round(currentDrawTime / 1000) : '30'; // Default/fallback display

  return (
    <div className="game-controls">
      {isHost && gamePhase === 'waiting' && (
        <div className="host-waiting-controls">
          {/* Draw Time Setting */}
          <div className="draw-time-setting">
            <label htmlFor="drawTimeInput">Draw Time (sec):</label>
            <input 
              type="number"
              id="drawTimeInput"
              value={displayTimeSeconds}
              onChange={handleTimeChange}
              min="15" // Mirror server validation
              max="120" // Mirror server validation
              step="5" // Optional: steps of 5 seconds
              className="draw-time-input"
            />
          </div>
          {/* Start Game Button */}
          <button onClick={onStartGame} className="control-button start-button">
            Start Game
          </button>
        </div>
      )}

      {!isHost && gamePhase === 'waiting' && (
        <div className="non-host-waiting-info">
           <p className="waiting-message">Waiting for host ({displayTimeSeconds}s draw time)...</p>
        </div>
      )}

      {isHost && gamePhase === 'revealing' && (
        <button onClick={onStartNewRound} className="control-button new-round-button">
          Start New Round
        </button>
      )}

      {/* Add more controls as needed */}
    </div>
  );
};

export default GameControls; 