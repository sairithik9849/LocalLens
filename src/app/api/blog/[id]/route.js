import * as homepageData from '@/lib/homepage.js';
import admin from "@/firebase/firebaseAuth";


export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const authHeader = req.headers.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split(" ")[1];

    
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 
        const newPost = await homepageData.deleteBlog(id, uid);      
        return new Response(JSON.stringify(newPost), { status: 200 });
    } catch (error) {
        console.error(error);
        return new Response('Error updating blog post', { status: 500 });
    }
}


export async function POST(req, { params }) {
    try {
            const { id } = await params;
        const text = await req.text();
        let userData = Object.fromEntries(new URLSearchParams(text));
        const authHeader = req.headers.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split(" ")[1];

    
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid;

        const newPost = await homepageData.postBlog(userData.title, userData.body, id, uid);      
        return new Response(JSON.stringify(newPost), { status: 200 });
    } catch (error) {
        console.error(error);
        return new Response('Error updating blog post', { status: 500 });
    }
}
