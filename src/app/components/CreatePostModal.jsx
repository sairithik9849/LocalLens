import React, { useState } from "react";
import ReactModal from "react-modal";
import axios from "axios";
import { getAuth } from "firebase/auth";

ReactModal.setAppElement("body");

export default function CreatePostModal({ isOpen, handleClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      const auth = getAuth();
      const token = await auth.currentUser.getIdToken();
      
      const params = new URLSearchParams();
      params.append("title", title);
      params.append("body", body);

      const res = await axios.post(
        "http://localhost:3000/api/homepage",
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const created = res.data;
      if (typeof onCreate === "function") {
        onCreate(created);
      }

      handleClose();
      setTitle("");
      setBody("");


    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  return (
    <ReactModal 
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="Create Post"
    >
      <div>
        <h2>Create Post</h2>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <textarea
            placeholder="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            required
          />

          <div>
            <button
              type="submit"
            >
              Submit
            </button>

            <button
              type="button"
              onClick={handleClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </ReactModal>
  );
}
