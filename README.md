# Drawing Battle - Real-Time AI Drawing Game

This project is a web-based multiplayer game where players draw a prompted object within a time limit, and a Gemini AI model judges the drawings to determine the winner.

## Overview

*   Players join a private game room using a unique code.
*   The host starts a round.
*   All players receive the same random drawing prompt (e.g., "Apple").
*   Players have 30 seconds to draw the object on a shared canvas.
*   When time is up, drawings are automatically submitted.
*   The backend sends the drawings and prompt to the Google Gemini API for judging.
*   Results are displayed, highlighting the winner chosen by the AI.
*   The host can start a new round.

## Tech Stack

*   **Frontend:**
    *   React (using Vite for build tooling)
    *   JavaScript, HTML, CSS
    *   Socket.IO Client (for real-time communication)
    *   HTML Canvas API (for drawing)
*   **Backend:**
    *   Node.js
    *   Socket.IO (for real-time communication)
    *   Express (could be added later for potential REST endpoints)
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
*   Follow the on-screen prompts to start drawing!

## Development Phases (from masterplan.md)

*   ✅ **Phase 1:** Project Setup & Basic Drawing Canvas
*   ✅ **Phase 2:** Basic Real-time Connection & Game Rooms
*   ✅ **Phase 3:** Core Game Loop (Manual Judging)
*   ✅ **Phase 4:** AI Integration & Winner Announcement
*   ⏳ **Phase 5:** Polish & Basic Deployment (Next Steps) 