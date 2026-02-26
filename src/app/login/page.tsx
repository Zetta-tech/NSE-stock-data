"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Lock, Activity, CheckCircle2, AlertTriangle, Play, ChevronRight, BarChart3, Database } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function CinematicLandingLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    { id: 1, title: "NIFTY Bank", val: "+2.4%", vol: "High Vol" },
    { id: 2, title: "Watchlist Alpha", val: "+5.1%", vol: "Breakout" },
    { id: 3, title: "Automotive Sec", val: "+1.2%", vol: "Accumulation" },
  ]);

  // Terminal state for feature 2
  const [terminalText, setTerminalText] = useState("");
  const fullTerminalText = "> INITIALIZING NSE FEED...\n> STATUS: [LIVE]\n> VALIDATING PACKETS: SUCCESS\n> SUPPRESSING STALE DATA...";

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
        setError("Invalid Operator ID or Access Code.");
      }
    } catch {
      setError("System malfunction. Please retry sequence.");
    } finally {
      setLoading(false);
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
          <span className="font-semibold tracking-wide text-sm">NSE Stock Data</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#FAF8F5]/60 hover:text-[#FAF8F5] transition-colors">
          <a href="#features">Features</a>
          <a href="#philosophy">Philosophy</a>
          <a href="#protocol">Protocol</a>
        </div>
        <button
          onClick={scrollToLogin}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="px-6 py-2.5 bg-[#C9A84C] text-[#0D0D12] rounded-full text-xs font-data uppercase tracking-widest font-bold hover:bg-[#FAF8F5] transition-colors"
        >
          Access Portal
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
            <span className="font-data text-xs uppercase tracking-[0.2em] text-[#C9A84C]">Real-Time Terminal</span>
          </div>
          <h1 className="hero-reveal text-5xl md:text-7xl font-semibold tracking-tighter leading-[1.1] mb-2 text-[#FAF8F5]">
            Market Dominance meets
          </h1>
          <h1 className="hero-reveal font-drama italic text-6xl md:text-8xl text-[#C9A84C] pr-4">
            Precision Data.
          </h1>
          <p className="hero-reveal mt-8 text-lg text-[#FAF8F5]/60 max-w-xl font-light leading-relaxed">
            A minimalist dashboard that scans NIFTY 50 stocks, alerting you to high-volume breakouts with absolute clarity.
          </p>
          <div className="hero-reveal mt-12">
            <button
              onClick={scrollToLogin}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="animated-btn px-10 py-5 border border-[#C9A84C] rounded-full gold-glow text-[#C9A84C] hover:cursor-pointer flex items-center gap-3"
            >
              <span>Authenticate Session</span>
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
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Fast Breakout Discovery</h3>
              <p className="text-sm text-white/50 leading-relaxed">Spots high + volume breakouts across your watchlist and NIFTY 50 instantly.</p>
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
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Trust-First Signals</h3>
              <p className="text-sm text-white/50 leading-relaxed">Clearly labels live/historical data and suppresses false alerts.</p>
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
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Simple Workflow</h3>
              <p className="text-sm text-white/50 leading-relaxed">Starred stocks + Refresh All + Auto-check mode make daily use effortless.</p>
            </div>

            <div className="mt-8 grid grid-cols-5 gap-2 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                <div key={i} className={`h-8 rounded flex items-center justify-center text-[10px] font-data ${i === 4 || i === 7 ? 'bg-[#C9A84C] text-[#0D0D12]' : 'bg-[#21212B] text-white/30'}`}>
                  {i === 4 || i === 7 ? '★' : '-'}
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* D. PHILOSOPHY */}
      <section id="philosophy" className="py-40 relative px-6 md:px-20 overflow-hidden" ref={philosophyRef}>
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-[0.03] mix-blend-screen"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1603513492128-ba7f1bc654c6?q=80&w=2671&auto=format&fit=crop')" }}
        />
        <div className="max-w-4xl mx-auto relative z-10">
          <p className="text-xl md:text-2xl text-white/50 font-light tracking-tight mb-6">
            {"Most platforms focus on: overwhelming you with endless noise and false flags.".split(" ").map((w, i) => <span key={i} className="phil-word inline-block mr-2">{w}</span>)}
          </p>
          <h2 className="text-4xl md:text-6xl text-[#FAF8F5] leading-tight">
            {"We focus on: ".split(" ").map((w, i) => <span key={`w-${i}`} className="phil-word inline-block mr-3 font-semibold">{w}</span>)}
            <br className="hidden md:block" />
            {"definitive ".split(" ").map((w, i) => <span key={`d-${i}`} className="phil-word inline-block mr-3 font-drama italic text-[#C9A84C]">{w}</span>)}
            {"action.".split(" ").map((w, i) => <span key={`a-${i}`} className="phil-word inline-block mr-3 font-drama italic text-[#C9A84C]">{w}</span>)}
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
              <h2 className="text-5xl font-semibold tracking-tight">NIFTY 50 Radar</h2>
              <p className="text-lg text-white/50 leading-relaxed font-light">
                Continuous volume tracking across the primary index, identifying accumulation phases before they execute into vertical breakouts.
              </p>
            </div>
            <div className="h-[400px] rounded-[2rem] border border-white/5 bg-[#16161D] flex items-center justify-center overflow-hidden relative">
              <div className="w-[300px] h-[300px] border border-[#C9A84C]/20 rounded-full animate-[spin_20s_linear_infinite] border-dashed" />
              <div className="absolute w-[200px] h-[200px] border border-[#C9A84C]/40 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
              <div className="absolute w-2 h-2 bg-[#C9A84C] rounded-full gold-glow" />
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="protocol-card h-screen w-full flex items-center justify-center px-6 sticky top-0 bg-[#0D0D12]">
          <div className="max-w-5xl w-full grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="font-data text-[#C9A84C] text-sm tracking-widest uppercase">02 / Verify</span>
              <h2 className="text-5xl font-semibold tracking-tight">Trust Signals</h2>
              <p className="text-lg text-white/50 leading-relaxed font-light">
                Intelligent packet validation automatically suppresses stale alerts. You always know exactly what feeds are live and which are historical.
              </p>
            </div>
            <div className="h-[400px] rounded-[2rem] border border-white/5 bg-[#16161D] flex items-center justify-center p-8">
              <div className="w-full h-full border-b border-l border-white/10 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                <div className="absolute left-0 right-0 h-[2px] bg-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.8)] animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
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
            <h2 className="text-3xl tracking-tight mb-2 font-drama italic text-[#FAF8F5]">Secure Gateway</h2>
            <p className="text-sm font-data text-[#FAF8F5]/40 tracking-widest uppercase">Operator Authentication</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-8 md:p-10 space-y-6 rounded-[2.5rem] bg-[#16161D]/80 backdrop-blur-xl border border-white/5 shadow-2xl relative overflow-hidden"
          >
            {/* Operator ID */}
            <div className="space-y-3">
              <label htmlFor="username" className="block font-data text-[10px] font-medium uppercase tracking-[0.2em] text-[#FAF8F5]/40 ml-1">
                Operator ID
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 text-sm font-data outline-none transition-all duration-300 bg-[#0D0D12] border border-white/5 text-[#FAF8F5] rounded-2xl focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/30"
                placeholder="SYS-ADMIN-01"
              />
            </div>

            {/* Access Code */}
            <div className="space-y-3">
              <label htmlFor="password" className="block font-data text-[10px] font-medium uppercase tracking-[0.2em] text-[#FAF8F5]/40 ml-1">
                Access Code
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
                      Authenticating...
                    </>
                  ) : ("Initialize Session")}
                </span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* G. FOOTER */}
      <footer className="mt-20 py-12 px-6 border-t border-white/5 rounded-t-[4rem] bg-[#0A0A0F] relative z-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#C9A84C]" />
            <span className="font-semibold tracking-wide text-sm">NSE Stock Data</span>
          </div>
          <p className="text-xs text-white/30 font-light">© 2026 Secured Gateway. All parameters encrypted.</p>
          <div className="flex items-center gap-2 bg-[#16161D] px-4 py-2 rounded-full border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-data text-[10px] text-emerald-500/70 uppercase tracking-widest">System Operational</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
