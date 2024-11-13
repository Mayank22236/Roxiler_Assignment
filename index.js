require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db.js");
const dataRoutes = require("./routes/dataRoutes.js");
const cors = require("cors");
const mongoose = require("mongoose");
const Product = require("./models/Product.js");

const app = express();

connectDB();
app.use(cors());
app.use(express.json());
app.use("/api", dataRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
