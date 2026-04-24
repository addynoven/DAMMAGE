import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  const session = await auth();
  const client = await clientPromise;
  const db = client.db("dammage");

  let dbUser = null;
  if (session?.user?.email) {
    dbUser = await db.collection("users").findOne(
      { email: session.user.email },
      { projection: { password: 0 } }
    );
  }

  return NextResponse.json({
    session,
    dbUser: dbUser ? { ...dbUser, _id: dbUser._id.toString() } : null,
  });
}
