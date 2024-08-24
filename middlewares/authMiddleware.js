import JWT from "jsonwebtoken";
import userModel from "./../models/userModels.js"


//Protected Routes token base
export const requireSignIn=async (req,res,next)=>{
    try{
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).send({
                success: false,
                message: "Token missing, authorization denied"
            });
        }
        const decode =JWT.verify(token,process.env.JWT_SECRET)
        req.user=decode
        next();
    }
    catch(error){
        console.log(error)
    }
}


//admin access
export const isAdmin=async(req,res,next)=>{
    try{
        const user=await userModel.findById(req.user._id)
        if(user.role!==1){
           return res.status(401).send(
            {
               success:false,
               message:"Unauthorized Access" 
            }
           ) 
        }
        else{
           return res.status(200).send(
            {
               success:true,
               message:"welcome admin" 
            }
           ) 
        }
    }
    catch(error){
        console.log(error)
        res.send(401).send({
            success:false,
            error,
            message:"Error in admin middleware "
        })
    }
}