import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Tag, TrendingDown, Store, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductGroupDetail, GroupPriceEntry } from '../types';
import { getGroupDetail } from '../services/priceDbService';
import { useLanguage } from '../contexts/LanguageContext';
import { SUPERMARKET_NAME_MAP } from '../services/priceDbService';

interface GroupDetailModalProps {
  groupId: number;
  onClose: () => void;
  city?: string;
  storeType?: string;
}

const GroupDetailModal: React.FC<GroupDetailModalProps> = ({ groupId, onClose, city, storeType }) => {
  const { isRTL } = useLanguage();
  const [detail, setDetail] = useState<ProductGroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setImgFailed(false);
    getGroupDetail(groupId, { city, store_type: storeType })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setIsLoading(false));
  }, [groupId, city, storeType]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const prices = detail?.prices ?? [];
  const cheapest = prices[0]?.effective_price ?? null;
  const mostExpensive = prices[prices.length - 1]?.effective_price ?? null;
  const maxSavings = cheapest != null && mostExpensive != null ? mostExpensive - cheapest : 0;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col z-10">

        {/* Image + name */}
        <div className="relative flex-shrink-0 h-48 sm:h-56 bg-slate-50 rounded-t-3xl sm:rounded-t-2xl overflow-hidden">
          {detail?.group.image_url && !imgFailed ? (
            <img
              src={detail.group.image_url}
              alt={detail.group.name}
              className="w-full h-full object-contain p-4"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-20 h-20 text-slate-200" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          {detail && (
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
              <p className="text-white font-bold text-base leading-snug drop-shadow">
                {detail.group.name}
              </p>
              <p className="text-white/80 text-xs mt-0.5 drop-shadow">
                {detail.group.sub_subcategory} · {prices.length} {isRTL ? 'רשתות' : 'chains'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 end-3 z-20 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-600 shadow transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : !detail || prices.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {isRTL ? 'לא נמצאו מחירים' : 'No prices found'}
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* Price hero */}
              {cheapest != null && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">
                      {isRTL ? 'המחיר הזול ביותר' : 'Cheapest Price'}
                    </p>
                    <p className="text-3xl font-black text-emerald-700 leading-none">
                      ₪{cheapest.toFixed(2)} / {isRTL ? 'ק״ג' : 'kg'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {prices[0].supermarket} — {prices[0].product_name}
                    </p>
                  </div>
                  {maxSavings > 0.01 && (
                    <div className="flex flex-col items-center bg-emerald-600 text-white rounded-xl px-3 py-2 text-center flex-shrink-0">
                      <TrendingDown className="w-4 h-4 mb-0.5" />
                      <p className="text-xs font-semibold leading-tight">
                        {isRTL ? 'חסוך' : 'Save'}
                      </p>
                      <p className="text-sm font-black">₪{maxSavings.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Price comparison table — one row per chain */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  {isRTL ? 'השוואת מחירים בין רשתות' : 'Cross-chain price comparison'}
                </p>
                <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                  {prices.map((p, i) => {
                    const isCheapest = i === 0;
                    const diff = cheapest != null ? p.effective_price - cheapest : 0;
                    const hasDiscount = p.effective_price < p.regular_price - 0.01;
                    const displayName = SUPERMARKET_NAME_MAP[p.supermarket] || p.supermarket;

                    return (
                      <div
                        key={`${p.supermarket}-${p.barcode}`}
                        className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                          isCheapest ? 'bg-emerald-50/80' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Store className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <p className={`text-sm font-semibold ${isCheapest ? 'text-emerald-800' : 'text-slate-700'}`}>
                              {displayName}
                            </p>
                            {isCheapest && (
                              <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                                {isRTL ? 'הכי זול' : 'Best'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{p.product_name}</p>
                          {p.promotion && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Tag className="w-3 h-3 text-rose-500 flex-shrink-0" />
                              <p className="text-[11px] text-rose-600 font-medium truncate">{p.promotion.description}</p>
                            </div>
                          )}
                          {p.store.is_online && p.store.delivery_fee != null && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Truck className="w-3 h-3 text-slate-400" />
                              <p className="text-[10px] text-slate-400">
                                {isRTL ? `משלוח ₪${p.store.delivery_fee}` : `Delivery ₪${p.store.delivery_fee}`}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="text-end flex-shrink-0">
                          <p className={`text-sm font-black ${isCheapest ? 'text-emerald-700' : hasDiscount ? 'text-rose-600' : 'text-slate-700'}`}>
                            ₪{p.effective_price.toFixed(2)} / {isRTL ? 'ק״ג' : 'kg'}
                          </p>
                          {hasDiscount && (
                            <p className="text-[11px] text-slate-400 line-through">₪{p.regular_price.toFixed(2)}</p>
                          )}
                          {p.unit_qty && (
                            <p className="text-[10px] text-slate-400">{p.unit_qty}</p>
                          )}
                          {!isCheapest && diff > 0.01 && (
                            <p className="text-[11px] text-slate-400 font-medium">+₪{diff.toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Member products (expandable) */}
              {detail.members.length > 1 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMembers(v => !v)}
                    className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors w-full justify-center py-2"
                  >
                    <span>
                      {isRTL
                        ? `${detail.members.length} ברקודים מאוחדים`
                        : `${detail.members.length} unified barcodes`}
                    </span>
                    {showMembers ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showMembers && (
                    <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                      {detail.members.map(m => (
                        <div key={m.barcode} className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs text-slate-700">{m.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{m.barcode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default GroupDetailModal;
