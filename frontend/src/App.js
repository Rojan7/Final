// import React, { useState } from "react";
// import SearchPage from "./components/SearchPage.js";

// function App() {
//   const [isDark, setIsDark] = useState(false);

//   return (
//     <div className={`${isDark ? "dark" : ""} min-h-screen transition-colors duration-500`}>
//       <div className="relative min-h-screen bg-slate-50 dark:bg-[#050505] overflow-hidden selection:bg-indigo-500/30">
        
//         {/* Animated Background Blobs */}
//         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-[120px] animate-pulse" />
//         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />

//         {/* Theme Toggle */}


//         <SearchPage isDark={isDark} />
//       </div>
//     </div>
//   );
// }

// export default App;
import React, { useState } from "react";
import SearchPage from "./components/SearchPage.js";
import Dark from "./components/Dark.js"; // Importing your custom dark component

function App() {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={`min-h-screen transition-all duration-500 ${isDark ? "bg-[#050505]" : "bg-[#f8fafc]"}`}>
      <div className="relative min-h-screen overflow-hidden selection:bg-indigo-500/30">
        
        {/* --- Theme Toggle Floating Button --- */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className={`fixed top-6 right-6 z-[100] px-5 py-2.5 rounded-2xl border backdrop-blur-xl transition-all active:scale-95 shadow-2xl font-bold text-xs tracking-widest uppercase
            ${isDark 
              ? "bg-white/10 border-white/20 text-white hover:bg-white/20" 
              : "bg-black/5 border-black/10 text-slate-900 hover:bg-black/10"
            }`}
        >
          {isDark ? "✨ Switch to Light" : "🌙 Switch to Dark"}
        </button>

        {/* --- Ambient Background Accents (Shared) --- */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse transition-colors duration-1000
            ${isDark ? "bg-indigo-900/40" : "bg-indigo-200/30"}`} 
          />
          <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse transition-colors duration-1000 [animation-delay:2s]
            ${isDark ? "bg-cyan-900/40" : "bg-cyan-200/30"}`} 
          />
        </div>

        {/* --- Conditional Rendering Logic --- */}
        {isDark ? (
          <Dark /> 
        ) : (
          <SearchPage />
        )}
        
      </div>
    </div>
  );
}

export default App;