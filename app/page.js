import { verifySession } from "../server/session.js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Landing from "@/components/landing.jsx";

export default async function IndexPage() {
  const cookieStore = await cookies();
  const userId = verifySession(cookieStore.get("userId")?.value);

  if (userId) {
    redirect("/dashboard");
  }

  return <Landing />;
}
