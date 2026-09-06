const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (userId) => {
    return jwt.sign(
        {
            userId,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "30d",
        }
    );
};

// REGISTER
const register = async (req, res, next) => {
    try {
        const {
            name,
            username,
            email,
            password,
        } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({
                message: "Name, username, email and password are required",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            $or: [
                { username: normalizedUsername },
                { email: normalizedEmail },
            ],
        });

        if (existingUser) {
            if (existingUser.username === normalizedUsername) {
                return res.status(409).json({
                    message: "Username already exists",
                });
            }

            return res.status(409).json({
                message: "Email already exists",
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: name.trim(),
            username: normalizedUsername,
            email: normalizedEmail,
            passwordHash,
        });

        const token = generateToken(user._id);

        res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                bio: user.bio,
                followersCount: 0,
                followingCount: 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

// LOGIN
const login = async (req, res, next) => {
    try {
        const {
            email,
            password,
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail,
        }).select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = generateToken(user._id);

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                bio: user.bio,
                followersCount: user.followers?.length || 0,
                followingCount: user.following?.length || 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

// CURRENT LOGGED-IN USER
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("followers", "name username profilePicture")
            .populate("following", "name username profilePicture");

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        res.json({
            user,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getMe,
};