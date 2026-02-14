import {
  AgentSession,
  AgentWorkflowState,
  AgentShoppingItem,
  AgentProduct,
  AgentStore,
  AgentSavingsReport,
  AgentPricingPlan,
  AgentDisambiguationItem,
  ChatMessage,
  ChatButton,
  Language,
  StoreCategory,
  ListPriceComparison,
} from '../types';

// ============================================
// Configuration
// ============================================

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

// Real Israeli supermarket chains from the DB
const ISRAELI_SUPERMARKETS: AgentStore[] = [
  { id: 'shufersal', name: 'שופרסל', nameHe: 'שופרסל', deliveryFee: 30 },
  { id: 'victory', name: 'ויקטורי', nameHe: 'ויקטורי', deliveryFee: 20 },
  { id: 'market-warehouses', name: 'מחסני השוק', nameHe: 'מחסני השוק', deliveryFee: 25 },
  { id: 'h-cohen', name: 'ח. כהן', nameHe: 'ח. כהן', deliveryFee: 25 },
];

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

// ============================================
// Session Management (via PricePilot Agent API)
// ============================================

const sessions = new Map<string, AgentSession>();

export function getSession(sessionId: string): AgentSession | undefined {
  return sessions.get(sessionId);
}

function updateSession(session: AgentSession): void {
  session.updatedAt = Date.now();
  sessions.set(session.id, session);
}

// ============================================
// API Communication
// ============================================

async function apiCreateSession(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[]
): Promise<{ session_id: string; messages: Array<{ id: string; type: string; text: string; timestamp: number }> }> {
  const res = await fetch(`${AGENT_API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      list_id: listId,
      grocery_list: groceryList,
    }),
  });
  if (!res.ok) throw new Error(`Agent API error: ${res.status}`);
  return res.json();
}

async function apiSendMessage(
  sessionId: string,
  userId: string,
  text: string
): Promise<{ messages: Array<{ id: string; type: string; text: string; timestamp: number }>; workflow_phase?: string }> {
  const res = await fetch(`${AGENT_API_URL}/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, text }),
  });
  if (!res.ok) throw new Error(`Agent API error: ${res.status}`);
  return res.json();
}

// ============================================
// Main Agent Service
// ============================================

export interface AgentResponse {
  session: AgentSession;
  newMessages: ChatMessage[];
}

/**
 * Start a new agent session.
 * Creates a session via the PricePilot Agent API and returns the initial messages.
 */
export async function startAgentSession(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[],
  language: Language
): Promise<AgentResponse> {
  const now = Date.now();

  try {
    // Call the PricePilot Agent API
    const apiResponse = await apiCreateSession(userId, listId, groceryList);

    // Create local session for state tracking
    const session: AgentSession = {
      id: apiResponse.session_id,
      userId,
      listId,
      state: 'CONFIRMING_CONTEXT',
      groceryList,
      selectedStores: ISRAELI_SUPERMARKETS.map((s) => s.id),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    // Convert API messages to ChatMessage format
    const newMessages: ChatMessage[] = apiResponse.messages.map((msg) => ({
      id: msg.id || generateId(),
      type: msg.type as ChatMessage['type'],
      text: msg.text,
      timestamp: msg.timestamp || now,
    }));

    session.messages.push(...newMessages);
    sessions.set(session.id, session);

    return { session, newMessages };
  } catch (error) {
    console.error('Failed to create agent session via API, falling back to local:', error);
    // Fallback to local session if API is unavailable
    return startAgentSessionLocal(userId, listId, groceryList, language);
  }
}

/**
 * Process a button action from the user.
 * Sends the action as a text message to the agent API.
 */
export async function handleButtonAction(
  sessionId: string,
  action: string,
  language: Language
): Promise<AgentResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const newMessages: ChatMessage[] = [];

  // Add user action as a message locally
  const userMessage = createUserMessage(action);
  session.messages.push(userMessage);
  newMessages.push(userMessage);

  try {
    // Send to agent API
    const apiResponse = await apiSendMessage(sessionId, session.userId, action);

    // Convert API response messages
    const botMessages: ChatMessage[] = apiResponse.messages.map((msg) => ({
      id: msg.id || generateId(),
      type: msg.type as ChatMessage['type'],
      text: msg.text,
      timestamp: msg.timestamp || Date.now(),
    }));

    session.messages.push(...botMessages);
    newMessages.push(...botMessages);
    updateSession(session);

    return { session, newMessages };
  } catch (error) {
    console.error('Failed to send button action via API, falling back to local:', error);
    return handleButtonActionLocal(session, action, language, newMessages);
  }
}

/**
 * Process a text message from the user.
 * Sends the message to the agent API.
 */
export async function processUserMessage(
  sessionId: string,
  text: string,
  language: Language
): Promise<AgentResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const newMessages: ChatMessage[] = [];

  // Add user message locally
  const userMessage = createUserMessage(text);
  session.messages.push(userMessage);
  newMessages.push(userMessage);

  try {
    // Send to agent API
    const apiResponse = await apiSendMessage(sessionId, session.userId, text);

    // Convert API response messages
    const botMessages: ChatMessage[] = apiResponse.messages.map((msg) => ({
      id: msg.id || generateId(),
      type: msg.type as ChatMessage['type'],
      text: msg.text,
      timestamp: msg.timestamp || Date.now(),
    }));

    session.messages.push(...botMessages);
    newMessages.push(...botMessages);
    updateSession(session);

    return { session, newMessages };
  } catch (error) {
    console.error('Failed to send message via API, falling back to local:', error);
    // Fallback: prompt to use buttons
    const promptMessage = createBotMessage(
      language === 'he'
        ? 'שגיאה בתקשורת עם השרת. נסו שוב.'
        : 'Error communicating with server. Please try again.'
    );
    session.messages.push(promptMessage);
    newMessages.push(promptMessage);
    updateSession(session);
    return { session, newMessages };
  }
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

function formatCurrency(amount: number): string {
  return `₪${amount.toFixed(2)}`;
}

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

function handleButtonActionLocal(
  session: AgentSession,
  action: string,
  language: Language,
  newMessages: ChatMessage[]
): AgentResponse {
  const m = messages[language];
  const [actionType, actionValue] = action.split(':');

  if (actionType === 'approve' && actionValue === 'yes') {
    session.state = 'BUILDING_CART';
    const buildingMessage = createBotMessage(m.buildingCart);
    session.messages.push(buildingMessage);
    newMessages.push(buildingMessage);

    const cartLines = session.groceryList.map((item) =>
      m.cartItem(item.name, formatCurrency(0), item.quantity)
    );

    session.state = 'COMPLETED';
    const cartMessage = createBotMessage(
      `${m.completed}\n\n${cartLines.join('\n')}`,
      [{ id: 'restart', label: m.restart, action: 'cancel:restart', variant: 'secondary' }]
    );
    session.messages.push(cartMessage);
    newMessages.push(cartMessage);
  } else if (actionType === 'approve' && actionValue === 'no') {
    session.state = 'IDLE';
    const declineMessage = createBotMessage(
      language === 'he' ? 'הבנתי. אפשר להתחיל מחדש מתי שתרצו.' : "Got it. You can start again whenever you're ready.",
      [{ id: 'restart', label: m.restart, action: 'cancel:restart', variant: 'secondary' }]
    );
    session.messages.push(declineMessage);
    newMessages.push(declineMessage);
  } else {
    session.state = 'IDLE';
    const resetMessage = createBotMessage(
      language === 'he'
        ? 'הפעולה בוטלה. לחצו על "מצא מחירים" כדי להתחיל מחדש.'
        : 'Action cancelled. Click "Find Best Prices" to start again.'
    );
    session.messages.push(resetMessage);
    newMessages.push(resetMessage);
  }

  updateSession(session);
  return { session, newMessages };
}

// ============================================
// Exports
// ============================================

export { ALL_STORES, STORE_CATEGORIES, ISRAELI_SUPERMARKETS };
export type { Language };
