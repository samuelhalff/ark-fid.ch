import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Team from "./pages/Team";
import Contact from "./pages/ContactForm";
import NavBar from "@/NavigationMenu/Navbar";
import { useTheme } from "@/components/ui/theme-provider";
import "./i18n.ts";
import Footer from "./components/ui/footer.tsx";
import Accounting from "./pages/Services/Accounting/Accounting.tsx";
import Taxes from "./pages/Services/Taxes/Taxes.tsx";

function App() {
  const { theme } = useTheme();
  return (
    <div>
      <NavBar />
      <main
        className={
          "p-8 " +
          "abstract-background-" +
          (theme == "system" ? "light" : theme) +
          " text-foreground"
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/taxes" element={<Taxes />} />
          {/* Add more routes as needed */}
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
