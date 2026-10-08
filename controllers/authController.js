import { comparePassword, hashPassword } from "../helpers/authHelper.js";
import userModel from "./../models/userModels.js"
import JWT from "jsonwebtoken";
import { fail, isId, isStr } from "../helpers/validate.js";
import { MAX_ADDRESSES, validateAddress } from "../helpers/rules.js";
import { userOut } from "../helpers/userOut.js";
import { adminIds, notify } from "../helpers/notify.js";

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
        //create user (registration always creates a customer; sellers apply later and an admin approves)
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
            user:userOut(user),
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
    res.send({success:true,user:userOut(req.user)})
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

//PUT profile: name, phone and address of the signed-in user (sellers may also change their store name)
export const profileController=async(req,res)=>{
    try{
        const {name,phone,address,storeName}=req.body || {}
        if(!isStr(name,1,100)) return fail(res,'Name is Required')
        if(!isStr(phone,1,30)) return fail(res,'phone no is Required')
        if(!isStr(address,1,300)) return fail(res,'address is Required')
        const patch={name:name.trim(),phone:phone.trim(),address:address.trim()}
        if(req.user.role===2 && storeName!==undefined){
            if(!isStr(storeName,2,60)) return fail(res,'Store name is required (2-60 characters)')
            patch.storeName=storeName.trim()
        }
        const user=await userModel.findByIdAndUpdate(req.user._id,patch,{returnDocument:'after'})
        res.send({success:true,message:'Profile updated',user:userOut(user)})
    }
    catch(error){
        console.log(error)
        res.status(500).send({success:false,message:'Error updating profile'})
    }
}

//POST seller application: a customer asks to become a seller; an admin approves it (Admin > Users)
export const sellerRequestController=async(req,res)=>{
    try{
        if(req.user.role!==0) return fail(res,'Only customer accounts can apply to sell',409)
        const storeName=req.body?.storeName
        if(!isStr(storeName,2,60)) return fail(res,'Store name is required (2-60 characters)')
        const user=await userModel.findByIdAndUpdate(req.user._id,{sellerRequest:true,storeName:storeName.trim()},{returnDocument:'after'})
        await notify(await adminIds(),{type:'seller',message:`${user.name} applied to become a seller (${user.storeName})`,link:'/admin/users'})
        res.send({success:true,message:'Application sent. An admin will review it.',user:userOut(user)})
    }
    catch(error){
        console.log(error)
        res.status(500).send({success:false,message:'Error sending application'})
    }
}

//address book: GET /auth/addresses, POST, PUT /:id, DELETE /:id (at most MAX_ADDRESSES, exactly one default)
const cleanAddress=(b)=>({
    label:typeof b.label==='string'?b.label.trim():'',
    name:b.name.trim(),phone:b.phone.trim(),street:b.street.trim(),city:b.city.trim(),zip:b.zip.trim()
})
const sendBook=(res,user,message,status=200)=>res.status(status).send({success:true,message,addresses:user.addresses})
const fixDefault=(user,wantId)=>{
    const list=user.addresses
    if(list.length===0) return
    const pick=list.find(a=>String(a._id)===String(wantId)) || list.find(a=>a.isDefault) || list[0]
    list.forEach(a=>{a.isDefault=a===pick})
}

export const listAddresses=async(req,res)=>sendBook(res,req.user,'Addresses fetched')

export const addAddress=async(req,res)=>{
    try{
        const b=req.body||{}
        const errs=validateAddress(b)
        if(Object.keys(errs).length) return fail(res,Object.values(errs)[0])
        if(req.user.addresses.length>=MAX_ADDRESSES) return fail(res,`You can save at most ${MAX_ADDRESSES} addresses`,409)
        req.user.addresses.push({...cleanAddress(b),isDefault:false})
        const added=req.user.addresses[req.user.addresses.length-1]
        fixDefault(req.user,b.isDefault===true||req.user.addresses.length===1?added._id:null)
        await req.user.save()
        sendBook(res,req.user,'Address saved',201)
    }
    catch(error){
        console.log(error)
        res.status(500).send({success:false,message:'Error saving address'})
    }
}

export const updateAddress=async(req,res)=>{
    try{
        if(!isId(req.params.id)) return fail(res,'Invalid address id')
        const a=req.user.addresses.id(req.params.id)
        if(!a) return fail(res,'Address not found',404)
        const b=req.body||{}
        const errs=validateAddress(b)
        if(Object.keys(errs).length) return fail(res,Object.values(errs)[0])
        Object.assign(a,cleanAddress(b))
        fixDefault(req.user,b.isDefault===true?a._id:null)
        await req.user.save()
        sendBook(res,req.user,'Address updated')
    }
    catch(error){
        console.log(error)
        res.status(500).send({success:false,message:'Error updating address'})
    }
}

export const deleteAddress=async(req,res)=>{
    try{
        if(!isId(req.params.id)) return fail(res,'Invalid address id')
        const a=req.user.addresses.id(req.params.id)
        if(!a) return fail(res,'Address not found',404)
        a.deleteOne()
        fixDefault(req.user,null)
        await req.user.save()
        sendBook(res,req.user,'Address removed')
    }
    catch(error){
        console.log(error)
        res.status(500).send({success:false,message:'Error removing address'})
    }
}
