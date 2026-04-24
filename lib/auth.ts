import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: "jwt", maxAge: 86400 },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const client = await clientPromise;
        const db = client.db("dammage");
        const user = await db.collection("users").findOne({ email: credentials.email });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password as string,
        );

        if (!passwordMatch) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image ?? null,
        };
      },
    }),
  ],
});
