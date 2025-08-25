const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


async function registerUser(req, res) {
    try {
        const { email, password, fullName } = req.body;

        if (!email || !password || !fullName?.firstName || !fullName?.lastName) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const isUserAlreadyExists = await userModel.findOne({ email });
        if (isUserAlreadyExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const user = await userModel.create({
            fullName: {
                firstName: fullName.firstName,
                lastName: fullName.lastName
            },
            email,
            password: hashPassword
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // dev ke liye
            sameSite: "lax"
        });

        res.status(201).json({
            message: "User registered successfully",
            user: {
                email: user.email,
                _id: user._id,
                fullName: user.fullName
            }
        });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function loginUser(req, res) {

    const { email, password } = req.body;

    const user = await userModel.findOne({
        email
    })

    if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);


    if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);


    res.cookie("token", token);


    res.status(200).json({
        message: "user logged in successfully",
        user: {
            email: user.email,
            _id: user._id,
            fullName: user.fullName
        }
    })

}


module.exports = {
    registerUser,
    loginUser
}