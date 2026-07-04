import { verifySession } from "../../server/session.js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { storage } from "../../server/storage.js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar.jsx";
import { ThemeToggle } from "@/components/theme-toggle.jsx";
import { UserMenu } from "@/components/user-menu.jsx";
import { LanguageToggle } from "@/components/language-toggle.jsx";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();
  const userId = verifySession(cookieStore.get("userId")?.value);

  console.log(`[DEBUG] DashboardLayout: userId=${userId}`);
  if (!userId) {
    redirect("/auth");
  }

  console.log(`[DEBUG] DashboardLayout: Fetching user for userId=${userId}`);
  const user = await storage.getUser(userId);

  console.log(`[DEBUG] DashboardLayout: user found=${!!user}`);
  if (!user) {
    // Session exists but user deleted?
    redirect("/auth");
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <UserMenu user={user} />
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
