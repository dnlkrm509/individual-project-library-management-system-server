const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

const mongoConnect = require('./util/database').mongoConnect;

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

dotenv.config();
const app = express();

app.use(cors({
  origin: ["https://danielk111.github.io", "http://127.0.0.1:5500", "https://dnlkrm509.github.io"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());


app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal Server Error', error: error.message });
});

mongoConnect(() => {
  app.listen(process.env.PORT || 80, () => {
    console.log('Server started on port', process.env.PORT || 80);
  });
});
