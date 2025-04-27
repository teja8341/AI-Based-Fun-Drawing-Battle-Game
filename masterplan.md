# Masterplan: Real-Time AI Drawing Game

## 1. App Overview and Objectives

*   **Overview:** A web-based multiplayer game where players join a private room, receive a random object prompt, and have a limited time (30 seconds) to draw it. After the time is up, drawings are submitted, revealed to all players, and judged by an AI (Gemini) to determine the winner whose drawing best represents the object.
*   **Objectives:**
    *   Create a fun, casual, real-time gaming experience for friends or small groups.
    *   Provide a simple and intuitive interface for drawing and participation.
    *   Leverage AI for objective and novel judging of player drawings.
    *   Ensure easy access via a web browser without requiring user accounts.

## 2. Target Audience

*   Anyone looking for a quick, fun, creative game to play online with friends.
*   Accessible via a web browser on desktop or touch devices.

## 3. Core Features and Functionality

*   **Game Rooms:**
    *   A user can "host" a new game session.
    *   A unique link or key is generated for sharing.
    *   Other players can join using the link/key and provide a temporary nickname.
*   **Real-time Player List:** Display nicknames of all players currently in the game room.
*   **Game Start:** Host initiates the start of a game round.
*   **Prompt Display:** A random object name (from a predefined list) is displayed to all players.
*   **Drawing Canvas:**
    *   Central area for free-flow drawing using mouse or touch.
    *   Simple interface (likely just a pen tool initially).
*   **Synchronized Timer:** A 30-second countdown timer visible to all players.
*   **Drawing Submission:** Drawings are automatically submitted when the timer ends.
*   **Drawing Reveal:** All submitted drawings are displayed to everyone in the room after the timer.
*   **AI Judging:**
    *   Backend sends submitted drawings (as images) and the prompt to the Gemini API.
    *   Backend processes the AI response to identify the winning drawing.
*   **Winner Announcement:** The winning player's nickname and drawing are clearly highlighted.
*   **New Round:** Host has the option to start a new round with a new prompt.

## 4. High-Level Technical Stack Recommendations

*   **Frontend (Client-side):**
    *   **Framework:** React (Recommended for managing interactive UI components effectively).
    *   **Language:** JavaScript, HTML, CSS.
    *   **Drawing Canvas:** HTML Canvas API (potentially via a simple React library or custom implementation).
*   **Backend (Server-side):**
    *   **Runtime:** Node.js (Allows using JavaScript on the server, pairs well with React).
    *   **Real-time Communication:** Socket.IO (Simplifies WebSocket management for instant updates between server and clients).
    *   **Language:** JavaScript.
*   **AI Integration:**
    *   Google Gemini API (Accessed securely *only* from the backend).
*   **Deployment (Conceptual):** Cloud platform (e.g., Vercel, Netlify for frontend; Heroku, Render, AWS EC2/Lambda for backend - choices depend on scale and cost).

## 5. Conceptual Data Model

*   **Object Prompts:** Stored in a simple `prompts.json` file loaded by the backend server. Easy to update initially.
    *   `["Apple", "Bicycle", "Tree", "Happy Face", ...]`
*   **Active Game State (In Server Memory):** Managed per active game room, likely associated with Socket.IO rooms.
    *   `Room ID`: Unique identifier for the game session.
    *   `Host ID`: Identifier for the player who started the game.
    *   `Players`: List of `{ playerID, nickname }`.
    *   `Current Prompt`: The object word for the current round.
    *   `Timer State`: Running / Stopped / Remaining Time.
    *   `Submitted Drawings`: Temporary storage for drawings `{ playerID, drawingData/Image }` for the current round.
    *   `Game Phase`: (e.g., Waiting, Drawing, Judging, ShowingResults).
    *   *(This data is transient and discarded when the game room closes)*.

## 6. User Interface Design Principles

*   **Layout:** Central drawing canvas, player list on the right, timer prominently at the top. Prompt clearly visible during the drawing phase.
*   **Simplicity:** Minimalist controls for drawing. Clear calls to action (Host Game, Join Game, Start Round).
*   **Feedback:** Visual cues for timer countdown, confirmation of drawing submission, clear indication of the winner, "Waiting for results" state.
*   **Real-time Feel:** Player list updates instantly, game starts smoothly for everyone, drawings appear simultaneously.

## 7. Security Considerations

*   **API Key Security:** The Gemini API key MUST be stored securely on the backend server and never exposed in the frontend code or network requests initiated directly from the browser.
*   **Input Sanitization (Future):** Basic checks on nicknames to prevent trivial cross-site scripting (XSS) could be added later.
*   **Rate Limiting (Future):** Consider implementing if spam/abuse becomes an issue.

## 8. Development Phases / Milestones (Step-by-Step Implementation)

*   **Phase 1: Project Setup & Basic Drawing Canvas**
    *   Set up basic React frontend project structure.
    *   Set up basic Node.js backend project structure.
    *   Implement the drawing canvas component in React (allow free-form drawing).
    *   *Goal:* Draw something locally in the browser.
*   **Phase 2: Basic Real-time Connection & Game Rooms**
    *   Integrate Socket.IO into frontend and backend.
    *   Implement "Host Game" functionality (backend creates a room).
    *   Implement "Join Game" functionality (users join room via link/key, provide nickname).
    *   Display the list of connected players in the room in real-time.
    *   *Goal:* Multiple users can join a room and see each other's nicknames appear/disappear.
*   **Phase 3: Core Game Loop (Manual Judging)**
    *   Implement "Start Game" button for the host.
    *   Backend selects random prompt from JSON, broadcasts to room.
    *   Implement synchronized 30-second timer, displayed to all.
    *   Implement drawing submission (send drawing data/image to backend on timer end).
    *   Backend collects drawings for the round.
    *   Implement simultaneous reveal of all drawings to all players.
    *   Implement host's "Start New Round" button.
    *   *(Temporarily skip AI judging - maybe just reveal drawings)*
    *   *Goal:* Players can go through a full round: get prompt, draw, see timer, submit, see everyone's drawings.
*   **Phase 4: AI Integration & Winner Announcement**
    *   Set up secure Gemini API access on the backend (using your private API key).
    *   Modify backend to send collected drawings (as images) + prompt to Gemini API after a round.
    *   Process the Gemini API response to determine the winner.
    *   Broadcast the winner information back to the frontend.
    *   Frontend highlights the winner's name and drawing.
    *   *Goal:* Game correctly identifies and announces the winner based on AI judgment.
*   **Phase 5: Polish & Basic Deployment**
    *   Refine UI/UX based on testing (layout, feedback messages).
    *   Add basic CSS styling for a cleaner look.
    *   Perform basic testing across a couple of major browsers.
    *   Prepare basic deployment scripts/configurations for a chosen platform.
    *   *Goal:* A playable, reasonably polished version of the game accessible online.

## 9. Potential Challenges and Solutions

*   **Real-time Sync Issues:** Ensure timers and game state updates are accurately synchronized using Socket.IO's broadcasting/room features. Test thoroughly.
*   **Gemini API Interpretation:** The AI's judgment might sometimes be unexpected. Need to understand how Gemini interprets drawings and potentially refine prompts or how drawing data is sent (e.g., image format, resolution). Start with clear, simple object prompts.
*   **Scalability (If popular):** Managing many simultaneous WebSocket connections and AI API calls might require optimizing the backend or scaling server resources later. (Not an initial concern).
*   **Drawing Canvas Performance:** Ensure the canvas remains responsive, especially on lower-powered devices (keep drawing complexity simple initially).

## 10. Future Expansion Possibilities

*   User accounts and score tracking.
*   Different game modes (e.g., longer timers, different judging criteria, guess-the-drawing mode).
*   More drawing tools (colors, shapes, eraser).
*   Ability to save or share winning drawings.
*   Public game lobbies for random matchmaking.
*   Improved prompt management (categories, difficulty).
*   Sound effects.