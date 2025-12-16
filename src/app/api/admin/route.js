import * as adminData from '@/lib/admin.js';
import admin, { initializeAdmin } from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    // Try to initialize admin, but don't fail if credentials are missing
    try {
      await initializeAdmin();
    } catch (initError) {
      // If initialization fails (e.g., missing credentials), just return false
      // Don't log as error since this is expected in some environments
      if (initError.message?.includes('Missing Firebase Admin credentials')) {
        return NextResponse.json(false, { status: 200 });
      }
      // For other init errors, still return false but log it
      console.warn('Firebase Admin initialization warning:', initError.message);
      return NextResponse.json(false, { status: 200 });
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];

    
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid; 

    const isAdmin = await adminData.isUserAdmin(uid);

    // Always return a boolean, even if there was an error (isUserAdmin returns false on error)
    return NextResponse.json(isAdmin === true, {status: 200})
  } catch (err) {
    // For any error, return false instead of 500 to prevent error display for non-admin users
    // This includes Firebase auth errors, MongoDB errors, etc.
    // Only log non-credential errors to reduce noise
    if (!err.message?.includes('Missing Firebase Admin credentials')) {
      console.error('Admin check error:', err);
    }
    return NextResponse.json(false, { status: 200 });
  }
}

export async function POST(req) {
  try {
      // Try to initialize admin, but fail gracefully if credentials are missing
      try {
        await initializeAdmin();
      } catch (initError) {
        if (initError.message?.includes('Missing Firebase Admin credentials')) {
          return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 503 });
        }
        throw initError;
      }
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
        


    if (!userData?.reportId) {
      return NextResponse.json({ error: "Missing body field: blogId" }, { status: 400 });
    }

    const reportResult = await adminData.ignoreReport(userData.reportId, uid);

    return NextResponse.json(reportResult, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete blog" }, { status: 500 });
  }
};

export async function DELETE(req) {
  try {
    // Try to initialize admin, but fail gracefully if credentials are missing
    try {
      await initializeAdmin();
    } catch (initError) {
      if (initError.message?.includes('Missing Firebase Admin credentials')) {
        return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 503 });
      }
      throw initError;
    }
    const url = new URL(req.url)
    const blogId = url.searchParams.get('blogId')
        const authHeader = req.headers.get("authorization");

        console.log(req.headers)

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split(" ")[1];

    
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid; 

    if (!blogId) {
      return NextResponse.json({ error: "Missing body field: blogId" }, { status: 400 });
    }

    const reportResult = await adminData.deletePostByReport(blogId, uid);

    return NextResponse.json(reportResult, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete blog" }, { status: 500 });
  }
};