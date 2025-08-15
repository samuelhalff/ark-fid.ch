import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Team from "./pages/Team";
import Contact from "./pages/ContactForm";
import NavBar from "@/NavigationMenu/Navbar";
import { ThemeProvider } from "@/components/ui/theme-provider";
import "./i18n.ts";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <NavBar />
      {/* Page Content */}
      {/* The Routes component itself cannot be styled. Wrap it in a div or main tag. */}
      <main className="p-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contact" element={<Contact />} />
          {/* Add more routes as needed */}
        </Routes>
      </main>
    </ThemeProvider>
  );
}

export default App;
