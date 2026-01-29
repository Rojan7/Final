import React from "react";
import SearchPage from "./components/SearchPage.js";

function App() {
  return (
    <div className="min-h-screen bg-[#f8fafc] transition-all duration-500">
      <div className="relative min-h-screen overflow-hidden selection:bg-indigo-500/30">

        {/* --- Ambient Background Accents --- */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse bg-indigo-200/30" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse bg-cyan-200/30 [animation-delay:2s]" />
        </div>

        {/* --- Render Only Search Page --- */}
        <SearchPage />

      </div>
    </div>
  );
}

export default App;
