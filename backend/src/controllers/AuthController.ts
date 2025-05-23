import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Use env for production

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const user = await AppDataSource.getRepository(User).findOneBy({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const { password: _, ...userData } = user;
    return res.json({ token, user: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
};
