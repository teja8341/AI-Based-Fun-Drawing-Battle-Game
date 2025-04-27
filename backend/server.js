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
const GRACE_PERIOD = 1500; // 1.5 seconds grace period for submissions

const httpServer = http.createServer((req, res) => {
  // Basic HTTP response (can be expanded later if needed for API routes)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Drawing Battle Backend');
});

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Allow requests from our React frontend dev server
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
        winnerId: room.winnerId, // Also include winnerId if available (for results phase)
        drawTime: room.drawTime // NEW: Send current draw time setting
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
async function judgeDrawings(prompt, drawings) {
    if (!apiKey) {
        console.log("Skipping AI judging as API key is missing.");
        return null; // Return null if no API key
    }
    if (!drawings || Object.keys(drawings).length === 0) {
        console.log("Skipping AI judging as there are no drawings.");
        return null;
    }

    const playerIds = Object.keys(drawings);

    // Prepare parts for Gemini API
    const parts = [
        { text: `Game Prompt: "${prompt}". The following images are drawings submitted by different players. Each player has a unique ID associated with their drawing.` },
    ];

    // Add drawings with their IDs
    playerIds.forEach((playerId) => {
        parts.push({ text: `
Player ID: ${playerId}` });
        try {
            const imageDataPart = dataUrlToGenerativePart(drawings[playerId]);
            parts.push(imageDataPart);
        } catch (error) {
            console.error(`[AI Judge] Error processing drawing for player ${playerId}:`, error);
            // Skip this drawing if conversion fails
        }
    });

    parts.push({ text: `
Based *only* on how well the drawings represent the prompt "${prompt}", which drawing is the best? Respond with *only* the Player ID of the winner. If it's impossible to determine a single best drawing or multiple are equally good, respond with "NONE".` });

    console.log(`[AI Judge] Sending ${playerIds.length} drawings to Gemini for prompt: "${prompt}"`);

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig,
            safetySettings,
        });

        const responseText = result.response.text().trim();
        console.log(`[AI Judge] Gemini Response: "${responseText}"`);

        // Check if the response exactly matches one of the player IDs
        if (playerIds.includes(responseText)) {
            console.log(`[AI Judge] Winner determined: ${responseText}`);
            return responseText; // Return the winning player ID
        } else if (responseText.toUpperCase() === "NONE") {
             console.log("[AI Judge] Gemini indicated no clear winner.");
             return null; // No clear winner
        } else {
            console.warn(`[AI Judge] Gemini response ("${responseText}") did not match any Player ID or "NONE". No winner selected.`);
            return null; // Unexpected response
        }
    } catch (error) {
        console.error("[AI Judge] Error calling Gemini API:", error);
        return null; // Return null on error
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
    if (room.timerId) clearTimeout(room.timerId);
    if (room.graceTimerId) clearTimeout(room.graceTimerId);
    room.graceTimerId = null;
    room.winnerId = null;

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
  socket.on('requestJudgment', async () => { // Make this async
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

      // --- Notify clients we are judging ---
      io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));

      // --- Call AI Judge (async) ---
      let winnerId = null;
      try {
          // Optional delay might still be useful here if needed
          // await new Promise(resolve => setTimeout(resolve, 50));
          winnerId = await judgeDrawings(room.currentPrompt, room.roundDrawings);
          if (winnerId) {
              room.winnerId = winnerId;
          }
      } catch (judgeError) {
          console.error(`[${roomId}] Error during AI judging:`, judgeError);
      }
      // --- End AI Judge Call ---

      // Ensure room still exists and phase is still judging before proceeding
      if (rooms[roomId] && rooms[roomId].gamePhase === 'judging') {
          console.log(`[${roomId}] Judging complete. Revealing results. Winner: ${room.winnerId || 'None'}`);
          // Now set phase to revealing AFTER judging is done
          rooms[roomId].gamePhase = 'revealing';

          // Send results including the winner ID
          io.to(roomId).emit('showResults', {
              drawings: room.roundDrawings,
              winnerId: room.winnerId,
              prompt: room.currentPrompt // Send prompt here too for context
          });
          // Update state again to reflect revealing phase
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

  // --- Start New Round --- (Host only)
  socket.on('startNewRound', () => {
    const roomId = socket.data.currentRoomId;
    const room = rooms[roomId];
    // Allow starting new round only from revealing phase
    if (!room || room.hostId !== socket.id || room.gamePhase !== 'revealing') {
      console.log(`[${roomId}] Unauthorized startNewRound attempt by ${socket.id} in phase ${room?.gamePhase}`);
      return;
    }
    console.log(`[${roomId}] Resetting for new round.`);

    room.gamePhase = 'waiting';
    room.currentPrompt = null;
    room.timerEndTime = null;
    room.roundDrawings = {};
    room.winnerId = null; // Clear winner ID
    if (room.timerId) clearTimeout(room.timerId);
    if (room.graceTimerId) clearTimeout(room.graceTimerId);
    room.timerId = null;
    room.graceTimerId = null;

    io.to(roomId).emit('roomStateUpdate', getRoomStateForClient(roomId));
    io.to(roomId).emit('clearResults');
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