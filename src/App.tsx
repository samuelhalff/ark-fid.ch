import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Team from "./pages/Team";
import Contact from "./pages/ContactForm";
import NavBar from "@/NavigationMenu/Navbar";
import "./i18n.ts";
import Footer from "./components/ui/footer.tsx";
import Accounting from "./pages/Services/Accounting/Accounting.tsx";
import Taxes from "./pages/Services/Taxes/Taxes.tsx";
import Payroll from "./pages/Services/Payroll/Payroll.tsx";
import "./App.css";
import Odoo from "./pages/Services/Odoo/Odoo.tsx";
import Outsourcing from "./pages/Services/Outsourcing/Outsourcing.tsx";
import Corporate from "./pages/Services/Corporate/Corporate.tsx";
import Domiciliation from "./pages/Services/Domiciliation/Domiciliation.tsx";
import { useEffect } from "react";

function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location]);
  return (
    <div>
      <NavBar />
      <main className={"p-4 abstract-background text-foreground"}>
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
          <Route path="/outsourcing" element={<Outsourcing />} />
          <Route path="/domiciliation" element={<Domiciliation />} />
          <Route path="/corporate" element={<Corporate />} />
          <Route path="/odoo" element={<Odoo />} />
        </Routes>

        <Footer />
      </main>
    </div>
  );
}

export default App;
