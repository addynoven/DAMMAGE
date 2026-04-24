import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DetectionItem {
  label: string;
  confidence: number;
  box: DetectionBox;
}

interface DetectionDoc {
  _id: ObjectId;
  userId: string;
  type: "road" | "waste";
  imageUrl: string | null;
  width: number;
  height: number;
  detections: DetectionItem[];
  createdAt: Date;
}

interface UserDoc {
  _id: ObjectId;
  email: string;
  role?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db("dammage");

  const caller = await db.collection<UserDoc>("users").findOne({
    _id: new ObjectId(session.user.id),
  });

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const skip = parseInt(searchParams.get("skip") ?? "0", 10);

  const col = db.collection<DetectionDoc>("detections");

  const [docs, total] = await Promise.all([
    col.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments({}),
  ]);

  // Collect unique userIds and fetch matching user emails in one query
  const userIds = [...new Set(docs.map((d) => d.userId))];
  const userDocs = await db
    .collection<UserDoc>("users")
    .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } })
    .project<Pick<UserDoc, "_id" | "email">>({ email: 1 })
    .toArray();

  const emailById = new Map(userDocs.map((u) => [u._id.toString(), u.email]));

  const detections = docs.map(({ _id, ...rest }) => ({
    id: _id.toString(),
    userId: rest.userId,
    userEmail: emailById.get(rest.userId) ?? "unknown",
    type: rest.type,
    imageUrl: rest.imageUrl,
    width: rest.width,
    height: rest.height,
    detections: rest.detections,
    createdAt: rest.createdAt,
  }));

  return NextResponse.json({ detections, total });
}
