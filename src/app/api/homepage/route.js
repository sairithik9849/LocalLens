import * as homepageData from '@/lib/homepage.js';
import { parse } from 'querystring';
import admin from "@/firebase/firebaseAuth";


export async function POST(req) {
   const body = await req.text(); 
   const userData = parse(body); 
   console.log(userData);

   try {
      const authHeader = req.headers.get("authorization");
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const idToken = authHeader.split(" ")[1];
      
          
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid; 
      
      const newPost = await homepageData.createBlog(
         userData.title,
         userData.body,
         uid
         );
      return new Response(JSON.stringify(newPost), { status: 201 });
   } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500 });
   }
}

export async function GET(req) {
   const { searchParams } = new URL(req.url);
   const page = searchParams.get('page');
   const location = searchParams.get('location');


   try {
      const authHeader = req.headers.get("authorization");
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const idToken = authHeader.split(" ")[1];
      
          
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid; 
      const blogs = await homepageData.getPageOfBlogs(page, uid);
      return new Response(JSON.stringify(blogs), { status: 200 });
   } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500 });
   }
}

export async function PATCH(req) {
   const body = await req.text(); // Get the raw body as text
   const userData = parse(body); // Parse the URL-encoded string
   console.log(userData);

   try {
      const updatedPost = await homepageData.patchBlog(userData.title, userData.body);
      return new Response(JSON.stringify(updatedPost), { status: 200 });
   } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500 });
   }
}
