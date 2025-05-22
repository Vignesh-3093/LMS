import express from "express";
import { AppDataSource } from "../data-source";
import leaveRoutes from "./routes/leave";
import userRoutes from "./routes/user";
import authRoutes from "./routes/auth";
import bodyParser from "body-parser";
import adminRoutes from "./routes/admin";
import hrRoutes from "./routes/hrRoutes";
import manager from "./routes/manager";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use("/api/leave", leaveRoutes);
app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/manager", manager);

AppDataSource.initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize data source:", err);
  });
