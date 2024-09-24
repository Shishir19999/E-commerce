import React from 'react'
import Layout from '../../components/Layout'

const Register = () => {
  return (
    <Layout title="Register">
        <div className="register">
            <h1>Register Page</h1>
            <form>
  <div className="mb-3">
    <label htmlFor="exampleInputEmail1" className="form-label">Name</label>
    <input type="email" className="form-control" id="exampleInputEmail1"  />
  </div>
  <div className="mb-3">
    <label htmlFor="exampleInputPassword1" className="form-label">Password</label>
    <input type="password" className="form-control" id="exampleInputPassword1" />
  </div>
  
  <button type="submit" className="btn btn-primary">Submit</button>
</form>

        </div>

    </Layout>
  )
}

export default Register
