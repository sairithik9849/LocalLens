import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { auth } from "@/firebase/config";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import EditPostModal from '@/app/components/editPostModal.jsx';
import EditCommentModal from '@/app/components/editCommentModal.jsx';
import EditReplyModal from '@/app/components/editReplyModal.jsx';


function BlogCard({ blog, onDeletePost, onUpdatePost }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(blog.comments || []);
  const [reply, setReply] = useState({});
  const [userId, setUserId] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(blog.likes?.length || 0);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [showEditCommentModal, setShowEditCommentModal] = useState(false);
  const [showEditReplyModal, setShowEditReplyModal] = useState(false);
  const [commentIdToEdit, setCommentIdToEdit] = useState(null);
  const [replyIdToEdit, setReplyIdToEdit] = useState(null);
  const [commentContext, setCommentContext] = useState(null);

  const pendingCommentsRef = useRef({});

  const notifyParent = (updatedFields) => {
    if (typeof onUpdatePost === "function") {
      const merged = { ...blog, comments, likes: blog.likes || [], ...updatedFields };
      onUpdatePost(merged);
    }
  };

  const handleEditReplyModal = (commentId, replyId, comment) => {
    setCommentIdToEdit(commentId);
    setReplyIdToEdit(replyId);
    setCommentContext(comment);
    setShowEditReplyModal(true);
  }

  const handleEditCommentModal = (commentId, comment) => {
    setCommentIdToEdit(commentId);
    setCommentContext(comment);
    setShowEditCommentModal(true);
  };

  const handleEditPostModal = () => {
    setShowEditPostModal(true);
  };

  const handleCloseModals = () => {
    setShowEditPostModal(false);
    setShowEditReplyModal(false);
    setShowEditCommentModal(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setLikes(blog.likes?.length || 0);
    if (userId) {
      setLiked(Boolean(blog.likes && blog.likes.includes(userId)));
    } else {
      setLiked(false);
    }
    setComments(blog.comments || []);
  }, [blog.likes, blog.comments, userId]);

  const handleChange = (event) => {
    setComment(event.target.value);
  };

  const handleReplyChange = (commentId, text) => {
    setReply((prev) => ({
      ...prev,
      [commentId]: text,
    }));
  };

  const toggleLike = async () => {
    try {
      const currentAuth = getAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser) {
        return;
      }

      const token = await currentUser.getIdToken();

      await axios.post(
        `http://localhost:3000/api/likes/${blog._id}`,
        {},
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const newLiked = !liked;
      const newLikesCount = newLiked ? likes + 1 : likes - 1;
      setLikes(newLikesCount);
      setLiked(newLiked);

      const newLikesArray = newLiked
        ? [...(blog.likes || []), userId]
        : (blog.likes || []).filter((id) => id !== userId);
      notifyParent({ likes: newLikesArray });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const makeTempId = (prefix = "temp") =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeReply = (raw, fallbackText = "", fallbackFirst = "You", fallbackLast = "") => {
    if (!raw) {
      return {
        _id: makeTempId("r"),
        comment: fallbackText,
        postedOn: new Date().toISOString(),
        postedBy: userId,
        firstName: fallbackFirst,
        lastName: fallbackLast,
      };
    }
    return {
      _id: raw._id || raw.id || makeTempId("r"),
      comment:
        raw.comment ??
        raw.text ??
        raw.body ??
        raw.content ??
        raw.commentText ??
        fallbackText ??
        "",
      postedOn: raw.postedOn || raw.createdAt || raw.created || new Date().toISOString(),
      postedBy: raw.postedBy || raw.author || userId,
      firstName: raw.firstName || (raw.postedByName ? raw.postedByName.split(" ")[0] : fallbackFirst),
      lastName: raw.lastName || (raw.postedByName ? raw.postedByName.split(" ")[1] || "" : fallbackLast),
      __optimistic: raw.__optimistic || false,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const currentAuth = getAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser) return;

      const displayName = currentUser.displayName || "";
      const [firstName = "You", lastName = ""] = displayName.split(" ");

      const tempId = makeTempId("c");
      const tempComment = {
        _id: tempId,
        comment,
        postedOn: new Date().toISOString(),
        postedBy: userId,
        firstName,
        lastName,
        replies: [],
        __optimistic: true,
      };

      let resolveFn;
      let rejectFn;
      const promise = new Promise((res, rej) => {
        resolveFn = res;
        rejectFn = rej;
      });
      pendingCommentsRef.current[tempId] = {
        promise,
        resolve: resolveFn,
        reject: rejectFn,
      };

      setComments((prev) => [tempComment, ...prev]);
      setComment("");

      const token = await currentUser.getIdToken();
      const params = new URLSearchParams();
      params.append("comment", comment);

      const res = await axios.post(
        `http://localhost:3000/api/comments/${blog._id}`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const created = res.data;

      if (created && created._id) {
        setComments((prev) =>
          prev.map((c) => {
            if (c._id === tempId) {
              const optimisticReplies = (c.replies || []).filter((r) => r.__optimistic);
              const serverReplies = created.replies || [];
              const mergedReplies = [
                ...serverReplies,
                ...optimisticReplies.filter(
                  (opt) => !serverReplies.some((sr) => sr._id === opt._id || sr._id === opt._id)
                ),
              ];
              return {
                ...created,
                replies: mergedReplies,
              };
            }
            return c;
          })
        );

        notifyParent({ comments: [created, ...(blog.comments || [])] });

        if (pendingCommentsRef.current[tempId]) {
          pendingCommentsRef.current[tempId].resolve(created._id);
          delete pendingCommentsRef.current[tempId];
        }
      } else {
        setComments((prev) =>
          prev.map((c) =>
            c._id === tempId ? { ...c, __optimistic: false } : c
          )
        );
        if (pendingCommentsRef.current[tempId]) {
          pendingCommentsRef.current[tempId].reject(
            new Error("Server did not return created comment id")
          );
          delete pendingCommentsRef.current[tempId];
        }
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      setComments((prev) => prev.filter((c) => !c.__optimistic));
      for (const tempId in pendingCommentsRef.current) {
        if (pendingCommentsRef.current[tempId]) {
          pendingCommentsRef.current[tempId].reject(error);
          delete pendingCommentsRef.current[tempId];
        }
      }
    }
  };

  const deleteComment = async (commentId) => {
    try {
      const currentAuth = getAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      await axios.get(
        `http://localhost:3000/api/comments/${blog._id}-${commentId}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setComments((prev) => prev.filter((c) => c._id !== commentId));

      notifyParent({ comments: comments.filter((c) => c._id !== commentId) });
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const deleteReply = async (replyId, commentId) => {
    try {
      const currentAuth = getAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      await axios.get(
        `http://localhost:3000/api/replies/${blog._id}-${commentId}-${replyId}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? {
                ...c,
                replies: (c.replies || []).filter((r) => r._id !== replyId),
              }
            : c
        )
      );

      const newComments = comments.map((c) =>
        c._id === commentId ? { ...c, replies: (c.replies || []).filter((r) => r._id !== replyId) } : c
      );
      notifyParent({ comments: newComments });
    } catch (error) {
      console.error("Error deleting reply:", error);
    }
  };

  const deletePost = async (postId) => {
    try {
      const currentAuth = getAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      await axios.get(
        `http://localhost:3000/api/blog/${postId}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (typeof onDeletePost === "function") {
        onDeletePost(postId);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleReply = async (event, commentId) => {
    event.preventDefault();

    try {
      const currentAuth = getAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser) return;

      const text = reply[commentId] || "";
      if (!text) return;

      const displayName = currentUser.displayName || "";
      const [firstName = "You", lastName = ""] = displayName.split(" ");

      const tempReplyId = makeTempId("r");
      const tempReply = {
        _id: tempReplyId,
        comment: text,
        postedOn: new Date().toISOString(),
        postedBy: userId,
        firstName,
        lastName,
        __optimistic: true,
      };

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, replies: [...(c.replies || []), tempReply] } : c
        )
      );

      setReply((prev) => ({ ...prev, [commentId]: "" }));

      let realCommentId = commentId;
      const pending = pendingCommentsRef.current[commentId];
      if (pending) {
        try {
          realCommentId = await pending.promise;
        } catch (err) {
          setComments((prev) =>
            prev.map((c) =>
              c._id === commentId
                ? { ...c, replies: (c.replies || []).filter((r) => r._id !== tempReplyId) }
                : c
            )
          );
          console.error("Cannot post reply:", err);
          return;
        }
      } else {
        const found = comments.find((c) => c._id === commentId || c._id === realCommentId);
        if (!found) {
          setComments((prev) =>
            prev.map((c) =>
              c._id === commentId
                ? { ...c, replies: (c.replies || []).filter((r) => r._id !== tempReplyId) }
                : c
            )
          );
          console.error("Parent comment not found.");
          return;
        }
      }

      const params = new URLSearchParams();
      params.append("commentId", realCommentId);
      params.append("comment", text);

      const token = await currentUser.getIdToken();

      const res = await axios.post(
        `http://localhost:3000/api/replies/${blog._id}`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const rawCreated = res?.data?.reply ?? res?.data ?? null;
      const created = normalizeReply(rawCreated, text, firstName, lastName);

      if (created && created._id) {
        setComments((prev) =>
          prev.map((c) => {
            if (c._id === commentId || c._id === realCommentId) {
              const replies = c.replies || [];
              const tempIndex = replies.findIndex((r) => r._id === tempReplyId);
              if (tempIndex !== -1) {
                const newReplies = replies.slice();
                newReplies[tempIndex] = { ...created };
                return { ...c, replies: newReplies };
              } else {
                const exists = replies.some((r) => r._id === created._id);
                if (!exists) {
                  return { ...c, replies: [...replies, created] };
                }
                return c;
              }
            }
            return c;
          })
        );

        const newComments = comments.map((c) => {
          if (c._id === commentId || c._id === realCommentId) {
            const replies = c.replies || [];
            const exists = replies.some((r) => r._id === created._id);
            if (!exists) return { ...c, replies: [...replies, created] };
            return c;
          }
          return c;
        });
        notifyParent({ comments: newComments });
      } else {
        setComments((prev) =>
          prev.map((c) =>
            c._id === realCommentId
              ? {
                  ...c,
                  replies: (c.replies || []).map((r) =>
                    r._id === tempReplyId ? { ...r, __optimistic: false } : r
                  ),
                }
              : c
          )
        );
      }
    } catch (error) {
      console.error("Error posting reply:", error);
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? { ...c, replies: (c.replies || []).filter((r) => !r.__optimistic) }
            : c
        )
      );
    }
  };

  const preview =
    (blog.body && blog.body.slice(0, 50)) +
    (blog.body && blog.body.length > 50 ? "..." : "");

  return (
    <div
      style={{
        justifyContent: "center",
        width: "400px",
        backgroundColor: "white",
        borderRadius: "2%",
        boxShadow: "5px 5px 10px rgba(0, 0, 0, 0.5)",
        margin: "0 auto",
      }}
    >
      <div>
        <h2>
          <b>
            {blog.title} - {blog.firstName} {blog.lastName}
          </b>
        </h2>
        <p>
          {expanded ? blog.body : preview}
          {!expanded && blog.body?.length > 50 && (
            <span
              onClick={(e) => {
                e.preventDefault();
                setExpanded(true);
              }}
            >
              Read more
            </span>
          )}
        </p>
        {blog.postedBy === userId && (
          <button onClick={() => deletePost(blog._id)}>Delete</button>
        )}
      </div>

      <p>{likes} Likes</p>

      {liked ? (
        <button onClick={toggleLike}>Liked</button>
      ) : (
        <button onClick={toggleLike}>Like</button>
      )}

      {blog.postedBy === userId && (
        <button onClick={handleEditPostModal}>Edit</button>
      )}
      
      <div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Comment"
            value={comment}
            onChange={handleChange}
            required
          />
          <input type="submit" value="Submit" />
        </form>

        {comments.map((comment) => (
          <div key={comment._id || comment.postedOn}>
            <p>
              <b>
                {comment.firstName} {comment.lastName}
              </b>{" "}
              {new Date(comment.postedOn).toLocaleDateString()}
              {comment.__optimistic && " (posting...)"}
            </p>
            {comment.postedBy === userId && (
                <button onClick={() => deleteComment(comment._id)}>Delete</button>
            )}
            {comment.postedBy === userId && (
                <button onClick={() => handleEditCommentModal(comment._id, comment.comment)}>Edit</button>
            )}
            <div style={{ marginLeft: "20px" }}>
              <p>{comment.comment}</p>
              <form onSubmit={(e) => handleReply(e, comment._id)}>
                <input
                  type="text"
                  placeholder="Reply"
                  value={reply[comment._id] || ""}
                  onChange={(e) => handleReplyChange(comment._id, e.target.value)}
                  required
                />
                <input type="submit" />
              </form>

              {(comment.replies || []).map((rep) => (
                <div key={rep._id || rep.postedOn}>
                  <p>
                    <b>
                      {rep.firstName} {rep.lastName}
                    </b>{" "}
                    {new Date(rep.postedOn).toLocaleDateString()}
                    {rep.__optimistic && " (posting...)"}
                  </p>
                  {rep.postedBy === userId && (
                    <button onClick={() => handleEditReplyModal(comment._id, rep._id, rep.comment)}>Edit</button>
                  )}
                  {rep.postedBy === userId && (
                    <button onClick={() => deleteReply(rep._id, comment._id)}>Delete</button>
                  )}
                  <div style={{ marginLeft: "20px" }}>
                    <p>{rep.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <EditPostModal
        isOpen={showEditPostModal}
        handleClose={handleCloseModals}
        blogId={blog._id}
        onEdit={(updated) => {
          if (updated) {
            notifyParent(updated);
          }
          handleCloseModals();
        }}
      />
      <EditCommentModal
        isOpen={showEditCommentModal}
        handleClose={handleCloseModals}
        blogId={blog._id}
        commentId={commentIdToEdit}
        initialBody={commentContext ? commentContext : ""}
        onSaved={(updatedComment) => {
          setComments((prev) => prev.map((c) => (c._id === updatedComment._id ? updatedComment : c)));
          notifyParent({ comments: comments.map((c) => (c._id === updatedComment._id ? updatedComment : c)) });
        }}
      />
      <EditReplyModal
        isOpen={showEditReplyModal}
        handleClose={handleCloseModals}
        blogId={blog._id}
        commentId={commentIdToEdit}
        replyId={replyIdToEdit}
        initialBody={commentContext ? commentContext : ""}
        onSaved={(commentId, updatedReply) => {
          setComments((prev) =>
            prev.map((c) =>
              c._id === commentId
                ? { ...c, replies: (c.replies || []).map((r) => (r._id === updatedReply._id ? updatedReply : r)) }
                : c
            )
          );
          notifyParent({ comments });
        }}
      />
    </div>
  );
}

export default BlogCard;
