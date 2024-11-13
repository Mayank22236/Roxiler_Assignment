const axios = require("axios");
const Product = require("../models/Product");
const mongoose = require("mongoose");

exports.initializeDatabase = async (req, res) => {
  try {
    const response = await axios.get(
      "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
    );
    const products = response.data;

    await Product.deleteMany({});
    await Product.insertMany(products);

    res.status(200).json({ message: "Database initialized with seed data" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to initialize database", details: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  const { page = 1, perPage = 10, search = "", month } = req.query;

  console.log(req.query);

  const monthNumber = new Date(Date.parse(month + " 1, 2022")).getMonth() + 1;

  const query = {
    ...(search && {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { price: parseFloat(search) || 0 },
      ],
    }),
    ...(month && { dateOfSale: { $month: monthNumber } }),
  };

  const products = await Product.find(query)
    .skip((page - 1) * perPage)
    .limit(parseInt(perPage));

  res.json(products);
};

//getStatistics function
exports.getStatistics = async (req, res) => {
  const month = parseInt(req.query.month); // Ensure month is an integer
  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Invalid month" });
  }

  try {
    const totalSaleAmount = await Product.aggregate([
      {
        $match: {
          $expr: { $eq: [{ $month: "$dateOfSale" }, month] },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$price" },
        },
      },
    ]);

    const soldItemsCount = await Product.countDocuments({
      sold: true,
      $expr: { $eq: [{ $month: "$dateOfSale" }, month] },
    });

    const notSoldItemsCount = await Product.countDocuments({
      sold: false,
      $expr: { $eq: [{ $month: "$dateOfSale" }, month] },
    });

    res.json({
      totalSaleAmount: totalSaleAmount[0]?.totalAmount || 0,
      soldItemsCount,
      notSoldItemsCount,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error.message);
    res.status(500).json({ message: "Error fetching statistics" });
  }
};

exports.getBarChart = async (req, res) => {
  const month = parseInt(req.query.month);

  // Validate the month parameter
  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Invalid month" });
  }

  try {
    const priceRanges = [
      { min: 0, max: 100 },
      { min: 101, max: 200 },
      { min: 201, max: 300 },
      { min: 301, max: 400 },
      { min: 401, max: 500 },
      { min: 501, max: 600 },
      { min: 601, max: 700 },
      { min: 701, max: 800 },
      { min: 801, max: 900 },
      { min: 901, max: Infinity },
    ];

    const barChartData = await Promise.all(
      priceRanges.map(async (range) => {
        const count = await Product.countDocuments({
          price: {
            $gte: range.min,
            $lt: range.max === Infinity ? undefined : range.max,
          },
          $expr: { $eq: [{ $month: "$dateOfSale" }, month] },
        });

        return {
          range: `${range.min}-${range.max === Infinity ? "above" : range.max}`,
          count,
        };
      })
    );

    res.json(barChartData);
  } catch (error) {
    console.error("Error fetching bar chart data:", error.message);
    res.status(500).json({ message: "Error fetching bar chart data" });
  }
};

exports.getPieChart = async (req, res) => {
  const month = parseInt(req.query.month);

  // Validate the month parameter
  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Invalid month" });
  }

  try {
    const startOfMonth = new Date(`2023-${month}-01`);
    const endOfMonth = new Date(`2023-${month + 1}-01`);

    const pieChartData = await Product.aggregate([
      { $match: { dateOfSale: { $gte: startOfMonth, $lt: endOfMonth } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]);

    res.json(pieChartData);
  } catch (error) {
    console.error("Error fetching pie chart data:", error.message);
    res.status(500).json({ message: "Error fetching pie chart data" });
  }
};

exports.getCombinedData = async (req, res) => {
  const month = parseInt(req.query.month);

  // Validate the month parameter
  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Invalid month" });
  }

  try {
    // Fetch statistics data
    const statisticsData = await Product.aggregate([
      { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$price" },
          soldItems: { $sum: { $cond: [{ $eq: ["$isSold", true] }, 1, 0] } },
          notSoldItems: {
            $sum: { $cond: [{ $eq: ["$isSold", false] }, 1, 0] },
          },
        },
      },
      { $project: { totalSales: 1, soldItems: 1, notSoldItems: 1, _id: 0 } },
    ]);

    // Fetch bar chart data
    const barChartData = await Product.aggregate([
      { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } } },
      {
        $bucket: {
          groupBy: "$price",
          boundaries: [
            0,
            100,
            200,
            300,
            400,
            500,
            600,
            700,
            800,
            900,
            Infinity,
          ],
          default: "901-above",
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    // Fetch pie chart data
    const pieChartData = await Product.aggregate([
      { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]);

    // Combine all results
    const combined = {
      statistics: statisticsData[0] || {},
      barchart: barChartData,
      piechart: pieChartData,
    };

    res.json(combined);
  } catch (error) {
    console.error("Error fetching combined data:", error.message);
    res.status(500).json({ message: "Error fetching combined data" });
  }
};
