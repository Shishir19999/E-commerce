import JWT from "jsonwebtoken";
import userModel from "./../models/userModels.js"


//Protected Routes token base: verifies the JWT, that the user still exists, and that the token was not revoked
export const requireSignIn=async (req,res,next)=>{
    try{
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).send({
                success: false,
                message: "Token missing, authorization denied"
            });
        }
        // accept "Bearer <token>" (or a raw token for backward compatibility)
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
        if (!token) {
            return res.status(401).send({
                success: false,
                message: "Token missing, authorization denied"
            });
        }
        const decode =JWT.verify(token,process.env.JWT_SECRET)
        const user=await userModel.findById(decode._id)
        if(!user){
            return res.status(401).send({success:false,message:"User no longer exists"})
        }
        if((decode.tv ?? 0)!==(user.tokenVersion ?? 0)){
            return res.status(401).send({success:false,message:"Token has been revoked, please log in again"})
        }
        req.user=user
        next();
    }
    catch(error){
        return res.status(401).send({
            success: false,
            message: "Invalid or expired token"
        });
    }
}


//admin access (must run after requireSignIn, which loads the current user from the DB)
export const isAdmin=async(req,res,next)=>{
    if(!req.user || req.user.role!==1){
        return res.status(401).send(
            {
               success:false,
               message:"Unauthorized Access"
            }
        )
    }
    next();
}
