import {
  AgentSession,
  AgentShoppingItem,
  AgentStore,
  ChatMessage,
  ChatButton,
  Language,
  StoreCategory,
} from '../types';
import { looksLikeJwt } from './storeAuthService';

// ============================================
// reCAPTCHA helpers (for store OTP login)
// ============================================

/** Rami Levy's reCAPTCHA v2 sitekey */
const RECAPTCHA_SITEKEY = '6LcbrMcqAAAAAG3zZqwyELvzuJlNHdW9Leq71AHy';

let recaptchaLoaded = false;
let recaptchaWidgetId: number | null = null;

/** Load the reCAPTCHA script if not already loaded */
function loadRecaptchaScript(): Promise<void> {
  if (recaptchaLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit`;
    script.async = true;
    script.onload = () => { recaptchaLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });
}

/** Solve reCAPTCHA and return the response token */
export async function solveRecaptcha(): Promise<string | null> {
  try {
    await loadRecaptchaScript();
    const grecaptcha = (window as any).grecaptcha;
    if (!grecaptcha) return null;

    return new Promise((resolve) => {
      // Create a temporary invisible container
      let container = document.getElementById('pricepilot-recaptcha');
      if (!container) {
        container = document.createElement('div');
        container.id = 'pricepilot-recaptcha';
        container.style.display = 'none';
        document.body.appendChild(container);
      }

      // Render or reset the widget
      if (recaptchaWidgetId !== null) {
        grecaptcha.reset(recaptchaWidgetId);
      } else {
        recaptchaWidgetId = grecaptcha.render(container, {
          sitekey: RECAPTCHA_SITEKEY,
          size: 'invisible',
          callback: (token: string) => resolve(token),
          'error-callback': () => resolve(null),
        });
      }

      grecaptcha.execute(recaptchaWidgetId);

      // Timeout after 10s
      setTimeout(() => resolve(null), 10000);
    });
  } catch {
    return null;
  }
}

/** Check if text looks like an email address */
function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

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

// ============================================
// Session Management
// ============================================

const sessions = new Map<string, AgentSession>();

/** Extra PricePilot v2 state per session */
interface PricePilotSessionMeta {
  pricepilotUserId: string;
  storeName?: string;
  checkoutUrl?: string;
  cartPersisted?: boolean;
  phase?: string;
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
// PricePilot v2 API Communication
// ============================================

interface PricePilotMessage {
  role: string;   // "model" | "user"
  text: string;
  author: string;
}

interface BuildCartApiResponse {
  session_id: string;
  user_id: string;
  messages: PricePilotMessage[];
}

interface MessageApiResponse {
  messages: PricePilotMessage[];
  phase?: string;
  cart_persisted: boolean;
  checkout_url?: string;
}

/** Keywords that indicate the agent is asking the user to connect their account - disabled since auth is now in-chat OTP */
const LOGIN_HINT_PATTERNS: string[] = [];

/** Keywords that indicate a checkout URL is present */
const CHECKOUT_HINT_PATTERNS = ['לקופה', 'checkout', 'להזמין', 'לשלם'];

/**
 * Convert PricePilot v2 API messages to ChatMessage format.
 * Automatically adds login/checkout buttons based on message content.
 */
function mapApiMessages(apiMessages: PricePilotMessage[], storeName?: string): ChatMessage[] {
  return apiMessages
    .filter((msg) => msg.role === 'model')
    .map((msg) => {
      const buttons: ChatButton[] = [];
      const textLower = msg.text.toLowerCase();

      // Detect if agent is asking about account connection → add login button
      const mentionsLogin = LOGIN_HINT_PATTERNS.some((p) => textLower.includes(p));
      const mentionsCheckout = CHECKOUT_HINT_PATTERNS.some((p) => textLower.includes(p));

      if (mentionsLogin && storeName) {
        buttons.push({
          id: 'login-store',
          label: `התחבר ל-${storeName}`,
          action: `login:${storeName}`,
          variant: 'primary',
        });
      }

      // Detect checkout URLs in text and add a checkout button
      const urlMatch = msg.text.match(/https?:\/\/[^\s]+/);
      if (urlMatch && mentionsCheckout) {
        buttons.push({
          id: 'checkout',
          label: 'עבור לקופה',
          action: `checkout:${urlMatch[0]}`,
          variant: 'primary',
        });
      }

      return {
        id: generateId(),
        type: 'bot' as const,
        text: msg.text,
        timestamp: Date.now(),
        buttons: buttons.length > 0 ? buttons : undefined,
      };
    });
}

async function apiBuildCart(
  storeName: string,
  storeId: string,
  items: AgentShoppingItem[],
  userCity?: string,
  authToken?: string,
): Promise<BuildCartApiResponse> {
  const res = await fetch(`${PRICEPILOT_API_URL}/api/build-cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_name: storeName,
      store_id: storeId,
      items: items.map((item) => ({
        name: item.name,
        barcode: item.barcode || '',
        quantity: item.quantity,
      })),
      user_city: userCity,
      auth_token: authToken,
    }),
  });
  if (!res.ok) throw new Error(`PricePilot API error: ${res.status}`);
  return res.json();
}

async function apiSendMessage(
  sessionId: string,
  userId: string,
  message: string,
  authToken?: string,
  recaptchaToken?: string,
): Promise<MessageApiResponse> {
  const res = await fetch(`${PRICEPILOT_API_URL}/api/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: userId,
      message,
      auth_token: authToken,
      recaptcha_token: recaptchaToken,
    }),
  });
  if (!res.ok) throw new Error(`PricePilot API error: ${res.status}`);
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
 * Calls PricePilot v2 /api/build-cart and returns initial messages.
 */
export async function startAgentSession(
  userId: string,
  listId: string,
  groceryList: AgentShoppingItem[],
  language: Language,
  storeName?: string,
  storeId?: string,
  userCity?: string,
): Promise<AgentResponse> {
  const now = Date.now();

  // If no store specified, fall back to local mode
  if (!storeName) {
    return startAgentSessionLocal(userId, listId, groceryList, language);
  }

  try {
    const effectiveStoreId = storeId || STORE_DEFAULT_IDS[storeName] || '';
    const apiResponse = await apiBuildCart(
      storeName,
      effectiveStoreId,
      groceryList,
      userCity,
    );

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

    // Store PricePilot v2 metadata
    sessionMeta.set(session.id, {
      pricepilotUserId: apiResponse.user_id,
      storeName,
    });

    // Convert API messages to ChatMessage format
    const newMessages = mapApiMessages(apiResponse.messages, storeName);

    session.messages.push(...newMessages);
    sessions.set(session.id, session);

    return { session, newMessages };
  } catch (error) {
    console.error('Failed to create PricePilot session, falling back to local:', error);
    return startAgentSessionLocal(userId, listId, groceryList, language);
  }
}

/**
 * Process a button action from the user.
 * Sends the action as a text message to PricePilot v2 /api/message.
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

  const meta = sessionMeta.get(sessionId);
  const newMessages: ChatMessage[] = [];

  // Add user action as a message locally
  const userMessage = createUserMessage(action);
  session.messages.push(userMessage);
  newMessages.push(userMessage);

  // If no PricePilot metadata, use local fallback
  if (!meta) {
    return handleButtonActionLocal(session, action, language, newMessages);
  }

  try {
    const apiResponse = await apiSendMessage(
      sessionId,
      meta.pricepilotUserId,
      action,
    );

    // Update metadata
    meta.phase = apiResponse.phase ?? meta.phase;
    meta.cartPersisted = apiResponse.cart_persisted;
    meta.checkoutUrl = apiResponse.checkout_url ?? meta.checkoutUrl;

    const botMessages = mapApiMessages(apiResponse.messages, meta.storeName);

    // If checkout URL available and not already added by mapApiMessages, add button
    if (apiResponse.checkout_url && botMessages.length > 0) {
      const lastMsg = botMessages[botMessages.length - 1];
      const hasCheckout = lastMsg.buttons?.some(b => b.action.startsWith('checkout:'));
      if (!hasCheckout) {
        lastMsg.buttons = [
          ...(lastMsg.buttons || []),
          {
            id: 'checkout',
            label: language === 'he' ? 'עבור לקופה' : 'Go to Checkout',
            action: `checkout:${apiResponse.checkout_url}`,
            variant: 'primary',
          },
        ];
      }
    }

    session.messages.push(...botMessages);
    newMessages.push(...botMessages);
    updateSession(session);

    return { session, newMessages };
  } catch (error) {
    console.error('Failed to send action via PricePilot API:', error);
    return handleButtonActionLocal(session, action, language, newMessages);
  }
}

/**
 * Process a text message from the user.
 * Sends to PricePilot v2 /api/message.
 */
export async function processUserMessage(
  sessionId: string,
  text: string,
  language: Language,
  authToken?: string,
): Promise<AgentResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const meta = sessionMeta.get(sessionId);
  const newMessages: ChatMessage[] = [];

  // Auto-detect JWT tokens pasted by the user
  const detectedToken = authToken || (looksLikeJwt(text) ? text.trim() : undefined);

  // Add user message locally
  const userMessage = createUserMessage(
    detectedToken && !authToken ? (language === 'he' ? '🔑 טוקן התחברות התקבל' : '🔑 Login token received') : text
  );
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
    updateSession(session);
    return { session, newMessages };
  }

  try {
    // If user sent an email (likely for OTP login), solve reCAPTCHA first
    let recaptchaToken: string | undefined;
    if (looksLikeEmail(text) && !detectedToken) {
      recaptchaToken = (await solveRecaptcha()) || undefined;
    }

    const apiResponse = await apiSendMessage(
      sessionId,
      meta.pricepilotUserId,
      detectedToken ? 'User has logged in. Here is the auth token.' : text,
      detectedToken,
      recaptchaToken,
    );

    // Update metadata
    meta.phase = apiResponse.phase ?? meta.phase;
    meta.cartPersisted = apiResponse.cart_persisted;
    meta.checkoutUrl = apiResponse.checkout_url ?? meta.checkoutUrl;

    const botMessages = mapApiMessages(apiResponse.messages, meta.storeName);

    // If checkout URL available and not already added by mapApiMessages, add button
    if (apiResponse.checkout_url && botMessages.length > 0) {
      const lastMsg = botMessages[botMessages.length - 1];
      const hasCheckout = lastMsg.buttons?.some(b => b.action.startsWith('checkout:'));
      if (!hasCheckout) {
        lastMsg.buttons = [
          ...(lastMsg.buttons || []),
          {
            id: 'checkout',
            label: language === 'he' ? 'עבור לקופה' : 'Go to Checkout',
            action: `checkout:${apiResponse.checkout_url}`,
            variant: 'primary',
          },
        ];
      }
    }

    session.messages.push(...botMessages);
    newMessages.push(...botMessages);
    updateSession(session);

    return { session, newMessages };
  } catch (error) {
    console.error('Failed to send message via PricePilot API:', error);
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

    session.state = 'COMPLETED';
    const cartMessage = createBotMessage(
      m.completed,
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
