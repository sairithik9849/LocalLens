import * as adminData from '@/lib/admin.js';
import admin from "@/firebase/firebaseAuth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
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

    const reportInfo = await adminData.getPageOfReports(page, pageSize, uid);

    return NextResponse.json(reportInfo, {status: 200})
  } catch (err) {
  console.error(err);
  return NextResponse.json({ error: "Failed to get reports" }, { status: 500 });
}}