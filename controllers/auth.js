const crypto = require('crypto');

const { validationResult } = require('express-validator');

const User = require('../models/user');

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Resend = require('resend').Resend;

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

exports.postLogin = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            pageTitle: 'Login',
            path: '/login',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email,
                password
            },
            validationErrors: errors.array()
        });
    }
    
    User.findByEmail(email)
    .then(user => {
        if (!user) {
            return res.status(422).json({
                pageTitle: 'Login',
                path: '/login',
                errorMessage: 'Invalid email.',
                oldInput: {
                    email,
                    password
                },
                validationErrors: [{ path: 'email' }]
            });
        }

        bcrypt
        .compare(password, user.password)
        .then(doMatch => {
            if (doMatch) {
                const token = jwt.sign({
                        userId: user._id
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '1h' }
                );
                return res.status(200).json({ token: token, message: 'Loggedin successfully.' });
            }

            return res.status(422).json({
                pageTitle: 'Login',
                path: '/login',
                errorMessage: 'Invalid password.',
                oldInput: {
                    email,
                    password
                },
                validationErrors: [{ path: 'password' }]
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.postSignup = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            pageTitle: 'Signup',
            path: '/signup',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email,
                password,
                confirmPassword: req.body.confirmPassword
            },
            validationErrors: errors.array()
        });
    }

    bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
        const user = new User(email, hashedPassword, { resources: [] });

        return user.save();
    })
    .then(result => {
        res.status(200).json({
            message: 'User created!'
        });
        return resend.emails.send({
            to: [ email ],
            from: 'Strong Library <onboarding@resend.dev>',
            subject: 'Welcome to our Library members',
            html: '<h1>Hello</h1><p>You successfully signed up!</p>'
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.postReset = (req, res, next) => {
    const email = req.body.email;
    crypto.randomBytes(32, (err, buffer) => {
        if(err) {
            return res.status(500).json({ message: 'An error happen creating the token.' });
        }
        const token = buffer.toString('hex');
        User.findByEmail(email)
        .then(user => {
            if (!user) {
                return res.status(404).json({ message: 'No account with that email found.' });
            }
        
            const newUser = new User(user.email, user.password, user.borrowedItems, user._id.toString(), token, Date.now() + 3600000);
            return newUser.save()
        })
        .then(result => {
        res.status(200).json({ message: 'Email found, you shortly receive an email containing a reset password link.' });
        resend.emails.send({
            to: [ email ],
            from: 'Strong Library <onboarding@resend.dev>',
            subject: 'Password Reset',
            html: `
                <p>You requested password reset</p>
                <p>Click this <a href="${req.protocol}://${req.get('host')}/reset/${token}">link</a> to set a new password.</p>
            `
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
    })
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;

    User.findByPasswordToken(token)
    .then(user => {
        if (!user) {
            return res.status(404).json({ message: 'No account found.' });
        }
        res.redirect(`https://dnlkrm509.github.io/individual-project-library-management-system-client/auth/new-password.html?token=${token}&userId=${user._id.toString()}`);
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
    const userId = req.body.userId;
    const token = req.body.token;
    const password = req.body.password;

    if (!token || !userId || !password) {
        return res.status(400).json({ message: 'Invalid or missing data.' });
    }

    let resetUser;

    User.findByUserIdANDToken(userId, token)
    .then(user => {
        resetUser = user;
        return bcrypt.hash(password, 12);
    })
    .then(hashedPassword => {
        const newUser = new User(
            resetUser.email, hashedPassword, resetUser.borrowedItems,
            resetUser._id.toString(), undefined, undefined
        )
        return newUser.save();
    })
    .then(result => {
        res.status(200).json({ redirectUrl: `${req.get('origin')}/individual-project-library-management-system-client/shop/resources.html` });
        resend.emails.send({
            to: [ resetUser.email ],
            from: 'Strong Library <onboarding@resend.dev>',
            subject: 'Password Reset',
            html: `
                <p>Your password changed.</p>
            `
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};