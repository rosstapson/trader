import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Nav } from "@/components/nav";
import { SearchView } from "@/components/search-view";
import { CompanyView } from "@/components/company-view";
import { WatchlistsListView } from "@/components/watchlists-list-view";
import { WatchlistDetailView } from "@/components/watchlist-detail-view";
import { AlertsView } from "@/components/alerts-view";

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<SearchView />} />
        <Route path="/company/:symbol" element={<CompanyView />} />
        <Route path="/watchlists" element={<WatchlistsListView />} />
        <Route path="/watchlists/:id" element={<WatchlistDetailView />} />
        <Route path="/alerts" element={<AlertsView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
