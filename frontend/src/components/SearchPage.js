import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { refineSearch } from "../api/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ text_results: [], image_results: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [baseEmbedding, setBaseEmbedding] = useState(null);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [activeResultIndex, setActiveResultIndex] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const resultsRef = useRef(null);

  // Auto-scroll to results after search
  useEffect(() => {
    if (hasSearched && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [hasSearched]);

  // TEXT SEARCH
  const performSearch = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setSearchHistory(prev => [q, ...prev.filter(item => item !== q).slice(0, 4)]);

    try {
      const res = await axios.get(`http://localhost:8000/search?q=${encodeURIComponent(q)}`);
      setResults(res.data);
      setBaseEmbedding(res.data.embedding);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // IMAGE SEARCH
  const handleImageUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setHasSearched(true);
    setQuery(`Image: ${file.name}`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        "http://localhost:8000/search/image/unified",
        formData
      );

      setResults(res.data);
      setBaseEmbedding(res.data.embedding);
    } catch (err) {
      console.error("Image search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // REFINE
  const handleRefine = async () => {
    if (!refineText.trim() || !baseEmbedding) return;
    setRefining(true);
    setSearchHistory(prev => [`${query} → ${refineText}`, ...prev.slice(0, 4)]);

    try {
      // Fade out existing results
      setResults(prev => ({
        text_results: prev.text_results.map(r => ({ ...r, _fading: true })),
        image_results: prev.image_results.map(r => ({ ...r, _fading: true }))
      }));

      await new Promise(resolve => setTimeout(resolve, 300));

      const data = await refineSearch(baseEmbedding, refineText);
      
      setResults(data);
      setBaseEmbedding(data.embedding);
      setQuery(prev => `${prev} → ${refineText}`);
      setRefineText("");
    } catch (err) {
      console.error("Refinement failed:", err);
    } finally {
      setTimeout(() => setRefining(false), 400);
    }
  };

  const totalResults = results.text_results?.length + results.image_results?.length || 0;

  return (
    <div className={`min-h-screen transition-all duration-1000 ${
      isDark 
        ? "bg-gradient-to-br from-slate-950 via-indigo-950/30 to-violet-950/30 text-slate-100" 
        : "bg-gradient-to-br from-slate-50 via-indigo-50/20 to-violet-50/30 text-slate-900"
    } selection:bg-indigo-500/30 ${!hasSearched ? "flex flex-col items-center justify-center" : "pt-6 pb-20"}`}>
      
      {/* Animated background elements */}
      <div className={`fixed inset-0 -z-10 pointer-events-none transition-opacity duration-1000 ${isDark ? "opacity-[0.03]" : "opacity-[0.02]"}`}>
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, ${isDark ? '#818cf8' : '#6366f1'} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? '#818cf8' : '#6366f1'} 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }}></div>
      </div>

      {/* Floating ambient orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${isDark ? "bg-indigo-500/20" : "bg-indigo-300/10"}`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${isDark ? "bg-violet-500/20" : "bg-violet-300/10"}`} style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Theme Toggle Button */}
      <button
        onClick={() => setIsDark(!isDark)}
        className={`fixed top-6 right-6 z-50 p-4 rounded-full transition-all duration-500 backdrop-blur-xl border shadow-lg hover:scale-110 active:scale-95 group ${
          isDark 
            ? "bg-slate-800/80 border-slate-700/50 text-amber-400 hover:shadow-amber-500/20" 
            : "bg-white/80 border-slate-200/50 text-slate-600 hover:shadow-indigo-200/50"
        }`}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <svg className="h-5 w-5 rotate-0 transition-transform duration-500 group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 rotate-0 transition-transform duration-500 group-hover:-rotate-45" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      {/* HEADER SECTION */}
      <section className={`w-full max-w-7xl mx-auto px-6 transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] ${hasSearched ? "mb-8 flex flex-col md:flex-row items-center gap-8" : "text-center"}`}>
        
        {/* Logo */}
        <div 
          onClick={() => { 
            setHasSearched(false); 
            setQuery(""); 
            setResults({ text_results: [], image_results: [] }); 
            setBaseEmbedding(null);
          }}
          className={`group cursor-pointer transition-all duration-1000 select-none relative ${hasSearched ? "" : "mb-12"}`}
        >
          <h1 className={`font-black tracking-tighter transition-all duration-1000
            ${hasSearched 
              ? "text-4xl md:text-5xl bg-gradient-to-br from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent" 
              : isDark
                ? "text-7xl sm:text-8xl md:text-9xl lg:text-[12rem] leading-none text-slate-100"
                : "text-7xl sm:text-8xl md:text-9xl lg:text-[12rem] leading-none text-slate-900"}`}
          >
            NEXUS
            <span className={`inline-block transition-all duration-500 ${hasSearched ? "text-indigo-400" : isDark ? "text-indigo-400 group-hover:scale-125 group-hover:rotate-180" : "text-indigo-600 group-hover:scale-125 group-hover:rotate-180"}`}>.</span>
          </h1>
          {!hasSearched && (
            <p className={`text-sm md:text-base mt-4 tracking-wide animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Next-generation semantic search
            </p>
          )}
        </div>

        {/* Search Bar */}
        <div className={`relative w-full transition-all duration-1000 ${hasSearched ? "max-w-3xl" : "max-w-2xl mx-auto"}`}>
          {/* Glow effect on focus */}
          <div className={`absolute -inset-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-[3rem] blur-2xl transition-all duration-1000 ${isFocused ? "opacity-25 scale-105" : "opacity-0 scale-95"}`}></div>
          
          {/* Search container */}
          <div className={`relative flex items-center backdrop-blur-xl border rounded-[2.5rem] p-2 md:p-3 transition-all duration-500 ${
            isDark
              ? isFocused 
                ? "bg-slate-800/80 border-indigo-500 shadow-2xl shadow-indigo-500/20"
                : "bg-slate-800/60 border-slate-700/50 shadow-xl shadow-slate-900/30"
              : isFocused
                ? "bg-white/80 border-indigo-400 shadow-2xl shadow-indigo-200/50"
                : "bg-white/80 border-slate-200/50 shadow-xl shadow-slate-200/30"
          }`}>
            
            {/* Search icon */}
            <div className={`pl-3 md:pl-4 transition-all duration-300 ${isFocused ? isDark ? "text-indigo-400 scale-110" : "text-indigo-600 scale-110" : isDark ? "text-slate-500" : "text-slate-400"}`}>
              <svg fill="none" className="h-5 w-5 md:h-6 md:w-6" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Input field */}
            <input
              type="text"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
              placeholder="Ask anything..."
              className={`w-full px-3 md:px-5 py-2 md:py-3 text-lg md:text-xl bg-transparent outline-none font-medium ${
                isDark 
                  ? "placeholder:text-slate-600 text-slate-100" 
                  : "placeholder:text-slate-300 text-slate-900"
              }`}
            />
            
            {/* Clear button */}
            {query && !loading && (
              <button
                onClick={() => setQuery("")}
                className={`mr-2 p-2 rounded-full transition-all duration-200 animate-in zoom-in-50 ${
                  isDark
                    ? "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            {/* Image upload button */}
            <label className="flex items-center px-1 md:px-2 cursor-pointer group/cam relative">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => handleImageUpload(e.target.files[0])} 
              />
              <div className={`p-3 md:p-4 rounded-full transition-all duration-300 group-hover/cam:scale-110 group-hover/cam:shadow-lg ${
                isDark
                  ? "bg-slate-700 text-slate-400 group-hover/cam:bg-gradient-to-br group-hover/cam:from-indigo-600 group-hover/cam:to-violet-600 group-hover/cam:text-white group-hover/cam:shadow-indigo-500/20"
                  : "bg-slate-50 text-slate-500 group-hover/cam:bg-gradient-to-br group-hover/cam:from-indigo-600 group-hover/cam:to-violet-600 group-hover/cam:text-white group-hover/cam:shadow-indigo-200"
              }`}>
                <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
              <span className={`absolute -bottom-8 right-0 text-[10px] opacity-0 group-hover/cam:opacity-100 transition-opacity whitespace-nowrap ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Upload image
              </span>
            </label>
          </div>

          {/* Recent search history */}
          {!hasSearched && searchHistory.length > 0 && (
            <div className={`absolute top-full mt-4 w-full backdrop-blur-xl rounded-2xl shadow-xl border p-4 animate-in fade-in slide-in-from-top-2 duration-300 z-10 ${
              isDark
                ? "bg-slate-800/90 border-slate-700/50"
                : "bg-white/90 border-slate-200/50"
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Recent searches</p>
              <div className="space-y-2">
                {searchHistory.map((hist, idx) => (
                  <button
                    key={idx}
                    onClick={() => { 
                      const searchQuery = hist.split(' → ')[0];
                      setQuery(searchQuery); 
                      performSearch(searchQuery); 
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 group ${
                      isDark
                        ? "text-slate-400 hover:bg-slate-700 hover:text-indigo-400"
                        : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                    }`}
                  >
                    <svg className={`h-3 w-3 transition-colors ${isDark ? "text-slate-600 group-hover:text-indigo-400" : "text-slate-300 group-hover:text-indigo-400"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate">{hist}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* RESULTS AREA */}
      {hasSearched && (
        <main ref={resultsRef} className="w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          
          {/* Results header with stats */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className={`px-4 py-2 backdrop-blur-sm rounded-full border shadow-sm ${
                isDark
                  ? "bg-slate-800/60 border-slate-700/50"
                  : "bg-white/60 border-slate-200/50"
              }`}>
                <span className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  <span className={`font-bold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{totalResults}</span> {totalResults === 1 ? 'result' : 'results'} found
                </span>
              </div>
              {refining && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border animate-in slide-in-from-left duration-300 ${
                  isDark
                    ? "bg-amber-900/30 border-amber-700/50"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDark ? "bg-amber-400" : "bg-amber-500"}`}></div>
                  <span className={`text-xs font-semibold ${isDark ? "text-amber-400" : "text-amber-700"}`}>Refining context...</span>
                </div>
              )}
            </div>
          </div>

          {/* Refinement Input */}
          {baseEmbedding && (
            <div className={`mb-12 max-w-2xl mx-auto transition-all duration-500 ${refining ? "scale-[0.98] opacity-70" : "scale-100 opacity-100"}`}>
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-[2rem] blur-xl opacity-20"></div>
                <div className={`relative flex items-center p-1.5 rounded-[1.75rem] border shadow-lg backdrop-blur-sm ${
                  isDark
                    ? "bg-gradient-to-br from-slate-800 to-slate-900 border-indigo-500/50"
                    : "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200/50"
                }`}>
                  <div className={isDark ? "pl-4 text-indigo-400" : "pl-4 text-indigo-400"}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Refine your search (e.g., 'more technical', 'recent only')"
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                    disabled={refining}
                    className={`w-full px-4 py-3 bg-transparent outline-none text-sm font-medium disabled:opacity-50 ${
                      isDark
                        ? "text-slate-100 placeholder:text-slate-600"
                        : "text-indigo-900 placeholder:text-indigo-300/70"
                    }`}
                  />
                  <button
                    onClick={handleRefine}
                    disabled={!refineText.trim() || refining}
                    className={`bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap ${
                      isDark ? "hover:shadow-indigo-500/20" : "hover:shadow-indigo-200"
                    }`}
                  >
                    {refining ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Refining</span>
                      </>
                    ) : (
                      <>
                        <span>Refine</span>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className={`text-xs text-center mt-3 animate-in fade-in duration-500 delay-200 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Iteratively refine results with natural language
              </p>
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            
            {/* TEXT RESULTS COLUMN */}
            <div className="lg:col-span-7 space-y-8">
              <header className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDark ? "bg-indigo-400" : "bg-indigo-600"}`}></div>
                  <span className={`text-xs font-bold uppercase tracking-[0.3em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Knowledge</span>
                </div>
                <div className={`h-px flex-1 bg-gradient-to-r to-transparent ${isDark ? "from-slate-700" : "from-slate-200"}`}></div>
              </header>

              {results.text_results?.length === 0 && !loading && (
                <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] backdrop-blur-sm ${
                  isDark
                    ? "border-slate-700/50 bg-slate-800/30"
                    : "border-slate-200/50 bg-white/30"
                }`}>
                  <div className={`w-16 h-16 mx-auto mb-4 ${isDark ? "text-slate-700" : "text-slate-200"}`}>
                    <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className={`italic text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>No text results found</p>
                </div>
              )}

              {results.text_results?.map((item, idx) => (
                <article 
                  key={idx} 
                  onMouseEnter={() => setActiveResultIndex(idx)}
                  onMouseLeave={() => setActiveResultIndex(null)}
                  className={`group relative transition-all duration-500 ${item._fading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Hover background */}
                  <div className={`absolute -inset-4 z-0 rounded-[2rem] scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 shadow-xl ${
                    isDark
                      ? "bg-gradient-to-br from-slate-800 to-indigo-900/20 shadow-slate-900/50"
                      : "bg-gradient-to-br from-white to-indigo-50/30 shadow-slate-200/50"
                  }`}></div>
                  
                  {/* Active indicator */}
                  <div className={`absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-12 bg-gradient-to-b from-indigo-600 to-violet-600 rounded-full transition-all duration-300 ${activeResultIndex === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}></div>
                  
                  <div className="relative z-10 p-6">
                    {/* Source badge */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-tight shadow-sm ${
                        isDark
                          ? "bg-gradient-to-r from-indigo-900/50 to-violet-900/50 text-indigo-300"
                          : "bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700"
                      }`}>
                        Source {idx + 1}
                      </span>
                      {item.url && (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`text-xs font-mono truncate max-w-xs transition-colors flex items-center gap-1 group/link ${
                            isDark
                              ? "text-slate-600 hover:text-indigo-400"
                              : "text-slate-400 hover:text-indigo-600"
                          }`}
                        >
                          <svg className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate">{item.url}</span>
                        </a>
                      )}
                    </div>
                    
                    {/* Title */}
                    <a 
                      href={item.url || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block transition-colors duration-300"
                    >
                      <h3 className={`text-2xl md:text-3xl font-bold tracking-tight mb-4 leading-[1.15] bg-gradient-to-br bg-clip-text transition-all duration-300 ${
                        isDark
                          ? "from-slate-100 to-slate-300 group-hover:from-indigo-400 group-hover:to-violet-400"
                          : "from-slate-900 to-slate-700 group-hover:from-indigo-600 group-hover:to-violet-600"
                      }`}>
                        {item.title}
                      </h3>
                    </a>
                    
                    {/* Preview text */}
                    <p className={`text-base md:text-lg leading-relaxed font-light ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {item.text?.substring(0, 280) || ''}
                      {item.text?.length > 280 && <span className={isDark ? "text-indigo-500" : "text-indigo-300"}>...</span>}
                    </p>
                    
                    {/* Read more link */}
                    {item.url && (
                      <a 
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 mt-4 text-sm font-semibold transition-colors group/read ${
                          isDark
                            ? "text-indigo-400 hover:text-violet-400"
                            : "text-indigo-600 hover:text-violet-600"
                        }`}
                      >
                        <span>Read full article</span>
                        <svg className="h-4 w-4 group-hover/read:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* VISUAL COLUMN */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-8">
                <header className="flex items-center gap-4 mb-8">
                  <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${isDark ? "to-slate-700" : "to-slate-200"}`}></div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-[0.3em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Visuals</span>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isDark ? "bg-violet-400" : "bg-violet-600"}`} style={{ animationDelay: '0.5s' }}></div>
                  </div>
                </header>

                {results.image_results?.length === 0 && !loading && (
                  <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] backdrop-blur-sm ${
                    isDark
                      ? "border-slate-700/50 bg-slate-800/30"
                      : "border-slate-200/50 bg-white/30"
                  }`}>
                    <div className={`w-16 h-16 mx-auto mb-4 ${isDark ? "text-slate-700" : "text-slate-200"}`}>
                      <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className={`italic text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>No images found</p>
                  </div>
                )}

                <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                  {results.image_results?.map((img, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedImage(img)}
                      className={`break-inside-avoid group relative rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer ${
                        img._fading ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
                      } ${
                        isDark
                          ? "bg-slate-800 hover:shadow-indigo-500/20"
                          : "bg-slate-100 hover:shadow-indigo-200/50"
                      }`}
                      style={{ animationDelay: `${i * 75}ms` }}
                    >
                      {/* Image */}
                      <img 
                        src={`http://localhost:8000/wikipedia_scrape/images/${img.filename}`} 
                        alt={img.caption || img.title}
                        className="w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110" 
                        loading="lazy"
                      />
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
                        <p className="text-white text-xs font-bold uppercase tracking-wider leading-tight transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          {img.title}
                        </p>
                        {img.caption && (
                          <p className="text-white/80 text-[10px] mt-1 leading-tight transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-75">
                            {img.caption.substring(0, 100)}{img.caption.length > 100 && '...'}
                          </p>
                        )}
                      </div>
                      
                      {/* Zoom icon */}
                      <div className={`absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 ${
                        isDark
                          ? "bg-slate-900/80 text-indigo-400"
                          : "bg-white/90 text-indigo-600"
                      }`}>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* IMAGE MODAL */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
            onClick={() => setSelectedImage(null)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="max-w-5xl max-h-[90vh] animate-in zoom-in-95 duration-300">
            <img 
              src={`http://localhost:8000/wikipedia_scrape/images/${selectedImage.filename}`}
              alt={selectedImage.caption || selectedImage.title}
              className="max-h-[90vh] w-auto rounded-2xl shadow-2xl"
            />
            {selectedImage.title && (
              <div className="mt-4 text-center">
                <h3 className="text-white text-xl font-bold mb-2">{selectedImage.title}</h3>
                {selectedImage.caption && (
                  <p className="text-white/70 text-sm">{selectedImage.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ENHANCED LOADING OVERLAY */}
      {(loading || refining) && (
        <div className={`fixed inset-0 backdrop-blur-2xl z-[100] flex flex-col items-center justify-center transition-all animate-in fade-in duration-500 ${
          isDark ? "bg-slate-950/90" : "bg-white/90"
        }`}>
          {/* Animated loader */}
          <div className="relative">
            {/* Outer ring */}
            <div className={`w-32 h-32 rounded-full border-2 animate-ping opacity-20 ${isDark ? "border-indigo-500" : "border-indigo-100"}`}></div>
            
            {/* Middle ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-24 h-24 rounded-full border-4 border-transparent animate-spin ${
                isDark
                  ? "border-t-indigo-400 border-r-violet-400"
                  : "border-t-indigo-600 border-r-violet-600"
              }`}></div>
            </div>
            
            {/* Inner pulse */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-6 h-6 bg-gradient-to-br rounded-full animate-pulse ${
                isDark
                  ? "from-indigo-400 to-violet-400 shadow-[0_0_30px_rgba(129,140,248,0.6)]"
                  : "from-indigo-600 to-violet-600 shadow-[0_0_30px_rgba(79,70,229,0.6)]"
              }`}></div>
            </div>
          </div>
          
          {/* Status text */}
          <div className="mt-12 text-center space-y-2">
            <span className={`block text-sm font-black uppercase tracking-[0.5em] bg-gradient-to-r bg-clip-text text-transparent ${
              isDark
                ? "from-indigo-400 to-violet-400"
                : "from-indigo-600 to-violet-600"
            }`}>
              {refining ? "Refining Context" : "Syncing Nexus"}
            </span>
            <div className="flex items-center justify-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-indigo-400" : "bg-indigo-600"}`}></div>
              <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-violet-400" : "bg-violet-600"}`} style={{ animationDelay: '0.1s' }}></div>
              <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-fuchsia-400" : "bg-fuchsia-600"}`} style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}