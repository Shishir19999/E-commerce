import express  from "express";
import {registerController, loginController,testController,meController,logoutController} from "../controllers/authController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";

//router object
const router=express.Router()

//routing

//Register || Method POST
router.post('/register',registerController)
//LOGIN || POST
router.post('/login',loginController)
//current user || GET
router.get('/me',requireSignIn,meController)
//logout (revokes all tokens) || POST
router.post('/logout',requireSignIn,logoutController)
//test Routes
router.get("/test",requireSignIn,isAdmin ,testController)

export default router