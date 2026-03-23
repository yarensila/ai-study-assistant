// Frontend logic for the summarizer UI.
// Sends textarea text to POST /api/summarize and renders the returned JSON.

const textInput = document.getElementById("textInput");
const summarizeBtn = document.getElementById("summarizeBtn");

const statusEl = document.getElementById("status");
const resultsEmptyEl = document.getElementById("resultsEmpty");
const resultsBodyEl = document.getElementById("resultsBody");

const resultTitleEl = document.getElementById("resultTitle");
const resultSummaryEl = document.getElementById("resultSummary");
const resultBulletsEl = document.getElementById("resultBullets");
const resultQuestionsEl = document.getElementById("resultQuestions");
const resultErrorEl = document.getElementById("resultError");

function setLoading(isLoading) {
  summarizeBtn.disabled = isLoading;
  statusEl.textContent = isLoading ? "Generating..." : "";
}

function showError(message) {
  resultErrorEl.textContent = message;
  resultErrorEl.hidden = false;
  // Ensure the user can actually see the error (results card might be hidden after clearResults()).
  resultsBodyEl.hidden = false;
  resultsEmptyEl.hidden = true;
}

function clearResults() {
  resultTitleEl.textContent = "";
  resultSummaryEl.textContent = "";
  resultBulletsEl.innerHTML = "";
  resultQuestionsEl.innerHTML = "";
  resultErrorEl.textContent = "";
  resultErrorEl.hidden = true;

  resultsBodyEl.hidden = true;
  resultsEmptyEl.hidden = false;
}

async function summarizeText() {
  const text = (textInput.value || "").trim();
  clearResults();

  if (!text) {
    showError("Please paste some text first.");
    return;
  }

  setLoading(true);

  try {
    const resp = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const baseMessage = data?.error || "Request failed.";
      const details = typeof data?.details === "string" ? data.details : "";
      const trimmedDetails = details.length > 250 ? `${details.slice(0, 247)}...` : details;
      throw new Error(trimmedDetails ? `${baseMessage} ${trimmedDetails}` : baseMessage);
    }

    // Render results.
    resultTitleEl.textContent = data.title || "Untitled";
    resultSummaryEl.textContent = data.summary || "";

    (data.bullets || []).forEach((bullet) => {
      const li = document.createElement("li");
      li.textContent = bullet;
      resultBulletsEl.appendChild(li);
    });

    (data.questions || []).forEach((question) => {
      const li = document.createElement("li");
      li.textContent = question;
      resultQuestionsEl.appendChild(li);
    });

    resultsBodyEl.hidden = false;
    resultsEmptyEl.hidden = true;
  } catch (err) {
    showError(err?.message || "Failed to generate summary.");
  } finally {
    setLoading(false);
  }
}

summarizeBtn.addEventListener("click", summarizeText);

// Allow Ctrl+Enter / Cmd+Enter to summarize quickly.
textInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    summarizeText();
  }
});

// Initialize UI state.
clearResults();

