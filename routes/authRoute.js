import express  from "express";
import {registerController, loginController,testController} from "../controllers/authController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";

//router object
const router=express.Router()

//routing

//Register || Method POST
router.post('/register',registerController)
//LOGIN || POST
router.post('/login',loginController)
//test Routes
router.get("/test",requireSignIn,isAdmin ,testController)

export default router