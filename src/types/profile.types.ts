import { Models } from "appwrite";

export type UserRole = "user" | "admin";

type ProfileBase = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  hasBusinessProfile: boolean;
  role: UserRole;
};

export type Profile = Models.Document & ProfileBase;

