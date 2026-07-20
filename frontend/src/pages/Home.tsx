import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Marquee from '../components/Marquee';
import About from '../components/About';
import Projects from '../components/Projects';
import CampaignBanner from '../components/CampaignBanner';
import GetInvolved from '../components/GetInvolved';
import Footer from '../components/Footer';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <main className="w-full flex flex-col items-center relative">
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
