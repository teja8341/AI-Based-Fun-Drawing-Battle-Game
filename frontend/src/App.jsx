import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import DrawingCanvas from './components/DrawingCanvas';
import PlayerList from './components/PlayerList';
import TimerDisplay from './components/TimerDisplay';
import PromptDisplay from './components/PromptDisplay';
import GameControls from './components/GameControls';
import ResultsDisplay from './components/ResultsDisplay';
import './App.css';

const SOCKET_SERVER_URL = "http://localhost:3001"; // Backend server address

function App() {
  const [socket, setSocket] = useState(null);
  const [nickname, setNickname] = useState('');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(''); // To display errors from the server
  const [hostId, setHostId] = useState(null); // Track the host
  const [gamePhase, setGamePhase] = useState('lobby'); // 'lobby', 'waiting', 'drawing', 'revealing'
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [submittedDrawings, setSubmittedDrawings] = useState({}); // { playerId: drawingDataUrl }
  const [winnerId, setWinnerId] = useState(null); // NEW: Track the winner

  const drawingCanvasRef = useRef(); // Ref for canvas methods

  // Effect to establish socket connection
  useEffect(() => {
    // Connect to the socket server
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    console.log('Attempting to connect to socket server...');

    newSocket.on('connect', () => {
      console.log('Connected to socket server!', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      // Handle disconnection logic if needed (e.g., reset state)
      setCurrentRoomId(null);
      setPlayers([]);
      setError('Lost connection to server');
      setHostId(null);
      setGamePhase('lobby');
      setSubmittedDrawings({});
      setWinnerId(null); // Reset winner on disconnect
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection Error:', err);
      setError('Failed to connect to the server. Is it running?');
    });

    // --- Listener for Room/Player Updates ---
    newSocket.on('roomCreated', (roomId) => {
      console.log(`Room created successfully: ${roomId}`);
      setCurrentRoomId(roomId);
      setError(''); // Clear previous errors
      setGamePhase('waiting'); // Move to waiting phase after creation
    });

    newSocket.on('joinedRoom', (roomId) => {
      console.log(`Joined room successfully: ${roomId}`);
      setCurrentRoomId(roomId);
      setError(''); // Clear previous errors
    });

    newSocket.on('playerListUpdate', (playerList) => {
      console.log('Player list updated:', playerList);
      setPlayers(playerList);
    });

    newSocket.on('joinError', (errorMessage) => {
      console.error('Join Error:', errorMessage);
      setError(errorMessage);
      setCurrentRoomId(null); // Ensure user is not considered "in" a room on error
      setGamePhase('lobby');
      setWinnerId(null); // Reset winner on join error too
    });

    // --- Game State Listeners ---
    newSocket.on('roomStateUpdate', (state) => {
      console.log('Room state update received:', state);
      if (state) {
        setPlayers(state.players || []);
        setHostId(state.hostId || null);
        setGamePhase(state.gamePhase || 'waiting'); // Default to waiting if phase is missing
        setCurrentPrompt(state.currentPrompt || null);
        setTimerEndTime(state.timerEndTime || null);
        // Clear drawings and winner if returning to waiting phase
        if (state.gamePhase === 'waiting' && gamePhase !== 'waiting') {
          setSubmittedDrawings({});
          setWinnerId(null);
          drawingCanvasRef.current?.clearCanvas();
        }
      }
    });

    newSocket.on('showResults', (resultsPayload) => {
      console.log('[Listener showResults] Received payload:', resultsPayload); // Log the raw payload
      if (resultsPayload) {
        const receivedWinnerId = resultsPayload.winnerId || null;
        console.log(`[Listener showResults] Extracted winnerId: ${receivedWinnerId}`); // Log the extracted ID
        setSubmittedDrawings(resultsPayload.drawings || {});
        setWinnerId(receivedWinnerId); // Set the state
        console.log('[Listener showResults] Called setWinnerId.'); // Confirm state setter was called
      }
      setGamePhase('revealing');
      setCurrentPrompt(null);
      setTimerEndTime(null);
    });

    newSocket.on('clearResults', () => {
      console.log('Clearing results');
      setSubmittedDrawings({});
      setWinnerId(null); // Clear winner ID
    });

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, []); // Runs only once on component mount

  // Effect to automatically submit drawing when timer ends
  useEffect(() => {
    console.log(`[Effect] Checking timer: Phase=${gamePhase}, EndTime=${timerEndTime}`);
    if (gamePhase === 'drawing' && timerEndTime) {
      const now = Date.now();
      const timeLeft = timerEndTime - now;
      console.log(`[Effect] Time left: ${timeLeft}ms`);

      let timerId = null;
      if (timeLeft <= 100) { // Add small buffer to try and beat server timer
        console.log('[Effect] Timer already ended or very close, submitting immediately.');
        submitDrawingHandler();
      } else {
        console.log(`[Effect] Setting timeout for ${timeLeft}ms to submit drawing.`);
        timerId = setTimeout(() => {
            console.log('[Effect] Timeout finished, calling submitDrawingHandler.');
            submitDrawingHandler();
        }, timeLeft);
      }
      // Cleanup timeout if phase changes before it fires
      return () => {
          if (timerId) {
              console.log('[Effect] Cleanup: Clearing timer timeout.');
              clearTimeout(timerId);
          }
      };
    }
  }, [gamePhase, timerEndTime]);

  // --- Event Handlers ---
  const handleHostGame = () => {
    if (socket && nickname.trim()) {
      console.log('Attempting to host game with nickname:', nickname);
      socket.emit('hostGame', nickname.trim());
      setError(''); // Clear error on new action
    } else if (!nickname.trim()) {
      setError('Please enter a nickname.');
    } else {
      setError('Not connected to server yet.');
    }
  };

  const handleJoinGame = () => {
    if (socket && nickname.trim() && roomIdToJoin.trim()) {
      console.log(`Attempting to join room ${roomIdToJoin} with nickname: ${nickname}`);
      socket.emit('joinGame', { roomId: roomIdToJoin.trim().toUpperCase(), nickname: nickname.trim() });
      setError(''); // Clear error on new action
    } else if (!nickname.trim()) {
      setError('Please enter a nickname.');
    } else if (!roomIdToJoin.trim()) {
      setError('Please enter a Room ID.');
    } else {
      setError('Not connected to server yet.');
    }
  };

  const handleStartGame = () => {
    if (socket) {
      console.log('Emitting startGame');
      socket.emit('startGame');
    }
  };

  const submitDrawingHandler = () => {
      console.log(`[Submit] Attempting submission. Current phase: ${gamePhase}`);
      // Check if we are actually in the drawing phase before submitting
      // Allow submission even if phase *just* switched to revealing server-side, client might be slightly behind.
      if (gamePhase !== 'drawing' && gamePhase !== 'revealing') {
          console.warn(`[Submit] Aborted: Not in drawing/revealing phase.`);
          return;
      }
      if (socket && drawingCanvasRef.current) {
          const drawingDataUrl = drawingCanvasRef.current.getDrawingDataUrl();
          if (drawingDataUrl && drawingDataUrl.length > 100) { // Basic check for non-empty canvas data
              console.log(`[Submit] Got data URL (length: ${drawingDataUrl.length}), emitting submitDrawing...`);
              socket.emit('submitDrawing', drawingDataUrl);
          } else {
              console.error("[Submit] Failed: Could not get valid drawing data URL.", drawingDataUrl);
              // Still emit *something* maybe? Or handle blank submission?
              // For now, just log the error.
          }
      } else {
          console.error('[Submit] Failed: Socket or canvas ref not available.');
      }
  };

  const handleStartNewRound = () => {
    if (socket) {
      console.log('Emitting startNewRound');
      socket.emit('startNewRound');
      // Clear local results immediately for snappier feel
      setSubmittedDrawings({});
      drawingCanvasRef.current?.clearCanvas();
    }
  };

  // --- Render Logic ---
  const isHost = socket && socket.id === hostId;
  const showLobby = !currentRoomId || gamePhase === 'lobby';
  const resultsReady = gamePhase === 'revealing' && submittedDrawings && Object.keys(submittedDrawings).length > 0;

  return (
    <div className="App">
      <h1>Drawing Battle!</h1>
      {error && <p className="error-message">Error: {error}</p>}

      {showLobby ? (
        // Show Host/Join UI if not in a room
        <div className="lobby">
          <h2>Welcome!</h2>
          <input
            type="text"
            placeholder="Enter your Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={15} // Keep nicknames reasonable
          />
          <button onClick={handleHostGame} disabled={!socket || !nickname.trim()}>
            Host New Game
          </button>
          <hr />
          <input
            type="text"
            placeholder="Enter Room ID to Join"
            value={roomIdToJoin}
            onChange={(e) => setRoomIdToJoin(e.target.value)}
            onInput={(e) => e.target.value = e.target.value.toUpperCase()} // Force uppercase
          />
          <button onClick={handleJoinGame} disabled={!socket || !nickname.trim() || !roomIdToJoin.trim()}>
            Join Game
          </button>
        </div>
      ) : (
        // Show Game UI if in a room
        <div className="game-room">
          <h2>Room: {currentRoomId}</h2>

          {/* == Top Bar: Prompt & Timer == */}
          {(gamePhase === 'drawing' || gamePhase === 'revealing') && (
            <div className="game-info-bar">
              <PromptDisplay prompt={currentPrompt} />
              <TimerDisplay endTime={timerEndTime} />
            </div>
          )}

          {/* == Main Content Area == */}
          <div className="main-content">
            {/* Render Canvas/Players only when waiting or drawing */}
            {(gamePhase === 'waiting' || gamePhase === 'drawing') && (
              <div className="game-layout">
                <DrawingCanvas
                  ref={drawingCanvasRef}
                  disabled={gamePhase !== 'drawing'}
                />
                <PlayerList players={players} hostId={hostId} />
              </div>
            )}

            {/* Render Results only when phase is revealing AND drawings exist */}
            {resultsReady && (
              <ResultsDisplay
                drawings={submittedDrawings}
                players={players}
                winnerId={winnerId}
              />
            )}
          </div>

          {/* == Bottom Controls == */}
          <GameControls
            gamePhase={gamePhase}
            isHost={isHost}
            onStartGame={handleStartGame}
            onStartNewRound={handleStartNewRound}
          />
        </div>
      )}
    </div>
  );
}

export default App;
