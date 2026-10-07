import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
     name:{
        type:String,
        required:true,
        trim:true
     },
     email:{
        type:String,
        required:true,
        unique:true
     },
     password:{
        type:String,
        required:true
     },
     phone:{
        type:String,
        required:true
     },
     address:{
        type:String,
        required:true
     },
     role:{
        type:Number,
        default:0
     },
     wishlist:{
        type:[{type:mongoose.ObjectId,ref:"product"}],
        default:[]
     },
     // bumped on logout; tokens carrying an older value are rejected
     tokenVersion:{
        type:Number,
        default:0
     }

},{timestamps:true})

export default mongoose.model('users',userSchema)