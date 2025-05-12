const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// ===== MongoDB Connection =====
mongoose.connect("mongodb://localhost:27017/stockmgmt", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err));

// ===== Schemas =====
const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  phoneNumber: String,
  address: String,
  password: String,
});
const User = mongoose.model("User", UserSchema);

User.findOne({ email: "kowshika897@gmail.com" }).then((user) => {
  if (!user) {
    const admin = new User({
      username: "Admin",
      email: "kowshika897@gmail.com",
      phoneNumber: "0000000000",
      address: "Admin Address",
      password: bcrypt.hashSync("Kowshika@123", 10),
    });
    admin.save();
    console.log("✅ Default admin created.");
  }
});

const ProductSchema = new mongoose.Schema({
  name: String,
  type: String,
  brand: String,
  stock: Number,
  price: Number,
  imageUrl: String,
});
const Product = mongoose.model("Product", ProductSchema);

const OrderSchema = new mongoose.Schema({
  productId: String,
  productName: String,
  name: String,
  phoneNumber: String,
  address: {
    city: String,
    state: String,
    country: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    default: 'Placed'
  }
});
const Order = mongoose.model("Order", OrderSchema);

const OrderHistorySchema = new mongoose.Schema({
  name: String,
  phoneNumber: String,
  address: {
    city: String,
    state: String,
    country: String,
  },
  products: [
    {
      productId: String,
      productName: String,
      price: Number,
    }
  ],
  totalAmount: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  }
});
const OrderHistory = mongoose.model("OrderHistory", OrderHistorySchema);

// ===== User Routes =====
app.post("/api/signup", async (req, res) => {
  const { username, email, phoneNumber, address, password, confirmPassword } = req.body;
  if (!username || !email || !phoneNumber || !address || !password || !confirmPassword)
    return res.status(400).json({ message: "All fields are required" });
  if (password !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match" });

  const userExists = await User.findOne({ email });
  if (userExists) return res.status(400).json({ message: "User already exists" });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = new User({ username, email, phoneNumber, address, password: hashedPassword });
  await newUser.save();
  res.status(201).json({ message: "User created successfully!" });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const isAdmin = email === "kowshika897@gmail.com";
  res.json({
    message: "Login successful",
    isAdmin,
    username: user.username,
    email: user.email,
  });
});

// ===== Admin Routes =====
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await User.find({ email: { $ne: "kowshika897@gmail.com" } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve users" });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// ===== Product Routes =====
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to get products" });
  }
});

app.post("/api/products", async (req, res) => {
  const { name, type, brand, stock, price, imageUrl } = req.body;
  if (!name || !type || !brand || stock == null || price == null) {
    return res.status(400).json({ message: "All product fields are required" });
  }
  const newProduct = new Product({ name, type, brand, stock, price, imageUrl });
  try {
    await newProduct.save();
    res.status(201).json({ message: "Product added successfully" });
  } catch (err) {
    res.status(400).json({ message: "Error adding product" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, type, brand, stock, price, imageUrl } = req.body;
  try {
    const updated = await Product.findByIdAndUpdate(id, {
      name, type, brand, stock, price, imageUrl
    }, { new: true });
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product updated successfully", product: updated });
  } catch (err) {
    res.status(400).json({ message: "Error updating product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Error deleting product" });
  }
});

// ===== Order Routes =====
app.post('/api/orders', async (req, res) => {
  const { productId, name, phoneNumber, address } = req.body;
  if (!productId || !name || !phoneNumber || !address) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.stock < 1) {
      return res.status(400).json({ message: 'Product out of stock' });
    }

    const newOrder = new Order({
      productId,
      productName: product.name,
      name,
      phoneNumber,
      address,
    });

    await newOrder.save();

    product.stock -= 1;
    await product.save();

    res.status(201).json({ message: 'Order placed successfully' });
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ message: 'Failed to place order' });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving orders" });
  }
});

app.put('/api/orders/cancel/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'Cancelled') return res.status(400).json({ message: 'Order is already canceled' });

    order.status = 'Cancelled';
    await order.save();

    // Optional: Restock the product
    await Product.findByIdAndUpdate(order.productId, { $inc: { stock: 1 } });

    res.status(200).json({ message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('Error canceling order:', err);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

// ===== Finalized Order History (Bill Generation) =====
app.post("/api/orderhistory", async (req, res) => {
  try {
    const { products, name, phoneNumber, address, totalAmount, createdAt } = req.body;
    const newBill = new OrderHistory({
      products,
      name,
      phoneNumber,
      address,
      totalAmount,
      createdAt,
    });
    await newBill.save();
    res.status(201).json({ message: "Bill generated and saved successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate bill" });
  }
});

app.get("/api/order-history", async (req, res) => {
  try {
    const bills = await OrderHistory.find();
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving bills" });
  }
});

// ===== Analytics Routes =====
app.get("/api/analytics/total-stock", async (req, res) => {
  try {
    const result = await Product.aggregate([
      { $group: { _id: null, totalStock: { $sum: "$stock" } } },
    ]);
    res.json({ totalStock: result[0]?.totalStock || 0 });
  } catch (err) {
    res.status(500).json({ message: "Error calculating total stock" });
  }
});

app.get("/api/analytics/stock-by-type", async (req, res) => {
  try {
    const result = await Product.aggregate([
      { $group: { _id: "$type", totalStock: { $sum: "$stock" } } },
      { $sort: { totalStock: -1 } },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Error getting stock by type" });
  }
});

app.get("/api/analytics/low-stock", async (req, res) => {
  try {
    const result = await Product.find({ stock: { $lt: 20 } });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Error getting low stock items" });
  }
});

app.get("/api/analytics/top-stocked", async (req, res) => {
  try {
    const result = await Product.find().sort({ stock: -1 }).limit(5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Error getting top stocked products" });
  }
});

app.get("/api/analytics/avg-price-by-type", async (req, res) => {
  try {
    const result = await Product.aggregate([
      { $group: { _id: "$type", avgPrice: { $avg: "$price" } } },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Error calculating average prices" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
