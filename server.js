import express, { Router } from "express";
import morgan from "morgan";
import dotenv from "dotenv"
import connectDB from "./config/db.js"
import authRoutes from './routes/authRoute.js'


//rest object
const app=express()

//dotenv file
dotenv.config()

//Database
connectDB();

//middlewares
app.use(express.json())
app.use(morgan('dev'));

//routes 
app.use('api/v1/auth', authRoutes)

//rest api
app.get("/",(req,res)=>{
    res.send(
            "<h1>welcome</h1>"            
            )
        })

//PORT from env file
const PORT=process.env.PORT || 3000

//run listen
app.listen(PORT,()=>{
    console.log(`server is running on ${process.env.DEV_MODE} mode on port ${PORT}`)
})