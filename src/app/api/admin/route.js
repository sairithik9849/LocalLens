import * as adminData from '@/lib/admin.js';
import admin from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];

    
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid; 

    const reportInfo = await adminData.isUserAdmin(uid);
    console.log(reportInfo);

    return NextResponse.json(reportInfo, {status: 200})
  } catch (err) {
  console.error(err);
  return NextResponse.json({ error: "Failed to get reports" }, { status: 500 });
}}

export async function POST(req) {
  try {
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