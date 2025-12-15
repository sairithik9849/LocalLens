import React from "react";
import ReactModal from "react-modal";

ReactModal.setAppElement("body");

export default function ViewPostModal({ isOpen, handleClose, report }) {
  if (!report) return null;

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="View reported post"
      overlayClassName="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-6 mx-4 outline-none"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">{report.title || 'Post'}</h2>
          <p className="text-sm text-slate-500 mt-1">Posted by <span className="font-medium text-slate-700">{report.reporteeEmail}</span></p>
        </div>
        <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
          <span className="sr-only">Close</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4 text-slate-700">
        <p className="whitespace-pre-wrap">{report.body || 'Post is empty'}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-500">
          <div>
            <div className="font-medium text-slate-700">Location</div>
            <div>{report.location}</div>
          </div>

          <div>
            <div className="font-medium text-slate-700">Posted On</div>
            <div>{report.reportedAt}</div>
          </div>
        </div>
      </div>

      <footer className="mt-6 flex justify-end gap-2">
        <button onClick={handleClose} className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50">
          Close
        </button>
      </footer>
    </ReactModal>
  );
}
