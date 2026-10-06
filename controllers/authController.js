import { comparePassword, hashPassword } from "../helpers/authHelper.js";
import userModel from "./../models/userModels.js"
import JWT from "jsonwebtoken";
import { fail, isStr } from "../helpers/validate.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//POST Registration
export const registerController= async(req,res)=>{
    try{
        const {name,email,password,phone,address}=req.body || {}
        //validation (all inputs must be strings; blocks operator-injection objects)
        if(!isStr(name,1,100)) return fail(res,'Name is Required')
        if(!isStr(email,3,200) || !EMAIL_RE.test(email.trim())) return fail(res,'A valid email is Required')
        if(typeof password!=='string' || password.length<6 || password.length>100) return fail(res,'Password is required (6-100 chars)')
        if(!isStr(phone,1,30)) return fail(res,'phone no is Required')
        if(!isStr(address,1,300)) return fail(res,'address is Required')

        const cleanEmail=email.trim().toLowerCase()
        //check user
        const existingUser=await userModel.findOne({email:cleanEmail})
        if(existingUser){
            return fail(res,'Already Register Please Login',409)
        }
        //create user
        const hashedPassword=await hashPassword(password)
        //save
        const user=await new userModel ({name:name.trim(),email:cleanEmail,phone:phone.trim(),address:address.trim(),password:hashedPassword,role:0}).save()
        res.status(201).send({
            success:true,
            message:'Register Successfull',
            user:{
                _id:user._id,
                name:user.name,
                email:user.email,
                phone:user.phone,
                address:user.address
            }
        })
    }
    catch(error){
        console.log(error)
        if(error.code===11000) return fail(res,'Already Register Please Login',409)
        res.status(500).send({
            success:false,
            message:"Error in Registration"
        })
    }
};

//POST LOGIN
export const loginController=async (req,res)=>{
    try{
        const {email,password}=req.body || {}
        //validation
        if(typeof email!=='string' || typeof password!=='string' || !email || !password){
            return fail(res,'Invalid Email or Password',400)
        }
        //check user
        const user =await userModel.findOne({email:email.trim().toLowerCase()})
        if(!user){
           return fail(res,'Email is not registered',404)
        }
        const match=await comparePassword(password,user.password)
        if(!match){
           return fail(res,'Invalid Password',401)
        }
        //token
        const token=await JWT.sign({_id:user._id,tv:user.tokenVersion||0},process.env.JWT_SECRET,{expiresIn:'7d'})
        res.status(200).send({
            success:true,
            message:'Login Successfull',
            user:{
                _id:user._id,
                name:user.name,
                email:user.email,
                phone:user.phone,
                address:user.address,
                role:user.role
            },
            token
        })
    }
    catch(error){
        console.log(error)
        res.status(500).send({
          success:false,
          message:"Error in Login"
        })
    }
}

//GET current user (requireSignIn already verified the token and that the user still exists)
export const meController=(req,res)=>{
    const user=req.user
    res.send({success:true,user:{_id:user._id,name:user.name,email:user.email,phone:user.phone,address:user.address,role:user.role}})
}

//POST logout: bumps tokenVersion so every token issued so far is rejected
export const logoutController=async(req,res)=>{
    try{
        await userModel.updateOne({_id:req.user._id},{$inc:{tokenVersion:1}})
        res.send({success:true,message:'Logged out; existing tokens revoked'})
    }
    catch(error){
        console.log(error)
        res.status(500).send({success:false,message:'Error in logout'})
    }
}

//test controller
export const testController=(req,res)=>{
    res.send("Protected Route")
}
