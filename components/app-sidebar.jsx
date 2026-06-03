"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Mic,
  Music,
  Trophy,
  Settings,
  Target,
  Sparkles,
  Star,
  Lock,
  LogOut,
  Calendar,
  Map,
  AudioWaveform,
} from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./progress-ring.jsx";
import { apiRequest } from "@/lib/query-client.js";
import { useLanguage } from "@/lib/language-context.jsx";

export function AppSidebar({ user }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const phaseProgress = user
    ? {
      1: user.currentPhase > 1 ? 100 : 0,
      2: user.currentPhase > 2 ? 100 : 0,
      3: user.currentPhase > 3 ? 100 : 0,
    }
    : { 1: 0, 2: 0, 3: 0 };

  const mainNavItems = [
    { title: t.nav.dashboard, url: "/dashboard", icon: Home },
    { title: t.nav.learningPaths, url: "/learning-paths", icon: Map },
    { title: "Challenges", url: "/challenges", icon: Trophy, isComingSoon: true },
    { title: t.nav.practice, url: "/practice", icon: Mic },
    { title: t.nav.voiceAnalysis, url: "/analysis", icon: Mic },
    { title: t.nav.routinePlanner, url: "/routine-planner", icon: Calendar },
  ];

  const phases = [
    {
      id: 1,
      title: t.nav.foundation,
      url: "/phase/1",
      icon: Target,
      unlocked: user ? user.currentPhase >= 1 : true,
    },
    {
      id: 2,
      title: t.nav.technique,
      url: "/phase/2",
      icon: Sparkles,
      unlocked: user ? user.currentPhase >= 2 : false,
    },
    {
      id: 3,
      title: t.nav.performance,
      url: "/phase/3",
      icon: Star,
      unlocked: user ? user.currentPhase >= 3 : false,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">SingSmart AI</h1>
              <p className="text-xs text-muted-foreground">{t.appTagline}</p>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                      className="transition-all duration-300"
                    >
                      <Link href={item.url} className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <item.icon className={cn(
                            "h-5 w-5 mr-2 transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )} />
                          <span className={cn(
                            "font-medium transition-colors",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>{item.title}</span>
                        </div>
                        {item.isComingSoon && (
                          <span className="text-[9px] uppercase tracking-wider font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-2">
                            Soon
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t.nav.learningPhases}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {phases.map((phase) => {
                const isActive = pathname === phase.url;
                return (
                  <SidebarMenuItem key={phase.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      disabled={!phase.unlocked}
                      data-testid={`nav-phase-${phase.id}`}
                      className="transition-all duration-300"
                    >
                      <Link
                        href={phase.unlocked ? phase.url : "#"}
                        className={!phase.unlocked ? "cursor-not-allowed" : ""}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {phase.unlocked ? (
                            <phase.icon className={cn(
                              "h-5 w-5 transition-colors",
                              isActive ? "text-primary" : "text-muted-foreground"
                            )} />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "font-medium transition-colors",
                            !phase.unlocked ? "text-muted-foreground" : isActive ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {phase.title}
                          </span>
                        </div>
                        {phase.unlocked && (
                          <ProgressRing
                            progress={phaseProgress[phase.id]}
                            size={24}
                            strokeWidth={3}
                            showLabel={false}
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t.nav.performance}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/songs"}
                  disabled={!user || user.currentPhase < 2}
                  data-testid="nav-songs"
                  className="transition-all duration-300"
                >
                  <Link
                    href={user && user.currentPhase >= 2 ? "/songs" : "#"}
                    className={!user || user.currentPhase < 2 ? "cursor-not-allowed" : ""}
                  >
                    {!user || user.currentPhase < 2 ? (
                      <Lock className="h-5 w-5 mr-2 text-muted-foreground" />
                    ) : (
                      <Music className={cn(
                        "h-5 w-5 transition-colors",
                        pathname === "/songs" ? "text-primary" : "text-muted-foreground"
                      )} />
                    )}
                    <span className={cn(
                      "font-medium transition-colors",
                      !user || user.currentPhase < 2 ? "text-muted-foreground" :
                      pathname === "/songs" ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {t.nav.songLibrary}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/perform"}
                  disabled={!user || user.currentPhase < 3}
                  data-testid="nav-perform"
                  className="transition-all duration-300"
                >
                  <Link
                    href={user && user.currentPhase >= 3 ? "/perform" : "#"}
                    className={!user || user.currentPhase < 3 ? "cursor-not-allowed" : ""}
                  >
                    {!user || user.currentPhase < 3 ? (
                      <Lock className="h-5 w-5 mr-2 text-muted-foreground" />
                    ) : (
                      <Trophy className={cn(
                        "h-5 w-5 transition-colors",
                        pathname === "/perform" ? "text-primary" : "text-muted-foreground"
                      )} />
                    )}
                    <span className={cn(
                      "font-medium transition-colors",
                      !user || user.currentPhase < 3 ? "text-muted-foreground" :
                      pathname === "/perform" ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {t.nav.virtualStage}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {user.experienceLevel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/settings">
                <Settings className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
              </Link>
              <button
                onClick={async () => {
                  await apiRequest("POST", "/api/logout");
                  window.location.href = "/";
                }}
                className="p-1 hover:bg-destructive/10 rounded-md transition-colors"
                title="Log out"
              >
                <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" />
              </button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
