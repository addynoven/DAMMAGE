import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

const registerAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registerAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    registerAttempts.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  if (checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!/[0-9!@#$%^&*]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one number or special character" },
      { status: 400 },
    );
  }

  const client = await clientPromise;
  const db = client.db("dammage");

  const existing = await db.collection("users").findOne({ email });
  if (existing) {
    return NextResponse.json({ error: "Registration failed" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await db.collection("users").insertOne({
    name,
    email,
    password: hashedPassword,
    image: null,
    emailVerified: null,
    createdAt: new Date(),
  });

  return NextResponse.json(
    { id: result.insertedId.toString(), email, name },
    { status: 201 },
  );
}
