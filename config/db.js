import mongoose from "mongoose";

const connectDb=async()=>{
    try{
        const conn=await mongoose.connect(process.env.MONGODB_URL)
        console.log(`connected to database Successfully ${conn.connection.host}`)
    }
    catch(error){
        console.log(`Error in Mongodb ${error}`);
    }
}

export default connectDb;