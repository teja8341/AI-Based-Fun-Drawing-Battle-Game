import React from 'react';
import './GameControls.css';

const GameControls = ({ 
  gamePhase, 
  isHost, 
  onStartGame, 
  onStartNewRound, 
  currentDrawTime, // in ms
  onSetDrawTime,
  currentTotalRounds, // NEW
  onSetTotalRounds, // NEW
}) => {

  // Handler for input change - convert ms to seconds for display/input
  const handleTimeChange = (event) => {
    const timeInSeconds = event.target.value;
    // Convert seconds back to milliseconds before sending
    const timeInMs = parseInt(timeInSeconds, 10) * 1000;
    if (!isNaN(timeInMs)) {
      onSetDrawTime(timeInMs); // Pass ms to App.jsx handler
    }
  };

  // Handler for rounds change
  const handleRoundsChange = (event) => {
    const rounds = event.target.value;
    onSetTotalRounds(rounds);
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
          {/* NEW: Total Rounds Setting */}
          <div className="total-rounds-setting">
            <label htmlFor="totalRoundsInput">Total Rounds:</label>
            <input 
              type="number"
              id="totalRoundsInput"
              value={currentTotalRounds}
              onChange={handleRoundsChange}
              min="1" // Mirror server validation
              max="10" // Mirror server validation
              step="1" 
              className="total-rounds-input"
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
           <p className="waiting-message">Waiting for host ({displayTimeSeconds}s draw time, {currentTotalRounds} rounds)...</p>
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