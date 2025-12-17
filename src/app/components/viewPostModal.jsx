import React, { useState } from "react";
import ReactModal from "react-modal";

ReactModal.setAppElement("body");

export default function ViewPostModal({ isOpen, handleClose, report }) {
  const [expandedImage, setExpandedImage] = useState(null);

  if (!report) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return date.toString();
    }
  };

  const images = report.images || [];

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="View reported post"
      overlayClassName="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl mx-4 outline-none max-h-[90vh] flex flex-col"
    >
      {/* Header - Fixed */}
      <div className="flex items-start justify-between p-6 border-b border-slate-200 flex-shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Reported Post</h2>
          <p className="text-sm text-slate-500 mt-1">
            Posted by <span className="font-medium text-slate-700">{report.reporteeEmail || 'Unknown'}</span>
          </p>
        </div>
        <button 
          onClick={handleClose} 
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Post Content */}
        <div className="mb-6">
          <div className="text-slate-700 whitespace-pre-wrap break-words">
            {report.body || 'Post is empty'}
          </div>
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Images ({images.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((imageUrl, index) => (
                <div 
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setExpandedImage(imageUrl)}
                >
                  <img
                    src={imageUrl}
                    alt={`Post image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-slate-700 mb-1">Location</div>
              <div className="text-slate-600">{report.location || 'Not specified'}</div>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">Posted On</div>
              <div className="text-slate-600">{formatDate(report.postedOn || report.reportedAt)}</div>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">Reported On</div>
              <div className="text-slate-600">{formatDate(report.reportedAt)}</div>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">Report Reason</div>
              <div className="text-slate-600">{report.reason || 'No reason provided'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Fixed */}
      <footer className="p-6 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
        <button 
          onClick={handleClose} 
          className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      </footer>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            aria-label="Close image"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={expandedImage}
            alt="Expanded post image"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </ReactModal>
  );
}
