"use client";

import React, { useState } from "react";
import ReactModal from "react-modal";
import axios from "axios";
import { getAuth } from "firebase/auth";

ReactModal.setAppElement("body");

export default function ReportPostModal({ isOpen, handleClose, post }) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();

      const params = new URLSearchParams();
      params.append("reason", body);

      await axios.post(
        `http://localhost:3000/api/report/${post._id}`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setBody("");
      handleClose();
    } catch (error) {
      console.error("Error creating report:", error);
      setErrorMessage("You have already reported this post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={() => {
        setErrorMessage("");
        handleClose();
      }}
      contentLabel="Report Post"
      overlayClassName="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      className="relative max-w-lg w-full mx-4 bg-white rounded-2xl shadow-xl outline-none"
    >
      <div className="p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Report post</h2>
            <p className="text-sm text-gray-500 mt-1">
              Describe why this post should be reviewed.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close report modal"
            onClick={() => {
              setErrorMessage("");
              handleClose();
            }}
            className="rounded-full p-2 hover:bg-gray-100 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="sr-only" htmlFor="report-reason">
            Report reason
          </label>

          <textarea
            id="report-reason"
            placeholder="Report reason (required)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
            className="w-full border border-gray-200 rounded-lg p-3 text-sm placeholder-gray-400 resize-y focus:ring-2 focus:ring-green-300 focus:border-transparent transition"
            disabled={submitting}
          />

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-500">
              {body.length}/500
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  handleClose();
                }}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || body.trim().length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition
                  ${submitting || body.trim().length === 0
                    ? "bg-green-200 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                  }`}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-md">
              <strong className="block text-sm">{errorMessage}</strong>
            </div>
          )}
        </form>

        <footer className="mt-4 text-xs text-gray-400">
          By submitting, you confirm this report follows the community guidelines.
        </footer>
      </div>
    </ReactModal>
  );
}
