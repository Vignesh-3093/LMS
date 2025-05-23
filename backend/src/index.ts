/// <reference types="./types/express" />
import express from "express";
import { AppDataSource } from "../data-source";
import leaveRoutes from "./routes/leave";
import userRoutes from "./routes/user";
import authRoutes from "./routes/auth";
import bodyParser from "body-parser";
import adminRoutes from "./routes/admin";
import hrRoutes from "./routes/hrRoutes";
import manager from "./routes/manager";
import employeeRouter from "./routes/employee";
import dashboardRoutes from './routes/dashboard';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use("/api/leave", leaveRoutes);
app.use("/api", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/manager", manager);
app.use("/api/employee", employeeRouter);
app.use('/api/dashboard', dashboardRoutes);

AppDataSource.initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize data source:", err);
  });
