import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import ItineraryPage from "@/pages/ItineraryPage";
import SignIn from "@/pages/SignIn";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/t/:slug" element={<ItineraryPage />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
