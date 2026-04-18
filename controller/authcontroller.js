const User = require('../models/user')
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
exports.register = async (req,res)=>{
    try {
         const  {userName , email , password} = req.body
    const existmail = await User.findOne({email})
    const existusername = await  User.findOne({userName})
    if(existmail)
    {
        return res.status(400).json({message:"sorry this mail already exist"})
     }
    if(existusername)
    {
        return res.status(400).json({message:"this username already exit"})
    }
    const hashed = await bcrypt.hash(password,10)
    const newuser = await User.create({
        userName,email,password:hashed
    })
        const token = jwt.sign({userid:newuser._id},process.env.JWT_SECRET,{expiresIn:"2d"})

    return res.json({
        token,
        userid:newuser._id,
        userName:newuser.userName,
        message:"user registered successfully "
    })
    } catch (error) {
        return res.status(500).json({message:error.message})
    }
   
}

// this is the login controller here 

exports.login = async (req,res)=>{
try {
    const {emailorusername,password} = req.body
    const exisinguser = await User.findOne({$or:[{email:emailorusername},{userName:emailorusername}]})
    if (!exisinguser)
        return res.status(400).json({message:"user not found"})
    const match = await bcrypt.compare(password,exisinguser.password)
    if(!match)
    {
        return res.status(401).json({message:"wrong password"})
    }
    const token = jwt.sign({userid:exisinguser._id},process.env.JWT_SECRET,{expiresIn:"2d"})
    return res.json({
        message:"login successful"
        ,userid:exisinguser._id
        ,token
    })
    
} catch (error) {
    return res.status(500).json({message:error.message})
}
}