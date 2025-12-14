import * as homepageData from '@/lib/homepage.js';
import admin from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";


export async function GET(req, { params }) {
   try {
    const { query } = await params || {};
    const authHeader = req.headers.get("authorization");
      
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
      
    const idToken = authHeader.split(" ")[1];
      
          
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
      
    const newPost = await homepageData.searchPosts(query, uid);
    return new Response(JSON.stringify(newPost), { status: 201 });
   } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500 });
   }
}