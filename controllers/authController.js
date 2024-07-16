import { hashPassword } from "../helpers/authHelper.js";
import userModel from "./../models/userModels.js"
import { Jwt } from "jsonwebtoken";

export const registerController= async(req,res)=>{
    try{
        const {name,email,password,phone,address}=req.body
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
        const user=await new userModel ({name,email,phone,address,password:hashedPassword}).save()
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

