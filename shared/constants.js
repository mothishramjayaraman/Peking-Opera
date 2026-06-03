import { z } from "zod";

export const phases = [
  {
    id: 1,
    name: "基础功 (Jingju Foundation)",
    description: "Build authentic Peking Opera vocal foundations: 丹田 breath, 咬字归韵, pentatonic pitch, and 旦角/生角 voice introduction",
    features: [
      "丹田 breath support training",
      "咬字归韵 articulation drills",
      "Pentatonic scale vocalization",
      "旦角 and 生角 voice introduction",
      "韵白 recitative and 拖腔 basics",
    ],
    unlockCriteria: "Start your Jingju journey",
  },
  {
    id: 2,
    name: "行腔技法 (Phrasing & Technique)",
    description: "Develop advanced 行腔, 二黄/西皮 melodic systems, 花腔 ornamentation, and dramatic character expression",
    features: [
      "Classic 唱段 (aria) recommendations",
      "二黄 and 西皮 melodic systems",
      "花腔 ornamentation and 快板 speed",
      "戏剧内心独白 (dramatic subtext)",
      "声调配合 (tone-melody alignment)",
    ],
    unlockCriteria: "Complete Phase 1 and pass Phase Test",
  },
  {
    id: 3,
    name: "舞台演绎 (Stage Performance)",
    description: "Master 京剧大戏院 stage presence, 亮相 entrance, 二胡 ensemble awareness, and 神韵 character embodiment",
    features: [
      "Virtual 京剧大戏院 simulator",
      "叫好 audience reactions",
      "身段 gesture + voice integration",
      "二胡 ensemble coordination",
      "竞技级 competition-level analysis",
    ],
    unlockCriteria: "Complete Phase 2 and pass Phase Test",
  },
];

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*(),.?\":{}|<>]/,
    "Password must contain at least one special character",
  );

export const insertUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  googleId: z.string().optional(),
  vocalRange: z.string().optional(),
});
