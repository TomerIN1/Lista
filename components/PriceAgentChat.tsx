import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Loader2, ShoppingBag } from 'lucide-react';
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
import ChatMessage from './ChatMessage';

interface PriceAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  listId: string;
  groceryList: AgentShoppingItem[];
}

const PriceAgentChat: React.FC<PriceAgentChatProps> = ({
  isOpen,
  onClose,
  userId,
  listId,
  groceryList,
}) => {
  const { language, isRTL } = useLanguage();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [customStores, setCustomStores] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session when opened
  useEffect(() => {
    if (isOpen && !session) {
      initializeSession();
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSession = async () => {
    setIsLoading(true);
    setSelectedStoreIds([]);
    setCustomStores([]);
    try {
      const { session: newSession, newMessages } = await startAgentSession(
        userId,
        listId,
        groceryList,
        language
      );
      setSession(newSession);
      setMessages(newMessages);
    } catch (error) {
      console.error('Failed to initialize session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !session || isLoading) return;

    setIsLoading(true);
    try {
      const { session: updatedSession, newMessages } = await processUserMessage(
        session.id,
        inputText.trim(),
        language
      );
      setSession(updatedSession);
      setMessages((prev) => [...prev, ...newMessages]);
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
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

    setIsLoading(true);
    try {
      const { session: updatedSession, newMessages } = await handleButtonAction(
        session.id,
        action,
        language
      );
      setSession(updatedSession);

      // If newMessages is empty, it means the session was updated in place (e.g., store selection)
      // In that case, sync messages from the session
      if (newMessages.length === 0) {
        setMessages([...updatedSession.messages]);
      } else {
        setMessages((prev) => [...prev, ...newMessages]);
      }
    } catch (error) {
      console.error('Failed to handle button action:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStoreSelectionChange = (newSelectedIds: string[]) => {
    setSelectedStoreIds(newSelectedIds);
  };

  const handleCustomStoreAdd = (storeName: string) => {
    // Add custom store to the selection
    const customStoreId = `custom-${storeName.toLowerCase().replace(/\s+/g, '-')}`;
    if (!customStores.includes(storeName)) {
      setCustomStores(prev => [...prev, storeName]);
    }
    if (!selectedStoreIds.includes(customStoreId)) {
      setSelectedStoreIds(prev => [...prev, customStoreId]);
    }
  };

  const handleStoreSelectionComplete = async () => {
    if (!session || selectedStoreIds.length === 0) return;

    // Update session with selected stores and trigger the flow
    setIsLoading(true);
    try {
      // First update session with selected stores
      session.selectedStores = selectedStoreIds;

      // Then trigger the done_stores action
      const { session: updatedSession, newMessages } = await handleButtonAction(
        session.id,
        'done_stores:done',
        language
      );
      setSession(updatedSession);
      setMessages([...updatedSession.messages]);
    } catch (error) {
      console.error('Failed to complete store selection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setSession(null);
    setMessages([]);
    setInputText('');
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
                {language === 'he' ? 'מוצא את המחירים הטובים ביותר' : 'Find the best prices anywhere'}
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

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onButtonClick={handleButtonClick}
              selectedStoreIds={selectedStoreIds}
              onStoreSelectionChange={handleStoreSelectionChange}
              onCustomStoreAdd={handleCustomStoreAdd}
              onStoreSelectionComplete={handleStoreSelectionComplete}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
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
      </div>
    </>
  );
};

export default PriceAgentChat;
