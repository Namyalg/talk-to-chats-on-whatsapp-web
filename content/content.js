// Content script for extracting WhatsApp messages

const DEBUG = false; // Set to true for development logging

function debugError(message, ...args) {
  if (DEBUG) {
    console.error(`[WhatsApp Summarizer] ${message}`, ...args);
  }
}

// Message extraction function
function extractMessages() {
  const messages = [];

  // Try multiple selectors for message containers
  // WhatsApp Web uses dynamic class names, so we need to be flexible
  const messageSelectors = [
    '[data-id] .copyable-text',
    '.message-in, .message-out',
    '[data-pre-plain-text]',
    'div[class*="message"]'
  ];

  let messageElements = [];

  // Try to find messages using data-pre-plain-text attribute (most reliable)
  const messagesWithPreText = document.querySelectorAll('[data-pre-plain-text]');
  if (messagesWithPreText.length > 0) {
    messageElements = Array.from(messagesWithPreText);
  } else {
    // Fallback: try to find message containers
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messageElements = Array.from(elements);
        break;
      }
    }
  }

  for (const element of messageElements) {
    try {
      let sender = 'Unknown';
      let text = '';

      // Method 1: Extract from data-pre-plain-text attribute
      // Format: "[HH:MM, DD/MM/YYYY] Sender Name: "
      const preText = element.getAttribute('data-pre-plain-text');
      if (preText) {
        const match = preText.match(/\[.*?\]\s*(.+?):\s*$/);
        if (match) {
          sender = match[1].trim();
        }
      }

      // Get message text
      const selectableText = element.querySelector('.selectable-text span');
      if (selectableText) {
        text = selectableText.textContent.trim();
      } else {
        // Try alternative selectors
        const spans = element.querySelectorAll('span[dir="ltr"], span[dir="rtl"]');
        for (const span of spans) {
          const content = span.textContent.trim();
          if (content && content.length > 0) {
            text = content;
            break;
          }
        }
      }

      // Skip empty messages, timestamps only, or system messages
      if (!text || text.length === 0) continue;

      // Try to determine if it's an incoming or outgoing message
      const messageContainer = element.closest('[data-id]');
      if (messageContainer) {
        const dataId = messageContainer.getAttribute('data-id');
        if (dataId && dataId.includes('true_')) {
          sender = 'Me';
        }
      }

      // Check for message-in/message-out classes
      const inMessage = element.closest('.message-in') || element.closest('[class*="message-in"]');
      const outMessage = element.closest('.message-out') || element.closest('[class*="message-out"]');

      if (outMessage) {
        sender = 'Me';
      } else if (inMessage && sender === 'Unknown') {
        // Try to find sender name in group chats
        const senderElement = inMessage.querySelector('[data-testid="msg-meta"] span, span[aria-label]');
        if (senderElement) {
          sender = senderElement.textContent.trim() || 'Other';
        } else {
          sender = 'Other';
        }
      }

      messages.push({ sender, text });
    } catch (err) {
      debugError('Error extracting message:', err);
    }
  }

  // Remove duplicates and return
  const uniqueMessages = [];
  const seen = new Set();

  for (const msg of messages) {
    const key = `${msg.sender}:${msg.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMessages.push(msg);
    }
  }

  return uniqueMessages;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security: Validate sender is from our own extension
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized request' });
    return true;
  }

  if (request.action === 'getMessages') {
    try {
      const messages = extractMessages();
      sendResponse({ success: true, messages });
    } catch (error) {
      // Return generic error message to avoid information disclosure
      debugError('Message extraction error:', error);
      sendResponse({ success: false, error: 'Failed to extract messages' });
    }
  }
  return true; // Keep message channel open for async response
});
