import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "../entities/User";

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await AppDataSource.getRepository(User).find();
    return res.json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

  try {
    const user = await AppDataSource.getRepository(User).findOneBy({ id });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email, role, password } = req.body;
  if (!password) return res.status(400).json({ message: "Password required" });

  try {
    const userRepo = AppDataSource.getRepository(User);
    const newUser = userRepo.create({
      name,
      email,
      role: role || "User",
      password,
    });
    const savedUser = await userRepo.save(newUser);
    return res.status(201).json(savedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create user" });
  }
};
