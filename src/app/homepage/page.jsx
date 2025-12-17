'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import BlogCard from "@/app/components/blogCard.jsx";
import { useAuth } from "@/firebase/AuthContext";
import { getAuth } from "firebase/auth";
import { auth } from "@/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import CreatePostModal from "@/app/components/CreatePostModal";

export default function Homepage() {
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const handleOpenCreatePostModal = () => setShowCreateModal(true);
  const handleCloseModals = () => setShowCreateModal(false);

  const handleAddPost = (newPost) => {
    if (!newPost) return;
    setPosts((prev) => {
      if (!newPost._id) return [newPost, ...prev];
      const exists = prev.some((p) => p._id === newPost._id);
      return exists ? prev : [newPost, ...prev];
    });
  };

  const handleUpdatePost = (updatedPost) => {
    if (!updatedPost) return;
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
    setSearchResults((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  };

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    setSearchResults((prev) => prev.filter((p) => p._id !== postId));
  };

  const fetchPosts = async (pageNum) => {
    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) return;

      const token = await current.getIdToken();

      const { data } = await axios.get("/api/homepage/", {
        params: { page: pageNum },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!Array.isArray(data) || data.length === 0) {
        if (pageNum > 1) setHasMore(false);
        return;
      }

      setPosts((prev) => {
        const existingIds = new Set(prev.filter(Boolean).map((p) => p._id).filter(Boolean));
        const newUnique = data.filter((item) => {
          if (!item) return false;
          if (!item._id) return true;
          return !existingIds.has(item._id);
        });
        if (newUnique.length === 0 && pageNum > 1) setHasMore(false);
        return [...prev, ...newUnique];
      });
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (!searchQuery) fetchPosts(page);
  }, [page, searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore || searchQuery.trim().length > 0) return;

      const bottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 200;

      if (bottom) {
        setLoadingMore(true);
        setPage((prev) => prev + 1);
        setTimeout(() => setLoadingMore(false), 400);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadingMore, hasMore, searchQuery]);

  useEffect(() => {
    const doSearch = async () => {
      const q = searchQuery.trim();
      if (!q) {
        setSearchResults([]);
        return;
      }

      try {
        const currentAuth = getAuth();
        const currentUser = currentAuth.currentUser;
        if (!currentUser) {
          return;
        }
        
        const token = await currentUser.getIdToken();
        
        const { data } = await axios.get(`http://localhost:3000/api/search/${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.log(err);
      }
    };

    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setPage(1);
      setHasMore(true);
      setPosts([]);
    }
  }, [searchQuery]);

  if (loading) {
    return (
      <div>
        <span></span>
      </div>
    );
  }

  if (!user) return null;

  const itemsToDisplay = searchQuery ? searchResults : posts;

  return (
    <div>
      <button onClick={handleOpenCreatePostModal}>Create Post</button>

      <form onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="Search Posts"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      <div>
        {itemsToDisplay.map((item, idx) => {
          const idPart = item && item._id ? item._id : `no-id-${idx}`;
          const key = `${idPart}-${idx}`;
          return (
            <BlogCard
              blog={item}
              key={key}
              onDeletePost={handleDeletePost}
              onUpdatePost={handleUpdatePost}
            />
          );
        })}
      </div>

      {!searchQuery && loadingMore && (
        <div>Loading...</div>
      )}

      {!searchQuery && !hasMore && posts.length > 0 && (
        <div>You’ve reached the end</div>
      )}

      <CreatePostModal
        isOpen={showCreateModal}
        handleClose={handleCloseModals}
        onCreate={handleAddPost}
      />
    </div>
  );
}
