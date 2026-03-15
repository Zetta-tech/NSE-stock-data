"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Lock, Activity, CheckCircle2, AlertTriangle, Play, ChevronRight, BarChart3, Database, Mail } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function CinematicLandingLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Refs for sections
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const philosophyRef = useRef<HTMLDivElement>(null);
  const protocolRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);

  // Cards state for feature 1 (Shuffler)
  const [shuffleCards, setShuffleCards] = useState([
    { id: 1, title: "RELIANCE", val: "+3.8%", vol: "Alert Triggered" },
    { id: 2, title: "INFY", val: "+2.1%", vol: "Watchlist" },
    { id: 3, title: "HDFC Bank", val: "+1.7%", vol: "NSE Scan" },
  ]);

  // Terminal state for feature 2
  const [terminalText, setTerminalText] = useState("");
  const fullTerminalText = "> CONDITION MET: RELIANCE +3.8% HIGH VOL\n> DISPATCHING PUSH ALERT...\n> STATUS: [DELIVERED]\n> RESPONSE TIME: 0.3s";

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Hero Entrance
      gsap.fromTo(
        ".hero-reveal",
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: "power3.out", delay: 0.2 }
      );

      // 2. Navbar morphing
      ScrollTrigger.create({
        start: "top -100px",
        end: 99999,
        toggleClass: { className: "nav-scrolled", targets: navRef.current },
      });

      // 3. Philosophy Section
      gsap.fromTo(
        ".phil-word",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.05,
          ease: "power2.out",
          scrollTrigger: {
            trigger: philosophyRef.current,
            start: "top 60%",
          },
        }
      );

      // 4. Protocol Stacking Archive
      const cards = gsap.utils.toArray(".protocol-card") as HTMLElement[];
      cards.forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          pin: true,
          pinSpacing: false,
          endTrigger: ".protocol-end",
          end: "bottom bottom",
        });

        if (i !== cards.length - 1) {
          gsap.to(card, {
            scale: 0.9,
            opacity: 0.3,
            filter: "blur(10px)",
            scrollTrigger: {
              trigger: cards[i + 1],
              start: "top bottom",
              end: "top top",
              scrub: true,
            },
          });
        }
      });
    }, mainRef);

    return () => ctx.revert();
  }, []);

  // Shuffler Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setShuffleCards(prev => {
        const newCards = [...prev];
        const last = newCards.pop();
        if (last) newCards.unshift(last);
        return newCards;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Typewriter Logic
  useEffect(() => {
    let i = 0;
    const typing = setInterval(() => {
      setTerminalText(fullTerminalText.slice(0, i));
      i++;
      if (i > fullTerminalText.length) clearInterval(typing);
    }, 50);
    return () => clearInterval(typing);
  }, []);

  // Form Submit
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerEmail, source: "landing" }),
      });

      if (res.ok) {
        setRegisterSuccess(true);
      } else {
        const data = await res.json();
        setRegisterError(data.error || "Registration failed.");
      }
    } catch {
      setRegisterError("Something went wrong. Please try again.");
    } finally {
      setRegisterLoading(false);
    }
  }

  // Magnetic Button
  const handleMouseMove = (e: React.MouseEvent<HTMLLinkElement | HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(btn, {
      x: x * 0.2,
      y: y * 0.2,
      scale: 1.05,
      duration: 0.4,
      ease: "power2.out",
    });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLLinkElement | HTMLButtonElement>) => {
    gsap.to(e.currentTarget, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.4,
      ease: "power2.out",
    });
  };

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main
      ref={mainRef}
      className="relative w-full bg-[#0D0D12] text-[#FAF8F5] overflow-x-hidden"
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:ital@0;1&display=swap');
        
        body { font-family: 'Inter', sans-serif; background-color: #0D0D12; margin: 0; padding: 0; }
        .font-drama { font-family: 'Playfair Display', serif; }
        .font-data { font-family: 'JetBrains Mono', monospace; }
        
        /* Noise Filter - Scoped to this page only */
        .luxe-noise::after {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          opacity: 0.05;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .gold-glow { box-shadow: 0 0 40px rgba(201, 168, 76, 0.15); }
        .gold-border { border: 1px solid rgba(201, 168, 76, 0.3); }
        
        .nav-scrolled {
          background: rgba(13, 13, 18, 0.8) !important;
          backdrop-filter: blur(16px);
          border: 1px solid rgba(250, 248, 245, 0.05);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .animated-btn { position: relative; overflow: hidden; }
        .animated-btn::before {
          content: "";
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: #C9A84C;
          transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          z-index: 0;
        }
        .animated-btn:hover::before { transform: translateX(100%); }
        .animated-btn > span { position: relative; z-index: 10; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em; }
        .animated-btn:hover > span { color: #0D0D12; }

        .shuffler-card { transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}} />
      <div className="luxe-noise" />

      {/* A. NAVBAR */}
      <nav
        ref={navRef}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] flex items-center justify-between w-[90%] max-w-5xl transition-all duration-500 bg-transparent border border-transparent"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#C9A84C]" />
          <span className="font-semibold tracking-wide text-sm">Tickzy</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#FAF8F5]/60 hover:text-[#FAF8F5] transition-colors">
          <a href="#features">Features</a>
          <a href="#philosophy">Why Us</a>
          <a href="#protocol">How It Works</a>
        </div>
        <button
          onClick={scrollToLogin}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="px-6 py-2.5 bg-[#C9A84C] text-[#0D0D12] rounded-full text-xs font-data uppercase tracking-widest font-bold hover:bg-[#FAF8F5] transition-colors"
        >
          Sign In
        </button>
      </nav>

      {/* B. HERO SECTION */}
      <section className="relative h-[100dvh] w-full flex items-end pb-32 px-6 md:px-20 overflow-hidden">
        {/* Background Image & Overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 bg-no-repeat w-full"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0D0D12] via-[#0D0D12]/80 to-transparent" />

        <div className="relative z-10 max-w-4xl" ref={heroRef}>
          <div className="hero-reveal mb-6 flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-[#C9A84C] rounded-full animate-pulse" />
            <span className="font-data text-xs uppercase tracking-[0.2em] text-[#C9A84C]">Never Miss a Breakout</span>
          </div>
          <h1 className="hero-reveal text-5xl md:text-7xl font-semibold tracking-tighter leading-[1.1] mb-2 text-[#FAF8F5]">
            By the time you notice,
          </h1>
          <h1 className="hero-reveal font-drama italic text-6xl md:text-8xl text-[#C9A84C] pr-4">
            it&apos;s already over.
          </h1>
          <p className="hero-reveal mt-8 text-lg text-[#FAF8F5]/60 max-w-xl font-light leading-relaxed">
            We watch every stock on your watchlist — and every stock on the Indian Stock Exchange — 24/7 during market hours. The moment your alert triggers, you get a push notification instantly.
          </p>
          <div className="hero-reveal mt-12">
            <button
              onClick={scrollToLogin}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="animated-btn px-10 py-5 border border-[#C9A84C] rounded-full gold-glow text-[#C9A84C] hover:cursor-pointer flex items-center gap-3"
            >
              <span>Start Monitoring</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* C. FEATURES */}
      <section id="features" className="py-32 px-6 md:px-20 relative z-10" ref={featuresRef}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Card 1: Diagnostic Shuffler */}
          <div className="bg-[#16161D] border border-white/5 rounded-[2rem] p-10 h-[400px] flex flex-col justify-between gold-hover group overflow-hidden relative shadow-2xl">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-6">
                <BarChart3 className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Watches Everything, So You Don&apos;t Have To</h3>
              <p className="text-sm text-white/50 leading-relaxed">Monitors your entire watchlist and every stock on NSE, 24/7 during market hours.</p>
            </div>

            <div className="relative h-[120px] mt-6 w-full flex items-end justify-center">
              {shuffleCards.map((card, i) => {
                const isTop = i === 2;
                return (
                  <div
                    key={card.id}
                    className="shuffler-card absolute w-[90%] bg-[#21212B] rounded-2xl p-4 border border-white/10 flex justify-between items-center shadow-xl"
                    style={{
                      transform: `translateY(${!isTop ? (2 - i) * 15 : 0}px) scale(${1 - (!isTop ? (2 - i) * 0.05 : 0)})`,
                      opacity: isTop ? 1 : 0.5,
                      zIndex: i,
                    }}
                  >
                    <div>
                      <p className="font-data text-xs text-white/60 mb-1">{card.vol}</p>
                      <p className="font-medium text-sm">{card.title}</p>
                    </div>
                    <div className="text-[#C9A84C] font-data font-semibold text-sm">
                      {card.val}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card 2: Telemetry Typewriter */}
          <div className="bg-[#16161D] border border-white/5 rounded-[2rem] p-10 h-[400px] flex flex-col justify-between relative shadow-2xl">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-6">
                <Database className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Instant Push Notifications</h3>
              <p className="text-sm text-white/50 leading-relaxed">The moment a stock meets your conditions, a push notification fires instantly.</p>
            </div>

            <div className="bg-[#0D0D12] rounded-xl p-5 mt-6 border border-white/5 h-[140px] font-data text-[11px] leading-loose text-[#C9A84C] overflow-hidden whitespace-pre-wrap flex flex-col justify-end">
              <p>
                {terminalText}
                <span className="inline-block w-2 h-3 bg-[#C9A84C] ml-1 animate-pulse" />
              </p>
            </div>
          </div>

          {/* Card 3: Cursor Protocol Scheduler */}
          <div className="bg-[#16161D] border border-white/5 rounded-[2rem] p-10 h-[400px] flex flex-col justify-between relative shadow-2xl overflow-hidden">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">AI-Powered Alert Builder</h3>
              <p className="text-sm text-white/50 leading-relaxed">Describe your alert in plain English. &quot;Alert me when any stock crosses its 52-week high on heavy volume.&quot; The AI does the rest.</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 w-full">
              <div className="bg-[#0D0D12] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <span className="text-[#C9A84C] animate-pulse">✨</span>
                <div className="w-1 h-3 bg-[#C9A84C] animate-pulse" />
              </div>
              <div className="flex gap-2 flex-wrap mt-1">
                <div className="h-6 px-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-data text-[9px] uppercase tracking-widest flex items-center shadow-lg shadow-emerald-500/5">Vol &gt; Avg</div>
                <div className="h-6 px-3 rounded-md border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] font-data text-[9px] uppercase tracking-widest flex items-center shadow-lg shadow-[#C9A84C]/5">52W High</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* D. PHILOSOPHY */}
      <section id="philosophy" className="py-40 relative px-6 md:px-20 overflow-hidden flex items-center justify-center" ref={philosophyRef}>
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] z-0" />

        {/* Background dark radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,13,18,0)_0%,#0D0D12_80%)] z-10" />

        {/* Central glowing line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-[#C9A84C]/20 to-transparent z-10 opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#C9A84C] opacity-[0.03] blur-[100px] rounded-full z-10" />

        <div className="max-w-4xl mx-auto relative z-20 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-8 bg-[#16161D] shadow-[0_0_30px_rgba(201,168,76,0.1)] relative">
            <div className="absolute inset-0 rounded-full border border-[#C9A84C]/30 animate-ping opacity-20" />
            <Activity className="w-5 h-5 text-[#C9A84C]" />
          </div>

          <p className="text-xl md:text-2xl text-white/50 font-light tracking-tight mb-8 max-w-2xl leading-relaxed">
            {"Most retail investors miss breakouts because: by the time they notice the move, it's already over.".split(" ").map((w, i) => <span key={i} className="phil-word inline-block mr-2">{w}</span>)}
          </p>

          <div className="w-12 h-[1px] bg-[#C9A84C]/30 mb-10" />

          <h2 className="text-4xl md:text-7xl text-[#FAF8F5] leading-none flex flex-col items-center">
            <span className="mb-2">
              {"We watch the market:".split(" ").map((w, i) => <span key={`w-${i}`} className="phil-word inline-block mr-3 font-semibold tracking-tight">{w}</span>)}
            </span>
            <span className="inline-block mt-2 relative">
              {"so you ".split(" ").map((w, i) => <span key={`d-${i}`} className="phil-word inline-block mr-3 font-drama italic text-[#C9A84C]">{w}</span>)}
              <span className="relative inline-block">
                {"never miss.".split(" ").map((w, i) => <span key={`a-${i}`} className="phil-word inline-block mr-3 font-drama italic text-[#C9A84C] relative z-10">{w}</span>)}
                <span className="absolute -bottom-2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent blur-[1px]" />
              </span>
            </span>
          </h2>
        </div>
      </section>

      {/* E. PROTOCOL */}
      <section id="protocol" className="relative w-full bg-[#0D0D12]">
        <div className="protocol-end absolute bottom-0 w-full h-1" />

        {/* Card 1 */}
        <div className="protocol-card h-screen w-full flex items-center justify-center px-6 sticky top-0 bg-[#0D0D12]">
          <div className="max-w-5xl w-full grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="font-data text-[#C9A84C] text-sm tracking-widest uppercase">01 / Scan</span>
              <h2 className="text-5xl font-semibold tracking-tight">Full Market Coverage</h2>
              <p className="text-lg text-white/50 leading-relaxed font-light">
                Stuck in a job? Can&apos;t watch 50 stocks at once? We monitor your entire watchlist and every stock on the Indian Stock Exchange — simultaneously, 24/7 during market hours.
              </p>
            </div>
            <div className="h-[400px] rounded-[2rem] border border-white/5 bg-[#16161D] flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.05)_0,transparent_70%)]" />
              <div className="w-[300px] h-[300px] border border-[#C9A84C]/10 rounded-full relative overflow-hidden flex items-center justify-center">
                <div className="absolute top-1/2 left-1/2 w-[150px] h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-[#C9A84C] origin-left animate-[spin_3s_linear_infinite] z-10" />
                <div className="absolute inset-0 border border-[#C9A84C]/20 rounded-full m-[30px]" />
                <div className="absolute inset-0 border border-[#C9A84C]/30 rounded-full m-[70px] border-dashed" />
                <div className="absolute top-[35%] left-[65%] w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)] z-20" />
                <div className="absolute top-[70%] left-[40%] w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-ping z-20" />
                <div className="absolute top-[25%] left-[30%] w-1 h-1 bg-[#C9A84C] rounded-full z-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="protocol-card h-screen w-full flex items-center justify-center px-6 sticky top-0 bg-[#0D0D12]">
          <div className="max-w-5xl w-full grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="font-data text-[#C9A84C] text-sm tracking-widest uppercase">02 / Alert</span>
              <h2 className="text-5xl font-semibold tracking-tight">Instant Notifications</h2>
              <p className="text-lg text-white/50 leading-relaxed font-light">
                The moment any stock on NSE meets your conditions, a push notification fires. No delay, no manual checking — just the alert you need, exactly when the move is happening.
              </p>
            </div>
            <div className="h-[400px] rounded-[2rem] border border-white/5 bg-[#16161D] flex items-center justify-center relative overflow-hidden p-8">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-[#C9A84C]/20 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] z-0" />

              <div className="relative z-10 w-full max-w-[280px] bg-[#0D0D12] border border-[#C9A84C]/30 rounded-2xl p-5 shadow-[0_0_40px_rgba(201,168,76,0.2)] transform hover:-translate-y-2 transition-transform duration-500">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-xs font-semibold text-[#FAF8F5] uppercase tracking-widest font-data">System Alert</h4>
                  </div>
                  <span className="text-[9px] font-data text-white/40">JUST NOW</span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold tracking-wide">RELIANCE</span>
                    <span className="text-emerald-500 font-data font-bold text-sm">+3.8%</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed font-light mt-2">Breakout detected: Crossed 52-week high with heavy volume.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* F. LOGIN SECTION */}
      <section id="login" ref={loginRef} className="min-h-screen py-32 flex items-center justify-center relative bg-[#0D0D12] overflow-hidden px-4">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[#16161D]/50" />

        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-10">
            <Lock className="w-6 h-6 text-[#C9A84C] mx-auto mb-6" />
            <h2 className="text-3xl tracking-tight mb-2 font-drama italic text-[#FAF8F5]">Welcome Back</h2>
            <p className="text-sm font-data text-[#FAF8F5]/40 tracking-widest uppercase">Sign in to your account</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-8 md:p-10 space-y-6 rounded-[2.5rem] bg-[#16161D]/80 backdrop-blur-xl border border-white/5 shadow-2xl relative overflow-hidden"
          >
            {/* Operator ID */}
            <div className="space-y-3">
              <label htmlFor="username" className="block font-data text-[10px] font-medium uppercase tracking-[0.2em] text-[#FAF8F5]/40 ml-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 text-sm font-data outline-none transition-all duration-300 bg-[#0D0D12] border border-white/5 text-[#FAF8F5] rounded-2xl focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/30"
                placeholder="your-username"
              />
            </div>

            {/* Access Code */}
            <div className="space-y-3">
              <label htmlFor="password" className="block font-data text-[10px] font-medium uppercase tracking-[0.2em] text-[#FAF8F5]/40 ml-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 text-sm font-data outline-none transition-all duration-300 bg-[#0D0D12] border border-white/5 text-[#FAF8F5] rounded-2xl focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/30 tracking-[0.2em]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-3 bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-xs text-red-400 font-data pr-2 leading-relaxed">{error}</p>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="relative overflow-hidden group w-full py-4 text-xs font-data uppercase tracking-widest font-bold flex items-center justify-center gap-2 rounded-2xl border border-[#C9A84C]/40 bg-[#0D0D12] text-[#FAF8F5] hover:border-[#C9A84C] transition-colors"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                <span className="absolute inset-0 w-full h-full bg-[#C9A84C] -translate-x-[102%] group-hover:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] z-0" />
                <span className="relative z-10 flex items-center gap-2 group-hover:text-[#0D0D12] transition-colors">
                  {loading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : ("Sign In")}
                </span>
              </button>
            </div>
          </form>

          {/* Registration / Early Access */}
          <div className="mt-8 relative">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-[1px] bg-white/10" />
              <span className="font-data text-[10px] uppercase tracking-[0.2em] text-[#FAF8F5]/30">or</span>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>

            {registerSuccess ? (
              <div className="p-8 rounded-[2.5rem] bg-[#16161D]/80 backdrop-blur-xl border border-emerald-500/20 shadow-2xl text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold tracking-tight mb-2">You&apos;re on the list</h3>
                <p className="text-sm text-white/50 font-light">We&apos;ll notify you when public access opens.</p>
              </div>
            ) : (
              <form
                onSubmit={handleRegister}
                className="p-8 md:p-10 space-y-5 rounded-[2.5rem] bg-[#16161D]/80 backdrop-blur-xl border border-white/5 shadow-2xl"
              >
                <div className="text-center mb-2">
                  <Mail className="w-5 h-5 text-[#C9A84C] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold tracking-tight mb-1">Get Early Access</h3>
                  <p className="text-xs text-white/40 font-light">Drop your email — we&apos;ll notify you when public access opens.</p>
                </div>

                <div className="space-y-3">
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full px-5 py-4 text-sm font-data outline-none transition-all duration-300 bg-[#0D0D12] border border-white/5 text-[#FAF8F5] rounded-2xl focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/30"
                    placeholder="you@email.com"
                  />
                </div>

                {registerError && (
                  <div className="rounded-xl px-4 py-3 flex items-start gap-3 bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                    <p className="text-xs text-red-400 font-data pr-2 leading-relaxed">{registerError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={registerLoading}
                  className="w-full py-4 text-xs font-data uppercase tracking-widest font-bold flex items-center justify-center gap-2 rounded-2xl border border-[#C9A84C]/40 text-[#C9A84C] hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition-colors"
                  style={{ opacity: registerLoading ? 0.7 : 1 }}
                >
                  {registerLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : ("Join Waitlist")}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* G. FOOTER */}
      <footer className="mt-20 py-12 px-6 border-t border-white/5 rounded-t-[4rem] bg-[#0A0A0F] relative z-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#C9A84C]" />
            <span className="font-semibold tracking-wide text-sm">Tickzy</span>
          </div>
          <p className="text-xs text-white/30 font-light">© 2026 Tickzy. For informational purposes only. MIT Licensed.</p>
          <div className="flex items-center gap-2 bg-[#16161D] px-4 py-2 rounded-full border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-data text-[10px] text-emerald-500/70 uppercase tracking-widest">Markets Live</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
