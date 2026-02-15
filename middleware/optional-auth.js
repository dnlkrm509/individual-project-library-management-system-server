const dotenv = require('dotenv');
dotenv.config();
const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
  const authHeader = req.header('authorization');
  const token = authHeader?.split(' ')[1];
  
  if (!token)
    return next();

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next();
  }

  req.userId = decodedToken.userId;

  try {
    const myUser = await User.findById(req.userId);
    if (!myUser) {
      return next();
    }
    req.user = new User(myUser.email, myUser.password, myUser.borrowedItems, myUser._id);
    next();
  } catch (err) {
    console.error(err);
    return next();
  }
};
