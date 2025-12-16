import React, { useState } from 'react';
import ReactModal from 'react-modal';

ReactModal.setAppElement('body');

export default function BanModal({ isOpen, onClose, onConfirm, action = 'ban', user = {}, processing = false }) {
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  const title = action === 'ban' ? 'Ban user' : 'Unban user';
  const subtitle = action === 'ban'
    ? 'Specify a reason for banning this user'
    : 'Confirm unbanning this user';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (action === 'ban' && !reason.trim()) {
      return;
    }
    await onConfirm(action === 'ban' ? { reason: reason.trim() } : {});
  };

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel={title}
      overlayClassName="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-6 mx-4 outline-none"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <span className="sr-only">Close</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        {action === 'ban' ? (
          <>
            <label className="block text-sm font-medium text-slate-700">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explanation for banning (required)"
              className="mt-2 w-full rounded-md border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
            />
          </>
        ) : (
          <div className="text-sm text-slate-600">Are you sure you want to unban <span className="font-medium text-slate-800">{user.email}</span>?</div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={processing || (action === 'ban' && !reason.trim())}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              action === 'ban' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {processing ? 'Processing…' : (action === 'ban' ? 'Ban user' : 'Unban user')}
          </button>
        </div>
      </form>
    </ReactModal>
  );
}
