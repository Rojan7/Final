import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

function TextCard({ item, idx, isDark }) {
  const snippet = (item.snippet || item.text || "").replace(/\.{3}$/, "").replace(/\.\.\.$/, "").trim();

  const domain = (() => {
    try { return new URL(item.url).hostname.replace("www.", ""); }
    catch { return ""; }
  })();

  const path = (() => {
    try {
      const u = new URL(item.url);
      const p = u.pathname + u.hash;
      return p.length > 55 ? p.slice(0, 55) + "…" : p;
    } catch { return ""; }
  })();

  return (
    <article style={{ padding: "18px 0", borderBottom: `1px solid ${isDark ? "#1e1e1c" : "#EDEAE6"}` }}>
      {/* breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{
          width: 18, height: 18, borderRadius: 4,
          background: isDark ? "#2C2C29" : "#E8E4DF",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
        }}>
          <img
            src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
            alt=""
            style={{ width: 12, height: 12, objectFit: "contain" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
        <span style={{ fontSize: 13, color: isDark ? "#888680" : "#6B6560" }}>{domain}</span>
        {path && (
          <span style={{ fontSize: 12, color: isDark ? "#555350" : "#9C9690", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "min(220px, 45vw)" }}>
            {path}
          </span>
        )}
      </div>

      {/* title */}
      <a
        href={item.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          fontSize: "clamp(16px, 4vw, 19px)",
          fontWeight: 400,
          color: isDark ? "#4ABA74" : "#1A6B3C",
          textDecoration: "none",
          marginBottom: 6,
          lineHeight: 1.35,
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
        onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
      >
        {item.title}
      </a>

      {/* snippet — plain, no highlighting */}
      {snippet && (
        <p style={{
          fontSize: 14,
          color: isDark ? "#888680" : "#6B6560",
          lineHeight: 1.7,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {snippet}
        </p>
      )}
    </article>
  );
}

function ImageLightbox({ img, onClose, isDark }) {
  // hooks must be called before any conditional return
  useEffect(() => {
    if (!img) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [img, onClose]);

  if (!img) return null;

  const SURFACE = isDark ? "#1C1C1A" : "#FFFFFF";
  const TEXT    = isDark ? "#EEECE8" : "#1A1916";
  const MUTED   = isDark ? "#888680" : "#6B6560";
  const ACCENT  = isDark ? "#4ABA74" : "#1A6B3C";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "fadeIn 0.18s ease",
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0; } to { opacity:1; } } @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 20,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.22)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
      >
        <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE,
          borderRadius: 16,
          overflow: "hidden",
          maxWidth: "min(680px, 92vw)",
          width: "100%",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          animation: "slideUp 0.22s ease",
        }}
      >
        {/* image */}
        <div style={{ background: isDark ? "#111110" : "#F0EDEA", lineHeight: 0 }}>
          <img
            src={`http://localhost:8000/wikipedia_scrape/images/${img.filename}`}
            alt={img.caption || img.title || ""}
            style={{ width: "100%", maxHeight: "62vh", objectFit: "contain", display: "block" }}
          />
        </div>

        {/* info + link */}
        <div style={{ padding: "18px 20px 20px" }}>
          {img.title && (
            <p style={{ fontSize: 15, fontWeight: 500, color: TEXT, margin: "0 0 6px", lineHeight: 1.4 }}>
              {img.title}
            </p>
          )}
          {img.caption && (
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px", lineHeight: 1.6 }}>
              {img.caption}
            </p>
          )}
          {img.url && (
            <a
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                fontSize: 13, fontWeight: 500, color: ACCENT,
                textDecoration: "none",
                padding: "8px 14px",
                border: `1px solid ${isDark ? "#2a4a35" : "#c2dfd0"}`,
                borderRadius: 8,
                background: isDark ? "#1A2E22" : "#EAF3EE",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View full article
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageCard({ img, isDark, onOpen }) {
  const [errored, setErrored] = useState(false);

  if (errored || !img.filename) return null;

  return (
    <div
      onClick={() => onOpen(img)}
      title="Click to view"
      style={{
        borderRadius: 8, overflow: "hidden",
        cursor: "pointer",
        background: isDark ? "#1C1C1A" : "#fff",
        border: `1px solid ${isDark ? "#2C2C29" : "#E8E4DF"}`,
        transition: "transform 0.2s, box-shadow 0.2s",
        breakInside: "avoid", marginBottom: 8,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = isDark
          ? "0 8px 24px rgba(0,0,0,0.4)"
          : "0 8px 24px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <img
        src={`http://localhost:8000/wikipedia_scrape/images/${img.filename}`}
        alt={img.caption || img.title || ""}
        style={{ width: "100%", display: "block", objectFit: "cover" }}
        onError={() => setErrored(true)}
      />
      {/* zoom hint overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0)",
        transition: "background 0.2s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.28)";
          e.currentTarget.querySelector("svg").style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0)";
          e.currentTarget.querySelector("svg").style.opacity = "0";
        }}
      >
        <svg style={{ width: 28, height: 28, color: "white", opacity: 0, transition: "opacity 0.2s", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      </div>
      {/* caption */}
      {(img.title || img.caption) && (
        <div style={{ padding: "7px 10px" }}>
          {img.title && (
            <p style={{ fontSize: 11, color: isDark ? "#888680" : "#6B6560", margin: 0, fontWeight: 500, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {img.title}
            </p>
          )}
          {img.caption && (
            <p style={{ fontSize: 10, color: isDark ? "#555350" : "#9C9690", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {img.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

export default function SearchPage() {
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState({ text_results: [], image_results: [] });
  const [loading, setLoading]         = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFocused, setIsFocused]     = useState(false);
  const [history, setHistory]         = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isDark, setIsDark]           = useState(false);
  const [activeTab, setActiveTab]     = useState("text");
  const [lightboxImg, setLightboxImg] = useState(null);
  const [refineText, setRefineText]   = useState("");
  const [refineFocused, setRefineFocused] = useState(false);
  const [baseQuery, setBaseQuery]     = useState("");   // original query before refinements
  const [refineHistory, setRefineHistory] = useState([]); // breadcrumb trail
  const resultsRef = useRef(null);
  const inputRef   = useRef(null);
  const refineRef  = useRef(null);
  const isMobile   = useIsMobile();

  const BG      = isDark ? "#111110" : "#F7F5F2";
  const SURFACE = isDark ? "#1C1C1A" : "#FFFFFF";
  const BORDER  = isDark ? "#2C2C29" : "#E8E4DF";
  const TEXT    = isDark ? "#EEECE8" : "#1A1916";
  const MUTED   = isDark ? "#888680" : "#6B6560";
  const SUBTLE  = isDark ? "#555350" : "#9C9690";
  const ACCENT  = isDark ? "#4ABA74" : "#1A6B3C";
  const SOFT    = isDark ? "#1A2E22" : "#EAF3EE";
  const DIVIDER = isDark ? "#222220" : "#EDEAE6";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const h = (e) => setIsDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.body.style.background = BG;
    document.body.style.margin = "0";
  }, [BG]);

  useEffect(() => {
    if (hasSearched && resultsRef.current) {
      setTimeout(() => resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [hasSearched]);

  const performSearch = useCallback(async (q = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setHasSearched(true);
    setShowHistory(false);
    setActiveTab("text");
    setBaseQuery(trimmed);
    setRefineHistory([trimmed]);
    setRefineText("");
    setHistory(prev => [trimmed, ...prev.filter(x => x !== trimmed).slice(0, 7)]);
    try {
      const res = await axios.get(`http://localhost:8000/search?q=${encodeURIComponent(trimmed)}`);
      setResults(res.data);
    } catch {
      setResults({ text_results: [], image_results: [] });
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setHasSearched(true);
    setQuery(`Image: ${file.name}`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post("http://localhost:8000/search/image/unified", fd);
      setResults(res.data);
    } catch {
      setResults({ text_results: [], image_results: [] });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setHasSearched(false);
    setQuery("");
    setResults({ text_results: [], image_results: [] });
    setRefineText("");
    setRefineHistory([]);
    setBaseQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const performRefine = async () => {
    const constraint = refineText.trim();
    if (!constraint) return;
    setRefineHistory(prev => [...prev, constraint]);
    setRefineText("");
    setLoading(true);
    setActiveTab("text");
    try {
      // POST current results + constraint to /refine
      // Backend re-ranks using CrossEncoder (text) and CLIP zero-shot (images)
      // No new FAISS search — just intelligent re-ranking of what we already have
      const res = await axios.post("http://localhost:8000/refine", {
        text_results:   results.text_results,
        image_results:  results.image_results,
        original_query: baseQuery,
        constraint:     constraint,
        k:              10,
      });
      setResults(res.data);
    } catch (err) {
      console.error("Refinement failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const textCount  = results.text_results?.length  ?? 0;
  const imageCount = results.image_results?.length ?? 0;

  const renderSearchBar = (compact) => (
    <div style={{
      display: "flex", alignItems: "center",
      background: SURFACE,
      border: `1.5px solid ${isFocused ? ACCENT : BORDER}`,
      borderRadius: compact ? 24 : 16,
      padding: compact ? "0 12px" : "0 16px",
      height: compact ? 40 : 52,
      boxShadow: isFocused
        ? `0 0 0 ${compact ? 3 : 4}px ${SOFT}`
        : compact ? "none" : `0 2px 12px rgba(0,0,0,${isDark ? 0.3 : 0.06})`,
      transition: "border-color 0.15s, box-shadow 0.2s",
    }}>
      <svg style={{ width: compact ? 15 : 17, height: compact ? 15 : 17, color: isFocused ? ACCENT : SUBTLE, flexShrink: 0, transition: "color 0.15s" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowHistory(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") performSearch(); if (e.key === "Escape") { setShowHistory(false); inputRef.current?.blur(); } }}
        onFocus={() => { setIsFocused(true); setShowHistory(true); }}
        onBlur={() => { setIsFocused(false); setTimeout(() => setShowHistory(false), 150); }}
        placeholder={compact ? "Search…" : "Search anything..."}
        style={{
          flex: 1, border: "none", outline: "none",
          background: "transparent",
          fontSize: compact ? 14 : 16,
          color: TEXT, padding: `0 ${compact ? 10 : 14}px`,
          fontFamily: "inherit",
        }}
      />
      {query && (
        <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: SUBTLE, display: "flex", padding: 4, marginRight: compact ? 4 : 6 }}>
          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div style={{ width: 1, height: 18, background: BORDER, margin: `0 ${compact ? 8 : 12}px`, flexShrink: 0 }} />
      <label style={{ cursor: "pointer", display: "flex", flexShrink: 0 }} title="Search by image">
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleImageUpload(e.target.files[0])} />
        <svg style={{ width: compact ? 15 : 17, height: compact ? 15 : 17, color: SUBTLE, transition: "color 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.color = ACCENT}
          onMouseLeave={(e) => e.currentTarget.style.color = SUBTLE}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
      </label>
      {!compact && (
        <button
          onClick={() => performSearch()}
          disabled={!query.trim()}
          style={{
            marginLeft: 10, padding: "8px 18px",
            background: query.trim() ? ACCENT : BORDER,
            color: query.trim() ? (isDark ? "#0f0d0b" : "#fff") : SUBTLE,
            border: "none", borderRadius: 10,
            fontSize: 13, fontFamily: "inherit", fontWeight: 500,
            cursor: query.trim() ? "pointer" : "not-allowed",
            transition: "all 0.15s", flexShrink: 0,
          }}
        >
          Search
        </button>
      )}
    </div>
  );

  const renderHistory = () => showHistory && history.length > 0 ? (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 12, overflow: "hidden", zIndex: 200,
      boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.1)",
    }}>
      <div style={{ padding: "10px 14px 4px", fontSize: 10, color: SUBTLE, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Recent
      </div>
      {history.slice(0, 5).map((h, i) => (
        <button key={i} onMouseDown={() => { setQuery(h); performSearch(h); }}
          style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer", padding: "9px 14px", background: "none", display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: MUTED, fontFamily: "inherit", transition: "background 0.1s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = DIVIDER}
          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
        >
          <svg style={{ width: 12, height: 12, color: SUBTLE, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {h}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@1,300;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { border-radius: 3px; background: #ccc; }
      `}</style>

      <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', -apple-system, sans-serif", transition: "background 0.3s, color 0.3s" }}>

        {/* ── HERO ── */}
        {!hasSearched && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "0 20px" }}>
            {/* theme toggle */}
            <button onClick={() => setIsDark(d => !d)} style={{ position: "fixed", top: 16, right: 16, zIndex: 50, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "inherit" }}>
              {isDark
                ? <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                : <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              }
              {isDark ? "Light" : "Dark"}
            </button>

            {/* wordmark */}
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <h1 style={{ fontSize: "clamp(60px, 15vw, 110px)", fontWeight: 300, fontStyle: "italic", color: TEXT, letterSpacing: "-0.03em", lineHeight: 0.92, marginBottom: 16, fontFamily: "'Playfair Display', Georgia, serif" }}>
                Nexus
              </h1>
              <p style={{ fontSize: 11, color: SUBTLE, fontWeight: 400, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                Semantic · Multimodal · Search
              </p>
            </div>

            {/* search box */}
            <div style={{ width: "100%", maxWidth: 560, position: "relative" }}>
              {renderSearchBar(false)}
              {renderHistory()}
              <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: SUBTLE }}>
                Press <kbd style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontFamily: "inherit" }}>/</kbd> to focus · or upload an image
              </p>
            </div>
          </div>
        )}

        {/* ── STICKY HEADER ── */}
        {hasSearched && (
          <header style={{ position: "sticky", top: 0, zIndex: 100, background: BG, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: isMobile ? 10 : 20, height: isMobile ? 56 : 60, padding: `0 ${isMobile ? 14 : 24}px` }}>
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", fontSize: isMobile ? 20 : 24, fontWeight: 300, fontStyle: "italic", color: ACCENT, letterSpacing: "-0.02em", padding: 0, flexShrink: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                Nexus
              </button>
              <div style={{ flex: 1, maxWidth: isMobile ? "none" : 580, position: "relative" }}>
                {renderSearchBar(true)}
                {renderHistory()}
              </div>
              {!isMobile && (
                <button onClick={() => setIsDark(d => !d)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "inherit", flexShrink: 0 }}>
                  {isDark
                    ? <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    : <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                  }
                  {isDark ? "Light" : "Dark"}
                </button>
              )}
            </div>

            {/* mobile tabs */}
            {isMobile && imageCount > 0 && (
              <div style={{ display: "flex", borderTop: `1px solid ${DIVIDER}` }}>
                {["text", "images"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: `2px solid ${activeTab === tab ? ACCENT : "transparent"}`, color: activeTab === tab ? ACCENT : SUBTLE, fontSize: 13, fontWeight: activeTab === tab ? 500 : 400, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", transition: "color 0.15s" }}>
                    {tab} ({tab === "text" ? textCount : imageCount})
                  </button>
                ))}
              </div>
            )}
          </header>
        )}

        {/* ── RESULTS ── */}
        {hasSearched && !loading && (
          <div ref={resultsRef} style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 16px 80px" : "28px 24px 80px" }}>
            <p style={{ fontSize: 13, color: SUBTLE, marginBottom: isMobile ? 14 : 22 }}>
              {textCount + imageCount} results for <span style={{ color: MUTED, fontWeight: 500 }}>"{query}"</span>
            </p>

            {/* mobile: tabbed */}
            {isMobile ? (
              <div>
                {activeTab === "text" && (
                  textCount === 0
                    ? <p style={{ padding: "40px 0", textAlign: "center", color: SUBTLE, fontSize: 14 }}>No text results</p>
                    : results.text_results.map((item, idx) => <TextCard key={idx} item={item} idx={idx} isDark={isDark} />)
                )}
                {activeTab === "images" && (
                  imageCount === 0
                    ? <p style={{ padding: "40px 0", textAlign: "center", color: SUBTLE, fontSize: 14 }}>No images</p>
                    : <div style={{ columns: 2, columnGap: 8 }}>
                        {results.image_results.map((img, i) => <ImageCard key={i} img={img} isDark={isDark} onOpen={setLightboxImg} />)}
                      </div>
                )}
              </div>
            ) : (
              /* desktop: two columns */
              <div style={{ display: "grid", gridTemplateColumns: imageCount > 0 ? "1fr 300px" : "1fr", gap: "0 56px", alignItems: "start" }}>
                <div style={{ maxWidth: 660 }}>
                  {textCount === 0
                    ? <p style={{ padding: "48px 0", textAlign: "center", color: SUBTLE, fontSize: 14 }}>No text results</p>
                    : results.text_results.map((item, idx) => <TextCard key={idx} item={item} idx={idx} isDark={isDark} />)
                  }
                </div>
                {imageCount > 0 && (
                  <div style={{ position: "sticky", top: 80 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Images</p>
                    <div style={{ columns: 2, columnGap: 8 }}>
                      {results.image_results.map((img, i) => <ImageCard key={i} img={img} isDark={isDark} onOpen={setLightboxImg} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REFINE PANEL ── */}
        {hasSearched && !loading && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
            background: isDark ? "rgba(17,17,16,0.96)" : "rgba(247,245,242,0.96)",
            backdropFilter: "blur(12px)",
            borderTop: `1px solid ${BORDER}`,
            padding: isMobile ? "12px 16px" : "14px 24px",
          }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>

              {/* breadcrumb trail */}
              {refineHistory.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {refineHistory.map((crumb, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {i > 0 && (
                        <svg style={{ width: 12, height: 12, color: SUBTLE, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      <span style={{
                        fontSize: 12, color: i === refineHistory.length - 1 ? ACCENT : MUTED,
                        background: i === refineHistory.length - 1 ? SOFT : "transparent",
                        padding: i === refineHistory.length - 1 ? "2px 8px" : "2px 0",
                        borderRadius: 20,
                        fontWeight: i === refineHistory.length - 1 ? 500 : 400,
                      }}>
                        {crumb}
                      </span>
                    </span>
                  ))}
                  {refineHistory.length > 1 && (
                    <button
                      onClick={() => {
                        setRefineHistory([baseQuery]);
                        setQuery(baseQuery);
                        performSearch(baseQuery);
                      }}
                      style={{ marginLeft: 4, fontSize: 11, color: SUBTLE, background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {/* refine input row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center",
                  background: SURFACE,
                  border: `1.5px solid ${refineFocused ? ACCENT : BORDER}`,
                  borderRadius: 24, padding: "0 14px", height: 40,
                  boxShadow: refineFocused ? `0 0 0 3px ${SOFT}` : "none",
                  transition: "border-color 0.15s, box-shadow 0.2s",
                }}>
                  {/* sparkle icon */}
                  <svg style={{ width: 14, height: 14, color: refineFocused ? ACCENT : SUBTLE, flexShrink: 0, transition: "color 0.15s" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 3l1.5 1.5M12 2v2M19 3l-1.5 1.5M2 12h2M20 12h2M5 21l1.5-1.5M12 20v2M19 21l-1.5-1.5M12 12a4 4 0 110-8 4 4 0 010 8z" />
                  </svg>
                  <input
                    ref={refineRef}
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") performRefine(); }}
                    onFocus={() => setRefineFocused(true)}
                    onBlur={() => setRefineFocused(false)}
                    placeholder={`Refine "${baseQuery}"… e.g. without cap, smiling, outdoors`}
                    style={{
                      flex: 1, border: "none", outline: "none",
                      background: "transparent", fontSize: 14,
                      color: TEXT, padding: "0 10px", fontFamily: "inherit",
                    }}
                  />
                  {refineText && (
                    <button onClick={() => setRefineText("")} style={{ background: "none", border: "none", cursor: "pointer", color: SUBTLE, display: "flex", padding: 2 }}>
                      <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <button
                  onClick={performRefine}
                  disabled={!refineText.trim()}
                  style={{
                    padding: "0 18px", height: 40,
                    background: refineText.trim() ? ACCENT : BORDER,
                    color: refineText.trim() ? (isDark ? "#0f0d0b" : "#fff") : SUBTLE,
                    border: "none", borderRadius: 20, fontSize: 13,
                    fontFamily: "inherit", fontWeight: 500,
                    cursor: refineText.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.15s", flexShrink: 0, whiteSpace: "nowrap",
                  }}
                >
                  Refine
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LIGHTBOX ── */}
        {lightboxImg && (
          <ImageLightbox img={lightboxImg} onClose={() => setLightboxImg(null)} isDark={isDark} />
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div style={{ position: "fixed", inset: 0, zIndex: 400, background: isDark ? "rgba(17,17,16,0.88)" : "rgba(247,245,242,0.88)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <svg style={{ width: 28, height: 28 }} viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke={BORDER} strokeWidth="2" />
              <path d="M14 3 A11 11 0 0 1 25 14" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" className="spin" />
            </svg>
            <p style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>Searching…</p>
          </div>
        )}
      </div>
    </>
  );
}