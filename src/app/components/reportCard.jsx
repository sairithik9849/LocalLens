import React, { useState } from "react";
import axios from "axios";
import { getAuth } from "firebase/auth";
import ViewPostModal from "./viewPostModal";

export default function ReportCard({ report = {}, onHandled }) {
  const [showPostModal, setShowPostModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleShowPostModal = () => setShowPostModal(true);
  const handleCloseModals = () => setShowPostModal(false);

  const withError = (msg) => {
    setErrorMessage(msg || "Something went wrong");
    setTimeout(() => setErrorMessage(""), 4000);
  };

  async function handleDelete() {
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) {
        withError("You must be signed in as admin");
        return;
      }

      const token = await current.getIdToken();

      await axios.delete("/api/admin", {
        params: { blogId: report.blogId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (typeof onHandled === "function") onHandled();
    } catch (err) {
      console.error("Delete failed:", err);
      withError(err?.response?.data?.error || "Failed to delete post");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleIgnore() {
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) {
        withError("You must be signed in as admin");
        return;
      }

      const token = await current.getIdToken();

      const params = new URLSearchParams();
      params.append("reportId", report._id);

      await axios.post("/api/admin", params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${token}`,
        },
      });

      if (typeof onHandled === "function") onHandled();
    } catch (err) {
      console.error("Ignore failed:", err);
      withError(err?.response?.data?.error || "Failed to ignore report");
    } finally {
      setIsProcessing(false);
    }
  }

  const reportedAt = report.reportedAt
    ? new Date(report.reportedAt).toLocaleString()
    : "Unknown";

  const initials = (() => {
    const name = report.reporterEmail || "U";
    return name
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  })();

  return (
    <>
      <article className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex gap-4 items-start">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
            {initials}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-800">
                {report.reason || 'Reported content'}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {report.reporterEmail && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Reporter: {report.reporterEmail}
                  </span>
                )}
                {report.reporteeEmail && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Author: {report.reporteeEmail}
                  </span>
                )}
              </div>
            </div>

            <div className="text-sm text-slate-400">
              {reportedAt}
            </div>
          </div>

          <p className="text-sm text-slate-600 mt-3 line-clamp-3">
            {report.excerpt || (report.body ? report.body.slice(0, 200) + (report.body.length > 200 ? '…' : '') : '')}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleShowPostModal}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12H9m0 0l3 3m-3-3 3-3" />
              </svg>
              View Post
            </button>

            <button
              onClick={handleIgnore}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Processing…
                </>
              ) : 'Ignore Report'}
            </button>

            <button
              onClick={handleDelete}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Processing…
                </>
              ) : 'Delete Post'}
            </button>
          </div>

          {errorMessage && (
            <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {errorMessage}
            </div>
          )}
        </div>
      </article>
      <ViewPostModal
        isOpen={showPostModal}
        handleClose={handleCloseModals}
        report={report}
      />
    </>
  );
}
