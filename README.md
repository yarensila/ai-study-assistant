# AI Study Assistant

Developed as part of the Future Talent Program AI-supported application development module using Cursor.
A simple web application for student study support, built with a Node.js + Express backend and a minimal HTML/CSS/JavaScript frontend.

## Features

- Summarizes academic text into a short, readable overview
- Generates 3 bullet-point insights from the input
- Suggests a clear title for the content
- Generates 3 exam-style questions based on the topic
- Uses a fallback mode when the OpenAI API is unavailable (for example, quota issues), so the app still works

## Setup

1. Install dependencies:
   - `npm install`
2. Create a `.env` file in the project root:
   - See `.env.example`
3. Start the server:
   - `npm start`

Then open: `http://localhost:3000`

## Environment variables

- `OPENAI_API_KEY` (recommended): your API key for AI-powered summarization.
- `OPENAI_MODEL` (optional): model name (defaults to `gpt-4o-mini`).
- `PORT` (optional): server port (defaults to `3000`).

# ai-study-assistant
