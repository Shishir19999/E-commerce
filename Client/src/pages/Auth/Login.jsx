import { useState } from "react";
import Layout from "./../../components/Layout";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import API, { errMsg } from "./config/API";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await API.post("/api/v1/auth/login", { email, password });
      if (res.data.success) {
        login(res.data.user, res.data.token);
        toast.success(res.data.message);
        navigate(location.state?.from || "/", { replace: true });
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Login - Ecommerce App">
      <div className="register">
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <h4 className="title">LOGIN</h4>
            <div className="mb-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-control" placeholder="Email" required autoFocus />
            </div>
            <div className="mb-3">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-control" placeholder="Password" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>LOGIN</button>
            <p className="mt-3">
              No account? <Link to="/register">Register</Link>
            </p>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
