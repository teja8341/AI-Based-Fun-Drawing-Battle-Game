# Drawing Battle - Real-Time AI Drawing Game

This project is a web-based multiplayer game where players draw a prompted object within a time limit, and a Google Gemini AI model judges the drawings to determine the winner, providing scores and comments.

## Overview

*   Players host or join a private game room using a unique code.
*   The host configures the drawing time (optional) and starts a round.
*   All players receive the same random drawing prompt (e.g., "Apple") from a customizable list (`backend/prompts.json`).
*   Players have the configured amount of time to draw the object.
*   When time is up (plus a short grace period), drawings are automatically submitted and displayed to all players (`reviewing` phase).
*   Any player can trigger the AI judgment (`judging` phase).
*   The backend sends the drawings and prompt to the Google Gemini API for judging.
*   Results are displayed (`revealing` phase), showing all drawings, the AI's scores and funny comments for each drawing, and highlighting the winner chosen by the AI.
*   The host can start a new round.

## Features

*   Real-time multiplayer drawing using Socket.IO.
*   Host/Join game rooms with unique codes.
*   Random drawing prompts loaded from `prompts.json` (customizable).
*   Configurable drawing time per round (set by host).
*   AI-powered judging using Google Gemini:
    *   Determines a winner based on prompt relevance.
    *   Assigns scores (totaling 100) to all players.
    *   Generates a unique, funny comment for each drawing.
*   Multiple game phases: Waiting -> Drawing -> Collecting (Grace Period) -> Reviewing -> Judging -> Revealing.
*   Display of all drawings, scores, and AI comments during results.
*   Basic host controls (start game, start new round, set draw time).
*   Handles player disconnections gracefully (reassigns host if needed).

## Tech Stack

*   **Frontend:**
    *   React (using Vite for build tooling)
    *   JavaScript, HTML, CSS
    *   Socket.IO Client (for real-time communication)
    *   HTML Canvas API (for drawing)
*   **Backend:**
    *   Node.js
    *   Socket.IO (for real-time communication)
    *   Google Generative AI SDK (`@google/generative-ai`) (for AI judging)
    *   `dotenv` (for environment variable management)
*   **AI:**
    *   Google Gemini API (specifically `gemini-1.5-flash` or similar vision model)

## Project Structure

```
Drawing_battle/
├── backend/         # Node.js server code
│   ├── node_modules/
│   ├── prompts.json   # List of drawing prompts
│   ├── server.js      # Main server logic
│   ├── package.json
│   ├── package-lock.json
│   └── .env           # <<< IMPORTANT: API Key (gitignored)
├── frontend/        # React client code
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── components/  # React components (Canvas, PlayerList, etc.)
│   │   ├── App.jsx      # Main application component
│   │   ├── index.css    # Global styles
│   │   └── main.jsx     # Entry point
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── .gitignore       # Root gitignore file
├── masterplan.md    # Project planning document
└── README.md        # This file
```

## Setup and Running

**Prerequisites:**

*   Node.js and npm (or yarn) installed.
*   A Google Gemini API Key (see [Google AI Studio](https://aistudio.google.com/app/apikey) to get one).

**1. Clone the Repository (if applicable)**

```bash
git clone <repository-url>
cd Drawing_battle
```

**2. Configure API Key:**

*   Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
*   Create a file named `.env`.
*   Add your Gemini API key to the `.env` file:
    ```dotenv
    GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
    ```
*   **Important:** This `.env` file is included in the `.gitignore` and should *not* be committed to version control.

**3. Install Dependencies:**

*   **Backend:**
    ```bash
    # Ensure you are in the backend/ directory
    npm install
    ```
*   **Frontend:**
    ```bash
    cd ../frontend # Navigate to the frontend directory
    npm install
    ```

**4. Run the Application:**

*   **Start the Backend Server:**
    ```bash
    cd ../backend # Navigate back to the backend directory
    npm start
    ```
    The backend server should start, typically listening on port 3001. Keep this terminal running.

*   **Start the Frontend Development Server:**
    *   Open a **new terminal window/tab**.
    *   Navigate to the `frontend` directory:
        ```bash
        cd path/to/Drawing_battle/frontend
        ```
    *   Run the development server:
        ```bash
        npm run dev
        ```
    This will usually open the application automatically in your default web browser (e.g., `http://localhost:5173`). If not, open the provided URL manually.

**5. Play!**

*   Open the application URL in two separate browser tabs.
*   Enter a nickname in the first tab and click "Host New Game".
*   Copy the Room ID displayed.
*   Enter a different nickname in the second tab, paste the Room ID, and click "Join Game".
*   The Host can optionally change the draw time before starting.
*   The Host clicks "Start Game".
*   Draw the prompt!
*   After drawing time, view drawings.
*   Click "Get AI Judgment".
*   View the results (scores, comments, winner)!
*   Host clicks "New Round" to play again.

## Development Phases (from masterplan.md)

*   ✅ **Phase 1:** Project Setup & Basic Drawing Canvas
*   ✅ **Phase 2:** Basic Real-time Connection & Game Rooms
*   ✅ **Phase 3:** Core Game Loop (Manual Judging) -> Enhanced to AI Judging
*   ✅ **Phase 4:** AI Integration & Winner Announcement -> Enhanced with Scores/Comments
*   ✅ **Phase 5:** Polish & Basic Deployment (Next Steps) -> Core features complete
*   ⏳ **Phase 6:** Advanced Features (Future ideas: Better drawing tools, user accounts, etc.) 