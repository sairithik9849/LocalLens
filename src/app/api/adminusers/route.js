import * as adminData from '@/lib/admin.js';
import admin, { initializeAdmin } from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initializeAdmin();
    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10')
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];

    
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid; 

    const reportInfo = await adminData.getPageOfUsersByAdmin(page, pageSize, uid);

    return NextResponse.json(reportInfo, {status: 200})
  } catch (err) {
  console.error(err);
  return NextResponse.json({ error: "Failed to get reports" }, { status: 500 });
}}


export async function POST(req) {
  try {
      await initializeAdmin();
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
        


    if (!userData?.targetId) {
      return NextResponse.json({ error: "Missing body field: blogId" }, { status: 400 });
    }

    console.log("TARGET ID:", userData.targetId, userData.reason);

    const reportResult = await adminData.toggleBanUser(userData.targetId, userData.reason || null, uid);

    return NextResponse.json(reportResult, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete blog" }, { status: 500 });
  }
};