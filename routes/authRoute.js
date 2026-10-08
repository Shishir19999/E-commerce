import express  from "express";
import {registerController, loginController,testController,meController,logoutController,profileController,sellerRequestController,listAddresses,addAddress,updateAddress,deleteAddress} from "../controllers/authController.js";
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
//update profile || PUT
router.put("/profile",requireSignIn,profileController)
//apply to become a seller || POST
router.post("/seller-request",requireSignIn,sellerRequestController)
//address book
router.get("/addresses",requireSignIn,listAddresses)
router.post("/addresses",requireSignIn,addAddress)
router.put("/addresses/:id",requireSignIn,updateAddress)
router.delete("/addresses/:id",requireSignIn,deleteAddress)
//logout (revokes all tokens) || POST
router.post('/logout',requireSignIn,logoutController)
//test Routes
router.get("/test",requireSignIn,isAdmin ,testController)

export default router
