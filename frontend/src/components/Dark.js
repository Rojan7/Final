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
  const resultsRef = useRef(null);

  useEffect(() => {
    if (hasSearched && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [hasSearched]);

  const performSearch = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);

    try {
      const res = await axios.get(
        `http://localhost:8000/search?q=${encodeURIComponent(q)}`
      );
      setResults(res.data);
      setBaseEmbedding(res.data.embedding);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setHasSearched(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(
        "http://localhost:8000/search/image/unified",
        formData
      );
      setResults(res.data);
      setBaseEmbedding(res.data.embedding);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!refineText.trim() || !baseEmbedding) return;
    setRefining(true);

    try {
      const data = await refineSearch(baseEmbedding, refineText);
      setResults(data);
      setBaseEmbedding(data.embedding);
      setQuery((q) => `${q} → ${refineText}`);
      setRefineText("");
    } catch (e) {
      console.error(e);
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0f19] via-[#0f172a] to-[#020617] text-slate-200">
      
      {/* Background grid */}
      <div className="fixed inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #6366f1 1px, transparent 1px), linear-gradient(to bottom, #6366f1 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* HEADER */}
      <section className={`max-w-7xl mx-auto px-6 transition-all ${hasSearched ? "pt-8" : "min-h-screen flex flex-col justify-center text-center"}`}>
        <h1
          onClick={() => {
            setHasSearched(false);
            setQuery("");
            setResults({ text_results: [], image_results: [] });
            setBaseEmbedding(null);
          }}
          className={`cursor-pointer font-black tracking-tight transition-all ${
            hasSearched
              ? "text-5xl bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent"
              : "text-8xl md:text-9xl text-white"
          }`}
        >
          NEXUS<span className="text-indigo-500">.</span>
        </h1>

        {!hasSearched && (
          <p className="mt-4 text-slate-400">
            Dark semantic multimodal search engine
          </p>
        )}

        {/* SEARCH BAR */}
        <div className="mt-12 max-w-3xl mx-auto relative">
          <div
            className={`absolute -inset-1 rounded-3xl blur-xl transition ${
              isFocused ? "bg-indigo-500/30" : "bg-transparent"
            }`}
          />
          <div className="relative flex items-center bg-slate-900/80 border border-slate-700 rounded-3xl p-3 backdrop-blur-xl">
            <input
              className="flex-1 bg-transparent outline-none text-lg px-4 text-slate-200 placeholder-slate-500"
              placeholder="Search the dark nexus..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />

            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleImageUpload(e.target.files[0])}
              />
              <div className="p-3 rounded-full bg-slate-800 hover:bg-indigo-600 transition">
                📷
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* RESULTS */}
      {hasSearched && (
        <main
          ref={resultsRef}
          className="max-w-[1400px] mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-16"
        >
          {/* TEXT */}
          <div className="lg:col-span-7 space-y-10">
            {results.text_results.map((item, idx) => (
              <article
                key={idx}
                onMouseEnter={() => setActiveResultIndex(idx)}
                onMouseLeave={() => setActiveResultIndex(null)}
                className="relative bg-slate-900/70 border border-slate-800 rounded-3xl p-8 hover:border-indigo-500 transition"
              >
                <h3 className="text-2xl font-bold text-white mb-4">
                  {item.title}
                </h3>
                <p className="text-slate-400">
                  {item.text?.substring(0, 280)}...
                </p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-4 text-indigo-400 hover:underline"
                  >
                    Read more →
                  </a>
                )}
              </article>
            ))}
          </div>

          {/* IMAGES */}
          <div className="lg:col-span-5 columns-2 gap-4 space-y-4">
            {results.image_results.map((img, i) => (
              <div
                key={i}
                onClick={() => setSelectedImage(img)}
                className="rounded-2xl overflow-hidden bg-slate-800 cursor-pointer hover:scale-[1.02] transition"
              >
                <img
                  src={`http://localhost:8000/wikipedia_scrape/images/${img.filename}`}
                  alt={img.caption}
                  className="w-full object-cover"
                />
              </div>
            ))}
          </div>
        </main>
      )}

      {/* IMAGE MODAL */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999]"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={`http://localhost:8000/wikipedia_scrape/images/${selectedImage.filename}`}
            className="max-h-[90vh] rounded-2xl"
          />
        </div>
      )}

      {/* LOADER */}
      {(loading || refining) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[500]">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
