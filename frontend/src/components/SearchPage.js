// import { useState, useEffect } from "react";
// import axios from "axios";

// export default function SearchPage({ isDark }) {
//   const [query, setQuery] = useState("");
//   const [results, setResults] = useState({ text_results: [], image_results: [] });
//   const [loading, setLoading] = useState(false);
//   const [hasSearched, setHasSearched] = useState(false);
//   const [isFocused, setIsFocused] = useState(false);

//   // Logic for unified search
//   const performSearch = async (q = query) => {
//     if (!q) return;
//     setLoading(true);
//     setHasSearched(true);
//     try {
//       const res = await axios.get(`http://localhost:8000/search?q=${q}`);
//       setResults({
//         text_results: res.data.text_results || [],
//         image_results: res.data.image_results || []
//       });
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleImageUpload = async (file) => {
//     if (!file) return;
//     setLoading(true);
//     setHasSearched(true);
//     const formData = new FormData();
//     formData.append("file", file);
//     try {
//       const res = await axios.post("http://localhost:8000/search/image/unified", formData);
//       setResults(res.data);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   return (
//     <div className={`relative z-10 w-full transition-all duration-1000 ease-in-out ${!hasSearched ? "flex flex-col items-center justify-center min-h-screen" : "pt-8"}`}>
      
//       {/* --- HERO / SEARCH SECTION --- */}
//       <section className={`w-full max-w-4xl px-6 transition-all duration-700 ${hasSearched ? "mb-8 flex flex-row items-center gap-6" : "text-center"}`}>
        
//         {/* Futuristic Logo */}
//         <h1 
//           onClick={() => {setHasSearched(false); setQuery("");}}
//           className={`font-black tracking-tighter cursor-pointer transition-all duration-700 
//             ${hasSearched 
//               ? "text-3xl bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent" 
//               : "text-9xl mb-12 dark:text-white text-slate-900 drop-shadow-2xl hover:tracking-normal transition-all"}`}
//         >
//           NEXUS<span className="text-indigo-500 animate-ping inline-block w-3 h-3 bg-indigo-500 rounded-full ml-2"></span>
//         </h1>

//         {/* Floating Search Bar */}
//         <div className={`relative w-full group transition-all duration-700 ${hasSearched ? "max-w-2xl" : "max-w-3xl"}`}>
//           <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-[2.5rem] blur-xl opacity-0 
//             ${isFocused ? "opacity-40" : "group-hover:opacity-20"} transition duration-1000 animate-gradient-x`}></div>
          
//           <div className="relative flex items-center bg-white/70 dark:bg-black/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[2rem] p-2 shadow-2xl overflow-hidden">
//             <div className="pl-5 text-indigo-500">
//               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//               </svg>
//             </div>
            
//             <input
//               type="text"
//               onFocus={() => setIsFocused(true)}
//               onBlur={() => setIsFocused(false)}
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               onKeyDown={(e) => e.key === "Enter" && performSearch()}
//               placeholder="Ask the dataset anything..."
//               className="w-full px-5 py-4 text-xl bg-transparent outline-none dark:text-white text-slate-800 placeholder:text-slate-400 font-light"
//             />

//             {/* Visual Search Toggle */}
//             <label className="flex items-center px-4 cursor-pointer group/cam">
//               <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files[0])} />
//               <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover/cam:bg-indigo-500 group-hover/cam:text-white transition-all text-indigo-500">
//                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
//                 </svg>
//               </div>
//             </label>
//           </div>
//         </div>
//       </section>

//       {/* --- CONTENT DASHBOARD --- */}
//       <main className={`max-w-[1600px] mx-auto px-8 pb-20 transition-all duration-1000 ${hasSearched ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        
//         {loading ? (
//           <div className="flex flex-col items-center py-40">
//              <div className="relative w-20 h-20">
//                 <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
//                 <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
//              </div>
//              <p className="mt-8 text-indigo-500 font-bold tracking-[0.3em] animate-pulse uppercase text-xs">Processing Nexus Streams</p>
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
//             {/* Left: Intelligence (Text Results) */}
//             <div className="lg:col-span-7 space-y-6">
//               <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-4">Textual Intelligence</h2>
//               {results.text_results.map((item, idx) => (
//                 <div key={idx} className="group bg-white/5 dark:bg-white/[0.03] backdrop-blur-sm border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 dark:hover:bg-white/[0.07] transition-all hover:scale-[1.01] hover:shadow-2xl duration-300">
//                   <div className="flex items-center gap-3 mb-3 text-xs text-slate-400">
//                     <span className="bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md">WIKI-CLIP</span>
//                     <span className="truncate">{item.url}</span>
//                   </div>
//                   <a href={item.url} target="_blank" className="text-2xl font-bold dark:text-white text-slate-800 hover:text-indigo-400 transition-colors block mb-3">
//                     {item.title}
//                   </a>
//                   <p className="text-slate-400 leading-relaxed font-light">{item.text.substring(0, 300)}...</p>
//                 </div>
//               ))}
//             </div>

//             {/* Right: Visual Matrix (Image Grid) */}
//             <div className="lg:col-span-5">
//               <h2 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-4">Visual Matrix</h2>
//               <div className="grid grid-cols-2 gap-4">
//                 {results.image_results.map((img, i) => (
//                   <div key={i} className="group relative aspect-square rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900 shadow-lg">
//                     <img src={`http://localhost:8000/wikipedia_scrape/images/${img.filename}`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-125" alt="" />
//                     <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-transparent p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-all duration-500">
//                       <p className="text-white font-bold text-sm leading-tight">{img.title}</p>
//                       <button className="mt-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-[10px] uppercase font-bold text-white tracking-widest hover:bg-white/40 transition-all">Expand View</button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>

//           </div>
//         )}
//       </main>
//     </div>
//   );
// }
import { useState } from "react";
import axios from "axios";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ text_results: [], image_results: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const performSearch = async (q = query) => {
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await axios.get(`http://localhost:8000/search?q=${q}`);
      setResults({
        text_results: res.data.text_results || [],
        image_results: res.data.image_results || []
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setHasSearched(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("http://localhost:8000/search/image/unified", formData);
      setResults(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className={`relative z-10 w-full transition-all duration-1000 ease-in-out ${!hasSearched ? "flex flex-col items-center justify-center min-h-[85vh]" : "pt-8"}`}>
      
      {/* --- HERO / SEARCH SECTION --- */}
      <section className={`w-full max-w-4xl px-6 transition-all duration-700 ${hasSearched ? "mb-12 flex flex-row items-center gap-8" : "text-center"}`}>
        
        {/* Logo with Cyan Glow */}
        <h1 
          onClick={() => {setHasSearched(false); setQuery("");}}
          className={`font-black tracking-tighter cursor-pointer transition-all duration-700 
            ${hasSearched 
              ? "text-3xl bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent" 
              : "text-9xl mb-12 text-slate-900 drop-shadow-xl"}`}
        >
          NEXUS<span className="relative inline-flex h-3 w-3 ml-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
          </span>
        </h1>

        {/* Floating Glass Search Bar */}
        <div className={`relative w-full group transition-all duration-700 ${hasSearched ? "max-w-2xl" : "max-w-3xl"}`}>
          <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 rounded-[2.5rem] blur-xl opacity-0 
            ${isFocused ? "opacity-30" : "group-hover:opacity-15"} transition duration-1000`}></div>
          
          <div className="relative flex items-center bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="pl-5 text-indigo-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <input
              type="text"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
              placeholder="Search the nexus..."
              className="w-full px-5 py-4 text-xl bg-transparent outline-none text-slate-800 placeholder:text-slate-300 font-light"
            />

            <label className="flex items-center px-4 cursor-pointer group/cam">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files[0])} />
              <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover/cam:bg-indigo-600 group-hover/cam:text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* --- CONTENT DASHBOARD --- */}
      <main className={`max-w-[1400px] mx-auto px-10 pb-20 transition-all duration-1000 ${hasSearched ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        
        {loading ? (
          <div className="flex flex-col items-center py-40">
             <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3 animate-[loading_1.5s_infinite_linear]"></div>
             </div>
             <p className="mt-6 text-indigo-500 font-black uppercase text-[10px] tracking-[0.5em]">Synchronizing Nexus</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Column: Text Knowledge */}
            <div className="lg:col-span-7 space-y-8">
              <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-2 flex items-center gap-4">
                <span className="h-px w-8 bg-slate-200"></span> Textual Records
              </h2>
              {results.text_results.map((item, idx) => (
                <article key={idx} className="group bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center text-[10px] font-bold text-indigo-500">W</div>
                    <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{item.url || "source.nexus"}</span>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-2xl font-bold text-slate-900 hover:text-indigo-600 transition-colors block mb-3 leading-tight">
                    {item.title}
                  </a>
                  <p className="text-slate-500 leading-relaxed font-normal text-[15px]">{item.text.substring(0, 280)}...</p>
                </article>
              ))}
            </div>

            {/* Right Column: Visual Matrix */}
            <div className="lg:col-span-5">
              <h2 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-6 text-center">Visual Insight</h2>
              <div className="grid grid-cols-2 gap-4">
                {results.image_results.map((img, i) => (
                  <a href={img.url || "#"} target="_blank" rel="noopener noreferrer" key={i}>
                    <div className="group relative aspect-square rounded-[2rem] overflow-hidden border border-white bg-white shadow-sm ring-1 ring-slate-100">
                      <img 
                        src={`http://localhost:8000/wikipedia_scrape/images/${img.filename}`} 
                        alt={img.caption || img.title} 
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/90 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
                        <p className="text-white font-bold text-xs uppercase tracking-tighter">{img.title}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
