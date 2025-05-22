import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt"; // Added bcrypt import

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

    // For now, return user info (excluding password)
    const { password: _, ...userData } = user;
    return res.json({ user: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
};
