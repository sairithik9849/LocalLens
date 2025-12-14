import * as homepageData from '@/lib/homepage.js';
import admin from "@/firebase/firebaseAuth";

function splitString(input) {
    const parts = input.split('-').filter(part => part !== '');
    
    while (parts.length < 3) {
        parts.push('');
    }

    return parts.slice(0, 3);
}


export async function POST(req, { params }) {

    try {
        const { reply } = await params;
        const text = await req.text();
        let userData = Object.fromEntries(new URLSearchParams(text));
        const authHeader = req.headers.get("authorization");
        
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
           return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const idToken = authHeader.split(" ")[1];        
            
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 
        
        let blogPost = await homepageData.addReply(reply, userData.commentId, userData.comment, uid);
        return new Response(JSON.stringify(blogPost), { status: 200 });
         
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
    }
}

export async function PATCH(req, { params }) {

    try {
        const { reply } = await params;
        const text = await req.text();
        let userData = Object.fromEntries(new URLSearchParams(text));
        const authHeader = req.headers.get("authorization");
        
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
           return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const idToken = authHeader.split(" ")[1];        
            
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 
        
        let blogPost = await homepageData.patchReply(reply, userData.commentId, userData.replyId, userData.comment, uid);
        return new Response(JSON.stringify(blogPost), { status: 200 });
         
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
    }
}



export async function GET(req, { params }) {
    try {
        const { reply } = await params;
        const authHeader = req.headers.get("authorization");
        
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
           return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const idToken = authHeader.split(" ")[1];        
            
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 
        let arr = splitString(reply);

        console.log(arr);
        
        let newPost = await homepageData.deleteReply(arr[0], arr[1], arr[2], uid);      
        return new Response(JSON.stringify(newPost), { status: 200 });
         
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
    }
}
