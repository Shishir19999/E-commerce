import React,{useState} from 'react';
import Layout from '../../components/Layout';
import {toast} from 'react-toastify'

const Register = () => {
const [name,setName]=useState("")
const [email,setEmail]=useState("")
const [phone,setPhone]=useState("")
const [password,setPassword]=useState("")
const [address,setAddress]=useState("")

const handleSubmit=(e)=>{
  e.preventDefault()
  console.log(name,email,password,address,phone)
  toast.success('Register Successfully')
}


  return (
    <Layout title="Register">
      <div className="register">
        <h1>Register Page</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            
            <input
              type="text"
              value={name}
              className="form-control"
              id="exampleInputName"
              onChange={(e)=>setName(e.target.value)} 
              placeholder='Enter Your Name'
              required
            />
          </div>
          <div className="mb-3">
             <input
              type="email"
              value={email}
              className="form-control"
              id="exampleInputEmail"
              onChange={(e)=>setEmail(e.target.value)}
              placeholder='Enter Your Email'
              required

            />
          </div>
          <div className="mb-3">
           
            <input
              type="password"
              value={password}
              className="form-control"
              id="exampleInputPassword"
              onChange={(e)=>setPassword(e.target.value)}
              placeholder='Enter Your password'
              required

            />
          </div>
          <div className="mb-3">
            
            <input
              type="text"
              value={phone}
              className="form-control"
              id="exampleInputEmail"
              onChange={(e)=>setPhone(e.target.value)}
              placeholder='Enter Your Phone no.'
              required

            />
          </div><div className="mb-3">
           
            <input
              type="text"
              value={address}
              className="form-control"
              id="exampleInputEmail"
              onChange={(e)=>setAddress(e.target.value)}
              placeholder='Enter Your Address'
              required

            />
          </div>

          <button type="submit" className="btn btn-primary">
            Submit
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Register;
