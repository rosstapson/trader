import { useState } from "react";
import { SearchView } from "@/components/search-view";
import { CompanyView } from "@/components/company-view";

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  return selectedSymbol ? (
    <CompanyView symbol={selectedSymbol} onBack={() => setSelectedSymbol(null)} />
  ) : (
    <SearchView onSelect={setSelectedSymbol} />
  );
}

export default App;
