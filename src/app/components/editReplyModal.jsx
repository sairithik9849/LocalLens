import React, { useState, useEffect } from "react";
import ReactModal from "react-modal";
import axios from "axios";
import { getAuth } from "firebase/auth";

ReactModal.setAppElement("body");

export default function EditReplyModal({
  isOpen,
  handleClose,
  blogId,
  commentId,
  replyId,
  initialBody = "", 
  onSaved, 
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBody(initialBody ?? "");
    }
  }, [isOpen, initialBody]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) {
        console.warn("No current user.");
        setLoading(false);
        return;
      }
      const token = await current.getIdToken();

      const params = new URLSearchParams();
      params.append("comment", body);
      params.append("commentId", commentId);
      params.append("replyId", replyId);

      const res = await axios.patch(
        `http://localhost:3000/api/replies/${blogId}`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let updated = res.data ?? null;
      console.log(updated)

      if (typeof onSaved === "function") {
        try {
          onSaved(commentId, updated);
        } catch (err) {
          try {
            onSaved(updated);
          } catch (e) {
          }
        }
      }

      setBody("");
      handleClose();
    } catch (error) {
      console.error("Error editing reply:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReactModal isOpen={isOpen} onRequestClose={handleClose} contentLabel="Edit Reply">
      <div>
        <h2>Edit Reply</h2>

        {loading ? (
          <p>Saving…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              placeholder="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
            />

            <div>
              <button type="submit" disabled={loading || !body.trim()}>
                Submit
              </button>

              <button
                type="button"
                onClick={() => {
                  setBody("");
                  handleClose();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </ReactModal>
  );
}
