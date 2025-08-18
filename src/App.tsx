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
import Payroll from "./pages/Services/Payroll/Payroll.tsx";

function App() {
  const { theme } = useTheme();
  return (
    <div>
      <NavBar />
      <main
        className={
          "p-4 " +
          "abstract-background-" +
          (theme == "system" ? "light" : theme) +
          " text-foreground"
        }
      >
        <meta
          name="description"
          content="Bienvenue chez Ark Fiduciaire. Découvrez nos services de comptabilité, fiscalité, conseil et accompagnement pour entreprises et particuliers."
        />
        <meta
          name="keywords"
          content="comptabilité, fiscalité, déductions, conseil, Ark Fiduciaire, services, entreprise, constitution, SA, Sàrl, audit, gestion, accompagnement"
        />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/taxes" element={<Taxes />} />
          <Route path="/payroll" element={<Payroll />} />
        </Routes>

        <Footer />
      </main>
    </div>
  );
}

export default App;
