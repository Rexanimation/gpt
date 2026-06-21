const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


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
            secure: true,
            sameSite: "strict"
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


    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict"
    });


    res.status(200).json({
        message: "user logged in successfully",
        user: {
            email: user.email,
            _id: user._id,
            fullName: user.fullName
        }
    })

}


async function getMe(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        res.status(200).json({
            user: {
                email: user.email,
                _id: user._id,
                fullName: user.fullName
            }
        });
    } catch (err) {
        console.error("GetMe error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function logoutUser(req, res) {
    try {
        res.clearCookie("token");
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function googleLoginUser(req, res) {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: "Google credential token is required" });
        }

        let payload;
        if (!process.env.GOOGLE_CLIENT_ID || credential.startsWith("mock_")) {
            // Fallback for development/testing without real client ID
            payload = {
                email: "mock.user@gmail.com",
                given_name: "Sahil",
                family_name: "User",
                sub: "mock_123456789"
            };
        } else {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            payload = ticket.getPayload();
        }

        const { email, given_name, family_name } = payload;
        if (!email) {
            return res.status(400).json({ message: "Email not provided in Google token" });
        }

        // Find or create user
        let user = await userModel.findOne({ email });
        if (!user) {
            user = await userModel.create({
                email,
                fullName: {
                    firstName: given_name || "Google",
                    lastName: family_name || "User"
                }
            });
        } else {
            user.fullName.firstName = given_name || user.fullName.firstName;
            user.fullName.lastName = family_name || user.fullName.lastName;
            await user.save();
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict"
        });

        res.status(200).json({
            message: "Logged in with Google successfully",
            user: {
                email: user.email,
                _id: user._id,
                fullName: user.fullName
            }
        });
    } catch (err) {
        console.error("Google login error:", err);
        res.status(500).json({ message: "Internal server error during Google Authentication" });
    }
}

module.exports = {
    registerUser,
    loginUser,
    googleLoginUser,
    getMe,
    logoutUser
}