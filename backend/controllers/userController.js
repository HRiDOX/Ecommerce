const ErrorHandler = require("../utils/errorhandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User = require("../models/userModel");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const cloudinary = require("cloudinary");

// Registration for a user
exports.registerUser =  catchAsyncErrors ( async(req,res,next)=> {
    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
        folder:"avatars",
        width:150,
        crop:"scale"
    });
    const {name,email,password} = req.body;
    const user = await User.create({
        name,
        email,
        password,
        avatar: {
            public_id : myCloud.public_id,
            url:myCloud.secure_url,
        },
    });
     
    sendToken(user,201,res);
});

// Login User

exports.loginUser = catchAsyncErrors(async (req,res,next)=> {
    const {email,password} = req.body;

    //Checking if user has given password and email both

    if (!email || !password) {
        return next(new ErrorHandler("Please Enter Email & Password" , 400));
        
    }

    const user = await User.findOne({ email }).select("+password");

    if(!user){
        return next(new ErrorHandler("Invalid email or password",401));
    }

    const isPasswordMatched = await user.comparePassword(password);

    if(!isPasswordMatched){
        return next(new ErrorHandler("Invalid email or password",401));
    }

    sendToken(user,200,res);
});

//LogOut User

exports.logout = catchAsyncErrors(async (req,res,next) => {
    res.cookie("token",null,{
        expires: new Date(Date.now()),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: "Logged Out",
    });
});

// Forgot password 

exports.forgotPassword = catchAsyncErrors( async(req,res,next) => {
    const user = await User.findOne({ email: req.body.email});

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    // get resetPassword Token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false});

    const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/v1/password/reset/${resetToken}`;

    const message = `Your password reset token is:-\n\n ${resetPasswordUrl} \n\nif you have not requested this email then , please ignore it`;

    try {
        await sendEmail ({
           email: user.email,
           subject: `Password Recovery`,
           message,

        });

        res.status(200).json({
            success: true,
            message: `Email sent to ${user.email} successfully`
        });
        
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false});

        return next(new ErrorHandler(error.message, 500));
    }
});


// Reset Password

exports.resetPassword = catchAsyncErrors ( async ( req,res,next) => {

    //creating token hash that is actually it'll take token from url thn hash it and will match it in cookies where the token is stored

    const resetPasswordToken =  crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return next( new ErrorHandler("Reset Password token is invalid or has been expired", 400));      
    }
    if (req.body.password !== req.body.confirmPassword) {
        return next( new ErrorHandler(" Password does not matched", 400));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    sendToken( user, 200, res);

});


// Get  User Detail
exports.getUserDetails = catchAsyncErrors(async(req,res,next) => {

    const user = await User.findById(req.user.id);
   
    res.status(200).json({
        success: true,
        user,
    });
});

// Update user password

exports.updatePassword = catchAsyncErrors( async (req, res, next)=> {

    const user = await User.findById(req.user.id).select("+password");
     
    const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

    if (!isPasswordMatched) {
        return next(new ErrorHandler("Password is incorrect", 401));
        
    } 

    if (req.body.newPassword !== req.body.confirmPassword) {
        return next(new ErrorHandler("Password does not match", 400));
    }


    user.password = req.body.newPassword;

     await user.save();

     sendToken(user, 200, res);
    
});

// Update User Profile
exports.updateProfile = catchAsyncErrors( async (req, res, next)=> {

    const newUserDate = {
        name: req.body.name,
        email:req.body.email,
    };

    // We will add cloudinary later

     const user =await User.findByIdAndUpdate(req.user.id, newUserDate, {
         new: true,
         runValidators: true,
         useFindAndModify: false,
     });
     


     res.status(200).json({
         success:true
     });
    
});

// get all users(admin wants to see)
exports.getAllUser = catchAsyncErrors( async(req,res,next) => {
    const users = await User.find();

    res.status(200).json({
        success:true,
        users,
    });
});

// get a users details (admin wants to see)
exports.getSingleUser = catchAsyncErrors(async(req,res,next)=> {
    const user =  await User.findById(req.params.id);

    if (!user) {
        return next(
          new ErrorHandler(`User does not exist with id: ${req.params.id}`)
        );
        
    }

    res.status(200).json({
        success:true,
        user,
    });
});

// Update User Role --Admin
exports.updateUserRole = catchAsyncErrors( async (req, res, next)=> {

    const newUserDate = {
        name: req.body.name,
        email:req.body.email,
        role:req.body.role
    };

   

     const user =await User.findByIdAndUpdate(req.params.id, newUserDate, {
         new: true,
         runValidators: true,
         useFindAndModify: false,
     });
     


     res.status(200).json({
         success:true
     });
    
});
// Delete User --Admin
exports.deleteUser = catchAsyncErrors( async (req, res, next)=> {

    
    const user =  await User.findById(req.params.id);
    
    // We will remove cloudinary later

    if (!user) {
        return next(
          new ErrorHandler(`User does not exist with id: ${req.params.id}`)
        );
        
    }

    await user.remove();

   


     res.status(200).json({
         success:true,
         message:"User Deleted Successfully"
     });
    
});