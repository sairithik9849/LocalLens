import * as adminData from '@/lib/admin.js';
import admin, { initializeAdmin } from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";


export async function POST(req, { params }) {
  try {
    // Ensure Firebase Admin is initialized before use
    await initializeAdmin();
    
    const { id } = await params || {};
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


    if (!id) {
      return NextResponse.json({ error: "Missing route param: id" }, { status: 400 });
    }
    if (!userData?.reason) {
      return NextResponse.json({ error: "Missing body field: reason" }, { status: 400 });
    }

    const reportResult = await adminData.reportBlog(id, userData.reason, uid);

    return NextResponse.json(reportResult, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to report blog" }, { status: 500 });
  }
};


