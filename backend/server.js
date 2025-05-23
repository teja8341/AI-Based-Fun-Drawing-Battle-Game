const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs'); // Import file system module
require('dotenv').config(); // Load .env file
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// --- Gemini AI Setup ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("🚨 Error: GEMINI_API_KEY not found in environment variables. AI Judging disabled.");
  // Optionally exit or run in a mode without AI
  // process.exit(1); 
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Use a capable vision model
});
const generationConfig = {
  temperature: 0.4,
  topP: 1,
  topK: 32,
  maxOutputTokens: 4096, // Adjust as needed
};
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Load Prompts --- \
let prompts = [];
try {
  const promptsData = fs.readFileSync('prompts.json', 'utf8');
  prompts = JSON.parse(promptsData);
  console.log(`Loaded ${prompts.length} prompts.`);
} catch (err) {
  console.error("Error loading prompts.json:", err);
  // Use default prompts if file loading fails
  prompts = ["Apple", "House", "Star", "Tree"];
}

// Helper function to generate a simple room ID
function generateRoomId(length = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// --- Constants ---
const DRAW_TIME = 30000; // 30 seconds in milliseconds
const GRACE_PERIOD = 3000; // 3 seconds grace period for submissions

const httpServer = http.createServer((req, res) => {
  // Basic HTTP response (can be expanded later if needed for API routes)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Drawing Battle Backend');
});

// Get the deployed frontend URL from environment variables, default to localhost for development
const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(httpServer, {
  cors: {
    origin: [frontendURL, "http://localhost:5173"], // Allow both deployed and local URLs
    methods: ["GET", "POST"]
  }
});

// Updated in-memory storage for game state
// rooms[roomId] = {
//   players: [{ id: socketId, nickname: string }, ... ],
//   hostId: socketId,
//   gamePhase: 'waiting' | 'drawing' | 'collecting' | 'reviewing' | 'judging' | 'revealing', // Added 'reviewing' phase
//   currentPrompt: string | null,
//   timerEndTime: number | null, // Timestamp when the timer ends
//   roundDrawings: { [socketId]: string }, // Store drawings (e.g., base64 data URL) for the round
//   timerId: NodeJS.Timeout | null, // Store the timer ID for cancellation
//   graceTimerId: NodeJS.Timeout | null, // Store the grace period timer ID
//   winnerId: string | null, // Store the winner ID
//   drawTime: number, // NEW: Configurable draw time in milliseconds
//   roundScores: { [socketId]: number } | null, // Scores for the round
//   roundComments: { [socketId]: string } | null // NEW: Comments for the round
//   totalRounds: number, // Total number of rounds for the game
//   currentRound: number, // Current round number (1-based)
//   playerScores: { [socketId]: number } // Cumulative scores across rounds
// }
const rooms = {};

// Helper function to get room state for client
const getRoomStateForClient = (roomId) => {
    const room = rooms[roomId];
    if (!room) return null;
    // Map 'collecting' phase to 'drawing' for the client
    // Map 'judging' & 'reviewing' phases explicitly for the client
    let clientPhase = room.gamePhase;
    if (clientPhase === 'collecting') {
        clientPhase = 'drawing';
    }
    return {
        players: room.players || [],
        hostId: room.hostId,
        gamePhase: clientPhase, // Send 'judging' & 'reviewing' phases to client
        currentPrompt: room.currentPrompt,
        timerEndTime: room.timerEndTime,
        winnerId: room.winnerId,
        drawTime: room.drawTime,
        roundScores: room.roundScores,
        roundComments: room.roundComments,
        // NEW: Add multi-round state
        totalRounds: room.totalRounds,
        currentRound: room.currentRound,
        playerScores: room.playerScores
    };
}

// Helper function to convert base64 Data URL to Gemini FileData Part
function dataUrlToGenerativePart(dataUrl, mimeType = "image/png") {
    return {
        inlineData: {
            data: dataUrl.split(',')[1], // Remove the "data:image/png;base64," prefix
            mimeType
        },
    };
}

// --- AI Judging Function ---
// Returns { winnerId: string|null, scores: { [playerId]: number } | null, comments: { [playerId]: string } | null }
async function judgeDrawings(prompt, drawings) {
    if (!apiKey) {
        console.log("Skipping AI judging as API key is missing.");
        return { winnerId: null, scores: null, comments: null };
    }
    const playerIds = Object.keys(drawings);
    if (!drawings || playerIds.length === 0) {
        console.log("Skipping AI judging as there are no drawings.");
        return { winnerId: null, scores: null, comments: null };
    }

    const defaultScores = playerIds.reduce((acc, id) => { acc[id] = 0; return acc; }, {});
    const defaultComments = playerIds.reduce((acc, id) => { acc[id] = "AI comment unavailable."; return acc; }, {});

    // --- NEW PROMPT for JSON Scores & Comments ---
    const parts = [
        { text: `Game Prompt: "${prompt}". The following images are drawings submitted by different players. Each player has a unique ID associated with their drawing.` },
    ];
    playerIds.forEach((playerId) => {
        parts.push({ text: `
Player ID: ${playerId}` });
        try {
            const imageDataPart = dataUrlToGenerativePart(drawings[playerId]);
            parts.push(imageDataPart);
        } catch (error) {
            console.error(`[AI Judge] Error processing drawing for player ${playerId}:`, error);
        }
    });
    // Construct example JSON structure string dynamically
    const exampleScores = JSON.stringify(playerIds.reduce((acc, id, index) => { acc[id] = index === 0 ? 60 : 40 / (playerIds.length -1 || 1); return acc; }, {}), null, 2);
    const exampleComments = JSON.stringify(playerIds.reduce((acc, id) => { acc[id] = "Funny comment about this drawing..."; return acc; }, {}), null, 2);
    const exampleJson = JSON.stringify({ scores: JSON.parse(exampleScores), comments: JSON.parse(exampleComments) }, null, 2);

    parts.push({ text: `
Based *only* on how well the drawings represent the prompt "${prompt}", perform two tasks:\n1. Distribute a total of 100 integer points among the players based on drawing quality relative to the prompt. The sum of scores MUST equal 100.\n2. For EACH player, provide a short, funny, one-sentence comment explaining the score or reacting to the drawing.\nRespond with *only* a single, valid JSON object containing two keys: "scores" and "comments".\n- The value for "scores" must be a JSON object mapping each Player ID to their integer score.\n- The value for "comments" must be a JSON object mapping each Player ID to their funny comment string.\nExample format:\n\`\`\`json\n${exampleJson}\n\`\`\`` });

    console.log(`[AI Judge] Sending ${playerIds.length} drawings to Gemini for prompt: "${prompt}" (Expecting JSON scores & comments)`);

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig,
            safetySettings,
        });

        const responseText = result.response.text().trim();
        console.log(`[AI Judge] Gemini Response Text: "${responseText}"`);

        // --- Parse and Validate JSON Response ---
        let parsedResponse = null;
        try {
            const cleanedJsonString = responseText.replace(/^```json\n?|```$/g, '').trim();
            parsedResponse = JSON.parse(cleanedJsonString);
            console.log("[AI Judge] Parsed response:", parsedResponse);

            if (!parsedResponse || typeof parsedResponse !== 'object' || !parsedResponse.scores || !parsedResponse.comments) {
                 throw new Error("Response missing 'scores' or 'comments' keys.");
            }

            // --- Validate Scores ---
            let currentTotal = 0;
            let scoresValid = true;
            const validatedScores = {};
            for (const playerId of playerIds) {
                const score = parsedResponse.scores[playerId];
                if (!(playerId in parsedResponse.scores) || typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
                    console.warn(`[AI Judge] Score validation failed for player ${playerId}:`, score);
                    scoresValid = false; break;
                }
                validatedScores[playerId] = score;
                currentTotal += score;
            }
            if (scoresValid && Object.keys(parsedResponse.scores).length !== playerIds.length) scoresValid = false; // Check for extra keys

            // --- Validate Comments ---
            let commentsValid = true;
            const validatedComments = {};
            for (const playerId of playerIds) {
                 const comment = parsedResponse.comments[playerId];
                 if (!(playerId in parsedResponse.comments) || typeof comment !== 'string' || comment.trim().length === 0) {
                     console.warn(`[AI Judge] Comment validation failed for player ${playerId}:`, comment);
                     commentsValid = false; break;
                 }
                 validatedComments[playerId] = comment.trim();
            }
             if (commentsValid && Object.keys(parsedResponse.comments).length !== playerIds.length) commentsValid = false; // Check for extra keys

            // --- Handle Validation Results --- 
            if (!scoresValid) {
                 console.warn("[AI Judge] Scores validation failed. Using default scores and comments.");
                 return { winnerId: null, scores: defaultScores, comments: defaultComments };
            }

            let finalScores = { ...validatedScores };
            let finalComments = commentsValid ? validatedComments : defaultComments;
            if (!commentsValid) console.warn("[AI Judge] Comments validation failed. Using default comments.");

            console.log(`[AI Judge] Initial scores validated. Sum: ${currentTotal}`);

            // --- Normalize Scores --- 
            if (currentTotal === 0) {
                finalScores = defaultScores;
            } else if (currentTotal !== 100) {
                console.log(`[AI Judge] Normalizing scores from ${currentTotal} to 100.`);
                let normalizedSum = 0;
                playerIds.forEach(id => {
                    finalScores[id] = Math.round((validatedScores[id] / currentTotal) * 100);
                    normalizedSum += finalScores[id];
                });
                // Adjust rounding diff
                let diff = 100 - normalizedSum;
                if (diff !== 0) {
                    let adjustPlayer = playerIds.reduce((a, b) => finalScores[a] > finalScores[b] ? a : b); // Player with highest score adjusts
                    finalScores[adjustPlayer] += diff;
                }
                 console.log("[AI Judge] Normalized scores:", finalScores);
            }

            // --- Determine Winner --- 
            let winnerId = null;
            let maxScore = -1;
            for (const [playerId, score] of Object.entries(finalScores)) {
                if (score > maxScore) {
                    maxScore = score;
                    winnerId = playerId;
                }
            }
            console.log(`[AI Judge] Winner determined by max score (${maxScore}): ${winnerId}`);
            return { winnerId: winnerId, scores: finalScores, comments: finalComments };

        } catch (parseError) {
            console.error("[AI Judge] Failed to parse or validate JSON response:", parseError);
            return { winnerId: null, scores: defaultScores, comments: defaultComments };
        }

    } catch (error) {
        console.error("[AI Judge] Error calling Gemini API:", error);
        return { winnerId: null, scores: defaultScores, comments: defaultComments };
    }
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // --- Host Game --- \
  socket.on('hostGame', (nickname) => {
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.length > 15) {
        // Basic validation
        // In a real app, add more robust validation
        console.log(`Invalid nickname attempt from ${socket.id}: ${nickname}`);
        return; // Maybe emit an error back?
    }

    let newRoomId;
    do {
        newRoomId = generateRoomId();
    } while (rooms[newRoomId]); // Ensure unique room ID

    console.log(`Player ${nickname} (${socket.id}) is hosting new room: ${newRoomId}`);

    rooms[newRoomId] = {
      players: [{ id: socket.id, nickname: nickname.trim() }],
      hostId: socket.id,
      gamePhase: 'waiting', // Initial phase
      currentPrompt: null,
      timerEndTime: null,
      roundDrawings: {},
      timerId: null,
      graceTimerId: null, // Initialize grace timer ID
      winnerId: null, // Initialize winner ID
      drawTime: DRAW_TIME, // NEW: Configurable draw time in milliseconds
      roundScores: null, // NEW: Initialize roundScores
      roundComments: null, // NEW: Initialize roundComments
      // NEW: Multi-round state
      totalRounds: 3, // Default to 3 rounds for now
      currentRound: 0,
      playerScores: { [socket.id]: 0 } // Initialize host score
    };

    socket.join(newRoomId); // Make the socket join the Socket.IO room
    socket.emit('roomCreated', newRoomId); // Tell the host the room ID

    // Send the initial room state
    io.to(newRoomId).emit('roomStateUpdate', getRoomStateForClient(newRoomId));
    socket.data.currentRoomId = newRoomId; // Store room for disconnect
  });

  // --- Join Game ---
  socket.on('joinGame', ({ roomId, nickname }) => {
    const requestedRoomId = roomId?.toUpperCase(); // Normalize room ID

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.length > 15) {
        console.log(`Join attempt with invalid nickname from ${socket.id}: ${nickname}`);
        socket.emit('joinError', 'Invalid nickname.');
        return;
    }
    if (!requestedRoomId || typeof requestedRoomId !== 'string' || !rooms[requestedRoomId]) {
      console.log(`Join attempt failed for room ${requestedRoomId} from ${socket.id}: Room not found`);
      socket.emit('joinError', 'Room not found.');
      return;
    }

    const room = rooms[requestedRoomId];

    // Check if nickname is already taken in that room
    if (room.players.some(player => player.nickname.toLowerCase() === nickname.trim().toLowerCase())) {
      console.log(`Join attempt failed for room ${requestedRoomId} from ${socket.id}: Nickname taken`);
      socket.emit('joinError', 'Nickname is already taken in this room.');
      return;
    }

    console.log(`Player ${nickname} (${socket.id}) is joining room: ${requestedRoomId}`);

    room.players.push({ id: socket.id, nickname: nickname.trim() });
    room.playerScores[socket.id] = 0; // Initialize score for joining player
    socket.join(requestedRoomId); // Join the Socket.IO room

    socket.emit('joinedRoom', requestedRoomId); // Confirm join success

    // Send updated room state to everyone
    io.to(requestedRoomId).emit('roomStateUpdate', getRoomStateForClient(requestedRoomId));

    // Send current results if joining mid-reveal
    if (room.gamePhase === 'revealing') {
        socket.emit('showResults', room.roundDrawings);
    }

    socket.data.currentRoomId = requestedRoomId;
  });

  // --- Start Game --- (Host only)
  socket.on('startGame', () => {
    const roomId = socket.data.currentRoomId;
    const room = rooms[roomId];

    if (!room || room.hostId !== socket.id || room.gamePhase !== 'waiting') {
        console.log(`Unauthorized startGame attempt in room ${roomId} by ${socket.id}`);
        return; // Only host can start in waiting phase
    }

    // Select a random prompt
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    const roomDrawTime = room.drawTime || DRAW_TIME; // Use room's time, fallback to default
    console.log(`[${roomId}] Starting game with prompt: "${randomPrompt}" and draw time: ${roomDrawTime}ms`);

    room.gamePhase = 'drawing';
    room.currentPrompt = randomPrompt;
    room.timerEndTime = Date.now() + roomDrawTime; // Use configured draw time
    room.roundDrawings = {};
    room.roundScores = null;
    room.roundComments = null; // NEW: Clear comments for new round
    if (room.timerId) clearTimeout(room.timerId);
    if (room.graceTimerId) clearTimeout(room.graceTimerId);
    room.graceTimerId = null;
    room.winnerId = null;
    room.currentRound = 1; // Start the first round

    // Main drawing timer
    room.timerId = setTimeout(() => {
      if (rooms[roomId] && rooms[roomId].gamePhase === 'drawing') {
          console.log(`[${roomId}] Main timer ended. Entering grace period.`);
          rooms[roomId].gamePhase = 'collecting';
          rooms[roomId].timerId = null;

          // Start the grace period timer
          rooms[roomId].graceTimerId = setTimeout(() => { // No 'async' needed here anymore
              const currentRoom = rooms[roomId];
              if (currentRoom && currentRoom.gamePhase === 'collecting') {
                  console.log(`[${roomId}] Grace period ended. Entering reviewing phase.`);
                  currentRoom.graceTimerId = null;
                  currentRoom.gamePhase = 'reviewing'; // <--- NEW PHASE: REVIEWING

                  // --- Notify clients to show all drawings ---
                  io.to(roomId).emit('showAllDrawings', {
                      drawings: currentRoom.roundDrawings,
                      prompt: currentRoom.currentPrompt // Send prompt too
                  });
                  // Send updated state (reviewing phase)
                  io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
              }
          }, GRACE_PERIOD);
      }
  }, roomDrawTime); // Use configured draw time for the timeout

    // Notify game started
    io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
  });

  // --- NEW: Request AI Judgment --- (Triggered by client)
  socket.on('requestJudgment', async () => {
      const roomId = socket.data.currentRoomId;
      const room = rooms[roomId];

      // Only allow judgment if in the reviewing phase
      if (!room || room.gamePhase !== 'reviewing') {
          console.log(`[${roomId}] Invalid requestJudgment attempt by ${socket.id} in phase ${room?.gamePhase}`);
          return;
      }
      // Optional: Add check if sender is host? For now, anyone can trigger.
      // if (room.hostId !== socket.id) { ... }

      console.log(`[${roomId}] Judgment requested by ${socket.id}. Entering judging phase.`);
      room.gamePhase = 'judging';
      room.winnerId = null; // Ensure winner is null before judging
      room.roundScores = null; // Clear previous scores
      room.roundComments = null; // Clear previous comments

      // --- Notify clients we are judging ---
      io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));

      // --- Call AI Judge (async) ---
      let judgeResult = { winnerId: null, scores: null, comments: null }; // Default result
      try {
          judgeResult = await judgeDrawings(room.currentPrompt, room.roundDrawings);
          room.winnerId = judgeResult.winnerId;
          room.roundScores = judgeResult.scores;
          room.roundComments = judgeResult.comments; // Store the comments object correctly

          // --- NEW: Update cumulative scores --- 
          if (room.roundScores) {
              for (const playerId in room.roundScores) {
                  if (room.playerScores.hasOwnProperty(playerId)) {
                      room.playerScores[playerId] += room.roundScores[playerId];
                  } else {
                      // Should not happen if players are managed correctly, but good to handle
                      console.warn(`[${roomId}] Player ${playerId} has round score but no cumulative score entry. Initializing.`);
                      room.playerScores[playerId] = room.roundScores[playerId]; 
                  }
              }
          }

      } catch (judgeError) {
          console.error(`[${roomId}] Error during AI judging:`, judgeError);
          // Keep winnerId, roundScores, roundComments as null/default
      }
      // --- End AI Judge Call ---

      // Ensure room still exists and phase is still judging before proceeding
      if (rooms[roomId] && rooms[roomId].gamePhase === 'judging') {
          console.log(`[${roomId}] Judging complete. Winner: ${room.winnerId || 'None'}. Scores:`, room.roundScores, "Comments:", room.roundComments);
          // Now set phase to revealing AFTER judging is done
          rooms[roomId].gamePhase = 'revealing';

          // Send results including the winner ID, scores, AND comments
          io.to(roomId).emit('showResults', {
              drawings: room.roundDrawings,
              winnerId: room.winnerId,
              prompt: room.currentPrompt,
              scores: room.roundScores,
              comments: room.roundComments // NEW: Send comments correctly
          });
          // Update state again to reflect revealing phase AND updated cumulative scores
          io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
      } else {
          console.log(`[${roomId}] Room state changed during judging, skipping reveal.`);
      }
  });

  // --- Submit Drawing --- \
  socket.on('submitDrawing', (drawingDataUrl) => {
    const roomId = socket.data.currentRoomId;
    const room = rooms[roomId];

    // Accept drawings during drawing phase OR grace period
    if (!room || (room.gamePhase !== 'drawing' && room.gamePhase !== 'collecting')) {
      console.log(`[${roomId}] Drawing submitted by ${socket.id} outside of allowed phase (${room?.gamePhase}).`);
      return;
    }
    // Check if already submitted
    if (room.roundDrawings[socket.id]) {
        console.log(`[${roomId}] Player ${socket.id} already submitted a drawing.`);
        return;
    }
    // Validation
    if (typeof drawingDataUrl !== 'string' || !drawingDataUrl.startsWith('data:image/png;base64,')) {
      console.log(`[${roomId}] Invalid drawing data received from ${socket.id}`);
      return;
    }

    console.log(`[${roomId}] Received drawing from ${socket.id} during phase: ${room.gamePhase}`);
    room.roundDrawings[socket.id] = drawingDataUrl;

    // Optional: Check if all players submitted during grace period to end early?
    // if (room.gamePhase === 'collecting') {
    //     const activePlayerIds = new Set(room.players.map(p => p.id));
    //     if (Object.keys(room.roundDrawings).length >= activePlayerIds.size) {
    //         console.log(`[${roomId}] All players submitted during grace period. Ending early.`);
    //         if (room.graceTimerId) clearTimeout(room.graceTimerId);
    //         room.gamePhase = 'revealing';
    //         room.graceTimerId = null;
    //         io.to(roomId).emit('showResults', room.roundDrawings);
    //         io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
    //     }
    // }
  });

  // --- Start New Round / End Game --- (Host only)
  socket.on('startNewRound', () => {
    const roomId = socket.data.currentRoomId;
    const room = rooms[roomId];
    // Allow transition only from revealing phase by the host
    if (!room || room.hostId !== socket.id || room.gamePhase !== 'revealing') {
      console.log(`[${roomId}] Unauthorized startNewRound/endGame attempt by ${socket.id} in phase ${room?.gamePhase}`);
      return;
    }

    // --- Check if all rounds are completed ---
    if (room.currentRound >= room.totalRounds) {
        console.log(`[${roomId}] Game ended after ${room.currentRound} rounds.`);
        room.gamePhase = 'gameOver';

        // Determine overall winner(s)
        let overallWinnerId = null;
        let maxScore = -1;
        let isTie = false;
        let winners = [];

        for (const [playerId, score] of Object.entries(room.playerScores)) {
            // Ensure the player is still in the room
            if (room.players.some(p => p.id === playerId)) {
                if (score > maxScore) {
                    maxScore = score;
                    winners = [playerId]; // Start new list of winners
                    isTie = false;
                } else if (score === maxScore) {
                    winners.push(playerId);
                    isTie = true;
                }
            }
        }

        // Assign winner(s)
        overallWinnerId = winners.length > 0 ? winners : null; // Can be an array in case of a tie

        console.log(`[${roomId}] Overall winner(s): ${overallWinnerId}, Score: ${maxScore}`);

        // Clear timers if any are somehow running
        if (room.timerId) clearTimeout(room.timerId);
        if (room.graceTimerId) clearTimeout(room.graceTimerId);
        room.timerId = null;
        room.graceTimerId = null;
        room.timerEndTime = null;

        // Notify clients about game over
        io.to(roomId).emit('gameOver', { 
            overallWinnerId: overallWinnerId, 
            finalScores: room.playerScores,
            isTie: isTie
        });
        // Also send final state update
        io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));

    } else {
        // --- Start the next round ---
        console.log(`[${roomId}] Starting round ${room.currentRound + 1} of ${room.totalRounds}.`);
        room.currentRound++;

        // Select a new random prompt
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        const roomDrawTime = room.drawTime || DRAW_TIME; // Use room's time, fallback to default
        console.log(`[${roomId}] New prompt: "${randomPrompt}"`);

        room.gamePhase = 'drawing';
        room.currentPrompt = randomPrompt;
        room.timerEndTime = Date.now() + roomDrawTime; 
        room.roundDrawings = {};
        room.roundScores = null;
        room.roundComments = null;
        if (room.timerId) clearTimeout(room.timerId); // Clear old timers just in case
        if (room.graceTimerId) clearTimeout(room.graceTimerId);
        room.graceTimerId = null;
        room.winnerId = null;

        // Main drawing timer for the new round
        room.timerId = setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].gamePhase === 'drawing') {
                console.log(`[${roomId}] Main timer ended (Round ${room.currentRound}). Entering grace period.`);
                rooms[roomId].gamePhase = 'collecting';
                rooms[roomId].timerId = null;

                // Start the grace period timer
                rooms[roomId].graceTimerId = setTimeout(() => {
                    const currentRoom = rooms[roomId];
                    if (currentRoom && currentRoom.gamePhase === 'collecting') {
                        console.log(`[${roomId}] Grace period ended (Round ${room.currentRound}). Entering reviewing phase.`);
                        currentRoom.graceTimerId = null;
                        currentRoom.gamePhase = 'reviewing';

                        io.to(roomId).emit('showAllDrawings', {
                            drawings: currentRoom.roundDrawings,
                            prompt: currentRoom.currentPrompt
                        });
                        io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
                    }
                }, GRACE_PERIOD);
            }
        }, roomDrawTime);

        // Notify game state updated for the new round
        io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
        io.to(roomId).emit('clearResults'); // Clear previous round results display on client
    }
  });

  // --- NEW: Reset Game (Host only, from Game Over) ---
  socket.on('resetGame', () => {
    const roomId = socket.data.currentRoomId;
    const room = rooms[roomId];

    // Only allow reset if host is triggering it from gameOver phase
    if (!room || room.hostId !== socket.id || room.gamePhase !== 'gameOver') {
        console.log(`[${roomId}] Unauthorized resetGame attempt by ${socket.id} in phase ${room?.gamePhase}`);
        return;
    }

    console.log(`[${roomId}] Host ${socket.id} is resetting the game.`);

    // Reset state back to waiting lobby defaults
    room.gamePhase = 'waiting';
    room.currentPrompt = null;
    room.timerEndTime = null;
    room.roundDrawings = {};
    room.winnerId = null; 
    room.roundScores = null;
    room.roundComments = null;
    room.currentRound = 0;
    // Reset player scores
    for (const playerId in room.playerScores) {
        room.playerScores[playerId] = 0;
    }
    // Keep totalRounds and drawTime as potentially configured by host
    // Clear any lingering timers (shouldn't be any, but good practice)
    if (room.timerId) clearTimeout(room.timerId);
    if (room.graceTimerId) clearTimeout(room.graceTimerId);
    room.timerId = null;
    room.graceTimerId = null;

    // Notify clients of the reset state
    io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
    io.to(roomId).emit('clearResults'); // Ensure old results/game over screen is cleared
  });

  // --- NEW: Set Total Rounds --- (Host only, during waiting phase)
  socket.on('setTotalRounds', (numRounds) => {
    const roomId = socket.data.currentRoomId;
    const room = rooms[roomId];
    const MIN_ROUNDS = 1;
    const MAX_ROUNDS = 10;

    if (!room || room.hostId !== socket.id || room.gamePhase !== 'waiting') {
        console.log(`[${roomId}] Unauthorized setTotalRounds attempt by ${socket.id} in phase ${room?.gamePhase}`);
        return;
    }

    const rounds = parseInt(numRounds, 10);
    if (isNaN(rounds) || rounds < MIN_ROUNDS || rounds > MAX_ROUNDS) {
        console.log(`[${roomId}] Invalid total rounds value received: ${numRounds}. Must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}.`);
        // Optionally emit an error back to the host?
        return;
    }

    console.log(`[${roomId}] Host ${socket.id} set total rounds to ${rounds}`);
    room.totalRounds = rounds;

    // Notify everyone in the room of the updated state (including the new round count)
    io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
});

  // --- NEW: Set Draw Time --- (Host only, during waiting phase)
  socket.on('setDrawTime', (newTimeMs) => {
      const roomId = socket.data.currentRoomId;
      const room = rooms[roomId];
      const MIN_DRAW_TIME = 15000; // 15 seconds
      const MAX_DRAW_TIME = 120000; // 2 minutes

      if (!room || room.hostId !== socket.id || room.gamePhase !== 'waiting') {
          console.log(`[${roomId}] Unauthorized setDrawTime attempt by ${socket.id} in phase ${room?.gamePhase}`);
          return;
      }

      const time = parseInt(newTimeMs, 10);
      if (isNaN(time) || time < MIN_DRAW_TIME || time > MAX_DRAW_TIME) {
          console.log(`[${roomId}] Invalid draw time value received: ${newTimeMs}. Must be between ${MIN_DRAW_TIME} and ${MAX_DRAW_TIME} ms.`);
          // Optionally emit an error back to the host?
          return;
      }

      console.log(`[${roomId}] Host ${socket.id} set draw time to ${time}ms`);
      room.drawTime = time;

      // Notify everyone in the room of the updated state (including the new time)
      io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
  });

  // --- Handle Disconnection --- \
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const roomId = socket.data.currentRoomId;

    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      console.log(`Removing player ${socket.id} from room ${roomId}`);

      // Remove the player
      const wasHost = room.hostId === socket.id;
      room.players = room.players.filter(player => player.id !== socket.id);

      if (room.players.length === 0) {
        console.log(`Room ${roomId} is empty, deleting.`);
        if(room.timerId) clearTimeout(room.timerId); // Clear timer if room is deleted
        if(room.graceTimerId) clearTimeout(room.graceTimerId); // Clear grace timer too
        delete rooms[roomId];
      } else {
        let hostChanged = false;
        // If the host disconnected, assign a new host (first player in list)
        if (wasHost) {
          room.hostId = room.players[0].id;
          hostChanged = true;
          console.log(`Host disconnected, new host is ${room.hostId} in room ${roomId}`);
        }

        // If the game was in drawing phase and the disconnected player hadn't submitted,
        // we might need to check if the round should end early (if all remaining players submitted)
        // (Logic omitted for brevity, similar to the check in submitDrawing)

        // Notify remaining players of the state change
        io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
      }
    } else {
        console.log(`Disconnected user ${socket.id} was not in a tracked room.`);
    }
  });

  // --- Placeholder for future event handlers ---
  // socket.on('drawingAction', (data) => { ... });
  // etc.

});

const PORT = process.env.PORT || 3001; // Use environment variable or default
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 