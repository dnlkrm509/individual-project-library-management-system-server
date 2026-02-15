const dotenv = require('dotenv');
dotenv.config();
const jwt = require('jsonwebtoken');

const User = require('../models/user');

module.exports = async (req, res, next) => {
  const authHeader = req.header('authorization');

  if (!authHeader)
    return res.status(401).json({ message: 'Not authenticated' });

  const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.userId = decodedToken.userId;

  try {
    const myUser = await User.findById(req.userId);
    if (!myUser) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = new User(myUser.email, myUser.password, myUser.borrowedItems, myUser._id);
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Auth error' });
  }
};
