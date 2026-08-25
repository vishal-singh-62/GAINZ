GAINZ — AI FITNESS COACH (GEMINI FREE-TIER BUILD)
==================================================

GAINZ is a student fitness planner that combines a local rule-based fitness engine with a conversational AI coach.

AI PROVIDER
-----------
This build uses Google's Gemini Developer API instead of OpenAI. Google AI Studio provides API keys and a free tier for eligible models/projects. Free-tier availability and limits can change, so check Google's current pricing/limits if a request is rate-limited.

The project defaults to Gemini 3.6 Flash-Lite. You can change GEMINI_MODEL in .env if your project has access to another Gemini model. The health endpoint does not perform model discovery, so it can confirm configuration without depending on the Models List endpoint.

SETUP
-----
1. Install Node.js 18+ (Node 24 LTS is recommended for this project).
2. Create a Gemini API key in Google AI Studio.
3. Create a file named .env beside server.js.
4. Put this in .env:

   GEMINI_API_KEY=your_real_key_here
   GEMINI_MODEL=
   PORT=3000

   You can optionally set GEMINI_MODEL=gemini-3.5-flash-lite.

5. Open PowerShell in this folder and run:

   node server.js

6. Open:

   http://localhost:3000

7. Test the backend configuration:

   http://localhost:3000/api/health

   Then use the "Test AI connection" button inside GAINZ. That button makes a real Gemini request.

You should see JSON at /api/health containing:
   "ok": true
   "apiKeyConfigured": true
   "provider": "gemini"
   "model": "gemini-3.5-flash-lite"

IMPORTANT SECURITY NOTE
-----------------------
Never put the Gemini API key in index.html, app.js, ai-engine.js, or any browser-served file. Keep it in .env on the server. The included .gitignore excludes .env.

If you change .env while the server is running, stop it with Ctrl+C and start node server.js again.

CORE ENGINE
-----------
BMR/TDEE, macro calculations, workout generation, meal generation, progress tracking and timer logic remain local and deterministic. Gemini is used only for the conversational AI Coach and supported exercise/meal replacement actions.

FILES
-----
index.html     UI
style.css      Styling
app.js         UI logic, progress, timer and AI Coach client
ai-engine.js   Local fitness recommendation engine
server.js      Local server + Gemini API bridge
.env.example   Environment variable template
.gitignore     Prevents .env from being committed
