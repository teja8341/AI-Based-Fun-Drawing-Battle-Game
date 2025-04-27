import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import DrawingCanvas from './components/DrawingCanvas';
import PlayerList from './components/PlayerList';
import TimerDisplay from './components/TimerDisplay';
import PromptDisplay from './components/PromptDisplay';
import GameControls from './components/GameControls';
import ResultsDisplay from './components/ResultsDisplay';
import LoadingIndicator from './components/LoadingIndicator';
import CanvasToolbar from './components/CanvasToolbar';
import ReviewDisplay from './components/ReviewDisplay';
import './App.css';

// Use environment variable for backend URL, fallback for local dev
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:3001";

function App() {
  const [socket, setSocket] = useState(null);
  const [nickname, setNickname] = useState('');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(''); // To display errors from the server
  const [hostId, setHostId] = useState(null); // Track the host
  const [gamePhase, setGamePhase] = useState('lobby'); // 'lobby', 'waiting', 'drawing', 'reviewing', 'judging', 'revealing'
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [submittedDrawings, setSubmittedDrawings] = useState({}); // { playerId: drawingDataUrl }
  const [reviewDrawings, setReviewDrawings] = useState({}); // NEW: For reviewing phase
  const [winnerId, setWinnerId] = useState(null); // NEW: Track the winner
  const [showRoomIdInput, setShowRoomIdInput] = useState(false); // NEW: State for lobby UI

  // NEW: State for drawing tools
  const [currentTool, setCurrentTool] = useState('pen'); // 'pen' or 'eraser'
  const [currentLineWidth, setCurrentLineWidth] = useState(5); // Default thickness

  // NEW: State for configurable draw time
  const [currentDrawTime, setCurrentDrawTime] = useState(null); // In milliseconds

  // NEW: State for round scores
  const [roundScores, setRoundScores] = useState(null); // { [playerId]: score }

  // NEW: State for round comments
  const [roundComments, setRoundComments] = useState(null); // { [playerId]: string }

  const drawingCanvasRef = useRef(); // Ref for canvas methods

  // --- Event Handlers ---
  // Define submitDrawingHandler *before* the useEffect that uses it
  const submitDrawingHandler = () => {
    console.log(`[Submit] Attempting submission. Current phase: ${gamePhase}`);
    // Allow submission during drawing or collecting (grace period)
    if (gamePhase !== 'drawing' && gamePhase !== 'collecting') {
        console.warn(`[Submit] Aborted: Not in drawing/collecting phase (Phase: ${gamePhase}).`);
        return;
    }
    if (socket && drawingCanvasRef.current) {
        const drawingDataUrl = drawingCanvasRef.current.getDrawingDataUrl();
        if (drawingDataUrl && drawingDataUrl.length > 100) { // Basic check for non-empty canvas data
            console.log(`[Submit] Got data URL (length: ${drawingDataUrl.length}), emitting submitDrawing...`);
            socket.emit('submitDrawing', drawingDataUrl);
        } else {
            console.warn("[Submit] Failed: Could not get valid drawing data URL.", drawingDataUrl);
            // Optionally, emit a blank submission or specific event?
             // socket.emit('submitDrawing', null); // Example: sending null
        }
    } else {
        console.error('[Submit] Failed: Socket or canvas ref not available.');
    }
  };

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
        setCurrentDrawTime(state.drawTime || null); // Update draw time state
        setRoundScores(state.roundScores || null); // NEW: Update scores state
        setRoundComments(state.roundComments || null); // NEW: Update comments state
        // Clear drawings and winner if returning to waiting phase
        if (state.gamePhase === 'waiting' && gamePhase !== 'waiting') {
          setSubmittedDrawings({});
          setWinnerId(null);
          setRoundScores(null);
          setRoundComments(null); // Clear comments too
          drawingCanvasRef.current?.clearCanvas();
        }
      }
    });

    // NEW: Listener for the review phase
    newSocket.on('showAllDrawings', (reviewData) => {
      console.log('[Listener showAllDrawings] Received review data:', reviewData);
      if (reviewData && reviewData.drawings) {
        setReviewDrawings(reviewData.drawings);
        setCurrentPrompt(reviewData.prompt || 'Prompt not received'); // Keep prompt visible
        setGamePhase('reviewing');
        setTimerEndTime(null); // Timer is done
        setSubmittedDrawings({}); // Clear previous results if any
        setWinnerId(null);
      }
    });

    newSocket.on('showResults', (resultsPayload) => {
      console.log('[Listener showResults] Received payload:', resultsPayload);
      if (resultsPayload) {
        const receivedWinnerId = resultsPayload.winnerId || null;
        setSubmittedDrawings(resultsPayload.drawings || {});
        setRoundScores(resultsPayload.scores || null);
        setRoundComments(resultsPayload.comments || null); // NEW: Set comments state
        setWinnerId(receivedWinnerId);
        console.log('[Listener showResults] Called setters for winner, scores, comments.');
      }
      setGamePhase('revealing');
      setCurrentPrompt(null);
      setTimerEndTime(null);
    });

    newSocket.on('clearResults', () => {
      console.log('Clearing results');
      setSubmittedDrawings({});
      setWinnerId(null);
      setRoundScores(null);
      setRoundComments(null); // NEW: Clear comments state
    });

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, []); // Runs only once on component mount

  // Effect to submit drawing automatically when the client-side timer appears to end
  useEffect(() => {
    // Only run this logic if we are in the drawing phase and have a timer end time
    if (gamePhase === 'drawing' && timerEndTime) {
      const now = Date.now();
      const timeLeft = timerEndTime - now;
      console.log(`[Submit Effect] Drawing phase active. Time left: ${timeLeft}ms`);

      // Set a timeout to submit slightly before the timer fully ends on the server
      const submitBufferMs = 100; // Submit 100ms before the calculated end time
      const submitTimeout = timeLeft - submitBufferMs;

      let timerId = null;
      if (submitTimeout > 0) {
        console.log(`[Submit Effect] Setting timeout to submit drawing in ${submitTimeout}ms.`);
        timerId = setTimeout(() => {
          console.log('[Submit Effect] Timeout finished, calling submitDrawingHandler.');
          submitDrawingHandler(); // Submit the drawing
        }, submitTimeout);
      } else {
        console.log('[Submit Effect] Timer already ended or very close, submitting immediately.');
        submitDrawingHandler();
      }

      return () => {
        if (timerId) {
          console.log('[Submit Effect] Cleanup: Clearing submit timeout.');
          clearTimeout(timerId);
        }
      };
    }
    // Now it's safe to include submitDrawingHandler in the dependency array
    // because it's defined above. We wrap it in useCallback if it causes re-renders, but start without it.
  }, [gamePhase, timerEndTime, submitDrawingHandler]);

  // --- Other Event Handlers ---
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
    if (!showRoomIdInput) {
        // First click: Show the input
        setShowRoomIdInput(true);
        setError(''); // Clear any previous errors
        return; 
    }

    // Second click (input is visible): Attempt to join
    if (socket && nickname.trim() && roomIdToJoin.trim()) {
        console.log(`Attempting to join room ${roomIdToJoin} with nickname: ${nickname}`);
        socket.emit('joinGame', { roomId: roomIdToJoin.trim().toUpperCase(), nickname: nickname.trim() });
        setError('');
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

  const handleStartNewRound = () => {
    if (socket) {
      console.log('Emitting startNewRound');
      socket.emit('startNewRound');
      setSubmittedDrawings({});
      setWinnerId(null);
      drawingCanvasRef.current?.clearCanvas();
    }
  };

  const handleClearCanvas = () => {
    drawingCanvasRef.current?.clearCanvas();
  };

  // NEW: Handlers for tool changes
  const handleSetTool = (tool) => {
      setCurrentTool(tool);
  };
  const handleSetLineWidth = (width) => {
      setCurrentLineWidth(width);
  };

  // NEW: Handler to request AI judgment (called by host)
  const handleRequestJudgment = () => {
    if (socket && gamePhase === 'reviewing') {
      console.log('Host requesting AI judgment...');
      socket.emit('requestJudgment');
      // The server will change the phase to 'judging' and eventually 'revealing'
    }
  };

  // NEW: Handler for setting draw time (called from GameControls)
  const handleSetDrawTime = (newTimeSeconds) => {
    if (socket && isHost && gamePhase === 'waiting') {
      const newTimeMs = parseInt(newTimeSeconds, 10) * 1000;
      if (!isNaN(newTimeMs)) {
          console.log(`[UI] Host attempting to set draw time to ${newTimeMs}ms`);
          // Add basic client-side validation mirroring server?
          const MIN_DRAW_TIME = 15000;
          const MAX_DRAW_TIME = 120000;
          if (newTimeMs >= MIN_DRAW_TIME && newTimeMs <= MAX_DRAW_TIME) {
            socket.emit('setDrawTime', newTimeMs);
          } else {
            console.warn(`[UI] Invalid draw time requested: ${newTimeMs}ms. Not emitting.`);
            // Maybe show a temporary error message on the UI?
          }
      } else {
        console.error(`[UI] Invalid time input for handleSetDrawTime: ${newTimeSeconds}`);
      }
    }
  };

  // --- Render Logic ---
  const isHost = socket && socket.id === hostId;
  const showLobby = !currentRoomId || gamePhase === 'lobby';
  const showReview = gamePhase === 'reviewing' && reviewDrawings && Object.keys(reviewDrawings).length > 0;
  const resultsReady = gamePhase === 'revealing' && submittedDrawings && Object.keys(submittedDrawings).length > 0;

  return (
    <div className="App">
      {/* Header Area */} 
      <div className="app-header">
        <h1>Drawing Battle!</h1>
        {/* Display nickname if available */} 
        {nickname && !showLobby && (
          <span className="current-user-display">Playing as: {nickname}</span>
        )}
      </div>
      
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
          {showRoomIdInput && (
            <input
              type="text"
              placeholder="Enter Room ID to Join"
              value={roomIdToJoin}
              onChange={(e) => setRoomIdToJoin(e.target.value)}
              onInput={(e) => e.target.value = e.target.value.toUpperCase()} // Force uppercase
              className="room-id-input" // Add class for potential styling
            />
          )}
          <button onClick={handleJoinGame} disabled={!socket || !nickname.trim() || (showRoomIdInput && !roomIdToJoin.trim())}>
            {showRoomIdInput ? 'Confirm Join' : 'Join Game'}
          </button>
        </div>
      ) : (
        <div className="game-room">
          {/* == NEW Horizontal Top Bar == */}
          <div className="game-top-bar">
            {/* Room ID */} 
            <h2>Room: {currentRoomId}</h2>
            
            {/* Prompt (only during drawing/revealing/judging) */} 
            {(gamePhase === 'drawing' || gamePhase === 'revealing' || gamePhase === 'judging') && (
               <PromptDisplay prompt={currentPrompt} /> 
            )}

            {/* Timer (only during drawing/revealing/judging) */} 
            {(gamePhase === 'drawing' || gamePhase === 'revealing' || gamePhase === 'judging') && (
                <TimerDisplay endTime={timerEndTime} />
            )}

            {/* Controls (only during waiting/revealing) */} 
            {(gamePhase === 'waiting' || gamePhase === 'revealing') && (
                <GameControls
                    gamePhase={gamePhase}
                    isHost={isHost}
                    onStartGame={handleStartGame}
                    onStartNewRound={handleStartNewRound}
                    currentDrawTime={currentDrawTime} // Pass draw time state
                    onSetDrawTime={handleSetDrawTime} // Pass draw time handler
                />
            )}
          </div>
          
          {/* == Main Content Area == */}
          <div className="main-content">
            {(gamePhase === 'waiting' || gamePhase === 'drawing') && (
              <div className="game-layout">
                <CanvasToolbar 
                  onClearCanvas={handleClearCanvas}
                  disabled={gamePhase !== 'drawing'}
                  currentTool={currentTool}         // Pass state down
                  onSetTool={handleSetTool}         // Pass handler down
                  currentLineWidth={currentLineWidth} // Pass state down
                  onSetLineWidth={handleSetLineWidth} // Pass handler down
                />
                <DrawingCanvas
                  ref={drawingCanvasRef}
                  disabled={gamePhase !== 'drawing'}
                  tool={currentTool}             // Pass state down
                  lineWidth={currentLineWidth}     // Pass state down
                />
                <PlayerList players={players} hostId={hostId} />
              </div>
            )}

            {/* NEW: Review Phase Display */}
            {showReview && (
                <ReviewDisplay
                  drawings={reviewDrawings}
                  players={players}
                  prompt={currentPrompt}
                  isHost={isHost}                   // Pass isHost prop
                  onSendForJudgement={handleRequestJudgment} // Pass handler prop
                />
            )}

            {gamePhase === 'judging' && (
              <LoadingIndicator message="AI is judging the drawings..." />
            )}

            {resultsReady && (
              <ResultsDisplay
                drawings={submittedDrawings}
                players={players}
                winnerId={winnerId}
                scores={roundScores}
                comments={roundComments} // NEW: Pass comments prop
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
