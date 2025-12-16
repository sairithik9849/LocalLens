import React, { useState } from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import BanModal from './banModal';

export default function UserCard({ userObj = {}, onHandled }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState('ban');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [localUser, setLocalUser] = useState(userObj);

  const banned = !!(localUser?.moderation && localUser.moderation.banned);

  const openBanModal = () => {
    setModalAction('ban');
    setModalOpen(true);
  };

  const openUnbanModal = () => {
    setModalAction('unban');
    setModalOpen(true);
  };

  const submitAction = async ({ reason } = {}) => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) {
        setErrorMessage('You must be signed in as admin');
        return;
      }

      const token = await current.getIdToken();
      const params = new URLSearchParams();
      params.append('targetId', localUser._id);
      if (modalAction === 'ban' && reason) {
        params.append('reason', reason);
      }

      const response = await axios.post('/api/adminusers', params.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const nextBanned = response?.data?.banned ?? !banned;

      // Optimistic local update
      setLocalUser((prev) => ({
        ...prev,
        moderation: {
          ...(prev?.moderation || {}),
          banned: nextBanned,
          banReason: modalAction === 'ban' ? reason || null : null,
        },
      }));

      if (typeof onHandled === 'function') onHandled();
    } catch (err) {
      console.error('Ban/Unban failed:', err);
      setErrorMessage(err?.response?.data?.error || 'Failed to update user');
    } finally {
      setIsProcessing(false);
      setModalOpen(false);
    }
  };

  const initials = (() => {
    const name = (localUser.firstName || localUser.lastName || localUser.email || '').toString();
    const words = name.trim() ? name.trim().split(/\s+/) : [];
    if (words.length === 0 && localUser.email) return localUser.email[0].toUpperCase();
    return words.map(w => w[0]).slice(0, 2).join('').toUpperCase();
  })();

  return (
    <>
      <article className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex gap-4 items-center">
        <div className="flex-shrink-0">
          {localUser.photoURL ? (
            <img src={localUser.photoURL} alt={`${localUser.firstName || ''} avatar`} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">User</div>
              <div className="text-sm font-medium text-slate-800 truncate">{(localUser.firstName || '') + (localUser.lastName ? ' ' + localUser.lastName : '') || localUser.email}</div>
              <div className="text-xs text-slate-400">{localUser.email}</div>
            </div>

            <div className="text-sm text-slate-400">
              <div className="text-xs">{localUser._id ?? localUser.id}</div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {banned && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                Banned {localUser?.moderation?.banReason ? `· ${localUser.moderation.banReason}` : ''}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={banned ? openUnbanModal : openBanModal}
              disabled={isProcessing}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                banned
                  ? 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100'
                  : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Processing…
                </>
              ) : banned ? 'Banned' : 'Ban user'}
            </button>
          </div>

          {errorMessage && (
            <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {errorMessage}
            </div>
          )}
        </div>
      </article>

      <BanModal
        isOpen={modalOpen}
        action={modalAction}
        user={localUser}
        onClose={() => setModalOpen(false)}
        onConfirm={submitAction}
        processing={isProcessing}
      />
    </>
  );
}
