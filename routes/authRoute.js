import Express  from "express";
import registerController from "../controllers/authController";

//router object
const router=express.Router()

//routing
//Register || Method POST
router.post('/register',registerController)

export default router