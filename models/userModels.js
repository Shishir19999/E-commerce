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
     // 0 customer, 1 admin, 2 seller
     role:{
        type:Number,
        default:0
     },
     wishlist:{
        type:[{type:mongoose.ObjectId,ref:"product"}],
        default:[]
     },
     // saved delivery addresses (address book)
     addresses:{
        type:[{
            label:{type:String,default:"",maxlength:30},
            name:{type:String,required:true},
            phone:{type:String,required:true},
            street:{type:String,required:true},
            city:{type:String,required:true},
            zip:{type:String,required:true},
            isDefault:{type:Boolean,default:false}
        }],
        default:[]
     },
     // role 2 (seller): public store name; sellerRequest is true while an application waits for an admin
     storeName:{type:String,default:"",trim:true,maxlength:60},
     sellerRequest:{type:Boolean,default:false},
     // bumped on logout; tokens carrying an older value are rejected
     tokenVersion:{
        type:Number,
        default:0
     }

},{timestamps:true})

export default mongoose.model('users',userSchema)