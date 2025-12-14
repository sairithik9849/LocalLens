import * as homepageData from '@/lib/homepage.js'
import admin from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";


export async function POST(req, { params }) {
   try {
      const { like } = await params || {};
      const text = await req.text();
      let userData = Object.fromEntries(new URLSearchParams(text));
      console.log(userData);

      const authHeader = req.headers.get("authorization");
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const idToken = authHeader.split(" ")[1];
      
          
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid; 

      let newPost = await homepageData.toggleLike(like, uid);
      return new Response(JSON.stringify(newPost), { status: 201 });
      
   } catch (error) {
      console.error(error);
      return new Response('Internal Server Error', { status: 500 });
   }
}

export async function GET() {
   return new Response(JSON.stringify({ message: 'test' }), { status: 200 });
}
