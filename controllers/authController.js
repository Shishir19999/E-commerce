import { comparePassword, hashPassword } from "../helpers/authHelper.js";
import userModel from "./../models/userModels.js"
import JWT from "jsonwebtoken";


//POST Registration
export const registerController= async(req,res)=>{
    try{
        const {name,email,password,phone,address,role}=req.body
        //validation
        if(!name){
            return res.send({error:'Name is Required'})
        }
        if(!email){
            return res.send({error:'email is Required'})
        }
        if(!password){
            return res.send({error:'password is Required'})
        }
        if(!phone){
            return res.send({error:'phone no is Required'})
        }
        if(!address){
            return res.send({error:'address is Required'})
        }
        
        //check user
        const existingUser=await userModel.findOne({email})
        if(existingUser){
            return res.status(200).send({
                success:true,
                message:'Already Register Please Login',
            })
        }
        //create user
        const hashedPassword=await hashPassword(password)
        //save
        const user=await new userModel ({name,email,phone,address,password:hashedPassword,role:role || 0}).save()
        res.status(201).send({
            success:true,
            message:'Register Successfull',
            user
        })
    }
    catch(error){
        console.log(error)
        res.status(500).send({
            success:false,
            message:"Error in Registration",
            error

        })
    }
};

//POST LOGIN
export const loginController=async (req,res)=>{
    try{
        const {email,password}=req.body
        //validation
        if(!email || !password){
            return res.status(404).send({
                success:false,
                message:'Invalid Email or Password'
            })
        }
        //check user
        const user =await userModel.findOne({email})
        if(!user){
           return res.status(404).send({
            success:false,
            message:'Email is not registered'
           }) 
        }
        const match=await comparePassword(password,user.password)
        if(!match){
           return res.status(200).send({
            success:false,
            message:'Invalid Password'
           }) 
        }
        //token
        const token=await JWT.sign({_id:user._id},process.env.JWT_SECRET,{expiresIn:'7d'})
        res.status(200).send({
            success:true,
            message:'Login Successfull',
            user:{
                name:user.name,
                email:user.email,
                phone:user.phone,
                address:user.address
            },
            token
        })
    }
    catch(error){
        console.log(error)
        res.status(500).send({
          success:false,
          message:"Error in Login",
          error
        })
    }
}

//test controller
export const testController=(req,res)=>{
    res.send("Protected Route")
}