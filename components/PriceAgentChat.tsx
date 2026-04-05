import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Bot, Loader2, ShoppingBag, ExternalLink, Puzzle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  AgentSession,
  AgentShoppingItem,
  ChatMessage as ChatMessageType,
} from '../types';
import {
  startAgentSession,
  handleButtonAction,
  processUserMessage,
  getSession,
} from '../services/agentService';
import { detectExtension } from '../services/extensionBridge';
import ChatMessage from './ChatMessage';

interface PriceAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  listId: string;
  groceryList: AgentShoppingItem[];
  storeName?: string;
  storeId?: string;
  userCity?: string;
}

/** Friendly Hebrew labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  initialize_shopping_session: 'מאתחל חיבור...',
  open_rami_levy_browser: 'פותח דפדפן רמי לוי...',
  start_login: 'מתחיל התחברות...',
  submit_otp: 'מאמת קוד...',
  search_products: 'מחפש מוצרים...',
  read_cart: 'קורא עגלה...',
  add_items_to_cart: 'מוסיף לעגלה...',
  clear_cart: 'מרוקן עגלה...',
  remove_cart_item: 'מסיר פריט...',
  verify_session_continuity: 'בודק חיבור...',
  generate_handoff: 'מכין קופה...',
};

const TOOL_LABELS_EN: Record<string, string> = {
  initialize_shopping_session: 'Initializing session...',
  open_rami_levy_browser: 'Opening Rami Levy browser...',
  start_login: 'Starting login...',
  submit_otp: 'Verifying code...',
  search_products: 'Searching products...',
  read_cart: 'Reading cart...',
  add_items_to_cart: 'Adding to cart...',
  clear_cart: 'Clearing cart...',
  remove_cart_item: 'Removing item...',
  verify_session_continuity: 'Verifying session...',
  generate_handoff: 'Preparing checkout...',
};

const PriceAgentChat: React.FC<PriceAgentChatProps> = ({
  isOpen,
  onClose,
  userId,
  listId,
  groceryList,
  storeName,
  storeId,
  userCity,
}) => {
  const { language, isRTL } = useLanguage();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check extension status when opened
  useEffect(() => {
    if (isOpen) {
      detectExtension(1500).then(setExtensionInstalled);
    }
  }, [isOpen]);

  // When user dismisses welcome → start session
  useEffect(() => {
    if (isOpen && !showWelcome && !session) {
      initializeSession();
    }
  }, [isOpen, showWelcome]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, toolStatus]);

  const onBotMessage = useCallback((msg: ChatMessageType) => {
    setMessages((prev) => [...prev, msg]);
    setToolStatus('');
  }, []);

  const onToolActivity = useCallback((toolName: string, type: 'call' | 'result') => {
    if (type === 'call') {
      const labels = language === 'he' ? TOOL_LABELS : TOOL_LABELS_EN;
      setToolStatus(labels[toolName] || toolName);
    } else {
      setToolStatus('');
    }
  }, [language]);

  const initializeSession = async () => {
    setIsLoading(true);
    setToolStatus('');
    try {
      const { session: newSession } = await startAgentSession(
        userId,
        listId,
        groceryList,
        language,
        storeName,
        storeId,
        userCity,
        onBotMessage,
        onToolActivity,
      );
      setSession(newSession);
    } catch (error) {
      console.error('Failed to initialize session:', error);
    } finally {
      setIsLoading(false);
      setToolStatus('');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !session || isLoading) return;

    const text = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Add user message immediately
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      type: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      await processUserMessage(
        session.id,
        text,
        language,
        undefined,
        onBotMessage,
        onToolActivity,
      );
      // Session already updated by processUserMessage
      setSession(getSession(session.id) || session);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
      setToolStatus('');
    }
  };

  const handleButtonClick = async (action: string) => {
    if (!session || isLoading) return;

    // Handle restart action specially
    if (action === 'cancel:restart') {
      setSession(null);
      setMessages([]);
      initializeSession();
      return;
    }

    // Handle checkout URL action
    if (action.startsWith('checkout:')) {
      const url = action.replace('checkout:', '');
      window.open(url, '_blank');
      return;
    }

    setIsLoading(true);
    try {
      await handleButtonAction(
        session.id,
        action,
        language,
        onBotMessage,
        onToolActivity,
      );
      setSession(getSession(session.id) || session);
    } catch (error) {
      console.error('Failed to handle button action:', error);
    } finally {
      setIsLoading(false);
      setToolStatus('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    setSession(null);
    setMessages([]);
    setInputText('');
    setToolStatus('');
    setShowWelcome(true);
    setExtensionInstalled(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 lg:bg-transparent lg:backdrop-blur-none"
        onClick={handleClose}
      />

      {/* Chat Panel */}
      <div
        className={`
          fixed inset-y-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl
          transform transition-transform duration-300 ease-out
          flex flex-col
          ${isRTL ? 'left-0' : 'right-0'}
          ${isOpen ? 'translate-x-0' : isRTL ? '-translate-x-full' : 'translate-x-full'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">PricePilot</h2>
              <p className="text-xs text-white/80">
                {storeName
                  ? (language === 'he' ? `בונה עגלה ב-${storeName}` : `Building cart at ${storeName}`)
                  : (language === 'he' ? 'מוצא את המחירים הטובים ביותר' : 'Find the best prices anywhere')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shopping List Summary */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShoppingBag className="w-4 h-4" />
            <span>
              {language === 'he'
                ? `${groceryList.length} פריטים ברשימה`
                : `${groceryList.length} items in your list`}
            </span>
          </div>
        </div>

        {/* Welcome Screen */}
        {showWelcome ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-4">
              {/* Welcome header */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {language === 'he' ? 'ברוכים הבאים ל-PricePilot' : 'Welcome to PricePilot'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {language === 'he'
                    ? 'הסוכן האוטומטי שבונה לך עגלת קניות ברמי לוי'
                    : 'Your automated shopping cart builder for Rami Levy'}
                </p>
              </div>

              {/* What PricePilot does */}
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-indigo-800">
                  {language === 'he' ? 'מה PricePilot עושה?' : 'What does PricePilot do?'}
                </p>
                <ul className="text-sm text-indigo-700 space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                  <li>{language === 'he' ? '- מחפש מוצרים לפי רשימת הקניות שלך' : '- Searches products from your shopping list'}</li>
                  <li>{language === 'he' ? '- מוסיף, מסיר ומעדכן פריטים בעגלה שלך' : '- Adds, removes, and updates items in your cart'}</li>
                  <li>{language === 'he' ? '- מכין את העגלה לתשלום — אתה רק משלם' : '- Prepares your cart for checkout — you just pay'}</li>
                </ul>
              </div>

              {/* Rami Levy info */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-green-700">RL</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {language === 'he' ? 'רמי לוי אונליין' : 'Rami Levy Online'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {language === 'he'
                      ? 'הסוכן יפתח את רמי לוי אוטומטית — אין צורך לצאת מ-Lista'
                      : 'The agent opens Rami Levy automatically — no need to leave Lista'}
                  </p>
                </div>
              </div>

              {/* Extension status */}
              {extensionInstalled === true && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-green-200 bg-green-50">
                  <Puzzle className="w-5 h-5 flex-shrink-0 text-green-600" />
                  <p className="text-sm text-green-700">
                    {language === 'he' ? 'התוסף מותקן ומוכן' : 'Extension installed and ready'}
                  </p>
                </div>
              )}

              {extensionInstalled === false && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Puzzle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-800">
                        {language === 'he' ? 'חובה להתקין את תוסף PricePilot' : 'PricePilot extension is required'}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {language === 'he'
                          ? 'בלי התוסף, PricePilot לא יכול לגשת לחשבון רמי לוי שלך ולבנות את העגלה. התוסף עובד ברקע ומאפשר לסוכן לחפש מוצרים, להוסיף ולהסיר פריטים מהעגלה שלך.'
                          : 'Without the extension, PricePilot cannot access your Rami Levy account or build your cart. The extension works in the background and lets the agent search products, add and remove items from your cart.'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://chrome.google.com/webstore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    <Puzzle className="w-4 h-4" />
                    {language === 'he' ? 'התקן את התוסף' : 'Install Extension'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {extensionInstalled === null && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <Loader2 className="w-5 h-5 flex-shrink-0 text-slate-400 animate-spin" />
                  <p className="text-sm text-slate-500">
                    {language === 'he' ? 'בודק תוסף...' : 'Checking extension...'}
                  </p>
                </div>
              )}

              {/* Start button — disabled if extension not installed */}
              <button
                onClick={() => setShowWelcome(false)}
                disabled={extensionInstalled !== true}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                  extensionInstalled === true
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {language === 'he' ? 'התחל לבנות עגלה' : 'Start Building Cart'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onButtonClick={handleButtonClick}
                />
              ))}

              {/* Tool activity indicator */}
              {isLoading && toolStatus && (
                <div className="flex items-center gap-2 text-indigo-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{toolStatus}</span>
                </div>
              )}

              {/* Generic loading indicator */}
              {isLoading && !toolStatus && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {language === 'he' ? 'מעבד...' : 'Processing...'}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    language === 'he'
                      ? 'הקלד הודעה...'
                      : 'Type a message...'
                  }
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className={`p-3 rounded-xl transition-all ${
                    inputText.trim() && !isLoading
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                {language === 'he'
                  ? 'PricePilot - מחירים טובים יותר בכל מקום'
                  : 'PricePilot - Better prices everywhere'}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default PriceAgentChat;
