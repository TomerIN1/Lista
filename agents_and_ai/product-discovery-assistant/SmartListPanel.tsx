import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Sparkles, Send, Loader2,
  Plus, Check, ShoppingCart,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SmartChatMessage, ShoppingProduct, DbProduct, DbProductEnhanced, SmartProductGroup, SmartItemGroup } from '../../types';
import { processSmartChat, loadMoreAlternatives } from './smartListService';
import ProductDetailModal from '../../components/ProductDetailModal';
import GroupDetailModal from '../../components/GroupDetailModal';
import { formatPriceLabel, formatPriceRange, defaultCartUnit } from '../../utils/priceFormat';
import { iconUrl } from './listaCategories';
import SmartResultsList from './SmartResultsList';

const IMAGE_FALLBACK = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23f1f5f9" width="40" height="40" rx="8"/><text x="20" y="24" text-anchor="middle" font-size="16">📦</text></svg>';

interface SmartListPanelProps {
  onClose: () => void;
  onConfirm: (products: ShoppingProduct[]) => void;
  existingBarcodes: Set<string>;
  city?: string;
  storeType?: string;
  selectedChains?: string[];
}

const SmartListPanel: React.FC<SmartListPanelProps> = ({
  onClose,
  onConfirm,
  existingBarcodes,
  city,
  storeType,
  selectedChains,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SmartChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: t('smartList.welcome'),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Track barcodes added via this panel so we can show "Added" immediately
  const [addedInSession, setAddedInSession] = useState<Set<string>>(new Set());
  const [detailBarcode, setDetailBarcode] = useState<string | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<number | null>(null);
  const [detailProduct, setDetailProduct] = useState<DbProduct | null>(null);

  const openDetail = (product: DbProduct) => {
    setDetailProduct(product);
    setDetailBarcode(product.barcode);
    setDetailGroupId(product.product_group_id ?? null);
  };
  const closeDetail = () => {
    setDetailBarcode(null);
    setDetailGroupId(null);
    setDetailProduct(null);
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Only auto-scroll when a new message is APPENDED (conversation grew),
  // not when an existing message is edited in place — e.g. when a "maybe
  // try..." chip replaces a missing item inline, we want to keep the user
  // parked where they are so they can continue scanning other items.
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const isInCart = (barcode: string) =>
    existingBarcodes.has(barcode) || addedInSession.has(barcode);

  /**
   * Core send: appends a user message, fires processSmartChat, replaces the
   * transient loading bubble with the real assistant response. Used both by
   * the input-area send button and by the "maybe try..." chips on missing
   * items (which submit pre-formed queries).
   */
  const sendMessage = async (text: string) => {
    text = text.trim();
    if (!text || isProcessing) return;

    const userMsg: SmartChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
    };

    const loadingMsg: SmartChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsProcessing(true);

    // Build conversation history for context (exclude welcome + loading, limit to last 6 messages)
    const history = [...messages, userMsg]
      .filter((m) => m.role !== 'system' && m.id !== 'welcome' && !m.isLoading)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }))
      .slice(-6);

    try {
      const result = await processSmartChat(
        text,
        language,
        history,
        city,
        storeType,
        selectedChains
      );

      const assistantMsg: SmartChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: result.message,
        products: result.products.length > 0 ? result.products : undefined,
        productGroups: result.groups.length > 0 ? result.groups : undefined,
        itemGroups: result.itemGroups.length > 0 ? result.itemGroups : undefined,
        notFound: result.notFound.length > 0 ? result.notFound : undefined,
      };

      // Replace loading message with real response
      setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);
    } catch {
      const errorMsg: SmartChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: language === 'he' ? 'שגיאה. נסו שוב.' : 'Error. Please try again.',
      };
      setMessages((prev) => [...prev.slice(0, -1), errorMsg]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  };

  /**
   * Load more alternatives for an already-matched item. Re-runs the search
   * pipeline with a wider limit, excludes barcodes already shown, and
   * appends the fresh ones to the item's alternatives list. Returns the
   * number of new products added so the UI can show "no more results" when
   * the pool is exhausted.
   */
  const handleLoadMore = async (messageId: string, itemId: string): Promise<number> => {
    let addedCount = 0;
    // Snapshot the target item so we can run the fetch outside of setState
    let target: SmartItemGroup | null = null;
    setMessages((prev) => {
      for (const m of prev) {
        if (m.id !== messageId || !m.itemGroups) continue;
        const g = m.itemGroups.find((x) => x.id === itemId);
        if (g) target = g;
      }
      return prev;
    });
    if (!target) return 0;
    const found: SmartItemGroup = target;

    try {
      const excluded = new Set<string>([
        ...(found.recommended ? [found.recommended.barcode] : []),
        ...found.alternatives.map((a) => a.barcode),
      ]);
      const query = found.originalText || (found.recommended?.name ?? '');
      if (!query) return 0;
      const more = await loadMoreAlternatives(
        query,
        found.listaCategory,
        excluded,
        city,
        storeType,
        selectedChains
      );
      addedCount = more.length;
      if (more.length === 0) return 0;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId || !msg.itemGroups) return msg;
          return {
            ...msg,
            itemGroups: msg.itemGroups.map((g) =>
              g.id === itemId
                ? { ...g, alternatives: [...g.alternatives, ...more] }
                : g
            ),
          };
        })
      );
      return addedCount;
    } catch {
      return 0;
    }
  };

  /**
   * Retry a missing item in place. Runs processSmartChat scoped to a single
   * query, takes the first produced item-group, and swaps it into the target
   * message's itemGroups — keeping the original id and originalText so the
   * layout stays stable. If the new query ALSO finds nothing, the card stays
   * in its "not found" state (but gets refreshed alternatives next render).
   */
  const handleRetryItem = async (messageId: string, itemId: string, query: string) => {
    let newGroup: SmartItemGroup | null = null;
    try {
      const result = await processSmartChat(
        query,
        language,
        [],
        city,
        storeType,
        selectedChains
      );
      newGroup = result.itemGroups[0] ?? null;
    } catch {
      // fall through to no-op update below
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.itemGroups) return msg;
        return {
          ...msg,
          itemGroups: msg.itemGroups.map((g) => {
            if (g.id !== itemId) return g;
            if (!newGroup) return g; // retry failed — leave the missing card as-is
            return {
              ...newGroup,
              id: g.id, // preserve stable id so React key + retry state don't churn
              originalText: query, // show the new query as the section label
              quantity: g.quantity, // keep any quantity the user had set
              // Keep the ORIGINAL category bucket so the card stays in the
              // same visual slot; retries are meant to replace-in-place, not
              // reorganize the list. Without this, a chip whose query got
              // tagged with a different listaCategory would cause the item
              // to teleport to a different section and look like it vanished.
              listaCategory: g.listaCategory,
            };
          }),
        };
      })
    );
  };

  const handleAddProduct = (product: DbProduct) => {
    if (isInCart(product.barcode)) return;
    const shoppingProduct: ShoppingProduct = {
      ...product,
      amount: 1,
      unit: defaultCartUnit(product.unit_of_measure, product.is_weighted, product.name),
    };
    onConfirm([shoppingProduct]);
    setAddedInSession((prev) => new Set(prev).add(product.barcode));
  };

  const handleAddAll = (products: DbProduct[]) => {
    const toAdd = products.filter((p) => !isInCart(p.barcode));
    if (toAdd.length === 0) return;
    const shoppingProducts: ShoppingProduct[] = toAdd.map((p) => ({
      ...p,
      amount: 1,
      unit: defaultCartUnit(p.unit_of_measure, p.is_weighted, p.name),
    }));
    onConfirm(shoppingProducts);
    setAddedInSession((prev) => {
      const next = new Set(prev);
      toAdd.forEach((p) => next.add(p.barcode));
      return next;
    });
  };

  const renderProductCard = (product: DbProduct) => {
    const inCart = isInCart(product.barcode);
    return (
      <div
        key={product.barcode}
        className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
          inCart
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-slate-150 bg-white hover:border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => openDetail(product)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
        >
          <img
            src={product.image_url || IMAGE_FALLBACK}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100"
            onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_FALLBACK; }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 leading-snug truncate">
              {product.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-400">{product.manufacturer}</span>
              {product.min_price > 0 && (
                <span className="text-xs font-bold text-emerald-600">
                  {product.max_price && product.max_price > product.min_price
                    ? formatPriceRange(product.min_price, product.max_price, product.unit_of_measure, product.is_weighted)
                    : formatPriceLabel(product.min_price, product.unit_of_measure, product.is_weighted)}
                </span>
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleAddProduct(product); }}
          disabled={inCart}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
            inCart
              ? 'bg-emerald-100 text-emerald-600 cursor-default'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
          }`}
        >
          {inCart ? (
            <>
              <Check className="w-3.5 h-3.5" />
              {t('smartList.alreadyInCart')}
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              {t('smartList.addToCart')}
            </>
          )}
        </button>
      </div>
    );
  };

  const renderCategoryGroup = (group: SmartProductGroup, idx: number) => (
    <div key={`${group.category}-${idx}`} className={idx > 0 ? 'mt-3 pt-3 border-t border-slate-200' : ''}>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <img
          src={iconUrl(group.category)}
          alt=""
          className="w-5 h-5 flex-shrink-0 opacity-80"
          onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
        />
        <span className="text-xs font-bold text-slate-600 tracking-wide">
          {group.category}
        </span>
        <span className="text-[11px] text-slate-400">
          ({group.products.length})
        </span>
        {group.freshFallback && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
            {language === 'he' ? 'לא נמצא טרי — מוצג מעובד' : 'No fresh — processed'}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {group.products.map(renderProductCard)}
      </div>
    </div>
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <BackArrow className="w-4 h-4" />
          <span>{t('smartList.backToCatalog')}</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
          <Sparkles className="w-4 h-4" />
          <span>{t('smartList.title')}</span>
        </div>
      </div>

      {/* Messages feed */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* User message */}
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-2xl rounded-ee-md whitespace-pre-wrap">
                  {msg.text}
                </div>
              </div>
            )}

            {/* Assistant message */}
            {msg.role === 'assistant' && (
              <div className="flex justify-start">
                <div className="max-w-[95%] space-y-2">
                  {/* Loading indicator */}
                  {msg.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('smartList.processing')}</span>
                    </div>
                  )}

                  {/* Text */}
                  {!msg.isLoading && msg.text && (
                    <div className="bg-slate-100 text-slate-700 text-sm px-3.5 py-2 rounded-2xl rounded-es-md whitespace-pre-wrap">
                      {msg.text}
                    </div>
                  )}

                  {/* Per-item selection UI (Phase 2 — preferred renderer) */}
                  {!msg.isLoading && msg.itemGroups && msg.itemGroups.length > 0 && (
                    <SmartResultsList
                      itemGroups={msg.itemGroups}
                      existingBarcodes={existingBarcodes}
                      addedInSession={addedInSession}
                      onRetryItem={(itemId, q) => handleRetryItem(msg.id, itemId, q)}
                      onLoadMore={(itemId) => handleLoadMore(msg.id, itemId)}
                      onAdd={(products) => {
                        onConfirm(products);
                        setAddedInSession((prev) => {
                          const next = new Set(prev);
                          products.forEach((p) => next.add(p.barcode));
                          return next;
                        });
                      }}
                      onOpenDetail={openDetail}
                    />
                  )}

                  {/* Legacy grouped product cards (by Lista category) — only
                      used when the response has no itemGroups (shouldn't happen
                      in normal flows after Phase 2, kept for resilience). */}
                  {!msg.isLoading && !msg.itemGroups && msg.productGroups && msg.productGroups.length > 0 && (
                    <div className="space-y-0">
                      {msg.productGroups.map((g, i) => renderCategoryGroup(g, i))}

                      {/* Add All across all groups */}
                      {(() => {
                        const allProducts = msg.productGroups!.flatMap((g) => g.products);
                        const addable = allProducts.filter((p) => !isInCart(p.barcode));
                        return addable.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleAddAll(allProducts)}
                            className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            {t('smartList.addAllResults').replace('{n}', String(addable.length))}
                          </button>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Flat product list fallback (legacy / ungrouped) */}
                  {!msg.isLoading && !msg.itemGroups && !msg.productGroups && msg.products && msg.products.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.products.map(renderProductCard)}
                      {msg.products.filter((p) => !isInCart(p.barcode)).length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAddAll(msg.products!)}
                          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          {t('smartList.addAllResults').replace('{n}', String(
                            msg.products.filter((p) => !isInCart(p.barcode)).length
                          ))}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-3 py-2.5 border-t border-slate-100 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('smartList.textPlaceholder')}
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 resize-none"
            dir="auto"
            disabled={isProcessing}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
              input.trim() && !isProcessing
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" style={{ transform: isRTL ? 'scaleX(-1)' : undefined }} />
          </button>
        </div>
      </div>

      {/* Detail modal — use GroupDetailModal for grouped products (cross-chain
          pricing) and ProductDetailModal otherwise. Mirrors ProductCatalogArea. */}
      {detailBarcode && detailGroupId != null && (
        <GroupDetailModal
          groupId={detailGroupId}
          fallbackProduct={detailProduct as DbProductEnhanced | null}
          storeType="online"
          availableChains={selectedChains}
          onClose={closeDetail}
          onAdd={(product) => { handleAddProduct(product); closeDetail(); }}
          isAdded={isInCart(detailBarcode)}
        />
      )}
      {detailBarcode && detailGroupId == null && (
        <ProductDetailModal
          barcode={detailBarcode}
          fallbackImageUrl={detailProduct?.image_url}
          fallbackProduct={detailProduct as DbProductEnhanced | null}
          storeType="online"
          availableChains={selectedChains}
          onClose={closeDetail}
          onAdd={(product) => { handleAddProduct(product); closeDetail(); }}
          isAdded={isInCart(detailBarcode)}
        />
      )}
    </div>
  );
};

export default SmartListPanel;
