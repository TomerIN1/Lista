import {
  AgentSession,
  AgentShoppingItem,
  AgentStore,
  ChatMessage,
  ChatButton,
  Language,
  StoreCategory,
} from '../types';
import {
  detectExtension,
  isExtensionInstalled,
  sendToExtension,
  onExtensionResponse,
} from './extensionBridge';

// ============================================
// Configuration
// ============================================

const PRICEPILOT_API_URL = process.env.PRICEPILOT_API_URL || '/pricepilot-api';

// Real Israeli supermarket chains from the DB
const ISRAELI_SUPERMARKETS: AgentStore[] = [
  { id: 'rami-levy', name: 'רמי לוי', nameHe: 'רמי לוי', deliveryFee: 30 },
  { id: 'shufersal', name: 'שופרסל', nameHe: 'שופרסל', deliveryFee: 30 },
  { id: 'victory', name: 'ויקטורי', nameHe: 'ויקטורי', deliveryFee: 20 },
  { id: 'market-warehouses', name: 'מחסני השוק', nameHe: 'מחסני השוק', deliveryFee: 25 },
  { id: 'h-cohen', name: 'ח. כהן', nameHe: 'ח. כהן', deliveryFee: 25 },
];

// Stores that have a working PricePilot adapter
export const SUPPORTED_ONLINE_STORES = new Set(['רמי לוי', 'Rami Levy', 'rami levy']);

// Map Hebrew store names to default store IDs for PricePilot
const STORE_DEFAULT_IDS: Record<string, string> = {
  'רמי לוי': '331',
  'Rami Levy': '331',
};

// Store categories (supermarket-focused)
const STORE_CATEGORIES: StoreCategory[] = [
  {
    id: 'supermarkets',
    name: 'סופרמרקטים ישראליים',
    nameHe: 'סופרמרקטים ישראליים',
    stores: ISRAELI_SUPERMARKETS,
  },
];

const ALL_STORES = ISRAELI_SUPERMARKETS;

// ============================================
// Message Helpers
// ============================================

export function generateId(): string {
  return crypto.randomUUID();
}

function createBotMessage(
  text: string,
  buttons?: ChatButton[],
  extras?: Partial<ChatMessage>
): ChatMessage {
  return {
    id: generateId(),
    type: 'bot',
    text,
    timestamp: Date.now(),
    buttons,
    ...extras,
  };
}

function createUserMessage(text: string): ChatMessage {
  return {
    id: generateId(),
    type: 'user',
    text,
    timestamp: Date.now(),
  };
}

function createSystemMessage(text: string): ChatMessage {
  return {
    id: generateId(),
    type: 'system' as ChatMessage['type'],
    text,
    timestamp: Date.now(),
  };
}

// ============================================
// Session Management
// ============================================

const sessions = new Map<string, AgentSession>();

/** PricePilot v4 metadata per session */
interface PricePilotSessionMeta {
  pricepilotUserId: string;
  storeName?: string;
}
const sessionMeta = new Map<string, PricePilotSessionMeta>();

export function getSession(sessionId: string): AgentSession | undefined {
  return sessions.get(sessionId);
}

export function getSessionMeta(sessionId: string): PricePilotSessionMeta | undefined {
  return sessionMeta.get(sessionId);
}

function updateSession(session: AgentSession): void {
  session.updatedAt = Date.now();
  sessions.set(session.id, session);
}

// ============================================
// PricePilot v4 API Communication (SSE)
// ============================================

/** SSE event from the v4 /api/chat endpoint */
interface ChatSSEEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'state_update' | 'done' | 'error' | 'browser_action_request';
  agent?: string;
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  delta?: Record<string, unknown>;
  message?: string;
  turn_complete?: boolean;
  request_id?: string;
}

/** Create a new v4 agent session */
async function apiCreateSession(
  userId: string,
  storeId: string,
): Promise<{ session_id: string; user_id: string }> {
  const res = await fetch(`${PRICEPILOT_API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, store_id: parseInt(storeId, 10) || 331 }),
  });
  if (!res.ok) throw new Error(`PricePilot API error: ${res.status}`);
  return res.json();
}

/**
 * Send a chat message to v4 and consume the SSE stream.
 * Calls onBotMessage for each text response from the agent.
 * Calls onToolActivity for tool call/result events (optional, for status display).
 *
 * When the server emits a `browser_action_request` event, this function
 * forwards it to the Chrome extension and POSTs the result back to the
 * server's /api/tool-response endpoint to unblock the agent.
 */
async function apiStreamChat(
  sessionId: string,
  userId: string,
  message: string,
  onBotMessage: (msg: ChatMessage) => void,
  onToolActivity?: (toolName: string, type: 'call' | 'result') => void,
): Promise<void> {
  const res = await fetch(`${PRICEPILOT_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, user_id: userId, message }),
  });
  if (!res.ok) throw new Error(`PricePilot API error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  // Set up extension response listener for this stream
  const cleanupExtension = onExtensionResponse(async (requestId, result) => {
    try {
      await fetch(`${PRICEPILOT_API_URL}/api/tool-response/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, result }),
      });
    } catch (err) {
      console.error('Failed to post tool response:', err);
    }
  });

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        let event: ChatSSEEvent;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        switch (event.type) {
          case 'text':
            if (event.text) {
              onBotMessage(createBotMessage(event.text));
            }
            break;
          case 'tool_call':
            if (event.tool && onToolActivity) {
              onToolActivity(event.tool, 'call');
            }
            break;
          case 'tool_result':
            if (event.tool && onToolActivity) {
              onToolActivity(event.tool, 'result');
            }
            break;
          case 'browser_action_request':
            // Forward to Chrome extension
            if (event.request_id && event.tool) {
              // Detect extension (async ping/pong, cached after first success)
              const extensionReady = await detectExtension();
              if (extensionReady) {
                sendToExtension(event.request_id, event.tool, event.args || {});
              } else {
                // Extension not installed — post error immediately to unblock the tool
                try {
                  await fetch(`${PRICEPILOT_API_URL}/api/tool-response/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      request_id: event.request_id,
                      result: {
                        status: 'error',
                        message: 'PricePilot extension is not installed. Please install it to continue.',
                      },
                    }),
                  });
                } catch (err) {
                  console.error('Failed to post extension-not-installed error:', err);
                }
              }
            }
            break;
          case 'error':
            if (event.message) {
              onBotMessage(createBotMessage(event.message));
            }
            break;
          case 'done':
            // Stream complete
            break;
        }
      }
    }
  } finally {
    cleanupExtension();
  }
}

// ============================================
// Format Shopping List for Agent
// ============================================

function formatShoppingListForAgent(
  items: AgentShoppingItem[],
  storeName: string,
  language: Language,
): string {
  const listLines = items.map((item, i) => {
    let line = `${i + 1}. ${item.name}`;
    if (item.quantity > 1) line += ` x${item.quantity}`;
    if (item.unit) line += ` (${item.unit})`;
    return line;
  });

  if (language === 'he') {
    return `הנה רשימת הקניות שלי ב${storeName}:\n${listLines.join('\n')}`;
  }
  return `Here is my shopping list for ${storeName}:\n${listLines.join('\n')}`;
}

// ============================================
// Main Agent Service
// ============================================

export interface AgentResponse {
  session: AgentSession;
  newMessages: ChatMessage[];
}

/**
 * Start a new agent session with PricePilot v4.
 * Creates a session, then streams the first message (the shopping list) to the agent.
 * Messages are delivered to the UI in real-time via onBotMessage callback.
 */
export async function startAgentSession(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[],
  language: Language,
  storeName?: string,
  storeId?: string,
  userCity?: string,
  onBotMessage?: (msg: ChatMessage) => void,
  onToolActivity?: (toolName: string, type: 'call' | 'result') => void,
): Promise<AgentResponse> {
  const now = Date.now();

  // If no store specified, fall back to local mode
  if (!storeName) {
    return startAgentSessionLocal(userId, listId, groceryList, language);
  }

  try {
    const effectiveStoreId = storeId || STORE_DEFAULT_IDS[storeName] || '331';
    const apiResponse = await apiCreateSession(userId, effectiveStoreId);

    // Create local session for state tracking
    const session: AgentSession = {
      id: apiResponse.session_id,
      userId,
      listId,
      state: 'BUILDING_CART',
      groceryList,
      selectedStores: [storeName],
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    // Store metadata
    sessionMeta.set(session.id, {
      pricepilotUserId: apiResponse.user_id,
      storeName,
    });

    sessions.set(session.id, session);

    const collectedMessages: ChatMessage[] = [];

    // Send the shopping list as the first message
    const firstMessage = formatShoppingListForAgent(groceryList, storeName, language);
    await apiStreamChat(
      session.id,
      apiResponse.user_id,
      firstMessage,
      (msg) => {
        session.messages.push(msg);
        collectedMessages.push(msg);
        onBotMessage?.(msg);
      },
      onToolActivity,
    );

    updateSession(session);
    return { session, newMessages: collectedMessages };
  } catch (error) {
    console.error('Failed to create PricePilot session, falling back to local:', error);
    return startAgentSessionLocal(userId, listId, groceryList, language);
  }
}

/**
 * Process a text message from the user.
 * Streams agent responses in real-time via onBotMessage callback.
 */
export async function processUserMessage(
  sessionId: string,
  text: string,
  language: Language,
  _authToken?: string,
  onBotMessage?: (msg: ChatMessage) => void,
  onToolActivity?: (toolName: string, type: 'call' | 'result') => void,
): Promise<AgentResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const meta = sessionMeta.get(sessionId);
  const newMessages: ChatMessage[] = [];

  // Add user message locally
  const userMessage = createUserMessage(text);
  session.messages.push(userMessage);
  newMessages.push(userMessage);

  // If no PricePilot metadata, show error
  if (!meta) {
    const errorMsg = createBotMessage(
      language === 'he'
        ? 'שגיאה: לא נמצא חיבור לשרת PricePilot.'
        : 'Error: PricePilot server connection not found.'
    );
    session.messages.push(errorMsg);
    newMessages.push(errorMsg);
    onBotMessage?.(errorMsg);
    updateSession(session);
    return { session, newMessages };
  }

  try {
    await apiStreamChat(
      sessionId,
      meta.pricepilotUserId,
      text,
      (msg) => {
        session.messages.push(msg);
        newMessages.push(msg);
        onBotMessage?.(msg);
      },
      onToolActivity,
    );

    updateSession(session);
    return { session, newMessages };
  } catch (error) {
    console.error('Failed to send message via PricePilot API:', error);
    const errorMsg = createBotMessage(
      language === 'he'
        ? 'שגיאה בתקשורת עם השרת. נסו שוב.'
        : 'Error communicating with server. Please try again.'
    );
    session.messages.push(errorMsg);
    newMessages.push(errorMsg);
    onBotMessage?.(errorMsg);
    updateSession(session);
    return { session, newMessages };
  }
}

/**
 * Process a button action from the user.
 * Sends the action as a text message to PricePilot v4.
 */
export async function handleButtonAction(
  sessionId: string,
  action: string,
  language: Language,
  onBotMessage?: (msg: ChatMessage) => void,
  onToolActivity?: (toolName: string, type: 'call' | 'result') => void,
): Promise<AgentResponse> {
  // Route through processUserMessage — v4 treats all input as chat
  return processUserMessage(sessionId, action, language, undefined, onBotMessage, onToolActivity);
}

// ============================================
// Local Fallback (when API is unavailable)
// ============================================

const messages = {
  en: {
    welcome: `Welcome to Lista PricePilot! I'll help you build your online cart at the best store.`,
    confirmList: (count: number) =>
      `Your list has ${count} item${count !== 1 ? 's' : ''}. Ready to build your cart?`,
    buildingCart: 'Building your cart... This may take a moment.',
    cartReady: (storeName: string) =>
      `Your cart for ${storeName} is ready! Here are the items with real prices:`,
    cartItem: (name: string, price: string, qty: number) =>
      `${name} x${qty} — ${price}`,
    cartTotal: (total: string) => `Total: ${total}`,
    noItems: 'No items found to build a cart.',
    error: 'Sorry, something went wrong. Please try again.',
    approve: 'Build Cart',
    decline: 'Cancel',
    restart: 'Start over',
    completed: 'Cart building complete! Store integration coming soon.',
  },
  he: {
    welcome: `ברוכים הבאים ל-PricePilot של Lista! אעזור לכם לבנות עגלה אונליין בחנות הטובה ביותר.`,
    confirmList: (count: number) => `הרשימה שלכם כוללת ${count} פריטים. מוכנים לבנות עגלה?`,
    buildingCart: 'בונה את העגלה... זה עשוי לקחת רגע.',
    cartReady: (storeName: string) =>
      `העגלה שלכם ב-${storeName} מוכנה! הנה הפריטים עם מחירים אמיתיים:`,
    cartItem: (name: string, price: string, qty: number) =>
      `${name} x${qty} — ${price}`,
    cartTotal: (total: string) => `סה"כ: ${total}`,
    noItems: 'לא נמצאו פריטים לבניית עגלה.',
    error: 'מצטער, משהו השתבש. נסו שוב.',
    approve: 'בנה עגלה',
    decline: 'ביטול',
    restart: 'התחל מחדש',
    completed: 'בניית העגלה הושלמה! אינטגרציה עם חנויות בקרוב.',
  },
};

function formatShoppingList(items: AgentShoppingItem[], _language: Language): string {
  return items
    .map((item, index) => {
      let line = `${index + 1}. ${item.name}`;
      if (item.quantity > 1) {
        line += ` x${item.quantity}`;
      }
      if (item.unit) {
        line += ` (${item.unit})`;
      }
      return line;
    })
    .join('\n');
}

function startAgentSessionLocal(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[],
  language: Language
): AgentResponse {
  const now = Date.now();
  const m = messages[language];
  const session: AgentSession = {
    id: generateId(),
    userId,
    listId,
    state: 'CONFIRMING_CONTEXT',
    groceryList,
    selectedStores: ISRAELI_SUPERMARKETS.map((s) => s.id),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const listText = formatShoppingList(groceryList, language);
  const welcomeMessage = createBotMessage(
    `${m.welcome}\n\n${m.confirmList(groceryList.length)}\n\n${listText}`,
    [
      { id: 'approve', label: m.approve, action: 'approve:yes', variant: 'primary' },
      { id: 'decline', label: m.decline, action: 'approve:no', variant: 'secondary' },
    ],
    { groceryList }
  );

  session.messages.push(welcomeMessage);
  sessions.set(session.id, session);

  return { session, newMessages: [welcomeMessage] };
}

// ============================================
// Exports
// ============================================

export { ALL_STORES, STORE_CATEGORIES, ISRAELI_SUPERMARKETS };
export type { Language };
