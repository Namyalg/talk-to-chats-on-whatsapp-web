// DOM Elements - Tabs
const tabSummary = document.getElementById('tab-summary');
const tabAsk = document.getElementById('tab-ask');
const panelSummary = document.getElementById('panel-summary');
const panelAsk = document.getElementById('panel-ask');

// DOM Elements - Status
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');

// DOM Elements - Summary panel
const briefBtn = document.getElementById('brief-btn');
const verboseBtn = document.getElementById('verbose-btn');
const loadingSummary = document.getElementById('loading-summary');
const errorSummary = document.getElementById('error-summary');
const summaryContainer = document.getElementById('summary-container');
const summaryDiv = document.getElementById('summary');
const copySummaryBtn = document.getElementById('copy-summary-btn');
const speakSummaryBtn = document.getElementById('speak-summary-btn');

// DOM Elements - Ask panel
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');
const loadingAsk = document.getElementById('loading-ask');
const errorAsk = document.getElementById('error-ask');
const answerContainer = document.getElementById('answer-container');
const answerDiv = document.getElementById('answer');
const copyAnswerBtn = document.getElementById('copy-answer-btn');
const speakAnswerBtn = document.getElementById('speak-answer-btn');

let isApiAvailable = false;
let isSummarizing = false; // Rate limiting flag for summary
let isAskingQuestion = false; // Rate limiting flag for questions

// Constants
const MAX_QUESTION_LENGTH = 500;
const DEBUG = false; // Set to true for development logging

// Generic error messages to avoid information disclosure
const ERROR_MESSAGES = {
  API_UNAVAILABLE: 'The Summarizer API is not available. Make sure you\'re using Chrome 138+ with the Summarizer API enabled.',
  NOT_WHATSAPP: 'Please open WhatsApp Web to use this extension',
  NO_MESSAGES: 'No messages found in the current chat',
  EXTRACTION_FAILED: 'Failed to extract messages. Please refresh WhatsApp Web and try again.',
  SUMMARIZATION_FAILED: 'Failed to generate summary. Please try again.',
  QUESTION_FAILED: 'Failed to answer question. Please try again.',
  QUESTION_TOO_LONG: `Question must be ${MAX_QUESTION_LENGTH} characters or less`,
  CLIPBOARD_FAILED: 'Failed to copy to clipboard',
  INVALID_MESSAGE_FORMAT: 'Received invalid message format from page'
};

// Conditional debug logging
function debugError(message, ...args) {
  if (DEBUG) {
    console.error(`[WhatsApp Summarizer] ${message}`, ...args);
  }
}

// Validate message structure from content script
function isValidMessage(msg) {
  return msg && typeof msg.sender === 'string' && typeof msg.text === 'string';
}

// Tab switching
function switchTab(tab) {
  if (tab === 'summary') {
    tabSummary.classList.add('active');
    tabAsk.classList.remove('active');
    panelSummary.classList.remove('hidden');
    panelAsk.classList.add('hidden');
  } else {
    tabAsk.classList.add('active');
    tabSummary.classList.remove('active');
    panelAsk.classList.remove('hidden');
    panelSummary.classList.add('hidden');
  }
}

// Check API availability
async function checkApiAvailability() {
  try {
    if (typeof Summarizer === 'undefined') {
      throw new Error('Summarizer API not available');
    }

    const availability = await Summarizer.availability();

    if (availability === 'available') {
      isApiAvailable = true;
      statusIcon.classList.add('available');
      statusText.textContent = 'Gemini Nano Summarizer enabled';
      enableButtons();
    } else if (availability === 'downloadable') {
      statusText.textContent = 'Downloading Gemini Nano...';
      await Summarizer.create({ outputLanguage: 'en' });
      isApiAvailable = true;
      statusIcon.classList.add('available');
      statusText.textContent = 'Gemini Nano Summarizer enabled';
      enableButtons();
    } else {
      throw new Error('Summarizer API not available on this device');
    }
  } catch (error) {
    debugError('API availability check failed:', error);
    statusIcon.classList.add('unavailable');
    statusText.textContent = 'Gemini Nano unavailable';
    showError('summary', ERROR_MESSAGES.API_UNAVAILABLE);
  }
}

function enableButtons() {
  briefBtn.disabled = false;
  verboseBtn.disabled = false;
  questionInput.disabled = false;
  askBtn.disabled = false;
}

function disableSummaryButtons() {
  briefBtn.disabled = true;
  verboseBtn.disabled = true;
}

function enableSummaryButtons() {
  if (isApiAvailable) {
    briefBtn.disabled = false;
    verboseBtn.disabled = false;
  }
}

function disableAskButtons() {
  askBtn.disabled = true;
}

function enableAskButtons() {
  if (isApiAvailable) {
    askBtn.disabled = false;
  }
}

// Get messages from content script
async function getMessages() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes('web.whatsapp.com')) {
    throw new Error(ERROR_MESSAGES.NOT_WHATSAPP);
  }

  const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMessages' });

  if (!response.success) {
    debugError('Message extraction failed:', response.error);
    throw new Error(ERROR_MESSAGES.EXTRACTION_FAILED);
  }

  if (!response.messages || response.messages.length === 0) {
    throw new Error(ERROR_MESSAGES.NO_MESSAGES);
  }

  // Validate message structure
  if (!response.messages.every(isValidMessage)) {
    debugError('Invalid message format received');
    throw new Error(ERROR_MESSAGES.INVALID_MESSAGE_FORMAT);
  }

  return response.messages;
}

// Format messages for summarization
function formatMessages(messages) {
  return messages.map(msg => `[${msg.sender}]: ${msg.text}`).join('\n');
}

// Summarize the chat
async function summarizeChat(type) {
  // Rate limiting: prevent multiple simultaneous summary requests
  if (isSummarizing) return;
  isSummarizing = true;

  hideError('summary');
  showLoading('summary');
  disableSummaryButtons();

  try {
    const messages = await getMessages();
    const formattedText = formatMessages(messages);

    const options = type === 'brief'
      ? { type: 'tldr', format: 'plain-text', length: 'short', outputLanguage: 'en' }
      : { type: 'key-points', format: 'plain-text', length: 'long', outputLanguage: 'en' };

    const summarizer = await Summarizer.create(options);

    const summary = await summarizer.summarize(formattedText, {
      context: 'This is a WhatsApp chat conversation. Refer to each person by their actual name as shown in the messages (e.g., "John said..." not "the speaker said..."). Output plain text only - do not use markdown formatting like asterisks, bullet points, or headers.'
    });

    hideLoading('summary');
    enableSummaryButtons();
    showSummary(summary);
  } catch (error) {
    hideLoading('summary');
    enableSummaryButtons();
    // Use generic error message unless it's a known user-facing error
    const userMessage = Object.values(ERROR_MESSAGES).includes(error.message)
      ? error.message
      : ERROR_MESSAGES.SUMMARIZATION_FAILED;
    debugError('Summarization error:', error);
    showError('summary', userMessage);
  } finally {
    isSummarizing = false;
  }
}

// Ask a question about the chat
async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) {
    showError('ask', 'Please enter a question');
    return;
  }

  // Input length validation
  if (question.length > MAX_QUESTION_LENGTH) {
    showError('ask', ERROR_MESSAGES.QUESTION_TOO_LONG);
    return;
  }

  // Rate limiting: prevent multiple simultaneous question requests
  if (isAskingQuestion) return;
  isAskingQuestion = true;

  hideError('ask');
  showLoading('ask');
  disableAskButtons();

  try {
    const messages = await getMessages();
    const formattedText = formatMessages(messages);

    // Use the Prompt API if available, otherwise use Summarizer with context
    if (typeof LanguageModel !== 'undefined') {
      const session = await LanguageModel.create({
        systemPrompt: 'You are a helpful assistant that answers questions about WhatsApp chat conversations. Be concise and accurate. Refer to people by their actual names as shown in the messages. Output plain text only - do not use markdown formatting like asterisks, bullet points, or headers.'
      });

      const prompt = `Here is a WhatsApp chat conversation:\n\n${formattedText}\n\nQuestion: ${question}\n\nAnswer in plain text without markdown:`;
      const answer = await session.prompt(prompt);

      hideLoading('ask');
      enableAskButtons();
      showAnswer(answer);
    } else {
      // Fallback: use Summarizer with the question as context
      const summarizer = await Summarizer.create({
        type: 'tldr',
        format: 'plain-text',
        length: 'medium',
        outputLanguage: 'en'
      });

      const answer = await summarizer.summarize(formattedText, {
        context: `Answer this question about the WhatsApp conversation: ${question}. Refer to people by their actual names. Output plain text only without markdown formatting.`
      });

      hideLoading('ask');
      enableAskButtons();
      showAnswer(answer);
    }
  } catch (error) {
    hideLoading('ask');
    enableAskButtons();
    // Use generic error message unless it's a known user-facing error
    const userMessage = Object.values(ERROR_MESSAGES).includes(error.message)
      ? error.message
      : ERROR_MESSAGES.QUESTION_FAILED;
    debugError('Question error:', error);
    showError('ask', userMessage);
  } finally {
    isAskingQuestion = false;
  }
}

// Copy to clipboard
async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const actionText = button.querySelector('.action-text');
    button.classList.add('copied');
    actionText.textContent = 'Copied!';
    setTimeout(() => {
      button.classList.remove('copied');
      actionText.textContent = 'Copy';
    }, 2000);
  } catch (error) {
    // Show user feedback on clipboard failure
    debugError('Clipboard error:', error);
    const actionText = button.querySelector('.action-text');
    button.classList.add('error');
    actionText.textContent = 'Failed';
    setTimeout(() => {
      button.classList.remove('error');
      actionText.textContent = 'Copy';
    }, 2000);
  }
}

// Text-to-speech
function speakText(text, button) {
  // If already speaking, stop
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    resetSpeakButton(button);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Use Samantha voice (local, private, US English)
  const voices = speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name === 'Samantha');
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  const actionText = button.querySelector('.action-text');
  button.classList.add('speaking');
  actionText.textContent = 'Stop';

  utterance.onend = () => {
    resetSpeakButton(button);
  };

  utterance.onerror = () => {
    resetSpeakButton(button);
  };

  speechSynthesis.speak(utterance);
}

function resetSpeakButton(button) {
  const actionText = button.querySelector('.action-text');
  button.classList.remove('speaking');
  actionText.textContent = 'Read';
}

// UI Helper functions
function showLoading(panel) {
  if (panel === 'summary') {
    loadingSummary.classList.remove('hidden');
  } else {
    loadingAsk.classList.remove('hidden');
  }
}

function hideLoading(panel) {
  if (panel === 'summary') {
    loadingSummary.classList.add('hidden');
  } else {
    loadingAsk.classList.add('hidden');
  }
}

function showError(panel, message) {
  if (panel === 'summary') {
    errorSummary.textContent = message;
    errorSummary.classList.remove('hidden');
  } else {
    errorAsk.textContent = message;
    errorAsk.classList.remove('hidden');
  }
}

function hideError(panel) {
  if (panel === 'summary') {
    errorSummary.classList.add('hidden');
  } else {
    errorAsk.classList.add('hidden');
  }
}

function showSummary(text) {
  summaryDiv.textContent = text;
  summaryContainer.classList.remove('hidden');
}

function showAnswer(text) {
  answerDiv.textContent = text;
  answerContainer.classList.remove('hidden');
}

// Event listeners - Tabs
tabSummary.addEventListener('click', () => switchTab('summary'));
tabAsk.addEventListener('click', () => switchTab('ask'));

// Event listeners - Summary
briefBtn.addEventListener('click', () => summarizeChat('brief'));
verboseBtn.addEventListener('click', () => summarizeChat('verbose'));
copySummaryBtn.addEventListener('click', () => copyToClipboard(summaryDiv.textContent, copySummaryBtn));
speakSummaryBtn.addEventListener('click', () => speakText(summaryDiv.textContent, speakSummaryBtn));

// Event listeners - Ask
askBtn.addEventListener('click', askQuestion);
questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !askBtn.disabled) {
    askQuestion();
  }
});
copyAnswerBtn.addEventListener('click', () => copyToClipboard(answerDiv.textContent, copyAnswerBtn));
speakAnswerBtn.addEventListener('click', () => speakText(answerDiv.textContent, speakAnswerBtn));

// Load voices (needed for some browsers)
speechSynthesis.getVoices();

// Initialize
checkApiAvailability();
