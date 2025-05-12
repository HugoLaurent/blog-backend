const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const { MONGO_DB_USERNAME, MONGO_DB_PASSWORD, MONGO_DB_NAME, JWT_SECRET } =
  process.env;

// 🔌 Connexion MongoDB
mongoose
  .connect(
    `mongodb+srv://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@shkapi.buq4jhk.mongodb.net/${MONGO_DB_NAME}?retryWrites=true&w=majority`
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error:", err));

// 📦 MODELS
const Product = mongoose.model("Product", {
  name: String,
  description: String,
  price: Number,
  image: String,
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", {
  userId: mongoose.Schema.Types.ObjectId,
  products: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      quantity: Number,
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", {
  username: String,
  password: String,
});

// 🛒 ROUTES PRODUITS
app.get("/products", async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

app.post("/products", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token manquant" });

  try {
    jwt.verify(token, JWT_SECRET); // Auth only
    const { name, description, price, image } = req.body;
    const newProduct = new Product({ name, description, price, image });
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(401).json({ error: "Token invalide" });
  }
});

// 🧾 ROUTES COMMANDES
app.post("/orders", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token manquant" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { products } = req.body;
    const order = new Order({
      userId: decoded.id,
      products,
    });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(401).json({ error: "Token invalide" });
  }
});

app.get("/orders", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token manquant" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orders = await Order.find({ userId: decoded.id }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (err) {
    res.status(401).json({ error: "Token invalide" });
  }
});

// 👤 AUTH
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "Username and password are required" });

  try {
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    res
      .status(201)
      .json({ message: "User registered", user: { username: user.username } });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "Username and password are required" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );

    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/products/seed", async (req, res) => {
  const sampleProducts = [
    {
      name: "Chaussures sport",
      description: "Confort ultime pour vos séances de course.",
      price: 89.99,
      image: "https://placehold.co/600x400?text=Chaussures+sport",
    },
    {
      name: "Montre connectée",
      description: "Gardez un œil sur vos performances.",
      price: 149.99,
      image: "https://placehold.co/600x400?text=Montre+connectée",
    },
    {
      name: "Sac à dos urbain",
      description: "Style et praticité pour le quotidien.",
      price: 59.99,
      image: "https://placehold.co/600x400?text=Sac+à+dos+urbain",
    },
    {
      name: "Casque Bluetooth",
      description: "Son immersif sans fil.",
      price: 119.99,
      image: "https://placehold.co/600x400?text=Casque+Bluetooth",
    },
  ];

  try {
    const inserted = await Product.insertMany(sampleProducts);
    res.status(201).json({ message: "Produits insérés", products: inserted });
  } catch (err) {
    console.error("Erreur d'insertion :", err);
    res.status(500).json({ error: "Erreur lors de l'insertion des produits" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 E-commerce API listening on port ${PORT}`)
);
