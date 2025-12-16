import React, { useState } from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import BanModal from './banModal';

export default function UserCard({ userObj, onHandled }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState('ban');
  const [isProcessing, setIsProcessing] = useState(false);

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
    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) return;

      console.log(userObj)

      const token = await current.getIdToken();
      const payload = modalAction === 'ban'
        ? { targetId: userObj._id, reason }
        : { targetId: userObj._id };

      await axios.post('http://localhost:3000/api/adminusers', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (typeof onHandled === 'function') onHandled();
    } catch (err) {
      console.error('Ban/Unban failed:', err);
    } finally {
      setIsProcessing(false);
      setModalOpen(false);
    }
  };

  const banned = !!(userObj.moderation && userObj.moderation.banned);

  const initials = (() => {
    const name = (userObj.firstName || userObj.lastName || userObj.email || '').toString();
    const words = name.trim() ? name.trim().split(/\s+/) : [];
    if (words.length === 0 && userObj.email) return userObj.email[0].toUpperCase();
    return words.map(w => w[0]).slice(0, 2).join('').toUpperCase();
  })();

  return (
    <>
      <article className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex gap-4 items-center">
        <div className="flex-shrink-0">
          {userObj.photoURL ? (
            <img src={userObj.photoURL} alt={`${userObj.firstName || ''} avatar`} className="w-12 h-12 rounded-full object-cover" />
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
              <div className="text-sm font-medium text-slate-800 truncate">{(userObj.firstName || '') + (userObj.lastName ? ' ' + userObj.lastName : '') || userObj.email}</div>
              <div className="text-xs text-slate-400">{userObj.email}</div>
            </div>

            <div className="text-sm text-slate-400">
              <div className="text-xs">{userObj._id ?? userObj.id}</div>
            </div>
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
        </div>
      </article>

      <BanModal
        isOpen={modalOpen}
        action={modalAction}
        user={userObj}
        onClose={() => setModalOpen(false)}
        onConfirm={submitAction}
        processing={isProcessing}
      />
    </>
  );
}
