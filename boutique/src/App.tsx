import { useEffect } from 'react';
import { CartDrawer } from './components/Cart';
import { ConsentBanner, Footer, Header } from './components/Layout';
import Contact from './pages/Contact';
import Home from './pages/Home';
import { Cgv, Confidentialite, Livraison, MentionsLegales, Merci, NotFound, Retractation } from './pages/Legal';
import { usePath } from './lib/router';

const ROUTES: Record<string, () => React.JSX.Element> = {
  '/': Home,
  '/livraison': Livraison,
  '/contact': Contact,
  '/cgv': Cgv,
  '/retractation': Retractation,
  '/mentions-legales': MentionsLegales,
  '/confidentialite': Confidentialite,
  '/merci': Merci,
};

export default function App() {
  const path = usePath();
  const Page = ROUTES[path] ?? NotFound;

  // Move focus to the new page for keyboard and screen-reader users.
  useEffect(() => {
    if (path !== '/') document.getElementById('contenu')?.focus({ preventScroll: true });
  }, [path]);

  return (
    <>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" tabIndex={-1}>
        <Page />
      </main>
      <Footer />
      <CartDrawer />
      <ConsentBanner />
    </>
  );
}
