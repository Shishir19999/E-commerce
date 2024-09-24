import React from 'react'
import Layout from '../components/Layout'
import {BiMailSend,BiPhoneCall,BiSupport} from 'react-icons/bi'


const Contact = () => {
  return (
      <Layout title={"Contact us - Ecommerce App"}>
        <div className="row contactus">
            <div className="col-md-6">
                <img src="./images/contactus.jpeg" alt="contactus" style={{width:"100%"}} />
            </div>
            <div className="col-md-4">
                <h1 className='bg-dark p-2 text-white text-center'>
                    CONTACT US
                </h1>
                <p className="text-justify mt-2">
                    Any query and info and product feel free to call anytime we 24x7 available
                </p>
                <p className="mt-3">
                    <BiMailSend/> : www.helpsupport.com
                    </p>
                <p className="mt-3">
                    <BiPhoneCall/> : +977 1234567890
                </p>
                <p className="mt-3">
                    <BiSupport/> :9999-9999-9999 (toll free)
                </p>
            </div>
        </div>
   </Layout>
  )
}

export default Contact
