import React, { useState } from 'react';
import { X, UserPlus, Mail, Check, Link2, Copy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (email: string) => Promise<void>;
  members: string[]; // emails
  listId: string; // for generating share link
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, onShare, members, listId }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [linkCopied, setLinkCopied] = useState(false);
  const { t } = useLanguage();

  if (!isOpen) return null;

  const shareLink = `${window.location.origin}/share/${listId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setStatus('idle');
    try {
      await onShare(email);
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-500" />
            {t('share.title')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Share Link Section */}
          <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <label className="text-sm font-semibold text-indigo-900">Share Link</label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 h-10 rounded-lg border border-indigo-200 bg-white text-slate-700 text-sm font-mono select-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-indigo-700 mt-2">Anyone with this link can view and edit this list after signing in</p>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-400 uppercase tracking-wider">or invite by email</span>
            </div>
          </div>

          {/* Email Invite Section */}
          <form onSubmit={handleSubmit} className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('share.inviteLabel')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('share.placeholder')}
                  className="w-full ps-9 h-10 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : t('share.inviteBtn')}
              </button>
            </div>
            {status === 'success' && <p className="text-emerald-600 text-xs mt-2 flex items-center gap-1"><Check className="w-3 h-3"/> {t('share.sent')}</p>}
            {status === 'error' && <p className="text-red-500 text-xs mt-2">{t('share.failed')}</p>}
          </form>

          <div>
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('share.currentMembers')}</h4>
             <div className="space-y-2">
               {members.map((member, idx) => (
                 <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                   <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                     {member.charAt(0).toUpperCase()}
                   </div>
                   <span className="text-sm text-slate-700 font-medium">{member}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;