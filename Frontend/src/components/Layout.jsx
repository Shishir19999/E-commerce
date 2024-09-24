import React from 'react'
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import {Helmet} from "react-helmet";


const Layout = ({children,title,description,keywords,author}) => {
  return (
    <div>
        <Helmet>
          <meta charSet="utf-8" />
          <meta name="description" content="Free Web tutorials" />
          <meta name="keywords" content="HTML, CSS, JavaScript" />
          <meta name="author" content="John Doe" />
        </Helmet>
        <Header/>
        <main style={{minHeight:"70vh"}}>{children}</main>
      <Footer/>
    </div>
  )
}

export default Layout
