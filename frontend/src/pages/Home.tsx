import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Marquee from '../components/Marquee';
import About from '../components/About';
import Projects from '../components/Projects';
import CampaignBanner from '../components/CampaignBanner';
import GetInvolved from '../components/GetInvolved';
import Footer from '../components/Footer';
import { isAuthenticated, getRoleHomePath } from '../utils/auth';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(getRoleHomePath(), { replace: true });
    }
  }, [navigate]);

  if (isAuthenticated()) {
    return null;
  }

  return (
    <main className="w-full flex flex-col items-center relative bg-[#03020E] text-white">
      <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="w-full">
        <Hero />
      </div>
      <div className="w-full mt-12 mb-6">
        <Marquee />
      </div>
      <About />
      <Projects />
      <CampaignBanner />
      <GetInvolved />
      <Footer />
    </main>
  );
}
