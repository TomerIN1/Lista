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

// Real Israeli supermarket chains from the DB
const ISRAELI_SUPERMARKETS: AgentStore[] = [
  { id: 'shufersal', name: 'Shufersal', nameHe: 'שופרסל', deliveryFee: 30 },
  { id: 'victory', name: 'Victory', nameHe: 'ויקטורי', deliveryFee: 20 },
  { id: 'market-warehouses', name: 'Market Warehouses', nameHe: 'מחסני השוק', deliveryFee: 25 },
  { id: 'h-cohen', name: 'H. Cohen', nameHe: 'ח. כהן', deliveryFee: 25 },
];

// Store categories (supermarket-focused)
const STORE_CATEGORIES: StoreCategory[] = [
  {
    id: 'supermarkets',
    name: 'Israeli Supermarkets',
    nameHe: 'סופרמרקטים ישראליים',
    stores: ISRAELI_SUPERMARKETS,
  },
];

const ALL_STORES = ISRAELI_SUPERMARKETS;

// ============================================
// Messages / i18n
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

// ============================================
// Simplified State Transitions
// ============================================

const STATE_TRANSITIONS: Record<AgentWorkflowState, AgentWorkflowState[]> = {
  IDLE: ['CONFIRMING_CONTEXT'],
  ONBOARDING: ['CONFIRMING_CONTEXT', 'IDLE'],
  COLLECTING_LIST: ['CONFIRMING_CONTEXT', 'IDLE'],
  CONFIRMING_CONTEXT: ['SCANNING_PRICES', 'IDLE'],
  SELECTING_STORES: ['SCANNING_PRICES', 'IDLE'],
  SCANNING_PRICES: ['BUILDING_CART', 'ERROR'],
  DISAMBIGUATING_ITEMS: ['BUILDING_CART', 'ERROR'],
  BUILDING_CART: ['COMPLETED', 'ERROR'],
  AWAITING_APPROVAL: ['GENERATING_CHECKOUT', 'IDLE'],
  GENERATING_CHECKOUT: ['COMPLETED', 'ERROR'],
  COMPLETED: ['IDLE'],
  ERROR: ['IDLE'],
};

// ============================================
// Session Management
// ============================================

const sessions = new Map<string, AgentSession>();

export function generateId(): string {
  return crypto.randomUUID();
}

export function createAgentSession(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[]
): AgentSession {
  const now = Date.now();
  const session: AgentSession = {
    id: generateId(),
    userId,
    listId,
    state: 'IDLE',
    groceryList,
    selectedStores: ISRAELI_SUPERMARKETS.map((s) => s.id),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): AgentSession | undefined {
  return sessions.get(sessionId);
}

export function updateSession(session: AgentSession): void {
  session.updatedAt = Date.now();
  sessions.set(session.id, session);
}

// ============================================
// Message Helpers
// ============================================

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
// Format Helpers
// ============================================

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

// ============================================
// Main Agent Service
// ============================================

export interface AgentResponse {
  session: AgentSession;
  newMessages: ChatMessage[];
}

/**
 * Start a new agent session - simplified flow, skips onboarding
 * Goes straight to confirming the list
 */
export function startAgentSession(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[],
  language: Language
): AgentResponse {
  const session = createAgentSession(userId, listId, groceryList);
  const m = messages[language];

  // Skip onboarding - go straight to confirming list
  session.state = 'CONFIRMING_CONTEXT';

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
  updateSession(session);

  return { session, newMessages: [welcomeMessage] };
}

/**
 * Process a button action from the user
 */
export function handleButtonAction(
  sessionId: string,
  action: string,
  language: Language
): AgentResponse {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const m = messages[language];
  const newMessages: ChatMessage[] = [];
  const [actionType, actionValue] = action.split(':');

  // Add user action as a message
  const userMessage = createUserMessage(
    actionValue === 'yes' ? m.approve :
    actionValue === 'no' ? m.decline :
    action
  );
  session.messages.push(userMessage);
  newMessages.push(userMessage);

  switch (actionType) {
    case 'approve':
      return handleApproval(session, actionValue === 'yes', language, newMessages);

    case 'cancel':
      return handleCancel(session, language, newMessages);

    default:
      const errorMessage = createBotMessage(m.error);
      session.messages.push(errorMessage);
      newMessages.push(errorMessage);
      return { session, newMessages };
  }
}

/**
 * Process a text message from the user
 */
export function processUserMessage(
  sessionId: string,
  text: string,
  language: Language
): AgentResponse {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const newMessages: ChatMessage[] = [];

  const userMessage = createUserMessage(text);
  session.messages.push(userMessage);
  newMessages.push(userMessage);

  const promptMessage = createBotMessage(
    language === 'he'
      ? 'השתמש בכפתורים כדי להמשיך.'
      : 'Please use the buttons to proceed.'
  );
  session.messages.push(promptMessage);
  newMessages.push(promptMessage);

  updateSession(session);
  return { session, newMessages };
}

// ============================================
// Action Handlers
// ============================================

function handleApproval(
  session: AgentSession,
  approved: boolean,
  language: Language,
  newMessages: ChatMessage[]
): AgentResponse {
  const m = messages[language];

  if (!approved) {
    session.state = 'IDLE';
    const declineMessage = createBotMessage(
      language === 'he' ? 'הבנתי. אפשר להתחיל מחדש מתי שתרצו.' : 'Got it. You can start again whenever you\'re ready.',
      [
        { id: 'restart', label: m.restart, action: 'cancel:restart', variant: 'secondary' },
      ]
    );
    session.messages.push(declineMessage);
    newMessages.push(declineMessage);
    updateSession(session);
    return { session, newMessages };
  }

  // User approved - build cart
  session.state = 'BUILDING_CART';

  const buildingMessage = createBotMessage(m.buildingCart);
  session.messages.push(buildingMessage);
  newMessages.push(buildingMessage);

  // Build structured cart data from grocery list with barcode info
  const cartLines = session.groceryList.map((item) => {
    return m.cartItem(item.name, formatCurrency(0), item.quantity);
  });

  session.state = 'COMPLETED';

  const cartMessage = createBotMessage(
    `${m.completed}\n\n${cartLines.join('\n')}`,
    [
      { id: 'restart', label: m.restart, action: 'cancel:restart', variant: 'secondary' },
    ]
  );
  session.messages.push(cartMessage);
  newMessages.push(cartMessage);

  updateSession(session);
  return { session, newMessages };
}

function handleCancel(
  session: AgentSession,
  language: Language,
  newMessages: ChatMessage[]
): AgentResponse {
  session.state = 'IDLE';
  session.selectedStores = [];
  session.savingsReport = undefined;
  session.disambiguation = undefined;
  session.checkoutUrls = undefined;

  const resetMessage = createBotMessage(
    language === 'he'
      ? 'הפעולה בוטלה. לחצו על "מצא מחירים" כדי להתחיל מחדש.'
      : 'Action cancelled. Click "Find Best Prices" to start again.'
  );
  session.messages.push(resetMessage);
  newMessages.push(resetMessage);

  updateSession(session);
  return { session, newMessages };
}

// ============================================
// Exports
// ============================================

export { ALL_STORES, STORE_CATEGORIES, ISRAELI_SUPERMARKETS };
export type { Language };
