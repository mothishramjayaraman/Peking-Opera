"use client";

import { useRouter } from "next/navigation";
import {
  Mic,
  Music,
  Star,
  Sparkles,
  Target,
  ChevronRight,
  Play,
  Award,
  ShieldCheck,
  Zap,
  Twitter,
  Instagram,
  Github,
  Youtube,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ThemeToggle } from "./theme-toggle.jsx";
import { LanguageToggle } from "./language-toggle.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 },
  },
};

const FloatingElement = ({ children, delay = 0, duration = 4 }) => (
  <motion.div
    animate={{
      y: [0, -20, 0],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    }}
  >
    {children}
  </motion.div>
);

export default function Landing() {
  const router = useRouter();

  const features = [
    {
      title: "Real-time Pitch AI",
      description:
        "Visual feedback on your pitch accuracy as you sing, helping you hit every note perfectly.",
      icon: Target,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      glow: "group-hover:shadow-blue-500/20",
    },
    {
      title: "AI Vocal Coach",
      description:
        "Get personalized feedback based on your recordings, improving your tone and breathing.",
      icon: Sparkles,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      glow: "group-hover:shadow-purple-500/20",
    },
    {
      title: "Virtual Stage",
      description:
        "Experience the thrill of performance with simulated audience reactions and stage effects.",
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      glow: "group-hover:shadow-yellow-500/20",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Vocal Analysis",
      description:
        "Take our initial assessment to find your range and skill level.",
    },
    {
      number: "02",
      title: "Guided Practice",
      description:
        "Follow a curriculum-based path from Foundation to Performance.",
    },
    {
      number: "03",
      title: "Song Mastery",
      description:
        "Practice with a library of curated songs and track your progress.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-blue-400/10 blur-[100px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.15] dark:opacity-[0.05]" />
      </div>

      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              SingSmart<span className="text-primary italic">AI</span>
            </span>
          </motion.div>
          <div className="hidden md:flex items-center gap-8">
            <nav className="flex items-center gap-6">
              {["Features", "How it Works"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors relative group"
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LanguageToggle />
              <Button
                onClick={() => router.push("/auth?tab=login")}
                variant="ghost"
                size="sm"
                className="rounded-full font-bold"
              >
                Log In
              </Button>
              <Button
                onClick={() => router.push("/auth?tab=register")}
                variant="default"
                size="sm"
                className="rounded-full px-6 font-bold shadow-xl shadow-primary/20 bg-primary hover:scale-105 transition-transform"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-40 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Badge
                variant="outline"
                className="mb-8 border-primary/20 bg-primary/5 text-primary px-6 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase"
              >
                <Sparkles className="w-4 h-4 mr-2 inline" />
                Next-Gen Vocal Training
              </Badge>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9] lg:leading-[0.85]">
                Unlock Your Voice <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-600">
                  With Precision AI
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground/80 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                Master your craft with real-time feedback, personalized
                coaching, and a virtual stage. The future of singing is here.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Button
                  size="lg"
                  className="rounded-full px-10 h-16 text-xl font-black group shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 hover:scale-105 transition-all"
                  onClick={() => router.push("/auth?tab=register")}
                >
                  Start Training Free
                  <ChevronRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Button>
                <div className="flex -space-x-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-background bg-muted overflow-hidden"
                    >
                      <img
                        src={`https://i.pravatar.cc/100?img=${i + 10}`}
                        alt="User"
                      />
                    </div>
                  ))}
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                    3k+
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Decorative Floating Notes */}
        <div className="absolute top-1/4 left-10 opacity-20 hidden lg:block">
          <FloatingElement delay={0} duration={5}>
            <Music className="w-12 h-12 text-primary rotate-12" />
          </FloatingElement>
        </div>
        <div className="absolute bottom-1/4 right-10 opacity-20 hidden lg:block">
          <FloatingElement delay={1} duration={6}>
            <Mic className="w-16 h-16 text-purple-500 -rotate-12" />
          </FloatingElement>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 bg-card/30 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-12 shadow-2xl">
            {[
              { label: "Active Singers", value: "50,000+", icon: Target },
              { label: "AI Suggestions", value: "2k+", icon: Sparkles },
              { label: "Library Songs", value: "15+", icon: Music },
              { label: "Satisfaction", value: "80%", icon: Award },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <div className="flex justify-center mb-4">
                  <stat.icon className="w-6 h-6 text-primary/40 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-4xl font-black mb-2 tracking-tighter group-hover:scale-110 transition-transform">
                  {stat.value}
                </p>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20 space-y-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-black tracking-tighter"
            >
              Training Built For{" "}
              <span className="italic text-primary">Your Performance</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground max-w-2xl mx-auto text-xl font-medium"
            >
              Our proprietary AI engine analyzes every nuance of your
              performance to provide unmatched precision and growth.
            </motion.p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-3 gap-8"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -15, scale: 1.02 }}
                className="group h-full"
              >
                <Card
                  className={`h-full border-white/10 bg-card/40 backdrop-blur-md transition-all duration-500 overflow-hidden relative shadow-xl hover:shadow-2xl ${feature.glow}`}
                >
                  <div
                    className={`absolute top-0 right-0 w-32 h-32 ${feature.bg} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  <CardContent className="p-10 space-y-6 relative z-10">
                    <div
                      className={`w-16 h-16 rounded-2xl ${feature.bg} flex items-center justify-center transition-transform duration-500 group-hover:rotate-12`}
                    >
                      <feature.icon className={`h-8 w-8 ${feature.color}`} />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed font-medium">
                        {feature.description}
                      </p>
                    </div>
                    <div className="pt-4">
                      <Button
                        variant="link"
                        className="p-0 font-bold group/btn text-primary"
                      >
                        Learn more{" "}
                        <ChevronRight className="ml-1 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Tech Preview Section */}
      <section className="py-32 bg-primary dark:bg-primary/95 text-primary-foreground overflow-hidden relative rounded-[5rem] mx-4 shadow-3xl">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-20%] -left-1/4 w-[1200px] h-[1200px] border-[40px] border-white/10 rounded-full animate-[spin_60s_linear_infinite]" />
          <div className="absolute bottom-[-20%] -right-1/4 w-[1000px] h-[1000px] border-[20px] border-white/10 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <motion.h2
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter"
              >
                Visualize Every <br />
                <span className="opacity-40 italic">Millisecond</span>
              </motion.h2>
              <p className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed font-medium max-w-lg">
                Our high-fidelity pitch detection engine visualizes your voice
                60 times per second with ultra-low latency.
              </p>
              <div className="grid gap-6">
                {[
                  { icon: Zap, label: "60ms Real-time Feedback" },
                  { icon: Award, label: "Studio-Grade Accuracy" },
                  { icon: ShieldCheck, label: "Smart Vocal Health AI" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 w-fit"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <span className="font-bold text-lg">{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/3] bg-black/40 rounded-[3rem] border border-white/20 backdrop-blur-2xl flex flex-col p-10 shadow-3xl overflow-hidden relative group">
                {/* Visualizer Header */}
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-black tracking-widest text-white/60 uppercase">
                      System Active
                    </span>
                  </div>
                  <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black">
                    LATENCY: 12ms
                  </div>
                </div>

                {/* Visualizer Waves */}
                <div className="flex-1 flex items-end gap-1.5 pb-10">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: [
                          "20%",
                          `${Math.random() * 60 + 20}%`,
                          `${Math.random() * 40 + 10}%`,
                          "25%",
                        ],
                        backgroundColor: [
                          "rgba(255,255,255,0.2)",
                          "rgba(255,100,255,0.4)",
                          "rgba(100,200,255,0.4)",
                          "rgba(255,255,255,0.2)",
                        ],
                      }}
                      transition={{
                        duration: 1.5 + Math.random(),
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.03,
                      }}
                      className="flex-1 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    />
                  ))}
                </div>

                {/* Grid Overlay */}
                <div className="absolute inset-x-0 bottom-20 h-[100px] border-y border-white/5 bg-white/[0.02]" />

                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <Play className="w-4 h-4 fill-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black opacity-50 uppercase">
                        Now Playing
                      </p>
                      <p className="text-sm font-bold">Bohemian Rhapsody</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary italic">
                      98.4
                    </p>
                    <p className="text-[10px] font-black opacity-40 uppercase">
                      Pitch Score
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter italic">
              Simple Path to{" "}
              <span className="text-primary not-italic">Mastery</span>
            </h2>
            <p className="text-muted-foreground text-xl font-medium">
              Elevate your performance in three seamless stages
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-16 relative">
            <div className="hidden md:block absolute top-[60px] left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10" />

            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-24 h-24 rounded-[2rem] bg-card border border-white/10 flex items-center justify-center text-3xl font-black shadow-2xl group-hover:bg-primary group-hover:text-primary-foreground group-hover:rotate-6 transition-all duration-500">
                  {step.number}
                </div>
                <h3 className="text-2xl font-black pt-8 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-[280px] mt-4">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 mb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-[4rem] p-16 md:p-24 border border-white/10 shadow-3xl text-center space-y-12 relative overflow-hidden group"
          >
            {/* Background Glow */}
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/10 blur-[120px] rounded-full group-hover:bg-primary/20 transition-colors duration-1000" />

            <div className="max-w-3xl mx-auto space-y-8 relative z-10">
              <h2 className="text-5xl md:text-8xl font-black leading-[0.85] tracking-tighter">
                Discover Your True <br />
                <span className="text-primary italic">Vocal Potential</span>
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground font-medium leading-relaxed">
                Join 1,000+ singers who have transformed their voices using our
                groundbreaking AI technology.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
                <Button
                  size="lg"
                  className="rounded-full px-12 h-20 text-2xl font-black shadow-3xl shadow-primary/40 bg-primary hover:bg-primary/90 hover:scale-105 transition-all w-full sm:w-auto"
                  onClick={() => router.push("/auth?tab=register")}
                >
                  Get Started Now
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-10 h-20 text-xl font-black w-full sm:w-auto hover:bg-muted/50 transition-colors"
                >
                  Explore Features
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-24 border-t border-white/5 bg-background overflow-hidden">
        {/* Background Glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row justify-between gap-16 lg:gap-24 mb-20">
            {/* Brand Column */}
            <div className="w-full lg:w-2/5 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Mic className="h-6 w-6 text-white" />
                </div>
                <span className="font-black text-2xl tracking-tighter">
                  SingSmart<span className="text-primary italic">AI</span>
                </span>
              </div>
              <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-sm">
                Empowering singers with cutting-edge AI technology to unlock
                their true vocal potential. Join the revolution of vocal
                training.
              </p>
              <div className="flex items-center gap-4">
                {[
                  { icon: <Twitter className="w-5 h-5" />, label: "Twitter" },
                  {
                    icon: <Instagram className="w-5 h-5" />,
                    label: "Instagram",
                  },
                  { icon: <Github className="w-5 h-5" />, label: "Github" },
                  { icon: <Youtube className="w-5 h-5" />, label: "Youtube" },
                ].map((social, i) => (
                  <motion.a
                    key={i}
                    href="#"
                    whileHover={{ y: -5, scale: 1.1 }}
                    className="w-11 h-11 rounded-full bg-muted/50 border border-white/5 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/20 transition-all shadow-sm"
                    aria-label={social.label}
                  >
                    {social.icon}
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Links Columns */}
            <div className="w-full lg:w-1/2 grid grid-cols-2 gap-8 sm:gap-16">
              <div className="space-y-6">
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/50">
                  Product
                </h4>
                <ul className="space-y-4">
                  {["Features", "Learning Paths", "Songs"].map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          router.push("/auth?tab=login");
                        }}
                        className="text-muted-foreground hover:text-primary font-bold transition-colors"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-6">
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/50">
                  Resources
                </h4>
                <ul className="space-y-4">
                  {["Community", "Documentation", "Help Center"].map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          router.push("/auth?tab=login");
                        }}
                        className="text-muted-foreground hover:text-primary font-bold transition-colors"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
