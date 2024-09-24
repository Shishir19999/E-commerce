import React from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

const Layout = ({
  children,
  title = 'E-commerce app',
  description = "mern stack project",
  keywords = "mern,react,node,mongodb,express",
  author = "shishir"
}) => {
  return (
    <HelmetProvider>
      <div>
        <Helmet>
          <meta charSet="utf-8" />
          <meta name="description" content={description} />
          <meta name="keywords" content={keywords} />
          <meta name="author" content={author} />
          <title>{title}</title>
        </Helmet>
        <Header />
        <main style={{ minHeight: "70vh" }}>{children}</main>
        <Footer />
      </div>
    </HelmetProvider>
  );
};

export default Layout;
