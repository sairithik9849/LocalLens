import * as homepageData from '@/lib/homepage.js';
import admin, { initializeAdmin } from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";

function splitString(input) {
    const parts = input.split('-').filter(part => part !== '');
    while (parts.length < 3) {
        parts.push('');
    }
    return parts.slice(0, 3);
}


export async function POST(req, { params }) {
  try {
    await initializeAdmin();
    const { comment } = await params || {};
      const text = await req.text();
      let userData = Object.fromEntries(new URLSearchParams(text));
        const authHeader = req.headers.get("authorization");

        console.log(req.headers)

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split(" ")[1];

    
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 

    if (!comment) {
      return NextResponse.json({ error: "Missing route param: comment" }, { status: 400 });
    }
    if (!userData?.comment) {
      return NextResponse.json({ error: "Missing body field: comment" }, { status: 400 });
    }

    const newPost = await homepageData.addComment(comment, userData.comment, uid);

    return NextResponse.json(newPost, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initializeAdmin();
    const { comment } = await params || {};
      const text = await req.text();
      let userData = Object.fromEntries(new URLSearchParams(text));
        const authHeader = req.headers.get("authorization");

        console.log(req.headers)

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split(" ")[1];

    
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 

    if (!comment) {
      return NextResponse.json({ error: "Missing route param: comment" }, { status: 400 });
    }
    if (!userData?.comment) {
      return NextResponse.json({ error: "Missing body field: comment" }, { status: 400 });
    }

    const newPost = await homepageData.patchComment(comment, userData.commentId, userData.comment, uid);

    return NextResponse.json(newPost, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}


export async function GET(req, { params }) {
    try {
        await initializeAdmin();
        const { comment } = await params;
        const authHeader = req.headers.get("authorization");

        console.log(req.headers)

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split(" ")[1];

    
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 
        console.log(comment);

        const arr = splitString(comment);
        console.log(arr);
        const newPost = await homepageData.deleteComment(arr[0], arr[1], uid);
        return new Response(JSON.stringify(newPost), { status: 200 });
    } catch (error) {
        console.error(error);
        return new Response("Failed to delete comment", { status: 500 });
    }
}



